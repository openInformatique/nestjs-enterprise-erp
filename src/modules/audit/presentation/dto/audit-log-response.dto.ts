import { ApiProperty } from '@nestjs/swagger';
import { AuditCategory } from '../../domain/audit-category.enum';
import { AuditLog } from '../../domain/audit-log';

/** Représentation publique d'un événement d'audit. */
export class AuditLogResponseDto {
  @ApiProperty({ description: "Identifiant de l'événement (UUID)." })
  id!: string;

  @ApiProperty({ enum: AuditCategory })
  category!: AuditCategory;

  @ApiProperty({ example: 'payments.recorded' })
  action!: string;

  @ApiProperty({
    nullable: true,
    description: "UUID de l'acteur ; null si anonyme/système.",
  })
  actorUserId!: string | null;

  @ApiProperty({ nullable: true, example: 'invoice' })
  resourceType!: string | null;

  @ApiProperty({ nullable: true })
  resourceId!: string | null;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Corrélation avec les logs techniques.',
  })
  requestId!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Contexte JSON, déjà filtré des valeurs sensibles.',
  })
  metadata!: string | null;

  @ApiProperty()
  createdAt!: Date;

  static fromDomain(log: AuditLog): AuditLogResponseDto {
    const dto = new AuditLogResponseDto();
    dto.id = log.id;
    dto.category = log.category;
    dto.action = log.action;
    dto.actorUserId = log.actorUserId;
    dto.resourceType = log.resourceType;
    dto.resourceId = log.resourceId;
    dto.ipAddress = log.ipAddress;
    dto.requestId = log.requestId;
    dto.metadata = log.metadata;
    dto.createdAt = log.createdAt;
    return dto;
  }
}
