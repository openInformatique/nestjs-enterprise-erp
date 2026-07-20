import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ContactType } from '../../domain/contact-type.enum';

/** Corps de POST /contacts (ADMIN et MANAGER). */
export class CreateContactDto {
  @ApiProperty({
    description: 'Nature du contact.',
    enum: ContactType,
    example: ContactType.Customer,
  })
  @IsEnum(ContactType, {
    message: 'Le type doit valoir CUSTOMER, SUPPLIER ou BOTH.',
  })
  type!: ContactType;

  @ApiProperty({ example: 'Dupont & Fils SARL' })
  @IsString()
  @MinLength(1, { message: 'Le nom de la société est obligatoire.' })
  @MaxLength(255, {
    message: 'Le nom de la société ne peut pas dépasser 255 caractères.',
  })
  companyName!: string;

  @ApiPropertyOptional({ example: 'Jean Dupont' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @ApiPropertyOptional({ example: 'contact@dupont-fils.fr' })
  @IsOptional()
  @IsEmail({}, { message: "L'e-mail est invalide." })
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional({ example: '+33 1 23 45 67 89' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: '12 rue de la République' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @ApiPropertyOptional({ example: 'Lyon' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: '69002' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Code pays ISO à 2 lettres (FR si absent).',
    example: 'FR',
    default: 'FR',
  })
  @IsOptional()
  @Length(2, 2, {
    message: 'Le pays doit être un code ISO à 2 lettres (ex. : FR).',
  })
  country?: string;

  @ApiPropertyOptional({
    description: 'SIRET français : exactement 14 chiffres.',
    example: '73282932000074',
  })
  @IsOptional()
  @Matches(/^\d{14}$/, {
    message: 'Le SIRET doit contenir exactement 14 chiffres.',
  })
  siret?: string;

  @ApiPropertyOptional({
    description: 'Numéro de TVA intracommunautaire.',
    example: 'FR40303265045',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vatNumber?: string;

  @ApiPropertyOptional({ description: 'Notes libres internes.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'Les notes ne peuvent pas dépasser 2000 caractères.',
  })
  notes?: string;
}
