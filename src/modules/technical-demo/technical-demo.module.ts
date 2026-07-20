import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PdfModule } from '../pdf/pdf.module';
import { StorageModule } from '../storage/storage.module';
import { TechnicalDemoController } from './technical-demo.controller';

/**
 * Module des endpoints de démonstration technique.
 *
 * N'est importé par AppModule QUE lorsque
 * TECHNICAL_DEMO_ENDPOINTS_ENABLED=true : sinon les routes
 * /technical-demo/* n'existent pas du tout (404).
 */
@Module({
  imports: [MailModule, StorageModule, PdfModule],
  controllers: [TechnicalDemoController],
})
export class TechnicalDemoModule {}
