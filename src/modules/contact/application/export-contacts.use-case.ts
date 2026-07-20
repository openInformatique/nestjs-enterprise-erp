import { Inject, Injectable } from '@nestjs/common';
import { ExportFormat } from '../../../common/enums/export-format.enum';
import { ExportTooLargeException } from '../../../common/exceptions/app-exceptions';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { ExportHelper } from '../../../common/utils/export.helper';
import { EXPORT_MAX_ROWS } from '../../../common/utils/export.constants';
import { CONTACT_REPOSITORY } from '../domain/contact-repository.port';
import type { ContactRepositoryPort } from '../domain/contact-repository.port';
import { ContactType } from '../domain/contact-type.enum';

/** Filtres d'export (les mêmes que la liste, sans pagination ni tri). */
export interface ExportContactsFilters {
  type?: ContactType;
  search?: string;
}

const HEADERS = [
  'Type',
  'Société',
  'Contact',
  'E-mail',
  'Téléphone',
  'Ville',
  'Pays',
  'SIRET',
  'TVA intracommunautaire',
  'Actif',
];

/** Cas d'utilisation : exporter les contacts (CSV/XLSX), filtres appliqués. */
@Injectable()
export class ExportContactsUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
  ) {}

  async execute(
    filters: ExportContactsFilters,
    format: ExportFormat,
  ): Promise<Buffer> {
    const result = await this.contactRepository.findAll({
      page: 1,
      limit: EXPORT_MAX_ROWS + 1,
      sortDirection: SortDirection.Asc,
      type: filters.type,
      search: filters.search,
    });

    if (result.meta.totalItems > EXPORT_MAX_ROWS) {
      throw new ExportTooLargeException(
        result.meta.totalItems,
        EXPORT_MAX_ROWS,
      );
    }

    const rows = result.items.map((contact) => [
      contact.type,
      contact.companyName,
      contact.contactName ?? '',
      contact.email ?? '',
      contact.phone ?? '',
      contact.city ?? '',
      contact.country,
      contact.siret ?? '',
      contact.vatNumber ?? '',
      contact.isActive ? 'Oui' : 'Non',
    ]);

    return format === ExportFormat.Xlsx
      ? ExportHelper.toXLSX('Contacts', HEADERS, rows)
      : ExportHelper.toCSV(HEADERS, rows);
  }
}
