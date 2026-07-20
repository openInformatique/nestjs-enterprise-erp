import { QuoteLine } from './quote-line';
import { QuoteStatus } from './quote-status.enum';

/**
 * Devis — agrégat racine : les lignes n'existent qu'à travers lui.
 *
 * Les totaux sont STOCKÉS (pas recalculés à la lecture) : ils sont
 * recalculés par le serveur à chaque écriture via computeQuoteTotals,
 * jamais fournis par le client.
 */
export class Quote {
  constructor(
    public readonly id: string,
    /** Numéro unique, séquentiel par année : DEV-2026-0001. */
    public readonly number: string,
    public readonly customerId: string,
    /**
     * Nom du client, dénormalisé pour l'affichage (jointure en
     * lecture) — jamais écrit dans la table quotes.
     */
    public readonly customerName: string,
    public readonly status: QuoteStatus,
    public readonly validUntil: Date,
    public readonly notes: string | null,
    public readonly totalHT: number,
    public readonly totalVAT: number,
    public readonly totalTTC: number,
    /** UUID de l'utilisateur créateur. */
    public readonly createdBy: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    /** Vide dans les listes ; complet dans le détail. */
    public readonly lines: QuoteLine[],
  ) {}

  /** Seul un brouillon est modifiable et supprimable. */
  isDraft(): boolean {
    return this.status === QuoteStatus.Draft;
  }

  /** Seul un devis envoyé peut être accepté, refusé ou expiré. */
  isSent(): boolean {
    return this.status === QuoteStatus.Sent;
  }
}
