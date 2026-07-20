import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvoicesTables1784272716542 implements MigrationInterface {
  name = 'CreateInvoicesTables1784272716542';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "invoices" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_668cef7c22a427fd822cc1be3ce" DEFAULT NEWSEQUENTIALID(), "created_at" datetime2 NOT NULL CONSTRAINT "DF_ea238a6937c1ab144a3820c7371" DEFAULT getdate(), "updated_at" datetime2 NOT NULL CONSTRAINT "DF_2ff2b0646f54340b6190283ba15" DEFAULT getdate(), "deleted_at" datetime2, "created_by" uniqueidentifier, "updated_by" uniqueidentifier, "number" nvarchar(20) NOT NULL, "type" nvarchar(12) NOT NULL, "customer_id" uniqueidentifier NOT NULL, "order_id" uniqueidentifier, "status" nvarchar(15) NOT NULL, "issue_date" datetime2 NOT NULL, "due_date" datetime2 NOT NULL, "total_ht" decimal(12,2) NOT NULL, "total_vat" decimal(12,2) NOT NULL, "total_ttc" decimal(12,2) NOT NULL, "paid_amount" decimal(12,2) NOT NULL CONSTRAINT "DF_9a7476edf4ae5f7620f83d0be36" DEFAULT 0, "credit_note_for_id" uniqueidentifier, "pdf_url" nvarchar(500), "notes" nvarchar(2000), CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_invoices_number" ON "invoices" ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_invoices_type" ON "invoices" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_invoices_customer" ON "invoices" ("customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_invoices_status" ON "invoices" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_invoices_due_date" ON "invoices" ("due_date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "invoice_lines" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_3d18eb48142b916f581f0c21a65" DEFAULT NEWSEQUENTIALID(), "invoice_id" uniqueidentifier NOT NULL, "product_id" uniqueidentifier, "position" int NOT NULL, "description" nvarchar(500) NOT NULL, "quantity" decimal(12,2) NOT NULL, "unit_price" decimal(12,2) NOT NULL, "vat_rate" decimal(5,2) NOT NULL CONSTRAINT "DF_809f22befb0bb14f5b7d47effe6" DEFAULT 20, "subtotal_ht" decimal(12,2) NOT NULL, CONSTRAINT "PK_3d18eb48142b916f581f0c21a65" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_invoice_lines_invoice" ON "invoice_lines" ("invoice_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_65e3145f317bd655481d3f96c74" FOREIGN KEY ("customer_id") REFERENCES "contacts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_ea83c3b911906a3578de2340fdf" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_845452165dd28faa1f05d51c47f" FOREIGN KEY ("credit_note_for_id") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_lines" ADD CONSTRAINT "FK_2da95dc86a54a00ff20ce46d0fe" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_lines" ADD CONSTRAINT "FK_975593df931842435a9c6979c55" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoice_lines" DROP CONSTRAINT "FK_975593df931842435a9c6979c55"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_lines" DROP CONSTRAINT "FK_2da95dc86a54a00ff20ce46d0fe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_845452165dd28faa1f05d51c47f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_ea83c3b911906a3578de2340fdf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_65e3145f317bd655481d3f96c74"`,
    );
    await queryRunner.query(
      `DROP INDEX "IX_invoice_lines_invoice" ON "invoice_lines"`,
    );
    await queryRunner.query(`DROP TABLE "invoice_lines"`);
    await queryRunner.query(`DROP INDEX "IX_invoices_due_date" ON "invoices"`);
    await queryRunner.query(`DROP INDEX "IX_invoices_status" ON "invoices"`);
    await queryRunner.query(`DROP INDEX "IX_invoices_customer" ON "invoices"`);
    await queryRunner.query(`DROP INDEX "IX_invoices_type" ON "invoices"`);
    await queryRunner.query(`DROP INDEX "UQ_invoices_number" ON "invoices"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
  }
}
