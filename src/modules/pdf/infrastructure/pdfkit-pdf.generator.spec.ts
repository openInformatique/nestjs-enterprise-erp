import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import {
  PDF_TEMPLATE_TECHNICAL_DEMO,
  TechnicalDemoPdfData,
} from '../domain/pdf-generator.port';
import { PdfKitPdfGenerator } from './pdfkit-pdf.generator';

describe('PdfKitPdfGenerator', () => {
  const generator = new PdfKitPdfGenerator();
  const demoData: TechnicalDemoPdfData = {
    generatedAt: new Date('2026-07-14T08:30:00.000Z'),
    userId: 'user-42',
    requestId: 'req-123',
  };

  it('génère un buffer non vide', async () => {
    const pdf = await generator.generate(PDF_TEMPLATE_TECHNICAL_DEMO, demoData);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(500);
  });

  it('produit un fichier commençant par la signature PDF (%PDF-)', async () => {
    const pdf = await generator.generate(PDF_TEMPLATE_TECHNICAL_DEMO, demoData);

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('rejette un gabarit inconnu', async () => {
    await expect(generator.generate('gabarit-inexistant', {})).rejects.toThrow(
      ResourceNotFoundException,
    );
  });
});
