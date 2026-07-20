import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogsTable1784027513208 implements MigrationInterface {
  name = 'CreateAuditLogsTable1784027513208';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_1bb179d048bbc581caa3b013439" DEFAULT NEWSEQUENTIALID(), "created_at" datetime2 NOT NULL CONSTRAINT "DF_2cd10fda8276bb995288acfbfb1" DEFAULT getdate(), "category" nvarchar(20) NOT NULL, "action" nvarchar(100) NOT NULL, "actor_user_id" uniqueidentifier, "resource_type" nvarchar(100), "resource_id" nvarchar(100), "request_id" nvarchar(64), "ip_address" nvarchar(45), "user_agent" nvarchar(500), "metadata" nvarchar(MAX), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_category" ON "audit_logs" ("category") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_actor_user_id" ON "audit_logs" ("actor_user_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_audit_logs_actor_user_id" ON "audit_logs"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_audit_logs_action" ON "audit_logs"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_audit_logs_category" ON "audit_logs"`,
    );
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
