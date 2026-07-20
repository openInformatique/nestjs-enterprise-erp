import { ApiProperty } from '@nestjs/swagger';
import { Warehouse } from '../../domain/warehouse';

/** Représentation publique d'un entrepôt. */
export class WarehouseResponseDto {
  @ApiProperty({ description: "Identifiant de l'entrepôt (UUID)." })
  id!: string;

  @ApiProperty({ example: 'Entrepôt Paris Nord' })
  name!: string;

  @ApiProperty({ example: 'WH-PARIS' })
  code!: string;

  @ApiProperty({ nullable: true })
  street!: string | null;

  @ApiProperty({ nullable: true })
  city!: string | null;

  @ApiProperty({ description: 'False = désactivé (plus aucun mouvement).' })
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDomain(warehouse: Warehouse): WarehouseResponseDto {
    const dto = new WarehouseResponseDto();
    dto.id = warehouse.id;
    dto.name = warehouse.name;
    dto.code = warehouse.code;
    dto.street = warehouse.street;
    dto.city = warehouse.city;
    dto.isActive = warehouse.isActive;
    dto.createdAt = warehouse.createdAt;
    dto.updatedAt = warehouse.updatedAt;
    return dto;
  }
}
