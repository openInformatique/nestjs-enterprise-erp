import ExcelJS from 'exceljs';

/** BOM UTF-8 : sans lui, Excel affiche les accents comme du charabia. */
const UTF8_BOM = '﻿';

/**
 * Convertit une valeur de cellule en texte CSV sûr.
 * Les lignes d'export ne portent que des primitives et des Date (jamais
 * d'objet arbitraire) : le type est restreint explicitement plutôt que
 * de faire confiance à un `String(unknown)` générique.
 */
function formatCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return '';
}

/** Échappe un champ CSV : guillemets doublés si virgule, guillemet ou saut de ligne. */
function escapeCsvField(raw: string): string {
  if (/[",\n;]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/** Construction de fichiers d'export — aucune dépendance à un module métier. */
export class ExportHelper {
  /** CSV UTF-8 avec BOM (compatibilité Excel), séparateur virgule. */
  static toCSV(headers: string[], rows: unknown[][]): Buffer {
    const lines = [headers, ...rows].map((row) =>
      row.map((cell) => escapeCsvField(formatCsvCell(cell))).join(','),
    );
    return Buffer.from(UTF8_BOM + lines.join('\r\n'), 'utf-8');
  }

  /** Classeur XLSX à une feuille, en-tête en gras. */
  static async toXLSX(
    sheetName: string,
    headers: string[],
    rows: unknown[][],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    sheet.addRow(headers);
    for (const row of rows) {
      sheet.addRow(row);
    }
    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
