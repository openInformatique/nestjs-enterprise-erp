import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrdersTables1784272072572 implements MigrationInterface {
  name = 'CreateOrdersTables1784272072572';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "order_lines" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_627dcd7f1d707de4df241b2da6b" DEFAULT NEWSEQUENTIALID(), "order_id" uniqueidentifier NOT NULL, "product_id" uniqueidentifier, "position" int NOT NULL, "description" nvarchar(500) NOT NULL, "quantity" decimal(12,2) NOT NULL, "unit_price" decimal(12,2) NOT NULL, "vat_rate" decimal(5,2) NOT NULL CONSTRAINT "DF_eaac8f012a75c0785614231142e" DEFAULT 20, "subtotal_ht" decimal(12,2) NOT NULL, CONSTRAINT "PK_627dcd7f1d707de4df241b2da6b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_order_lines_order" ON "order_lines" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_710e2d4957aa5878dfe94e4ac2f" DEFAULT NEWSEQUENTIALID(), "created_at" datetime2 NOT NULL CONSTRAINT "DF_c884e321f927d5b86aac7c8f9ef" DEFAULT getdate(), "updated_at" datetime2 NOT NULL CONSTRAINT "DF_44eaa1eacc7a091d5d3e2a6c828" DEFAULT getdate(), "deleted_at" datetime2, "created_by" uniqueidentifier, "updated_by" uniqueidentifier, "number" nvarchar(20) NOT NULL, "type" nvarchar(10) NOT NULL, "contact_id" uniqueidentifier NOT NULL, "status" nvarchar(12) NOT NULL, "quote_id" uniqueidentifier, "warehouse_id" uniqueidentifier, "notes" nvarchar(2000), "total_ht" decimal(12,2) NOT NULL, "total_vat" decimal(12,2) NOT NULL, "total_ttc" decimal(12,2) NOT NULL, "expected_delivery_date" datetime2, "delivered_at" datetime2, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_orders_number" ON "orders" ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_orders_type" ON "orders" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_orders_contact" ON "orders" ("contact_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_orders_status" ON "orders" ("status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "order_lines" ADD CONSTRAINT "FK_6a619803439ea92778cafc8fb54" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_lines" ADD CONSTRAINT "FK_c33a737fbeb5050911ca729aaed" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_382ec81f8325ade1575566bc247" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_d6183642a34a405848c4926c116" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_a1fd4de5944756bdb80799b00bc" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_a1fd4de5944756bdb80799b00bc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_d6183642a34a405848c4926c116"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_382ec81f8325ade1575566bc247"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_lines" DROP CONSTRAINT "FK_c33a737fbeb5050911ca729aaed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_lines" DROP CONSTRAINT "FK_6a619803439ea92778cafc8fb54"`,
    );
    await queryRunner.query(`DROP INDEX "IX_orders_status" ON "orders"`);
    await queryRunner.query(`DROP INDEX "IX_orders_contact" ON "orders"`);
    await queryRunner.query(`DROP INDEX "IX_orders_type" ON "orders"`);
    await queryRunner.query(`DROP INDEX "UQ_orders_number" ON "orders"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(
      `DROP INDEX "IX_order_lines_order" ON "order_lines"`,
    );
    await queryRunner.query(`DROP TABLE "order_lines"`);
  }
}
