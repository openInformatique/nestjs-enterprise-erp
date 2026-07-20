import { ApiProperty } from '@nestjs/swagger';

/** Une commande récente. */
export class RecentOrderDto {
  @ApiProperty({ description: 'Identifiant de la commande (UUID).' })
  id!: string;

  @ApiProperty({ example: 'CMD-2026-0003' })
  number!: string;

  @ApiProperty({ example: 'CUSTOMER' })
  type!: string;

  @ApiProperty({ example: 'IN_PROGRESS' })
  status!: string;

  @ApiProperty({ description: 'Nom du contact.', example: 'ACME Industries' })
  contact!: string;

  @ApiProperty({ example: 839.76 })
  totalTTC!: number;

  @ApiProperty()
  createdAt!: Date;
}
