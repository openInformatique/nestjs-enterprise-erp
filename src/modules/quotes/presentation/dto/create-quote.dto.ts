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
import { QuoteLineInputDto } from './quote-line-input.dto';

/** Corps de POST /quotes. */
export class CreateQuoteDto {
  @ApiProperty({ description: 'Contact client (type CUSTOMER ou BOTH).' })
  @IsUUID(undefined, {
    message: 'Le customerId doit être un UUID valide.',
  })
  customerId!: string;

  @ApiPropertyOptional({
    description: 'Date limite de validité (ISO 8601). Défaut : +30 jours.',
    example: '2026-08-15',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Le champ "validUntil" doit être une date ISO.' },
  )
  validUntil?: string;

  @ApiPropertyOptional({ example: 'Remise fidélité appliquée sur les écrans.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'Les notes ne peuvent pas dépasser 2000 caractères.',
  })
  notes?: string;

  @ApiProperty({
    description: 'Lignes du devis (au moins une).',
    type: [QuoteLineInputDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Un devis doit contenir au moins une ligne.' })
  // ValidateNested : descend valider CHAQUE ligne ; Type : indique à
  // class-transformer la classe cible (sinon il reçoit des objets nus
  // et aucune validation de ligne ne s'exécute).
  @ValidateNested({ each: true })
  @Type(() => QuoteLineInputDto)
  lines!: QuoteLineInputDto[];
}
