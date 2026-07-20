import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContactsTable1784203121162 implements MigrationInterface {
  name = 'CreateContactsTable1784203121162';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "contacts" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_b99cd40cfd66a99f1571f4f72e6" DEFAULT NEWSEQUENTIALID(), "created_at" datetime2 NOT NULL CONSTRAINT "DF_ec4f69b757fb905b908d0e66073" DEFAULT getdate(), "updated_at" datetime2 NOT NULL CONSTRAINT "DF_7e3d0339c97c4c67d2434296acc" DEFAULT getdate(), "deleted_at" datetime2, "created_by" uniqueidentifier, "updated_by" uniqueidentifier, "type" nvarchar(10) NOT NULL, "company_name" nvarchar(255) NOT NULL, "contact_name" nvarchar(255), "email" nvarchar(320), "phone" nvarchar(50), "street" nvarchar(255), "city" nvarchar(100), "postal_code" nvarchar(20), "country" nvarchar(2) NOT NULL CONSTRAINT "DF_3e4d971f815976234b30e223c26" DEFAULT 'FR', "siret" nvarchar(14), "vat_number" nvarchar(20), "notes" nvarchar(max), "is_active" bit NOT NULL CONSTRAINT "DF_6582f2c1c0a3e722ce46c101ce1" DEFAULT 1, CONSTRAINT "PK_b99cd40cfd66a99f1571f4f72e6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_contacts_company_name" ON "contacts" ("company_name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_contacts_email" ON "contacts" ("email") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IX_contacts_email" ON "contacts"`);
    await queryRunner.query(
      `DROP INDEX "IX_contacts_company_name" ON "contacts"`,
    );
    await queryRunner.query(`DROP TABLE "contacts"`);
  }
}
