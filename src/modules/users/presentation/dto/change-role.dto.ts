import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '../../../../common/enums/user-role.enum';

/** Corps de PATCH /users/:id/role (réservé ADMIN). */
export class ChangeRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.Manager })
  @IsEnum(UserRole, {
    message: 'Le rôle doit valoir ADMIN, MANAGER ou EMPLOYEE.',
  })
  role!: UserRole;
}
