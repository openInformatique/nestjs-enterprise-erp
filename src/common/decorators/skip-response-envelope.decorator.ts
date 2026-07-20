import { SetMetadata } from '@nestjs/common';

/** Clé de métadonnée lue par ResponseEnvelopeInterceptor. */
export const SKIP_RESPONSE_ENVELOPE_KEY = 'skipResponseEnvelope';

/**
 * Désactive l'enveloppe JSON standardisée sur un endpoint.
 *
 * À utiliser pour les réponses qui ne sont pas du JSON applicatif :
 * téléchargements de fichiers, flux, format Prometheus, etc.
 *
 * Exemple :
 *
 *   @SkipResponseEnvelope()
 *   @Get('download')
 *   download(): StreamableFile { ... }
 */
export const SkipResponseEnvelope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_RESPONSE_ENVELOPE_KEY, true);
