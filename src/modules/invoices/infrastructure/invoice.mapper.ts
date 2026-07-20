import { Injectable } from '@nestjs/common';
import { Invoice } from '../domain/invoice';
import { InvoiceLine } from '../domain/invoice-line';
import { InvoiceEntity } from './entities/invoice.entity';
import { InvoiceLineEntity } from './entities/invoice-line.entity';

/** Conversion entités TypeORM -> modèles de domaine. */
@Injectable()
export class InvoiceMapper {
  toDomain(entity: InvoiceEntity): Invoice {
    const lines = [...(entity.lines ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((line) => this.lineToDomain(line));

    return new Invoice(
      entity.id,
      entity.number,
      entity.type,
      entity.customerId,
      entity.customer?.companyName ?? '',
      entity.orderId,
      entity.status,
      entity.issueDate,
      entity.dueDate,
      entity.totalHT,
      entity.totalVAT,
      entity.totalTTC,
      entity.paidAmount,
      entity.creditNoteForId,
      entity.pdfUrl,
      entity.notes,
      entity.createdBy,
      entity.createdAt,
      entity.updatedAt,
      lines,
    );
  }

  private lineToDomain(entity: InvoiceLineEntity): InvoiceLine {
    return new InvoiceLine(
      entity.id,
      entity.invoiceId,
      entity.productId,
      entity.description,
      entity.quantity,
      entity.unitPrice,
      entity.vatRate,
      entity.subtotalHT,
    );
  }
}
