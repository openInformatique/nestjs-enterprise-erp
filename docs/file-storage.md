# Stockage de fichiers

## Contrat

```typescript
export interface FileStoragePort {
  save(file: FileToStore): Promise<StoredFile>;
  read(identifier: string): Promise<Readable>;
  stat(identifier: string): Promise<StoredFile>;
  delete(identifier: string): Promise<void>;
  exists(identifier: string): Promise<boolean>;
}
```

Injection via le jeton `FILE_STORAGE`.

## Implémentation locale (`STORAGE_DRIVER=local`)

- répertoire `STORAGE_LOCAL_PATH`, créé automatiquement au démarrage ;
- noms physiques = UUID générés par le serveur (`<uuid>.bin`) ; le nom
  original est conservé dans un sidecar JSON (`<uuid>.meta.json`) — pas de
  table SQL de métadonnées dans cette version ;
- validation type MIME (`STORAGE_ALLOWED_MIME_TYPES`) et taille
  (`STORAGE_MAX_FILE_SIZE`) avant écriture ;
- téléchargements en **streaming** (jamais de chargement complet en mémoire).

### Protections anti-traversée de répertoires

1. le nom original ne participe JAMAIS au chemin (et il est passé par
   `basename()` avant stockage dans les métadonnées) ;
2. les identifiants sont validés par expression régulière UUID stricte ;
3. défense en profondeur : le chemin résolu doit rester dans le répertoire de
   stockage, sinon `FILE_NOT_FOUND`.

## Erreurs

`FILE_NOT_FOUND` (404), `FILE_TYPE_NOT_ALLOWED` (400), `FILE_TOO_LARGE` (413).

## Démonstration

Si `TECHNICAL_DEMO_ENDPOINTS_ENABLED=true` (JWT requis) :

```text
POST   /api/v1/technical-demo/files      (multipart, champ "file")
GET    /api/v1/technical-demo/files/:id  (flux, hors enveloppe JSON)
DELETE /api/v1/technical-demo/files/:id
```

Dépôt et suppression sont audités (`storage.file.stored` / `storage.file.deleted`).

## Remplacer par un stockage cloud

Créer un adaptateur implémentant `FileStoragePort` (Azure Blob Storage, Amazon
S3, partage réseau...) dans `src/modules/storage/infrastructure/`, ajouter la
valeur au `StorageDriver` de la configuration, et sélectionner l'implémentation
dans `StorageModule` selon `STORAGE_DRIVER` (même pattern que le module mail).
Les consommateurs (upload, download, PDF...) ne changent pas d'une ligne.
