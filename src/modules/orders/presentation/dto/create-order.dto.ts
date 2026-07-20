import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { OrderType } from '../../domain/order-type.enum';
import { OrderLineInputDto } from './order-line-input.dto';

/** Corps de POST /orders. */
export class CreateOrderDto {
  @ApiProperty({
    description:
      'CUSTOMER = un client nous commande ; SUPPLIER = nous commandons.',
    enum: OrderType,
    example: OrderType.Customer,
  })
  @IsEnum(OrderType, {
    message: 'Le type doit valoir CUSTOMER ou SUPPLIER.',
  })
  type!: OrderType;

  @ApiProperty({
    description:
      'Contact — client (CUSTOMER/BOTH) ou fournisseur (SUPPLIER/BOTH) ' +
      'selon le type de commande.',
  })
  @IsUUID(undefined, {
    message: 'Le contactId doit être un UUID valide.',
  })
  contactId!: string;

  @ApiPropertyOptional({ example: 'Livraison souhaitée avant fin de mois.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'Les notes ne peuvent pas dépasser 2000 caractères.',
  })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Date de livraison prévue (ISO 8601).',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La date de livraison prévue doit être une date ISO.' },
  )
  expectedDeliveryDate?: string;

  @ApiProperty({
    description: 'Lignes de la commande (au moins une).',
    type: [OrderLineInputDto],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Une commande doit contenir au moins une ligne.',
  })
  @ValidateNested({ each: true })
  @Type(() => OrderLineInputDto)
  lines!: OrderLineInputDto[];
}
