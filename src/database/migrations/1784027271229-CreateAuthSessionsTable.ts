import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthSessionsTable1784027271229 implements MigrationInterface {
  name = 'CreateAuthSessionsTable1784027271229';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "auth_sessions" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_641507381f32580e8479efc36cd" DEFAULT NEWSEQUENTIALID(), "user_id" uniqueidentifier NOT NULL, "refresh_token_hash" nvarchar(500) NOT NULL, "token_family_id" uniqueidentifier NOT NULL, "user_agent" nvarchar(500), "ip_address" nvarchar(45), "last_used_at" datetime2, "expires_at" datetime2 NOT NULL, "revoked_at" datetime2, "revocation_reason" nvarchar(100), "created_at" datetime2 NOT NULL CONSTRAINT "DF_60c2b21c37d79572f92da3476dc" DEFAULT getdate(), "updated_at" datetime2 NOT NULL CONSTRAINT "DF_46ab036699db960a12d34aad2b9" DEFAULT getdate(), CONSTRAINT "PK_641507381f32580e8479efc36cd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_user_id" ON "auth_sessions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_token_family_id" ON "auth_sessions" ("token_family_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_expires_at" ON "auth_sessions" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_revoked_at" ON "auth_sessions" ("revoked_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" ADD CONSTRAINT "FK_50ccaa6440288a06f0ba693ccc6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" DROP CONSTRAINT "FK_50ccaa6440288a06f0ba693ccc6"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_auth_sessions_revoked_at" ON "auth_sessions"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_auth_sessions_expires_at" ON "auth_sessions"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_auth_sessions_token_family_id" ON "auth_sessions"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_auth_sessions_user_id" ON "auth_sessions"`,
    );
    await queryRunner.query(`DROP TABLE "auth_sessions"`);
  }
}
