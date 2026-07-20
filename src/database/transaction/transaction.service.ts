import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Helper léger d'exécution transactionnelle.
 *
 * Encapsule `DataSource.transaction` sans le masquer : TypeORM gère
 * lui-même le commit (fin normale) et le rollback (exception propagée).
 * Le socle ne fournit volontairement pas d'Unit of Work plus complexe.
 *
 * Exemple :
 *
 *   await this.transactionService.execute(async (manager) => {
 *     await manager.save(userEntity);
 *     await manager.save(auditLogEntity);
 *   });
 */
@Injectable()
export class TransactionService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Exécute `work` dans une transaction SQL Server.
   *
   * L'EntityManager transactionnel transmis à `work` doit être utilisé
   * pour TOUTES les opérations de la transaction ; utiliser un repository
   * global à la place ferait sortir l'opération de la transaction.
   *
   * Toute exception levée par `work` déclenche le rollback puis est
   * propagée à l'appelant.
   */
  async execute<TResult>(
    work: (manager: EntityManager) => Promise<TResult>,
  ): Promise<TResult> {
    return this.dataSource.transaction(work);
  }
}
