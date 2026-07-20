import { ApiProperty } from '@nestjs/swagger';
import { OverdueInvoiceSummary } from '../../application/get-overdue-summary.use-case';
import { PaymentResponseDto } from './payment-response.dto';

/** Le client à relancer. */
export class OverdueCustomerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'ACME Industries' })
  companyName!: string;

  @ApiProperty({ nullable: true, example: 'compta@acme-industries.fr' })
  email!: string | null;
}

/**
 * Une ligne du résumé des impayés : la facture, le client à relancer,
 * le retard et les encaissements déjà reçus.
 */
export class OverdueInvoiceSummaryDto {
  @ApiProperty({ description: 'Identifiant de la facture (UUID).' })
  invoiceId!: string;

  @ApiProperty({ example: 'FAC-2026-0001' })
  invoiceNumber!: string;

  @ApiProperty({ type: OverdueCustomerDto })
  customer!: OverdueCustomerDto;

  @ApiProperty({ example: 1094.76 })
  totalTTC!: number;

  @ApiProperty({ example: 500 })
  paidAmount!: number;

  @ApiProperty({ description: 'Reste à payer (TTC - payé).', example: 594.76 })
  remainingAmount!: number;

  @ApiProperty({ description: "Date d'échéance." })
  dueDate!: Date;

  @ApiProperty({
    description: 'Jours de retard (0 si l’échéance n’est pas dépassée).',
    example: 12,
  })
  daysOverdue!: number;

  @ApiProperty({ type: [PaymentResponseDto] })
  payments!: PaymentResponseDto[];

  static fromSummary(summary: OverdueInvoiceSummary): OverdueInvoiceSummaryDto {
    const dto = new OverdueInvoiceSummaryDto();
    dto.invoiceId = summary.invoice.id;
    dto.invoiceNumber = summary.invoice.number;
    dto.customer = {
      id: summary.invoice.customerId,
      companyName: summary.invoice.customerName,
      email: summary.customerEmail,
    };
    dto.totalTTC = summary.invoice.totalTTC;
    dto.paidAmount = summary.invoice.paidAmount;
    dto.remainingAmount = summary.invoice.remainingAmount();
    dto.dueDate = summary.invoice.dueDate;
    dto.daysOverdue = summary.daysOverdue;
    dto.payments = summary.payments.map(PaymentResponseDto.fromDomain);
    return dto;
  }
}
