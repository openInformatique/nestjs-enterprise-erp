import { Readable } from 'node:stream';

/** Fichier à enregistrer. */
export interface FileToStore {
  /** Nom original fourni par le client (conservé à titre informatif). */
  originalName: string;
  mimeType: string;
  content: Buffer;
}

/** Fichier enregistré. */
export interface StoredFile {
  /** Identifiant opaque (UUID) servant aux lectures et suppressions. */
  identifier: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storedAt: Date;
}

/**
 * Contrat de stockage de fichiers.
 *
 * L'implémentation locale (disque) est fournie par le socle ; le port
 * permet de basculer plus tard vers Azure Blob Storage, Amazon S3 ou un
 * stockage réseau sans toucher aux consommateurs
 * (voir docs/file-storage.md).
 */
export interface FileStoragePort {
  save(file: FileToStore): Promise<StoredFile>;
  /** Flux de lecture ; FileNotFoundException si l'identifiant est inconnu. */
  read(identifier: string): Promise<Readable>;
  /** Métadonnées connues du fichier ; FileNotFoundException si inconnu. */
  stat(identifier: string): Promise<StoredFile>;
  delete(identifier: string): Promise<void>;
  exists(identifier: string): Promise<boolean>;
}

/** Jeton d'injection du stockage de fichiers. */
export const FILE_STORAGE = Symbol('FILE_STORAGE');
