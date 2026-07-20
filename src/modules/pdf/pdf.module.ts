import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { GenerateDemoPdfUseCase } from './application/generate-demo-pdf.use-case';
import { PDF_GENERATOR } from './domain/pdf-generator.port';
import { PdfKitPdfGenerator } from './infrastructure/pdfkit-pdf.generator';

/**
 * Module de génération de PDF.
 *
 * Fournit PdfGeneratorPort (implémentation PDFKit locale) et le cas
 * d'utilisation de démonstration.
 */
@Module({
  imports: [AuditModule],
  providers: [
    GenerateDemoPdfUseCase,
    {
      provide: PDF_GENERATOR,
      useClass: PdfKitPdfGenerator,
    },
  ],
  exports: [PDF_GENERATOR, GenerateDemoPdfUseCase],
})
export class PdfModule {}
