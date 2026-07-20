import { Injectable } from '@nestjs/common';
import { TransactionService } from '../../../database/transaction/transaction.service';
import { StockMovement } from '../domain/stock-movement';
import {
  NewStockMovementData,
  StockLevelWrite,
  StockWriterPort,
} from '../domain/stock-writer.port';
import { StockLevelEntity } from './entities/stock-level.entity';
import { StockMovementEntity } from './entities/stock-movement.entity';
import { StockMovementMapper } from './stock-movement.mapper';

/**
 * Écrivain de stock transactionnel.
 *
 * Chaque appel = UNE transaction SQL : les niveaux puis les mouvements
 * sont écrits ensemble, ou pas du tout. C'est ce qui garantit que
 * l'historique (mouvements) et l'état courant (niveaux) ne divergent
 * jamais — y compris pour le transfert (2 mouvements + 2 niveaux).
 *
 * ⚠️ Règle d'or : TOUTES les écritures passent par le manager reçu
 * (manager.getRepository). Utiliser un repository global ici ferait
 * sortir l'opération de la transaction en silence.
 */
@Injectable()
export class TransactionalStockWriter implements StockWriterPort {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly mapper: StockMovementMapper,
  ) {}

  async write(
    movements: NewStockMovementData[],
    levels: StockLevelWrite[],
  ): Promise<StockMovement[]> {
    return this.transactionService.execute(async (manager) => {
      const levelRepository = manager.getRepository(StockLevelEntity);
      const movementRepository = manager.getRepository(StockMovementEntity);

      // save() sur une entité à clé primaire composite = UPSERT :
      // INSERT si le couple (product_id, warehouse_id) est inconnu,
      // UPDATE sinon. Exactement la sémantique voulue pour un niveau.
      // Si une quantité négative arrivait ici malgré les vérifications
      // des use cases (accès concurrents), la contrainte CHECK ferait
      // échouer la transaction : rollback, jamais de stock négatif.
      await levelRepository.save(
        levels.map((level) => levelRepository.create(level)),
      );

      const saved = await movementRepository.save(
        movements.map((movement) => movementRepository.create(movement)),
      );

      return saved.map((entity) => this.mapper.toDomain(entity));
    });
  }
}
