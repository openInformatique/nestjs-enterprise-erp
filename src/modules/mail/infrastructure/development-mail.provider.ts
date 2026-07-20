import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MailDeliveryResult,
  MailMessage,
  MailProviderPort,
} from '../domain/mail-provider.port';

/**
 * Fournisseur d'e-mails de DÉVELOPPEMENT : aucun envoi réel.
 *
 * Journalise uniquement les MÉTADONNÉES du message (destinataire, sujet,
 * tailles). Le contenu (texte, HTML, pièces jointes) n'est JAMAIS
 * journalisé : il peut contenir des informations sensibles.
 */
@Injectable()
export class DevelopmentMailProvider implements MailProviderPort {
  private readonly logger = new Logger(DevelopmentMailProvider.name);

  send(message: MailMessage): Promise<MailDeliveryResult> {
    const messageId = `dev-${randomUUID()}`;

    this.logger.log(
      `E-mail simulé (driver development) : to=${message.to} ` +
        `subject="${message.subject}" textLength=${message.text.length} ` +
        `hasHtml=${message.html !== undefined} ` +
        `attachments=${message.attachments?.length ?? 0} id=${messageId}`,
    );

    return Promise.resolve({ delivered: true, messageId });
  }
}
