import { Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { computeOrderLines } from '../domain/order-totals';
import type { ComputedOrderLine, OrderLineDraft } from '../domain/order-totals';

/** Ligne telle que reçue de l'API (avant résolution). */
export interface OrderLineInput {
  productId?: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  vatRate?: number;
}

/**
 * Résout chaque ligne de commande — même logique qu'au module 05 :
 *   - ligne PRODUIT : produit existant (404) et actif (409),
 *     description/prix/TVA copiés si non fournis puis FIGÉS ;
 *   - ligne LIBRE : description et prix obligatoires.
 */
@Injectable()
export class ResolveOrderLinesHelper {
  constructor(private readonly getProductByIdUseCase: GetProductByIdUseCase) {}

  async resolve(inputs: OrderLineInput[]): Promise<ComputedOrderLine[]> {
    const drafts: OrderLineDraft[] = [];

    for (const input of inputs) {
      if (input.productId !== undefined) {
        const product = await this.getProductByIdUseCase.execute(
          input.productId,
        );
        if (!product.isActive) {
          throw new BusinessRuleViolationException(
            `Le produit « ${product.name} » est désactivé : il ne peut ` +
              'plus être commandé.',
          );
        }
        drafts.push({
          productId: product.id,
          description: input.description ?? product.name,
          quantity: input.quantity,
          unitPrice: input.unitPrice ?? product.unitPrice,
          vatRate: input.vatRate ?? product.vatRate,
        });
      } else {
        if (input.description === undefined || input.unitPrice === undefined) {
          throw new BusinessRuleViolationException(
            'Une ligne libre (sans productId) doit préciser sa ' +
              'description et son prix unitaire.',
          );
        }
        drafts.push({
          productId: null,
          description: input.description,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          vatRate: input.vatRate ?? 20,
        });
      }
    }

    return computeOrderLines(drafts);
  }
}
