import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../../../common/enums/user-role.enum';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';

/**
 * Query string de GET /users.
 * Hérite des paramètres communs du socle (page, limit, sortBy,
 * sortDirection, search) et ajoute les filtres propres au module.
 */
export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtre par rôle.', enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole, {
    message: 'Le paramètre "role" doit valoir ADMIN, MANAGER ou EMPLOYEE.',
  })
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Filtre par statut (true = actifs, false = désactivés).',
  })
  @IsOptional()
  // Une query string est toujours du texte : "true"/"false" doivent être
  // convertis à la main. NE PAS utiliser @Type(() => Boolean) : il
  // convertirait la chaîne "false" (non vide) en... true.
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({
    message: 'Le paramètre "isActive" doit valoir true ou false.',
  })
  isActive?: boolean;
}
