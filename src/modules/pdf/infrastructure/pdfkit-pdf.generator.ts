import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import {
  PdfGeneratorPort,
  PDF_TEMPLATE_TECHNICAL_DEMO,
  TechnicalDemoPdfData,
} from '../domain/pdf-generator.port';

/**
 * Générateur PDF local basé sur PDFKit (bibliothèque serveur stable,
 * sans dépendance à un navigateur headless).
 *
 * Chaque gabarit est une méthode privée ; en ajouter un consiste à
 * enregistrer une nouvelle entrée dans le dispatch de generate().
 */
@Injectable()
export class PdfKitPdfGenerator implements PdfGeneratorPort {
  async generate<TData>(template: string, data: TData): Promise<Buffer> {
    if (template === PDF_TEMPLATE_TECHNICAL_DEMO) {
      return this.renderTechnicalDemo(data as TechnicalDemoPdfData);
    }
    throw new ResourceNotFoundException(`Le gabarit PDF "${template}"`);
  }

  /** Collecte le flux PDFKit dans un Buffer. */
  private collect(document: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
      document.end();
    });
  }

  private renderTechnicalDemo(data: TechnicalDemoPdfData): Promise<Buffer> {
    const document = new PDFDocument({ size: 'A4', margin: 56 });

    document
      .fontSize(22)
      .text('Document de démonstration technique', { align: 'center' })
      .moveDown(2);

    document
      .fontSize(11)
      .text(`Date de génération : ${data.generatedAt.toISOString()}`)
      .text(`Utilisateur : ${data.userId}`)
      .text(`Request ID : ${data.requestId ?? 'non disponible'}`)
      .moveDown(2);

    document
      .fontSize(14)
      .text('Données fictives', { underline: true })
      .moveDown(0.5);

    // Quelques données fictives non métier, purement illustratives.
    const fakeRows: Array<[string, string]> = [
      ['Référence', 'DEMO-0001'],
      ['Libellé', 'Élément de démonstration'],
      ['Statut', 'Généré par le socle technique'],
      ['Version du gabarit', '1.0'],
    ];
    document.fontSize(11);
    for (const [label, value] of fakeRows) {
      document.text(`${label} : ${value}`);
    }

    document
      .moveDown(3)
      .fontSize(9)
      .fillColor('#666666')
      .text(
        'Document généré automatiquement par nestjs-enterprise-starter — ' +
          'aucune valeur contractuelle.',
        { align: 'center' },
      );

    return this.collect(document);
  }
}
