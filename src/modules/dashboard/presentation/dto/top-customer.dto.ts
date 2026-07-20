import { ApiProperty } from '@nestjs/swagger';

/** Un client du top 5 (par CA encaissé). */
export class TopCustomerDto {
  @ApiProperty({ description: 'Identifiant du contact (UUID).' })
  contactId!: string;

  @ApiProperty({ example: 'ACME Industries' })
  companyName!: string;

  @ApiProperty({
    description: 'Somme TTC des factures PAID.',
    example: 15230.8,
  })
  totalRevenue!: number;
}
