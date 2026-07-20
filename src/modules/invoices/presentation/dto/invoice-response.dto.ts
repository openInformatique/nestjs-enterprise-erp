import { ApiProperty } from '@nestjs/swagger';
import { Invoice } from '../../domain/invoice';
import { InvoiceStatus } from '../../domain/invoice-status.enum';
import { InvoiceType } from '../../domain/invoice-type.enum';
import { InvoiceLineResponseDto } from './invoice-line-response.dto';

/**
 * Représentation publique d'une facture ou d'un avoir.
 * remainingAmount est CALCULÉ à la volée (jamais stocké).
 */
export class InvoiceResponseDto {
  @ApiProperty({ description: 'Identifiant de la facture (UUID).' })
  id!: string;

  @ApiProperty({ example: 'FAC-2026-0001' })
  number!: string;

  @ApiProperty({ enum: InvoiceType })
  type!: InvoiceType;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty()
  customerId!: string;

  @ApiProperty({ example: 'ACME Industries' })
  customerName!: string;

  @ApiProperty({
    nullable: true,
    description: 'Commande d’origine si la facture vient d’une conversion.',
  })
  orderId!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Facture corrigée par cet avoir (CREDIT_NOTE uniquement).',
  })
  creditNoteForId!: string | null;

  @ApiProperty({ description: "Date d'émission." })
  issueDate!: Date;

  @ApiProperty({ description: "Date d'échéance." })
  dueDate!: Date;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ type: [InvoiceLineResponseDto] })
  lines!: InvoiceLineResponseDto[];

  @ApiProperty({ example: 912.3 })
  totalHT!: number;

  @ApiProperty({ example: 182.46 })
  totalVAT!: number;

  @ApiProperty({ example: 1094.76 })
  totalTTC!: number;

  @ApiProperty({ description: 'Déjà encaissé (module 08).', example: 0 })
  paidAmount!: number;

  @ApiProperty({
    description: 'Reste à payer (TTC - payé).',
    example: 1094.76,
  })
  remainingAmount!: number;

  @ApiProperty({
    nullable: true,
    description: 'URL du PDF (branché au niveau min-).',
  })
  pdfUrl!: string | null;

  @ApiProperty({ nullable: true, description: 'UUID du créateur.' })
  createdBy!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDomain(invoice: Invoice): InvoiceResponseDto {
    const dto = new InvoiceResponseDto();
    dto.id = invoice.id;
    dto.number = invoice.number;
    dto.type = invoice.type;
    dto.status = invoice.status;
    dto.customerId = invoice.customerId;
    dto.customerName = invoice.customerName;
    dto.orderId = invoice.orderId;
    dto.creditNoteForId = invoice.creditNoteForId;
    dto.issueDate = invoice.issueDate;
    dto.dueDate = invoice.dueDate;
    dto.notes = invoice.notes;
    dto.lines = invoice.lines.map(InvoiceLineResponseDto.fromDomain);
    dto.totalHT = invoice.totalHT;
    dto.totalVAT = invoice.totalVAT;
    dto.totalTTC = invoice.totalTTC;
    dto.paidAmount = invoice.paidAmount;
    dto.remainingAmount = invoice.remainingAmount();
    dto.pdfUrl = invoice.pdfUrl;
    dto.createdBy = invoice.createdBy;
    dto.createdAt = invoice.createdAt;
    dto.updatedAt = invoice.updatedAt;
    return dto;
  }
}
