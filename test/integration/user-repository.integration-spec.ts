import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { AuthenticationSource } from '../../src/modules/users/domain/authentication-source.enum';
import { UserEntity } from '../../src/modules/users/infrastructure/entities/user.entity';
import { TypeOrmUserRepository } from '../../src/modules/users/infrastructure/typeorm-user.repository';
import { UserMapper } from '../../src/modules/users/infrastructure/user.mapper';
import { createTestDataSource } from '../helpers/test-database';

describe('TypeOrmUserRepository (intégration)', () => {
  let dataSource: DataSource;
  let entityRepository: Repository<UserEntity>;
  let repository: TypeOrmUserRepository;
  const createdEmails: string[] = [];

  /** Fabrique un e-mail unique : les suites restent indépendantes. */
  const uniqueEmail = (): string => {
    const email = `it-user-${randomUUID()}@test.dev`;
    createdEmails.push(email);
    return email;
  };

  const insertUser = async (email: string): Promise<UserEntity> =>
    entityRepository.save(
      entityRepository.create({
        email,
        displayName: 'Utilisateur de test',
        passwordHash: 'hash-de-test',
        authenticationSource: AuthenticationSource.Local,
        isActive: true,
      }),
    );

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    entityRepository = dataSource.getRepository(UserEntity);
    repository = new TypeOrmUserRepository(entityRepository, new UserMapper());
  });

  afterAll(async () => {
    // Nettoyage : suppression physique des utilisateurs créés par la suite.
    if (createdEmails.length > 0) {
      await entityRepository
        .createQueryBuilder()
        .delete()
        .where('email IN (:...emails)', { emails: createdEmails })
        .execute();
    }
    await dataSource.destroy();
  });

  it('persiste et relit un utilisateur par e-mail', async () => {
    const email = uniqueEmail();
    await insertUser(email);

    const found = await repository.findByEmail(email);

    expect(found).not.toBeNull();
    expect(found!.email).toBe(email);
    expect(found!.canAuthenticateLocally()).toBe(true);
    expect(found!.createdAt).toBeInstanceOf(Date);
  });

  it("applique la contrainte d'unicité de l'e-mail", async () => {
    const email = uniqueEmail();
    await insertUser(email);

    await expect(insertUser(email)).rejects.toThrow(QueryFailedError);
  });

  it('exclut les utilisateurs supprimés logiquement (soft delete)', async () => {
    const email = uniqueEmail();
    const entity = await insertUser(email);

    await entityRepository.softDelete({ id: entity.id });

    // Les recherches standard ne voient plus l'utilisateur...
    await expect(repository.findByEmail(email)).resolves.toBeNull();
    await expect(repository.findById(entity.id)).resolves.toBeNull();

    // ... mais la ligne existe toujours physiquement avec deleted_at.
    const rawEntity = await entityRepository.findOne({
      where: { id: entity.id },
      withDeleted: true,
    });
    expect(rawEntity).not.toBeNull();
    expect(rawEntity!.deletedAt).toBeInstanceOf(Date);
  });

  it('met à jour last_login_at', async () => {
    const email = uniqueEmail();
    const entity = await insertUser(email);
    const loginDate = new Date('2026-07-14T10:00:00.000Z');

    await repository.updateLastLoginAt(entity.id, loginDate);

    const found = await repository.findById(entity.id);
    expect(found!.lastLoginAt).toBeInstanceOf(Date);
    expect(found!.lastLoginAt!.getTime()).toBe(loginDate.getTime());
  });
});
