import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { mailConfig } from '../../../config/mail.config';
import {
  MailDeliveryResult,
  MailMessage,
  MailProviderPort,
} from '../domain/mail-provider.port';

/** Délai maximal accordé au serveur SMTP (connexion et envoi). */
const SMTP_TIMEOUT_MS = 10_000;

/**
 * Fournisseur d'e-mails SMTP (Nodemailer).
 *
 * L'échec d'envoi est renvoyé dans le résultat (delivered=false) plutôt
 * qu'en exception : l'appelant décide de la suite. Le détail technique
 * est journalisé sans jamais inclure le contenu du message.
 */
@Injectable()
export class SmtpMailProvider implements MailProviderPort {
  private readonly logger = new Logger(SmtpMailProvider.name);
  private readonly transporter: Transporter;
  private readonly defaultFrom: string;

  constructor(
    @Inject(mailConfig.KEY)
    config: ConfigType<typeof mailConfig>,
  ) {
    this.defaultFrom = config.from;
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      // STARTTLS est négocié automatiquement lorsque le serveur le propose.
      secure: config.port === 465,
      auth:
        config.username !== undefined && config.password !== undefined
          ? { user: config.username, pass: config.password }
          : undefined,
      connectionTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    });
  }

  async send(message: MailMessage): Promise<MailDeliveryResult> {
    try {
      const info = (await this.transporter.sendMail({
        from: message.from ?? this.defaultFrom,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
        })),
      })) as { messageId?: string };

      return { delivered: true, messageId: info.messageId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Échec d'envoi SMTP : to=${message.to} subject="${message.subject}" ` +
          `— ${errorMessage}`,
      );
      return { delivered: false, errorMessage };
    }
  }
}
