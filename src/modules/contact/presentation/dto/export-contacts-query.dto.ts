import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ExportFormat } from '../../../../common/enums/export-format.enum';
import { ContactType } from '../../domain/contact-type.enum';

/** Query de GET /contacts/export — les filtres habituels, SANS pagination. */
export class ExportContactsQueryDto {
  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat, { message: 'Le format doit valoir "csv" ou "xlsx".' })
  format!: ExportFormat;

  @ApiPropertyOptional({ enum: ContactType })
  @IsOptional()
  @IsEnum(ContactType, {
    message: 'Le type doit valoir CUSTOMER, SUPPLIER ou BOTH.',
  })
  type?: ContactType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
