import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

/**
 * Module global du contexte de requête.
 *
 * Global afin que tout module (audit, authentification, logs...) puisse
 * injecter RequestContextService sans import explicite.
 */
@Global()
@Module({
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class ContextModule {}
