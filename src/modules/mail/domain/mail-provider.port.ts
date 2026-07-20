/** Pièce jointe d'un e-mail. */
export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/** Message à envoyer. */
export interface MailMessage {
  to: string;
  subject: string;
  /** Contenu texte brut (toujours fourni : repli des clients mail). */
  text: string;
  /** Contenu HTML facultatif. */
  html?: string;
  /** Expéditeur ; à défaut, MAIL_FROM de la configuration. */
  from?: string;
  attachments?: MailAttachment[];
}

/** Résultat d'une tentative d'envoi. */
export interface MailDeliveryResult {
  delivered: boolean;
  /** Identifiant du message chez le transporteur, si disponible. */
  messageId?: string;
  /** Message d'erreur technique en cas d'échec (jamais exposé au client HTTP). */
  errorMessage?: string;
}

/**
 * Contrat d'envoi d'e-mails.
 *
 * Deux implémentations dans le socle :
 *   - development : journalise les métadonnées sans envoyer (MAIL_DRIVER=development) ;
 *   - smtp : envoi réel via Nodemailer (MAIL_DRIVER=smtp).
 */
export interface MailProviderPort {
  send(message: MailMessage): Promise<MailDeliveryResult>;
}

/** Jeton d'injection du fournisseur d'e-mails. */
export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
