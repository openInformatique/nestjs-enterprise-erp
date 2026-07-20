# Tâches planifiées

## Fonctionnement

Le module `scheduler` s'appuie sur `@nestjs/schedule`. L'infrastructure cron
est toujours enregistrée ; chaque tâche vérifie `SCHEDULER_ENABLED` à
l'exécution — l'activation se pilote donc par configuration, sans
recompilation.

## Tâche fournie : purge des sessions expirées

`SessionCleanupTask` (`@Cron` horaire) supprime les sessions expirées depuis
plus de **7 jours** (rétention volontaire : une session expirée est déjà
inutilisable, la conserver quelques jours facilite les investigations de
sécurité).

Garanties :

- **idempotente** : supprimer zéro ligne est un résultat normal ;
- **journalisée** : début, fin, durée, nombre de lignes supprimées ;
- **résiliente** : les erreurs sont capturées et journalisées, jamais
  propagées ;
- **sans exécution concurrente locale** : un verrou en mémoire ignore un
  déclenchement pendant qu'une exécution est en cours ;
- **testable sans attendre le cron** : la méthode `execute()` est publique et
  couverte par des tests unitaires (concurrence, erreurs, seuil).

## Limite documentée : déploiement multi-instances

Le verrou anti-concurrence est LOCAL au processus. Si le monolithe est un jour
répliqué sur plusieurs instances, chaque instance exécutera la purge. Pour
cette tâche précise c'est sans danger (les DELETE concurrents sont
idempotents), mais pour toute tâche future non idempotente il faudra un
verrou partagé — par exemple `sp_getapplock` de SQL Server ou une table de
verrous dédiée — pris en début d'exécution.

## Ajouter une tâche

1. créer `<nom>.task.ts` dans `src/modules/scheduler/` en suivant le modèle
   (`@Cron`, garde `SCHEDULER_ENABLED`, verrou local, logs début/fin/durée,
   erreurs capturées, `execute()` public testable) ;
2. la déclarer dans les providers de `SchedulerModule` ;
3. écrire les tests unitaires (sans attendre le déclenchement réel) ;
4. documenter la tâche ici.
