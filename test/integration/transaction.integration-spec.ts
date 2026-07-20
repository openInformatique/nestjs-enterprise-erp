import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { TransactionService } from '../../src/database/transaction/transaction.service';
import { AuthenticationSource } from '../../src/modules/users/domain/authentication-source.enum';
import { UserEntity } from '../../src/modules/users/infrastructure/entities/user.entity';
import { createTestDataSource } from '../helpers/test-database';

describe('TransactionService (intégration)', () => {
  let dataSource: DataSource;
  let service: TransactionService;
  const createdEmails: string[] = [];

  const uniqueEmail = (): string => {
    const email = `it-tx-${randomUUID()}@test.dev`;
    createdEmails.push(email);
    return email;
  };

  const buildUser = (email: string): Partial<UserEntity> => ({
    email,
    displayName: 'Utilisateur transaction',
    passwordHash: 'hash',
    authenticationSource: AuthenticationSource.Local,
    isActive: true,
  });

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    service = new TransactionService(dataSource);
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await dataSource
        .getRepository(UserEntity)
        .createQueryBuilder()
        .delete()
        .where('email IN (:...emails)', { emails: createdEmails })
        .execute();
    }
    await dataSource.destroy();
  });

  it('commit : les écritures de la transaction sont persistées', async () => {
    const email1 = uniqueEmail();
    const email2 = uniqueEmail();

    await service.execute(async (manager) => {
      await manager.save(manager.create(UserEntity, buildUser(email1)));
      await manager.save(manager.create(UserEntity, buildUser(email2)));
    });

    const repository = dataSource.getRepository(UserEntity);
    await expect(
      repository.findOne({ where: { email: email1 } }),
    ).resolves.not.toBeNull();
    await expect(
      repository.findOne({ where: { email: email2 } }),
    ).resolves.not.toBeNull();
  });

  it('rollback : une exception annule TOUTES les écritures', async () => {
    const email = uniqueEmail();

    await expect(
      service.execute(async (manager) => {
        await manager.save(manager.create(UserEntity, buildUser(email)));
        throw new Error('échec volontaire après la première écriture');
      }),
    ).rejects.toThrow('échec volontaire');

    // La ligne écrite avant l'exception ne doit PAS exister.
    await expect(
      dataSource.getRepository(UserEntity).findOne({ where: { email } }),
    ).resolves.toBeNull();
  });

  it('propage la valeur de retour du travail transactionnel', async () => {
    const result = await service.execute((manager) =>
      manager.query<Array<{ answer: number }>>('SELECT 42 AS answer'),
    );

    expect(result).toEqual([{ answer: 42 }]);
  });
});
