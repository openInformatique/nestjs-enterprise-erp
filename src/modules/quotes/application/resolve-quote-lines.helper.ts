import { Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { computeLines } from '../domain/quote-totals';
import type { ComputedQuoteLine, QuoteLineDraft } from '../domain/quote-totals';

/** Ligne telle que reçue de l'API (avant résolution). */
export interface QuoteLineInput {
  productId?: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  vatRate?: number;
  discountPercent?: number;
}

/**
 * Résout chaque ligne d'un devis :
 *   - ligne PRODUIT (productId fourni) : le produit doit exister (404)
 *     et être actif (409) ; description, prix et TVA sont COPIÉS du
 *     produit si non fournis — puis figés dans la ligne ;
 *   - ligne LIBRE (pas de productId) : description et prix obligatoires.
 * Renvoie les lignes avec leur sous-total HT calculé.
 */
@Injectable()
export class ResolveQuoteLinesHelper {
  constructor(private readonly getProductByIdUseCase: GetProductByIdUseCase) {}

  async resolve(inputs: QuoteLineInput[]): Promise<ComputedQuoteLine[]> {
    const drafts: QuoteLineDraft[] = [];

    for (const input of inputs) {
      if (input.productId !== undefined) {
        const product = await this.getProductByIdUseCase.execute(
          input.productId,
        );
        if (!product.isActive) {
          throw new BusinessRuleViolationException(
            `Le produit « ${product.name} » est désactivé : il ne peut ` +
              'plus être ajouté à un devis.',
          );
        }
        drafts.push({
          productId: product.id,
          description: input.description ?? product.name,
          quantity: input.quantity,
          unitPrice: input.unitPrice ?? product.unitPrice,
          vatRate: input.vatRate ?? product.vatRate,
          discountPercent: input.discountPercent ?? 0,
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
          discountPercent: input.discountPercent ?? 0,
        });
      }
    }

    return computeLines(drafts);
  }
}
