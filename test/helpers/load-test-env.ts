/**
 * Setup Jest (intégration et e2e) : force l'environnement de test et
 * charge .env.test AVANT tout import applicatif.
 *
 * Garantit que les suites ne touchent JAMAIS la base locale : la
 * configuration chargée pointe exclusivement vers la base *_test.
 */
process.env.NODE_ENV = 'test';

// bootstrap-env charge .env.test selon la convention du socle.
import '../../src/bootstrap-env';

if (!process.env.DB_DATABASE?.endsWith('_test')) {
  throw new Error(
    `Sécurité des tests : DB_DATABASE doit se terminer par "_test" ` +
      `(valeur actuelle : "${process.env.DB_DATABASE ?? 'absente'}"). ` +
      `Vérifiez le fichier .env.test.`,
  );
}
