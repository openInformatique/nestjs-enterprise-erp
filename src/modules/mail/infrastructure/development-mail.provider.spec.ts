import { Logger } from '@nestjs/common';
import { DevelopmentMailProvider } from './development-mail.provider';

describe('DevelopmentMailProvider', () => {
  let provider: DevelopmentMailProvider;
  let loggedLines: string[];

  beforeEach(() => {
    provider = new DevelopmentMailProvider();
    loggedLines = [];
    jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((message: unknown) => {
        loggedLines.push(String(message));
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('simule un envoi réussi avec un identifiant de message', async () => {
    const result = await provider.send({
      to: 'destinataire@example.com',
      subject: 'Sujet de test',
      text: 'Contenu texte',
    });

    expect(result.delivered).toBe(true);
    expect(result.messageId).toMatch(/^dev-/);
  });

  it('journalise les métadonnées mais jamais le contenu', async () => {
    await provider.send({
      to: 'destinataire@example.com',
      subject: 'Sujet visible',
      text: 'CONTENU-CONFIDENTIEL-NE-DOIT-PAS-FUIR',
      html: '<p>HTML-CONFIDENTIEL</p>',
    });

    const logged = loggedLines.join('\n');
    expect(logged).toContain('destinataire@example.com');
    expect(logged).toContain('Sujet visible');
    expect(logged).not.toContain('CONTENU-CONFIDENTIEL-NE-DOIT-PAS-FUIR');
    expect(logged).not.toContain('HTML-CONFIDENTIEL');
  });

  it('compte les pièces jointes sans exposer leur contenu', async () => {
    await provider.send({
      to: 'destinataire@example.com',
      subject: 'Avec pièce jointe',
      text: 'corps',
      attachments: [
        {
          filename: 'document.pdf',
          content: Buffer.from('SECRET-PDF'),
          contentType: 'application/pdf',
        },
      ],
    });

    const logged = loggedLines.join('\n');
    expect(logged).toContain('attachments=1');
    expect(logged).not.toContain('SECRET-PDF');
  });
});
