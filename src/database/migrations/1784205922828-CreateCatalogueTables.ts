import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalogueTables1784205922828 implements MigrationInterface {
  name = 'CreateCatalogueTables1784205922828';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_24dbc6126a28ff948da33e97d3b" DEFAULT NEWSEQUENTIALID(), "created_at" datetime2 NOT NULL CONSTRAINT "DF_a7b2c155b5bad01eb952cf2e562" DEFAULT getdate(), "updated_at" datetime2 NOT NULL CONSTRAINT "DF_55daad89e067f87627f9f9d8586" DEFAULT getdate(), "deleted_at" datetime2, "created_by" uniqueidentifier, "updated_by" uniqueidentifier, "name" nvarchar(100) NOT NULL, "description" nvarchar(500), "parent_id" uniqueidentifier, "is_active" bit NOT NULL CONSTRAINT "DF_083b4657d537e819d86961f4aa5" DEFAULT 1, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_categories_name" ON "categories" ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_0806c755e0aca124e67c0cf6d7d" DEFAULT NEWSEQUENTIALID(), "created_at" datetime2 NOT NULL CONSTRAINT "DF_995d8194c43edfc98838cabc5ab" DEFAULT getdate(), "updated_at" datetime2 NOT NULL CONSTRAINT "DF_655479822939d59ee88d665d7bb" DEFAULT getdate(), "deleted_at" datetime2, "created_by" uniqueidentifier, "updated_by" uniqueidentifier, "sku" nvarchar(30) NOT NULL, "name" nvarchar(255) NOT NULL, "description" nvarchar(max), "type" nvarchar(10) NOT NULL, "category_id" uniqueidentifier, "unit_price" decimal(12,2) NOT NULL, "purchase_price" decimal(12,2), "vat_rate" decimal(5,2) NOT NULL CONSTRAINT "DF_fece135bf429199b1ff15c1b03a" DEFAULT 20, "unit" nvarchar(10) NOT NULL, "is_active" bit NOT NULL CONSTRAINT "DF_4dcd2cd0cf988da1681469a0f43" DEFAULT 1, "image_url" nvarchar(500), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_products_sku" ON "products" ("sku") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_products_name" ON "products" ("name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_products_type" ON "products" ("type") `,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_88cea2dc9c31951d06437879b40" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_9a5f6868c96e0069e699f33e124" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_9a5f6868c96e0069e699f33e124"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_88cea2dc9c31951d06437879b40"`,
    );
    await queryRunner.query(`DROP INDEX "IX_products_type" ON "products"`);
    await queryRunner.query(`DROP INDEX "IX_products_name" ON "products"`);
    await queryRunner.query(`DROP INDEX "UQ_products_sku" ON "products"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP INDEX "IX_categories_name" ON "categories"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
