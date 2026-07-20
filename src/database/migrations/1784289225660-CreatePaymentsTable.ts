import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentsTable1784289225660 implements MigrationInterface {
  name = 'CreatePaymentsTable1784289225660';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_197ab7af18c93fbb0c9b28b4a59" DEFAULT NEWSEQUENTIALID(), "created_at" datetime2 NOT NULL CONSTRAINT "DF_1237daf748b7653a6ebb9492fe4" DEFAULT getdate(), "invoice_id" uniqueidentifier NOT NULL, "amount" decimal(12,2) NOT NULL, "method" nvarchar(15) NOT NULL, "reference" nvarchar(100), "notes" nvarchar(500), "paid_at" datetime2 NOT NULL, "recorded_by" uniqueidentifier NOT NULL, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_payments_invoice" ON "payments" ("invoice_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_payments_paid_at" ON "payments" ("paid_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_563a5e248518c623eebd987d43e" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_563a5e248518c623eebd987d43e"`,
    );
    await queryRunner.query(`DROP INDEX "IX_payments_paid_at" ON "payments"`);
    await queryRunner.query(`DROP INDEX "IX_payments_invoice" ON "payments"`);
    await queryRunner.query(`DROP TABLE "payments"`);
  }
}
