import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '../../domain/payment-method.enum';

/** Corps de POST /payments. */
export class RecordPaymentDto {
  @ApiProperty({
    description: 'Facture encaissée (SENT, OVERDUE ou PARTIALLY_PAID).',
  })
  @IsUUID(undefined, {
    message: "L'invoiceId doit être un UUID valide.",
  })
  invoiceId!: string;

  @ApiProperty({
    description: 'Montant encaissé en EUR — au plus le reste à payer.',
    example: 500,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Le montant doit être un nombre (2 décimales max).' },
  )
  @IsPositive({ message: 'Le montant doit être strictement positif.' })
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.BankTransfer })
  @IsEnum(PaymentMethod, {
    message:
      'La méthode doit valoir BANK_TRANSFER, CARD, CASH, CHECK ou OTHER.',
  })
  method!: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Référence externe (n° de virement, n° de chèque…).',
    example: 'VIR-2026-07-1842',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'La référence ne peut pas dépasser 100 caractères.',
  })
  reference?: string;

  @ApiPropertyOptional({ example: 'Acompte de 50 % à la commande.' })
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Les notes ne peuvent pas dépasser 500 caractères.',
  })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Date de VALEUR (ISO 8601). Défaut : maintenant.',
    example: '2026-07-17',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Le champ "paidAt" doit être une date ISO.' })
  paidAt?: string;
}
