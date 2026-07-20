# Module e-mails

## Contrat

```typescript
export interface MailProviderPort {
  send(message: MailMessage): Promise<MailDeliveryResult>;
}
```

`MailMessage` : destinataire, sujet, texte (toujours fourni), HTML facultatif,
expéditeur facultatif (défaut `MAIL_FROM`), pièces jointes facultatives.
`MailDeliveryResult` : `delivered`, `messageId`, `errorMessage` (l'échec est
un résultat, pas une exception : l'appelant décide de la suite).

## Deux implémentations

| Driver (`MAIL_DRIVER`) | Comportement |
| --- | --- |
| `development` | Journalise UNIQUEMENT les métadonnées (destinataire, sujet, tailles) — jamais le contenu ni les pièces jointes. Aucun envoi. |
| `smtp` | Envoi réel via Nodemailer (timeout 10 s, STARTTLS auto, `secure` si port 465). |

Le provider est sélectionné à l'injection (`MAIL_PROVIDER`) selon la
configuration : les consommateurs ne connaissent que le port.

## Utilisation

```typescript
constructor(@Inject(MAIL_PROVIDER) private readonly mail: MailProviderPort) {}

await this.mail.send({
  to: 'destinataire@example.com',
  subject: 'Sujet',
  text: 'Version texte',
  html: '<p>Version HTML</p>',
});
```

## Démonstration

`POST /api/v1/technical-demo/mail` (si `TECHNICAL_DEMO_ENDPOINTS_ENABLED=true`,
JWT requis) envoie un e-mail de démonstration et enregistre un audit
`mail.demo.sent`.

En local, un serveur SMTP de test type MailHog/Mailpit (port 1025) fonctionne
directement avec `MAIL_DRIVER=smtp`.

## Règle absolue

Ne jamais journaliser le contenu d'un e-mail (texte, HTML, pièces jointes) :
il peut contenir des données sensibles. Seules les métadonnées sont loggées.
