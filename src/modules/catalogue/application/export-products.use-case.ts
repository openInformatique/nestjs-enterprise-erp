import { Inject, Injectable } from '@nestjs/common';
import { ExportFormat } from '../../../common/enums/export-format.enum';
import { ExportTooLargeException } from '../../../common/exceptions/app-exceptions';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { ExportHelper } from '../../../common/utils/export.helper';
import { EXPORT_MAX_ROWS } from '../../../common/utils/export.constants';
import { PRODUCT_REPOSITORY } from '../domain/product-repository.port';
import type { ProductRepositoryPort } from '../domain/product-repository.port';
import { ProductType } from '../domain/product-type.enum';
import { ListCategoriesUseCase } from './list-categories.use-case';

/** Filtres d'export. */
export interface ExportProductsFilters {
  type?: ProductType;
  categoryId?: string;
  search?: string;
}

const HEADERS = [
  'SKU',
  'Nom',
  'Type',
  'Catégorie',
  'Prix de vente HT',
  "Prix d'achat HT",
  'TVA (%)',
  'Unité',
  'Actif',
];

/** Cas d'utilisation : exporter le catalogue (CSV/XLSX), filtres appliqués. */
@Injectable()
export class ExportProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    private readonly listCategoriesUseCase: ListCategoriesUseCase,
  ) {}

  async execute(
    filters: ExportProductsFilters,
    format: ExportFormat,
  ): Promise<Buffer> {
    const [result, categories] = await Promise.all([
      this.productRepository.findAll({
        page: 1,
        limit: EXPORT_MAX_ROWS + 1,
        sortDirection: SortDirection.Asc,
        type: filters.type,
        categoryId: filters.categoryId,
        search: filters.search,
      }),
      // Chargée UNE fois (liste plate, module 03) : résout categoryId ->
      // nom sans requête par ligne, même sur 10 000 produits.
      this.listCategoriesUseCase.execute({}),
    ]);

    if (result.meta.totalItems > EXPORT_MAX_ROWS) {
      throw new ExportTooLargeException(
        result.meta.totalItems,
        EXPORT_MAX_ROWS,
      );
    }

    const categoryNames = new Map(
      categories.map((category) => [category.id, category.name]),
    );

    const rows = result.items.map((product) => [
      product.sku,
      product.name,
      product.type,
      product.categoryId ? (categoryNames.get(product.categoryId) ?? '') : '',
      product.unitPrice,
      product.purchasePrice ?? '',
      product.vatRate,
      product.unit,
      product.isActive ? 'Oui' : 'Non',
    ]);

    return format === ExportFormat.Xlsx
      ? ExportHelper.toXLSX('Produits', HEADERS, rows)
      : ExportHelper.toCSV(HEADERS, rows);
  }
}
