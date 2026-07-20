import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InvoiceLineInputDto } from './invoice-line-input.dto';

/**
 * Corps de POST /invoices (création MANUELLE).
 * Pas d'orderId ici : facturer une commande passe par
 * POST /orders/:id/invoice, qui vérifie le statut de la commande.
 */
export class CreateInvoiceDto {
  @ApiProperty({ description: 'Contact client (type CUSTOMER ou BOTH).' })
  @IsUUID(undefined, {
    message: 'Le customerId doit être un UUID valide.',
  })
  customerId!: string;

  @ApiPropertyOptional({
    description: "Date d'échéance (ISO 8601). Défaut : émission + 30 jours.",
    example: '2026-08-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Le champ "dueDate" doit être une date ISO.' })
  dueDate?: string;

  @ApiPropertyOptional({ example: 'Facturation prestation juillet 2026.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'Les notes ne peuvent pas dépasser 2000 caractères.',
  })
  notes?: string;

  @ApiProperty({
    description: 'Lignes de la facture (au moins une).',
    type: [InvoiceLineInputDto],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Une facture doit contenir au moins une ligne.',
  })
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineInputDto)
  lines!: InvoiceLineInputDto[];
}
