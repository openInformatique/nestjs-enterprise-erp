import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateContactDto } from './create-contact.dto';

/**
 * Corps de PATCH /contacts/:id (ADMIN et MANAGER).
 *
 * PartialType(CreateContactDto) fabrique automatiquement une copie du
 * DTO de création où TOUT est optionnel, en conservant les validateurs
 * (un email fourni doit toujours être un email valide) et la doc
 * Swagger. On n'ajoute que ce qui n'existe pas à la création : isActive.
 *
 * ⚠️ Importer PartialType depuis '@nestjs/swagger' (et non
 * '@nestjs/mapped-types') : c'est la variante qui préserve la
 * documentation OpenAPI.
 */
export class UpdateContactDto extends PartialType(CreateContactDto) {
  @ApiPropertyOptional({
    description: 'Réactive (true) ou désactive (false) le contact.',
  })
  @IsOptional()
  @IsBoolean({ message: 'Le champ "isActive" doit valoir true ou false.' })
  isActive?: boolean;
}
