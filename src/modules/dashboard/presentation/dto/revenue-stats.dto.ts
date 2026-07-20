import { ApiProperty } from '@nestjs/swagger';

/** CA encaissé (factures INVOICE au statut PAID). */
export class RevenueStatsDto {
  @ApiProperty({ description: 'CA TTC du mois courant.', example: 12480.5 })
  currentMonth!: number;

  @ApiProperty({ description: 'CA TTC du mois précédent.', example: 9860 })
  lastMonth!: number;

  @ApiProperty({
    description: 'CA TTC depuis le 1er janvier.',
    example: 87310.25,
  })
  ytd!: number;
}
