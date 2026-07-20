import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1784027207618 implements MigrationInterface {
  name = 'CreateUsersTable1784027207618';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_a3ffb1c0c8416b9fc6f907b7433" DEFAULT NEWSEQUENTIALID(), "created_at" datetime2 NOT NULL CONSTRAINT "DF_c9b5b525a96ddc2c5647d7f7fa5" DEFAULT getdate(), "updated_at" datetime2 NOT NULL CONSTRAINT "DF_6d596d799f9cb9dac6f7bf7c23c" DEFAULT getdate(), "deleted_at" datetime2, "created_by" uniqueidentifier, "updated_by" uniqueidentifier, "email" nvarchar(320) NOT NULL, "display_name" nvarchar(200) NOT NULL, "password_hash" nvarchar(500), "authentication_source" nvarchar(20) NOT NULL CONSTRAINT "DF_f124aa82b73eab7338ce144c8b4" DEFAULT 'LOCAL', "is_active" bit NOT NULL CONSTRAINT "DF_20c7aea6112bef71528210f631d" DEFAULT 1, "last_login_at" datetime2, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_users_email" ON "users"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
