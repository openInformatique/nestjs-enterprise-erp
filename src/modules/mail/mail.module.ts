import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import { mailConfig } from '../../config/mail.config';
import { MailDriver } from '../../config/environment.validation';
import { SendDemoMailUseCase } from './application/send-demo-mail.use-case';
import { MAIL_PROVIDER } from './domain/mail-provider.port';
import { DevelopmentMailProvider } from './infrastructure/development-mail.provider';
import { SmtpMailProvider } from './infrastructure/smtp-mail.provider';

/**
 * Module d'envoi d'e-mails techniques.
 *
 * Le fournisseur est sélectionné par MAIL_DRIVER :
 *   - development : journalisation des métadonnées, aucun envoi ;
 *   - smtp : envoi réel via Nodemailer.
 */
@Module({
  imports: [AuditModule],
  providers: [
    DevelopmentMailProvider,
    SmtpMailProvider,
    SendDemoMailUseCase,
    {
      provide: MAIL_PROVIDER,
      inject: [mailConfig.KEY, DevelopmentMailProvider, SmtpMailProvider],
      useFactory: (
        config: ConfigType<typeof mailConfig>,
        development: DevelopmentMailProvider,
        smtp: SmtpMailProvider,
      ) => (config.driver === MailDriver.Smtp ? smtp : development),
    },
  ],
  exports: [MAIL_PROVIDER, SendDemoMailUseCase],
})
export class MailModule {}
