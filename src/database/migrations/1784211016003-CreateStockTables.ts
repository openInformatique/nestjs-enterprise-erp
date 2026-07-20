import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockTables1784211016003 implements MigrationInterface {
  name = 'CreateStockTables1784211016003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "warehouses" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_56ae21ee2432b2270b48867e4be" DEFAULT NEWSEQUENTIALID(), "created_at" datetime2 NOT NULL CONSTRAINT "DF_d458d3ad7d187ba7e4d4139cd69" DEFAULT getdate(), "updated_at" datetime2 NOT NULL CONSTRAINT "DF_ab4fbe34a8db9971f42a0628452" DEFAULT getdate(), "deleted_at" datetime2, "created_by" uniqueidentifier, "updated_by" uniqueidentifier, "name" nvarchar(100) NOT NULL, "code" nvarchar(20) NOT NULL, "street" nvarchar(255), "city" nvarchar(100), "is_active" bit NOT NULL CONSTRAINT "DF_853ef66ac9d45be4bc4f087264f" DEFAULT 1, CONSTRAINT "PK_56ae21ee2432b2270b48867e4be" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_warehouses_name" ON "warehouses" ("name") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_warehouses_code" ON "warehouses" ("code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "stock_levels" ("product_id" uniqueidentifier NOT NULL, "warehouse_id" uniqueidentifier NOT NULL, "quantity" int NOT NULL CONSTRAINT "DF_c41a466678150b577a6295a5de2" DEFAULT 0, "updated_at" datetime2 NOT NULL CONSTRAINT "DF_8b21578aaef979291bc8326efc3" DEFAULT getdate(), CONSTRAINT "CHK_stock_levels_quantity" CHECK ("quantity" >= 0), CONSTRAINT "PK_4bedc48e22aaac0a6c29991aeaa" PRIMARY KEY ("product_id", "warehouse_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_stock_levels_quantity" ON "stock_levels" ("quantity") `,
    );
    await queryRunner.query(
      `CREATE TABLE "stock_movements" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_57a26b190618550d8e65fb860e7" DEFAULT NEWSEQUENTIALID(), "created_at" datetime2 NOT NULL CONSTRAINT "DF_b2da8647ef82e50376cfc1ae7fb" DEFAULT getdate(), "product_id" uniqueidentifier NOT NULL, "warehouse_id" uniqueidentifier NOT NULL, "target_warehouse_id" uniqueidentifier, "type" nvarchar(12) NOT NULL, "quantity" int NOT NULL, "unit_cost" decimal(12,2), "reference" nvarchar(50), "notes" nvarchar(500), "performed_by" uniqueidentifier NOT NULL, "performed_at" datetime2 NOT NULL, CONSTRAINT "PK_57a26b190618550d8e65fb860e7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_stock_movements_product" ON "stock_movements" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_stock_movements_warehouse" ON "stock_movements" ("warehouse_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_stock_movements_type" ON "stock_movements" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_stock_movements_performed_at" ON "stock_movements" ("performed_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_levels" ADD CONSTRAINT "FK_46e4cf093a8ad0464e4be42f342" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_levels" ADD CONSTRAINT "FK_646a24750192418e87556abd277" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_2c1bb05b80ddcc562cd28d826c6" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_e7831147f5a8ee3c42e6eaeee2e" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_a15e3cd9ab28a4ffe7c73adb50a" FOREIGN KEY ("target_warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_a15e3cd9ab28a4ffe7c73adb50a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_e7831147f5a8ee3c42e6eaeee2e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_2c1bb05b80ddcc562cd28d826c6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_levels" DROP CONSTRAINT "FK_646a24750192418e87556abd277"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_levels" DROP CONSTRAINT "FK_46e4cf093a8ad0464e4be42f342"`,
    );
    await queryRunner.query(
      `DROP INDEX "IX_stock_movements_performed_at" ON "stock_movements"`,
    );
    await queryRunner.query(
      `DROP INDEX "IX_stock_movements_type" ON "stock_movements"`,
    );
    await queryRunner.query(
      `DROP INDEX "IX_stock_movements_warehouse" ON "stock_movements"`,
    );
    await queryRunner.query(
      `DROP INDEX "IX_stock_movements_product" ON "stock_movements"`,
    );
    await queryRunner.query(`DROP TABLE "stock_movements"`);
    await queryRunner.query(
      `DROP INDEX "IX_stock_levels_quantity" ON "stock_levels"`,
    );
    await queryRunner.query(`DROP TABLE "stock_levels"`);
    await queryRunner.query(`DROP INDEX "UQ_warehouses_code" ON "warehouses"`);
    await queryRunner.query(`DROP INDEX "IX_warehouses_name" ON "warehouses"`);
    await queryRunner.query(`DROP TABLE "warehouses"`);
  }
}
