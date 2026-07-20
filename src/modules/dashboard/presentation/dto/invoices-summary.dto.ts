import { ApiProperty } from '@nestjs/swagger';

/** Les créances — montants = reste à encaisser (TTC - payé). */
export class InvoicesSummaryDto {
  @ApiProperty({ description: 'Factures SENT.', example: 3 })
  pendingCount!: number;

  @ApiProperty({ example: 4820.4 })
  pendingAmount!: number;

  @ApiProperty({ description: 'Factures OVERDUE.', example: 1 })
  overdueCount!: number;

  @ApiProperty({ example: 1094.76 })
  overdueAmount!: number;

  @ApiProperty({ description: 'Factures PARTIALLY_PAID.', example: 2 })
  partialCount!: number;

  @ApiProperty({ example: 730.15 })
  partialAmount!: number;
}
