import { registerAs } from '@nestjs/config';
import { StorageDriver } from './environment.validation';

/** Configuration du stockage de fichiers. */
export interface StorageConfig {
  driver: StorageDriver;
  localPath: string;
  /** Taille maximale d'un fichier en octets. */
  maxFileSize: number;
  allowedMimeTypes: string[];
}

export const storageConfig = registerAs('storage', (): StorageConfig => ({
  driver: process.env.STORAGE_DRIVER as StorageDriver,
  localPath: process.env.STORAGE_LOCAL_PATH as string,
  maxFileSize: Number(process.env.STORAGE_MAX_FILE_SIZE),
  allowedMimeTypes: (process.env.STORAGE_ALLOWED_MIME_TYPES as string)
    .split(',')
    .map((mimeType) => mimeType.trim())
    .filter((mimeType) => mimeType.length > 0),
}));
