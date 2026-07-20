import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoleToUsers1784186166854 implements MigrationInterface {
  name = 'AddRoleToUsers1784186166854';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Contrainte DEFAULT nommée : indispensable pour pouvoir la
    // supprimer proprement dans down() (SQL Server).
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" nvarchar(20) NOT NULL ` +
        `CONSTRAINT "DF_users_role" DEFAULT 'EMPLOYEE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "DF_users_role"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
  }
}
