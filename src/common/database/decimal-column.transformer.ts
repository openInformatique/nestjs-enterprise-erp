import { ValueTransformer } from 'typeorm';

/**
 * Conversion des colonnes SQL decimal <-> number JavaScript.
 *
 * Le driver mssql renvoie les decimal en string pour préserver la
 * précision. Pour les montants de cet ERP (2 décimales, magnitudes
 * d'un ERP de gestion), la conversion en number est sans perte et
 * beaucoup plus pratique (calculs, JSON).
 *
 * Usage :
 *   @Column({ type: 'decimal', precision: 12, scale: 2,
 *             transformer: new DecimalColumnTransformer() })
 */
export class DecimalColumnTransformer implements ValueTransformer {
  /** JS -> SQL : TypeORM sait sérialiser un number, rien à faire. */
  to(value: number | null): number | null {
    return value;
  }

  /** SQL -> JS : "49.90" (string) devient 49.9 (number). */
  from(value: string | null): number | null {
    return value === null ? null : Number(value);
  }
}
