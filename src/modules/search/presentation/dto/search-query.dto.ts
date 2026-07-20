import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { SearchResultType } from '../../domain/search-result';

/** Normalise `?types=` (chaîne unique ou tableau) en tableau. */
function toArray({ value }: TransformFnParams): unknown[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Query de GET /search.
 *
 * `types` peut arriver comme une chaîne UNIQUE (`?types=CONTACT`) ou un
 * tableau (`?types=CONTACT&types=PRODUCT`) selon le nombre de valeurs —
 * c'est le comportement standard du parseur de query d'Express. Le
 * `@Transform` normalise les deux cas en tableau AVANT la validation.
 */
export class SearchQueryDto {
  @ApiProperty({
    description: 'Terme recherché (2 caractères minimum).',
    example: 'dupont',
  })
  @IsString()
  @MinLength(2, {
    message: 'Le paramètre "q" doit contenir au moins 2 caractères.',
  })
  q!: string;

  @ApiPropertyOptional({
    description: 'Types à chercher ; absent = tous les types.',
    enum: SearchResultType,
    isArray: true,
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(SearchResultType, {
    each: true,
    message: 'Chaque type doit valoir CONTACT, PRODUCT, ORDER ou INVOICE.',
  })
  types?: SearchResultType[];
}
