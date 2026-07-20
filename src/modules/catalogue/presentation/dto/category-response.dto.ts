import { ApiProperty } from '@nestjs/swagger';
import { Category } from '../../domain/category';

/** Représentation publique d'une catégorie (liste plate). */
export class CategoryResponseDto {
  @ApiProperty({ description: 'Identifiant de la catégorie (UUID).' })
  id!: string;

  @ApiProperty({ example: 'Matériel informatique' })
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({
    description: 'null = catégorie racine ; sinon id du parent.',
    nullable: true,
  })
  parentId!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDomain(category: Category): CategoryResponseDto {
    const dto = new CategoryResponseDto();
    dto.id = category.id;
    dto.name = category.name;
    dto.description = category.description;
    dto.parentId = category.parentId;
    dto.isActive = category.isActive;
    dto.createdAt = category.createdAt;
    dto.updatedAt = category.updatedAt;
    return dto;
  }
}
