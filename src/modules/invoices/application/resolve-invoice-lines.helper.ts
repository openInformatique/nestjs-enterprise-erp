import { Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { computeInvoiceLines } from '../domain/invoice-totals';
import type {
  ComputedInvoiceLine,
  InvoiceLineDraft,
} from '../domain/invoice-totals';

/** Ligne telle que reçue de l'API (avant résolution). */
export interface InvoiceLineInput {
  productId?: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  vatRate?: number;
}

/**
 * Résout chaque ligne de facture — même logique qu'aux modules 05/06 :
 * ligne PRODUIT (contenu copié du catalogue si absent, produit actif
 * exigé) ou ligne LIBRE (description + prix obligatoires).
 */
@Injectable()
export class ResolveInvoiceLinesHelper {
  constructor(private readonly getProductByIdUseCase: GetProductByIdUseCase) {}

  async resolve(inputs: InvoiceLineInput[]): Promise<ComputedInvoiceLine[]> {
    const drafts: InvoiceLineDraft[] = [];

    for (const input of inputs) {
      if (input.productId !== undefined) {
        const product = await this.getProductByIdUseCase.execute(
          input.productId,
        );
        if (!product.isActive) {
          throw new BusinessRuleViolationException(
            `Le produit « ${product.name} » est désactivé : il ne peut ` +
              'plus être facturé.',
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

    return computeInvoiceLines(drafts);
  }
}
