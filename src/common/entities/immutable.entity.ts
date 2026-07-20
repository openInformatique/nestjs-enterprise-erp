import { CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Classe de base des entités TypeORM immuables (ex. : audit logs).
 *
 * Une entité immuable n'est jamais modifiée ni supprimée après son
 * insertion : elle ne porte donc ni updated_at, ni deleted_at, ni
 * traçabilité de modification.
 */
export abstract class ImmutableEntity {
  /** UUID SQL Server (uniqueidentifier) généré par la base. */
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
  createdAt!: Date;
}
