import { Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { Order } from '../domain/order';

/** Ligne de commande qui doit bouger du stock. */
export interface StockLine {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Extrait d'une commande les lignes qui impactent le stock :
 *   - lignes AVEC productId et produit de type PRODUCT (les services
 *     et les lignes libres sont ignorés) ;
 *   - la quantité doit être ENTIÈRE : le stock du module 04 compte en
 *     unités entières — 2.5 écrans ne veut rien dire.
 */
@Injectable()
export class CollectStockLinesHelper {
  constructor(private readonly getProductByIdUseCase: GetProductByIdUseCase) {}

  async collect(order: Order): Promise<StockLine[]> {
    const stockLines: StockLine[] = [];

    for (const line of order.lines) {
      if (line.productId === null) {
        continue;
      }
      const product = await this.getProductByIdUseCase.execute(line.productId);
      if (!product.isStockManaged()) {
        continue;
      }
      if (!Number.isInteger(line.quantity)) {
        throw new BusinessRuleViolationException(
          `La ligne « ${line.description} » porte une quantité non ` +
            `entière (${line.quantity}) sur un produit stocké : ` +
            'impossible de mouvementer le stock.',
        );
      }
      stockLines.push({
        productId: line.productId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      });
    }

    return stockLines;
  }

  /**
   * Agrège les quantités PAR PRODUIT : deux lignes du même produit
   * doivent être vérifiées (et écrites) comme UNE demande cumulée —
   * sinon chaque ligne passerait le contrôle de stock alors que leur
   * somme le dépasse.
   */
  aggregateByProduct(stockLines: StockLine[]): Map<string, number> {
    const totals = new Map<string, number>();
    for (const line of stockLines) {
      totals.set(
        line.productId,
        (totals.get(line.productId) ?? 0) + line.quantity,
      );
    }
    return totals;
  }
}
