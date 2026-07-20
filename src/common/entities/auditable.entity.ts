import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Classe de base des entités TypeORM modifiables.
 *
 * Fournit l'identifiant UUID, les dates techniques et la traçabilité
 * créateur/modificateur. Toutes les dates sont stockées en datetime2
 * et interprétées en UTC.
 *
 * `createdBy` / `updatedBy` sont de simples UUID nullable : aucune
 * relation TypeORM vers `users` n'est imposée, afin de ne pas coupler
 * toutes les entités au module utilisateurs.
 *
 * Les entités immuables (ex. : audit logs) n'étendent PAS cette classe :
 * elles utilisent une base plus légère (voir ImmutableEntity).
 */
export abstract class AuditableEntity {
  /** UUID SQL Server (uniqueidentifier) généré par la base. */
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime2' })
  updatedAt!: Date;

  /** Suppression logique : géré par TypeORM (softDelete / restore). */
  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime2', nullable: true })
  deletedAt!: Date | null;

  /** UUID de l'utilisateur créateur, si connu. */
  @Column({ name: 'created_by', type: 'uniqueidentifier', nullable: true })
  createdBy!: string | null;

  /** UUID du dernier utilisateur modificateur, si connu. */
  @Column({ name: 'updated_by', type: 'uniqueidentifier', nullable: true })
  updatedBy!: string | null;
}
