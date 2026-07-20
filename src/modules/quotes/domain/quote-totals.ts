import { roundMoney } from '../../../common/money/money';

/** Ligne prête à calculer (contenu déjà résolu par le use case). */
export interface QuoteLineDraft {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountPercent: number;
}

/** Ligne calculée : le sous-total HT est posé. */
export interface ComputedQuoteLine extends QuoteLineDraft {
  subtotalHT: number;
}

/** Totaux d'un devis. */
export interface QuoteTotals {
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
}

/** Sous-total HT d'une ligne : qté × prix × (1 - remise/100), au centime. */
export function computeLineSubtotal(line: QuoteLineDraft): number {
  return roundMoney(
    line.quantity * line.unitPrice * (1 - line.discountPercent / 100),
  );
}

/** Pose le sous-total de chaque ligne. */
export function computeLines(lines: QuoteLineDraft[]): ComputedQuoteLine[] {
  return lines.map((line) => ({
    ...line,
    subtotalHT: computeLineSubtotal(line),
  }));
}

/**
 * Totaux du devis à partir des lignes calculées.
 * La TVA est calculée ligne par ligne (chaque ligne a son taux) puis
 * sommée — et chaque étape est arrondie au centime.
 */
export function computeQuoteTotals(lines: ComputedQuoteLine[]): QuoteTotals {
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
