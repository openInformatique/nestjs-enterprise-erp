/**
 * Plafond de lignes d'un export. Au-delà, on refuse (422) plutôt que
 * de tronquer silencieusement — un export tronqué sans le dire est
 * un mensonge comptable.
 */
export const EXPORT_MAX_ROWS = 10_000;
