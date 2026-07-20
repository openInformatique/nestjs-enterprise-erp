import { ApiProperty } from '@nestjs/swagger';

/** Une facture récente. */
export class RecentInvoiceDto {
  @ApiProperty({ description: 'Identifiant de la facture (UUID).' })
  id!: string;

  @ApiProperty({ example: 'FAC-2026-0002' })
  number!: string;

  @ApiProperty({ example: 'PARTIALLY_PAID' })
  status!: string;

  @ApiProperty({ description: 'Nom du client.', example: 'ACME Industries' })
  contact!: string;

  @ApiProperty({ example: 1094.76 })
  totalTTC!: number;

  @ApiProperty({ description: 'Reste à payer.', example: 594.76 })
  remainingAmount!: number;

  @ApiProperty({ description: "Date d'échéance." })
  dueDate!: Date;
}
