import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { MAIL_PROVIDER } from '../domain/mail-provider.port';
import type {
  MailDeliveryResult,
  MailProviderPort,
} from '../domain/mail-provider.port';

/**
 * Cas d'utilisation de démonstration : envoi d'un e-mail technique.
 *
 * Sert uniquement à démontrer la brique e-mail du socle (endpoint
 * /technical-demo/mail, activable par configuration). Aucune logique
 * métier.
 */
@Injectable()
export class SendDemoMailUseCase {
  constructor(
    @Inject(MAIL_PROVIDER)
    private readonly mailProvider: MailProviderPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    recipient: string,
    requestedByUserId: string,
  ): Promise<MailDeliveryResult> {
    const result = await this.mailProvider.send({
      to: recipient,
      subject: 'E-mail de démonstration — nestjs-enterprise-starter',
      text:
        'Ceci est un e-mail de démonstration envoyé par le socle technique.\n' +
        'Il valide la configuration du module d’envoi d’e-mails.',
      html:
        '<p>Ceci est un e-mail de <strong>démonstration</strong> envoyé par ' +
        'le socle technique.</p><p>Il valide la configuration du module ' +
        'd’envoi d’e-mails.</p>',
    });

    await this.auditService.record({
      category: AuditCategory.Technical,
      action: 'mail.demo.sent',
      actorUserId: requestedByUserId,
      resourceType: 'mail',
      metadata: {
        recipient,
        delivered: result.delivered,
        messageId: result.messageId,
      },
    });

    return result;
  }
}
