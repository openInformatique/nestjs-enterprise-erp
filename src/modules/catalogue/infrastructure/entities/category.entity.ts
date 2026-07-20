import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';

/**
 * Entité TypeORM de la table `categories`.
 *
 * Self-join : parent_id référence categories.id (clé étrangère générée
 * par la relation @ManyToOne ci-dessous). La règle « 1 niveau de
 * sous-catégories maximum » est applicative (use case), pas SQL.
 */
@Entity({ name: 'categories' })
export class CategoryEntity extends AuditableEntity {
  @Index('IX_categories_name')
  @Column({ name: 'name', type: 'nvarchar', length: 100 })
  name!: string;

  @Column({
    name: 'description',
    type: 'nvarchar',
    length: 500,
    nullable: true,
  })
  description!: string | null;

  /**
   * Colonne FK exposée telle quelle : le code lit/écrit l'UUID
   * directement, sans charger l'objet parent.
   */
  @Column({ name: 'parent_id', type: 'uniqueidentifier', nullable: true })
  parentId!: string | null;

  /**
   * Relation vers la catégorie parente — déclarée pour que TypeORM crée
   * la CLÉ ÉTRANGÈRE en base (une sous-catégorie ne peut pas pointer
   * vers un id inexistant). Le code applicatif n'utilise que parentId.
   */
  @ManyToOne(() => CategoryEntity, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: CategoryEntity | null;

  @Column({ name: 'is_active', type: 'bit', default: true })
  isActive!: boolean;
}
