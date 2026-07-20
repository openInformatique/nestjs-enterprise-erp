import { Inject, Injectable } from '@nestjs/common';
import { RequestContextService } from '../../../common/context/request-context.service';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import {
  PDF_GENERATOR,
  PDF_TEMPLATE_TECHNICAL_DEMO,
} from '../domain/pdf-generator.port';
import type {
  PdfGeneratorPort,
  TechnicalDemoPdfData,
} from '../domain/pdf-generator.port';

/**
 * Cas d'utilisation de démonstration : génération du PDF technique.
 *
 * Le document contient la date de génération, l'utilisateur demandeur,
 * le request ID et des données fictives. Un audit TECHNICAL est
 * enregistré à chaque génération.
 */
@Injectable()
export class GenerateDemoPdfUseCase {
  constructor(
    @Inject(PDF_GENERATOR)
    private readonly pdfGenerator: PdfGeneratorPort,
    private readonly auditService: AuditService,
    private readonly requestContext: RequestContextService,
  ) {}

  async execute(requestedByUserId: string): Promise<Buffer> {
    const data: TechnicalDemoPdfData = {
      generatedAt: new Date(),
      userId: requestedByUserId,
      requestId: this.requestContext.getRequestId() ?? null,
    };

    const pdf = await this.pdfGenerator.generate(
      PDF_TEMPLATE_TECHNICAL_DEMO,
      data,
    );

    await this.auditService.record({
      category: AuditCategory.Technical,
      action: 'pdf.demo.generated',
      actorUserId: requestedByUserId,
      resourceType: 'pdf',
      metadata: {
        template: PDF_TEMPLATE_TECHNICAL_DEMO,
        sizeBytes: pdf.length,
      },
    });

    return pdf;
  }
}
