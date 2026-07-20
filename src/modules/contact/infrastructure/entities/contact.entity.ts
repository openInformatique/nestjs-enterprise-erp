import { Column, Entity, Index } from 'typeorm';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';
import { ContactType } from '../../domain/contact-type.enum';

/**
 * Entité TypeORM de la table `contacts`.
 *
 * Une seule table pour clients, fournisseurs et mixtes (colonne `type`).
 * Index sur company_name et email : ce sont les colonnes de recherche.
 * SQL Server n'a pas de type enum : `type` est un nvarchar contraint
 * par la validation applicative (DTO + enum TypeScript).
 */
@Entity({ name: 'contacts' })
export class ContactEntity extends AuditableEntity {
  @Column({ name: 'type', type: 'nvarchar', length: 10 })
  type!: ContactType;

  @Index('IX_contacts_company_name')
  @Column({ name: 'company_name', type: 'nvarchar', length: 255 })
  companyName!: string;

  @Column({
    name: 'contact_name',
    type: 'nvarchar',
    length: 255,
    nullable: true,
  })
  contactName!: string | null;

  @Index('IX_contacts_email')
  @Column({ name: 'email', type: 'nvarchar', length: 320, nullable: true })
  email!: string | null;

  @Column({ name: 'phone', type: 'nvarchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ name: 'street', type: 'nvarchar', length: 255, nullable: true })
  street!: string | null;

  @Column({ name: 'city', type: 'nvarchar', length: 100, nullable: true })
  city!: string | null;

  @Column({ name: 'postal_code', type: 'nvarchar', length: 20, nullable: true })
  postalCode!: string | null;

  /** Code pays ISO 3166-1 alpha-2 (FR, BE, DE...). */
  @Column({ name: 'country', type: 'nvarchar', length: 2, default: 'FR' })
  country!: string;

  /** SIRET français : 14 chiffres (format vérifié par le DTO). */
  @Column({ name: 'siret', type: 'nvarchar', length: 14, nullable: true })
  siret!: string | null;

  @Column({ name: 'vat_number', type: 'nvarchar', length: 20, nullable: true })
  vatNumber!: string | null;

  /** nvarchar(max) : texte libre sans limite utile côté SQL. */
  @Column({ name: 'notes', type: 'nvarchar', length: 'max', nullable: true })
  notes!: string | null;

  /** Un contact inactif n'apparaît plus dans les sélections par défaut. */
  @Column({ name: 'is_active', type: 'bit', default: true })
  isActive!: boolean;
}
