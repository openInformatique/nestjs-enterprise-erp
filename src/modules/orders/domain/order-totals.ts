import { roundMoney } from '../../../common/money/money';

/** Ligne prête à calculer (contenu déjà résolu par le use case). */
export interface OrderLineDraft {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

/** Ligne calculée : le sous-total HT est posé. */
export interface ComputedOrderLine extends OrderLineDraft {
  subtotalHT: number;
}

/** Totaux d'une commande. */
export interface OrderTotals {
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
}

/** Pose le sous-total (qté × prix, au centime) de chaque ligne. */
export function computeOrderLines(
  lines: OrderLineDraft[],
): ComputedOrderLine[] {
  return lines.map((line) => ({
    ...line,
    subtotalHT: roundMoney(line.quantity * line.unitPrice),
  }));
}

/** Totaux de la commande — TVA ligne par ligne, arrondie à chaque étape. */
export function computeOrderTotals(lines: ComputedOrderLine[]): OrderTotals {
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
