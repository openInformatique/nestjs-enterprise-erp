import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Charge les variables d'environnement AVANT l'évaluation d'AppModule.
 *
 * Nécessaire car l'inclusion du module de démonstration technique
 * (TECHNICAL_DEMO_ENDPOINTS_ENABLED) est décidée au moment où le
 * décorateur @Module d'AppModule est évalué, c'est-à-dire à l'import —
 * donc avant que ConfigModule ne charge lui-même les fichiers .env.
 *
 * La convention de chargement est identique à celle du ConfigurationModule :
 * `.env.<NODE_ENV>` prioritaire, `.env` en repli. La validation stricte
 * des variables reste assurée par ConfigModule au démarrage.
 *
 * Ce fichier doit être importé EN PREMIER par main.ts (et par les tests
 * e2e avant tout import d'AppModule).
 */
const nodeEnv = process.env.NODE_ENV ?? 'local';
for (const candidate of [`.env.${nodeEnv}`, '.env']) {
  const path = resolve(process.cwd(), candidate);
  if (existsSync(path)) {
    loadDotenv({ path });
    break;
  }
}

/** Indique si les endpoints de démonstration technique sont activés. */
export function isTechnicalDemoEnabled(): boolean {
  return process.env.TECHNICAL_DEMO_ENDPOINTS_ENABLED === 'true';
}
