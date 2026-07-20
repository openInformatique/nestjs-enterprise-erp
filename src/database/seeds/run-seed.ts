import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import dataSource from '../data-source';
import { AuditLogEntity } from '../../modules/audit/infrastructure/entities/audit-log.entity';
import { AuditCategory } from '../../modules/audit/domain/audit-category.enum';
import { UserEntity } from '../../modules/users/infrastructure/entities/user.entity';
import { AuthenticationSource } from '../../modules/users/domain/authentication-source.enum';

/**
 * Seeder technique du socle.
 *
 * Insère uniquement des données de démonstration techniques :
 *   - un administrateur local de développement ;
 *   - un utilisateur local standard ;
 *   - quelques audit logs de démonstration.
 *
 * Aucune session n'est semée : une session de démonstration exigerait de
 * fabriquer de faux hashes de refresh token sans valeur pédagogique.
 *
 * Idempotence : les utilisateurs sont recherchés par e-mail avant insertion,
 * les audit logs de démonstration ne sont insérés qu'une seule fois.
 *
 * Mots de passe : JAMAIS codés en dur. Ils proviennent des variables
 * SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD ; à défaut, un mot de passe
 * aléatoire est généré et affiché en console (environnements local et
 * test uniquement, seuls environnements gérés par le socle).
 *
 * Usage : npm run seed  |  npm run seed:test
 */

interface UserSeed {
  email: string;
  displayName: string;
  passwordEnvVariable: string;
}

const USER_SEEDS: UserSeed[] = [
  {
    email: 'admin@local.dev',
    displayName: 'Administrateur local',
    passwordEnvVariable: 'SEED_ADMIN_PASSWORD',
  },
  {
    email: 'user@local.dev',
    displayName: 'Utilisateur de démonstration',
    passwordEnvVariable: 'SEED_USER_PASSWORD',
  },
];

/**
 * Résout le mot de passe d'un utilisateur semé : variable d'environnement
 * dédiée, sinon génération aléatoire affichée une seule fois en console.
 */
function resolvePassword(seed: UserSeed): string {
  const fromEnvironment = process.env[seed.passwordEnvVariable];
  if (fromEnvironment && fromEnvironment.trim() !== '') {
    return fromEnvironment;
  }
  const generated = randomBytes(12).toString('base64url');
  console.log(
    `ℹ ${seed.passwordEnvVariable} non défini : mot de passe généré pour ` +
      `${seed.email} → ${generated}`,
  );
  return generated;
}

async function seed(): Promise<void> {
  await dataSource.initialize();

  try {
    const userRepository = dataSource.getRepository(UserEntity);
    const auditLogRepository = dataSource.getRepository(AuditLogEntity);

    // --- Utilisateurs techniques -------------------------------------------
    for (const userSeed of USER_SEEDS) {
      const existing = await userRepository.findOne({
        where: { email: userSeed.email },
        withDeleted: true,
      });

      if (existing) {
        console.log(`✔ Utilisateur ${userSeed.email} déjà présent, ignoré.`);
        continue;
      }

      const password = resolvePassword(userSeed);
      // Argon2id : algorithme recommandé pour le hachage de mots de passe.
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
      });

      await userRepository.save(
        userRepository.create({
          email: userSeed.email,
          displayName: userSeed.displayName,
          passwordHash,
          authenticationSource: AuthenticationSource.Local,
          isActive: true,
        }),
      );
      console.log(`✔ Utilisateur ${userSeed.email} créé.`);
    }

    // --- Audit logs de démonstration ----------------------------------------
    const demoAction = 'seed.demo-data.inserted';
    const demoAlreadySeeded = await auditLogRepository.exists({
      where: { action: demoAction },
    });

    if (demoAlreadySeeded) {
      console.log('✔ Audit logs de démonstration déjà présents, ignorés.');
    } else {
      const admin = await userRepository.findOne({
        where: { email: 'admin@local.dev' },
      });

      await auditLogRepository.save([
        auditLogRepository.create({
          category: AuditCategory.Technical,
          action: demoAction,
          actorUserId: admin?.id ?? null,
          resourceType: 'seed',
          resourceId: null,
          requestId: null,
          ipAddress: null,
          userAgent: 'seeder',
          metadata: JSON.stringify({ source: 'run-seed.ts' }),
        }),
        auditLogRepository.create({
          category: AuditCategory.Security,
          action: 'seed.demo-security-event',
          actorUserId: admin?.id ?? null,
          resourceType: 'user',
          resourceId: admin?.id ?? null,
          requestId: null,
          ipAddress: null,
          userAgent: 'seeder',
          metadata: JSON.stringify({
            note: 'Événement de démonstration du journal d’audit.',
          }),
        }),
      ]);
      console.log('✔ Audit logs de démonstration insérés.');
    }
  } finally {
    await dataSource.destroy();
  }
}

seed()
  .then(() => {
    console.log('Seed terminé.');
  })
  .catch((error: unknown) => {
    console.error('Échec du seed :', error);
    process.exit(1);
  });
