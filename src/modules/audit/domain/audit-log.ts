import { AuditCategory } from './audit-category.enum';

/** Modèle de lecture d'un événement d'audit — le journal est immuable. */
export class AuditLog {
  constructor(
    public readonly id: string,
    public readonly category: AuditCategory,
    /** Action technique stable, ex. : payments.recorded */
    public readonly action: string,
    public readonly actorUserId: string | null,
    public readonly resourceType: string | null,
    public readonly resourceId: string | null,
    public readonly requestId: string | null,
    public readonly ipAddress: string | null,
    /** JSON déjà filtré des valeurs sensibles à l'écriture. */
    public readonly metadata: string | null,
    public readonly createdAt: Date,
  ) {}
}
