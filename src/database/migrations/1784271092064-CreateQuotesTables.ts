import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuotesTables1784271092064 implements MigrationInterface {
  name = 'CreateQuotesTables1784271092064';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "quotes" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_99a0e8bcbcd8719d3a41f23c263" DEFAULT NEWSEQUENTIALID(), "created_at" datetime2 NOT NULL CONSTRAINT "DF_f2d0db8ce3af5ac77786282fdd4" DEFAULT getdate(), "updated_at" datetime2 NOT NULL CONSTRAINT "DF_63181f7071ed4d4115a5ef91de1" DEFAULT getdate(), "deleted_at" datetime2, "created_by" uniqueidentifier, "updated_by" uniqueidentifier, "number" nvarchar(20) NOT NULL, "customer_id" uniqueidentifier NOT NULL, "status" nvarchar(10) NOT NULL, "valid_until" datetime2 NOT NULL, "notes" nvarchar(2000), "total_ht" decimal(12,2) NOT NULL, "total_vat" decimal(12,2) NOT NULL, "total_ttc" decimal(12,2) NOT NULL, CONSTRAINT "PK_99a0e8bcbcd8719d3a41f23c263" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quotes_number" ON "quotes" ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_quotes_customer" ON "quotes" ("customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_quotes_status" ON "quotes" ("status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "quote_lines" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_4589e13e3a55c06472a7dee6e31" DEFAULT NEWSEQUENTIALID(), "quote_id" uniqueidentifier NOT NULL, "product_id" uniqueidentifier, "position" int NOT NULL, "description" nvarchar(500) NOT NULL, "quantity" decimal(12,2) NOT NULL, "unit_price" decimal(12,2) NOT NULL, "vat_rate" decimal(5,2) NOT NULL CONSTRAINT "DF_12e3641b6f68d48dd4962f117c3" DEFAULT 20, "discount_percent" decimal(5,2) NOT NULL CONSTRAINT "DF_a84820b782cad8d6949056a71af" DEFAULT 0, "subtotal_ht" decimal(12,2) NOT NULL, CONSTRAINT "PK_4589e13e3a55c06472a7dee6e31" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_quote_lines_quote" ON "quote_lines" ("quote_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD CONSTRAINT "FK_a11bdb4a739328d1009c0b47e83" FOREIGN KEY ("customer_id") REFERENCES "contacts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quote_lines" ADD CONSTRAINT "FK_0338d96b421976a57a640570a38" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quote_lines" ADD CONSTRAINT "FK_d46678ba860b7704df2d822dc63" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quote_lines" DROP CONSTRAINT "FK_d46678ba860b7704df2d822dc63"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quote_lines" DROP CONSTRAINT "FK_0338d96b421976a57a640570a38"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP CONSTRAINT "FK_a11bdb4a739328d1009c0b47e83"`,
    );
    await queryRunner.query(
      `DROP INDEX "IX_quote_lines_quote" ON "quote_lines"`,
    );
    await queryRunner.query(`DROP TABLE "quote_lines"`);
    await queryRunner.query(`DROP INDEX "IX_quotes_status" ON "quotes"`);
    await queryRunner.query(`DROP INDEX "IX_quotes_customer" ON "quotes"`);
    await queryRunner.query(`DROP INDEX "UQ_quotes_number" ON "quotes"`);
    await queryRunner.query(`DROP TABLE "quotes"`);
  }
}
