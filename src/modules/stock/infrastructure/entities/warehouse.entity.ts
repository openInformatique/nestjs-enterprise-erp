import { Column, Entity, Index } from 'typeorm';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';

/**
 * Entité TypeORM de la table `warehouses`.
 *
 * Hérite d'AuditableEntity par cohérence avec le reste du projet, mais
 * la colonne deleted_at restera toujours NULL : un entrepôt se
 * DÉSACTIVE (is_active = false), il ne se supprime jamais — ses
 * mouvements historiques doivent rester lisibles.
 */
@Entity({ name: 'warehouses' })
export class WarehouseEntity extends AuditableEntity {
  @Index('IX_warehouses_name')
  @Column({ name: 'name', type: 'nvarchar', length: 100 })
  name!: string;

  /** Code court unique, normalisé en MAJUSCULES par la couche application. */
  @Index('UQ_warehouses_code', { unique: true })
  @Column({ name: 'code', type: 'nvarchar', length: 20 })
  code!: string;

  @Column({ name: 'street', type: 'nvarchar', length: 255, nullable: true })
  street!: string | null;

  @Column({ name: 'city', type: 'nvarchar', length: 100, nullable: true })
  city!: string | null;

  @Column({ name: 'is_active', type: 'bit', default: true })
  isActive!: boolean;
}
