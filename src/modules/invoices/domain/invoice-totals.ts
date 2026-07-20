import { roundMoney } from '../../../common/money/money';

/**
 * Calcul des lignes et totaux — même logique qu'aux modules 05 et 06
 * (une factorisation des trois dans common/money est une amélioration
 * de niveau min- : trois copies proches valent mieux qu'une mauvaise
 * abstraction précipitée).
 */

/** Ligne prête à calculer (contenu déjà résolu par le use case). */
export interface InvoiceLineDraft {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

/** Ligne calculée : le sous-total HT est posé. */
export interface ComputedInvoiceLine extends InvoiceLineDraft {
  subtotalHT: number;
}

/** Totaux d'une facture. */
export interface InvoiceTotals {
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
}

/** Pose le sous-total (qté × prix, au centime) de chaque ligne. */
export function computeInvoiceLines(
  lines: InvoiceLineDraft[],
): ComputedInvoiceLine[] {
  return lines.map((line) => ({
    ...line,
    subtotalHT: roundMoney(line.quantity * line.unitPrice),
  }));
}

/** Totaux — TVA ligne par ligne, arrondie à chaque étape. */
export function computeInvoiceTotals(
  lines: ComputedInvoiceLine[],
): InvoiceTotals {
  const totalHT = roundMoney(
    lines.reduce((sum, line) => sum + line.subtotalHT, 0),
  );
  const totalVAT = roundMoney(
    lines.reduce(
      (sum, line) => sum + roundMoney((line.subtotalHT * line.vatRate) / 100),
      0,
    ),
  );
  return {
    totalHT,
    totalVAT,
    totalTTC: roundMoney(totalHT + totalVAT),
  };
}
