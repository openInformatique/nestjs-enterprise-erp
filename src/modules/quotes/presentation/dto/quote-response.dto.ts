import { ApiProperty } from '@nestjs/swagger';
import { Quote } from '../../domain/quote';
import { QuoteStatus } from '../../domain/quote-status.enum';
import { QuoteLineResponseDto } from './quote-line-response.dto';

/**
 * Représentation publique d'un devis.
 * Dans les listes, `lines` est un tableau vide (le détail les charge).
 */
export class QuoteResponseDto {
  @ApiProperty({ description: 'Identifiant du devis (UUID).' })
  id!: string;

  @ApiProperty({ example: 'DEV-2026-0001' })
  number!: string;

  @ApiProperty({ enum: QuoteStatus })
  status!: QuoteStatus;

  @ApiProperty()
  customerId!: string;

  @ApiProperty({ example: 'ACME Industries' })
  customerName!: string;

  @ApiProperty({ description: 'Date limite de validité.' })
  validUntil!: Date;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ type: [QuoteLineResponseDto] })
  lines!: QuoteLineResponseDto[];

  @ApiProperty({ example: 714.82 })
  totalHT!: number;

  @ApiProperty({ example: 142.96 })
  totalVAT!: number;

  @ApiProperty({ example: 857.78 })
  totalTTC!: number;

  @ApiProperty({ nullable: true, description: 'UUID du créateur.' })
  createdBy!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDomain(quote: Quote): QuoteResponseDto {
    const dto = new QuoteResponseDto();
    dto.id = quote.id;
    dto.number = quote.number;
    dto.status = quote.status;
    dto.customerId = quote.customerId;
    dto.customerName = quote.customerName;
    dto.validUntil = quote.validUntil;
    dto.notes = quote.notes;
    dto.lines = quote.lines.map(QuoteLineResponseDto.fromDomain);
    dto.totalHT = quote.totalHT;
    dto.totalVAT = quote.totalVAT;
    dto.totalTTC = quote.totalTTC;
    dto.createdBy = quote.createdBy;
    dto.createdAt = quote.createdAt;
    dto.updatedAt = quote.updatedAt;
    return dto;
  }
}
