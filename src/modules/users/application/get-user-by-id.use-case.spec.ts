import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { AuthenticationSource } from '../domain/authentication-source.enum';
import { User } from '../domain/user';
import { UserRepositoryPort } from '../domain/user-repository.port';
import { GetUserByIdUseCase } from './get-user-by-id.use-case';

const existingUser = new User(
  'id-1',
  'admin@local.dev',
  'Administrateur',
  'hash',
  AuthenticationSource.Local,
  true,
  null,
  new Date(),
  new Date(),
  null,
);

describe('GetUserByIdUseCase', () => {
  const repository: UserRepositoryPort = {
    findById: (id: string) =>
      Promise.resolve(id === 'id-1' ? existingUser : null),
    findByEmail: () => Promise.resolve(null),
    updateLastLoginAt: () => Promise.resolve(),
  };
  const useCase = new GetUserByIdUseCase(repository);

  it("renvoie l'utilisateur lorsqu'il existe", async () => {
    await expect(useCase.execute('id-1')).resolves.toBe(existingUser);
  });

  it('lève RESOURCE_NOT_FOUND pour un identifiant inconnu', async () => {
    await expect(useCase.execute('id-inconnu')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});
