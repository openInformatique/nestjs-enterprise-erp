/**
 * Catégorie de produits — hiérarchie simple à 1 niveau :
 * une catégorie racine peut avoir des sous-catégories, une
 * sous-catégorie ne peut pas en avoir (règle vérifiée en use case).
 */
export class Category {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string | null,
    /** null = catégorie racine ; sinon id de la catégorie parente. */
    public readonly parentId: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  isRoot(): boolean {
    return this.parentId === null;
  }
}
