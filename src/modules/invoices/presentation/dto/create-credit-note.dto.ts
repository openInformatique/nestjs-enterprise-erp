import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InvoiceLineInputDto } from './invoice-line-input.dto';

/** Corps de POST /invoices/:id/credit-note. */
export class CreateCreditNoteDto {
  @ApiPropertyOptional({
    description:
      'Lignes de l’avoir. ABSENTES : copie intégrale de la facture ' +
      'source (avoir total). FOURNIES : avoir partiel.',
    type: [InvoiceLineInputDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Un avoir partiel doit contenir au moins une ligne.',
  })
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineInputDto)
  lines?: InvoiceLineInputDto[];

  @ApiPropertyOptional({
    example: 'Remboursement de deux écrans défectueux.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'Les notes ne peuvent pas dépasser 2000 caractères.',
  })
  notes?: string;
}
