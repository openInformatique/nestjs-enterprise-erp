import { Inject, Injectable, Logger } from '@nestjs/common';
import { RequestContextService } from '../../../common/context/request-context.service';
import { AuditCategory } from '../domain/audit-category.enum';
import { AUDIT_LOG_REPOSITORY } from '../domain/audit-log-repository.port';
import type { AuditLogRepositoryPort } from '../domain/audit-log-repository.port';

/** Événement d'audit déclaré par un cas d'utilisation. */
export interface AuditEvent {
  category: AuditCategory;
  /** Action technique stable, ex. : auth.login.success */
  action: string;
  /** Renseigné automatiquement depuis le contexte si absent. */
  actorUserId?: string | null;
  resourceType?: string;
  resourceId?: string;
  /** Contexte riche ; les valeurs sensibles sont filtrées avant stockage. */
  metadata?: Record<string, unknown>;
}

/** Clés dont la valeur est systématiquement expurgée des métadonnées. */
const SENSITIVE_KEY_PATTERN =
  /password|token|secret|cookie|authorization|credential/i;

/**
 * Service d'enregistrement du journal d'audit persistant.
 *
 * À la différence des logs techniques Pino (diagnostic), le journal
 * d'audit conserve en base les événements significatifs : connexions,
 * révocations, détections de réutilisation de token, actions techniques.
 *
 * L'audit est EXPLICITE : chaque cas d'utilisation déclare ses événements
 * avec un contexte maîtrisé ; aucune capture automatique et aveugle des
 * écritures SQL n'est effectuée.
 *
 * Décisions :
 *   - requestId, IP, user-agent et acteur sont complétés automatiquement
 *     depuis le contexte de requête lorsque disponibles ;
 *   - les valeurs sensibles des métadonnées sont remplacées par [REDACTED]
 *     (jamais de mot de passe, JWT, cookie ou refresh token en base) ;
 *   - un échec d'insertion est journalisé mais ne fait PAS échouer le cas
 *     d'utilisation appelant : l'indisponibilité de l'audit ne doit pas
 *     bloquer l'application.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: AuditLogRepositoryPort,
    private readonly requestContext: RequestContextService,
  ) {}

  /** Enregistre un événement d'audit. */
  async record(event: AuditEvent): Promise<void> {
    const context = this.requestContext.get();

    try {
      await this.auditLogRepository.insert({
        category: event.category,
        action: event.action,
        actorUserId: event.actorUserId ?? context?.userId ?? null,
        resourceType: event.resourceType ?? null,
        resourceId: event.resourceId ?? null,
        requestId: context?.requestId ?? null,
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
        metadata: event.metadata
          ? JSON.stringify(this.sanitizeMetadata(event.metadata))
          : null,
      });
    } catch (error) {
      this.logger.error(
        `Échec d'enregistrement de l'audit "${event.action}" ` +
          `(requestId=${context?.requestId ?? 'aucun'}) : ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Remplace récursivement les valeurs des clés sensibles par [REDACTED].
   */
  private sanitizeMetadata(
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }
      if (
        entry !== null &&
        typeof entry === 'object' &&
        !Array.isArray(entry)
      ) {
        sanitized[key] = this.sanitizeMetadata(
          entry as Record<string, unknown>,
        );
        continue;
      }
      sanitized[key] = entry;
    }

    return sanitized;
  }
}
