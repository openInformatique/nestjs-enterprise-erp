/**
 * Arrondit un montant au centime (2 décimales).
 *
 * RÈGLE DU PROJET : toute opération monétaire (multiplication,
 * pourcentage, somme) passe par cet arrondi AVANT d'être stockée ou
 * additionnée à autre chose. En JavaScript, 0.1 + 0.2 vaut
 * 0.30000000000000004 : sans arrondi systématique, les totaux d'un
 * devis dérivent du détail de ses lignes.
 *
 * Number.EPSILON compense les représentations binaires limites
 * (1.005 * 100 = 100.49999... sans lui).
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
