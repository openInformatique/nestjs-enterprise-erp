import { ContactType } from './contact-type.enum';

/**
 * Modèle de domaine du contact (client et/ou fournisseur).
 *
 * Classe pure : aucune dépendance à NestJS ou TypeORM. Seuls `type`,
 * `companyName` et `country` sont obligatoires : un fournisseur sans
 * e-mail ou un client sans SIRET sont des cas parfaitement réels.
 */
export class Contact {
  constructor(
    public readonly id: string,
    public readonly type: ContactType,
    public readonly companyName: string,
    public readonly contactName: string | null,
    public readonly email: string | null,
    public readonly phone: string | null,
    public readonly street: string | null,
    public readonly city: string | null,
    public readonly postalCode: string | null,
    /** Code pays ISO à 2 lettres ; 'FR' par défaut. */
    public readonly country: string,
    /** SIRET français (14 chiffres) si connu. */
    public readonly siret: string | null,
    /** Numéro de TVA intracommunautaire si connu. */
    public readonly vatNumber: string | null,
    public readonly notes: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  /**
   * Utilisable comme CLIENT (devis, commandes clients, factures).
   * Les modules 05, 06 et 07 s'appuieront sur cette méthode.
   */
  isCustomer(): boolean {
    return this.type === ContactType.Customer || this.type === ContactType.Both;
  }

  /**
   * Utilisable comme FOURNISSEUR (commandes fournisseurs).
   * Le module 06 s'appuiera sur cette méthode.
   */
  isSupplier(): boolean {
    return this.type === ContactType.Supplier || this.type === ContactType.Both;
  }
}
