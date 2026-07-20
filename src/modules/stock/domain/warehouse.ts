/**
 * Entrepôt de stockage.
 *
 * Particularité : un entrepôt ne se SUPPRIME jamais (ses mouvements
 * historiques doivent rester lisibles) — il se DÉSACTIVE, et seulement
 * s'il est vide. Pas de deletedAt dans le modèle : isActive suffit.
 */
export class Warehouse {
  constructor(
    public readonly id: string,
    public readonly name: string,
    /** Code court unique, normalisé en MAJUSCULES (ex. : WH-PARIS). */
    public readonly code: string,
    public readonly street: string | null,
    public readonly city: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
