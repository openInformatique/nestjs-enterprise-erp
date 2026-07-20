import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import {
  FileNotFoundException,
  FileTooLargeException,
  FileTypeNotAllowedException,
} from '../../../common/exceptions/app-exceptions';
import { storageConfig } from '../../../config/storage.config';
import {
  FileStoragePort,
  FileToStore,
  StoredFile,
} from '../domain/file-storage.port';

/** Format strict des identifiants de fichiers (UUID). */
const IDENTIFIER_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Métadonnées persistées à côté du fichier (sidecar JSON). */
interface FileMetadata {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storedAt: string;
}

/**
 * Stockage local sur disque.
 *
 * Sécurité :
 *   - les noms physiques sont des UUID générés par le serveur : le nom
 *     original (donnée non fiable) ne participe JAMAIS au chemin ;
 *   - les identifiants sont validés par expression régulière stricte
 *     puis le chemin résolu est vérifié comme restant dans le répertoire
 *     de stockage : double protection contre la traversée de répertoires ;
 *   - type MIME et taille validés contre la configuration avant écriture.
 *
 * Les métadonnées (nom original, type, taille) sont conservées dans un
 * fichier JSON adjacent : pas de table SQL dans cette version du socle.
 */
@Injectable()
export class LocalFileStorage implements FileStoragePort, OnModuleInit {
  private readonly rootDirectory: string;

  constructor(
    @Inject(storageConfig.KEY)
    private readonly config: ConfigType<typeof storageConfig>,
  ) {
    this.rootDirectory = resolve(config.localPath);
  }

  /** Crée le répertoire de stockage au démarrage s'il n'existe pas. */
  async onModuleInit(): Promise<void> {
    await mkdir(this.rootDirectory, { recursive: true });
  }

  async save(file: FileToStore): Promise<StoredFile> {
    if (!this.config.allowedMimeTypes.includes(file.mimeType)) {
      throw new FileTypeNotAllowedException(this.config.allowedMimeTypes);
    }
    if (file.content.length > this.config.maxFileSize) {
      throw new FileTooLargeException(this.config.maxFileSize);
    }

    const identifier = randomUUID();
    const storedAt = new Date();
    const metadata: FileMetadata = {
      // basename : neutralise tout chemin glissé dans le nom original.
      originalName: basename(file.originalName),
      mimeType: file.mimeType,
      sizeBytes: file.content.length,
      storedAt: storedAt.toISOString(),
    };

    await writeFile(this.resolveContentPath(identifier), file.content);
    await writeFile(
      this.resolveMetadataPath(identifier),
      JSON.stringify(metadata),
      'utf8',
    );

    return {
      identifier,
      originalName: metadata.originalName,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
      storedAt,
    };
  }

  async read(identifier: string): Promise<Readable> {
    const path = this.resolveContentPath(identifier);
    await this.assertExists(path);
    // Streaming : le fichier n'est jamais chargé entièrement en mémoire.
    return createReadStream(path);
  }

  async stat(identifier: string): Promise<StoredFile> {
    const metadataPath = this.resolveMetadataPath(identifier);
    await this.assertExists(metadataPath);

    const metadata = JSON.parse(
      await readFile(metadataPath, 'utf8'),
    ) as FileMetadata;

    return {
      identifier,
      originalName: metadata.originalName,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
      storedAt: new Date(metadata.storedAt),
    };
  }

  async delete(identifier: string): Promise<void> {
    const contentPath = this.resolveContentPath(identifier);
    await this.assertExists(contentPath);

    await unlink(contentPath);
    // Le sidecar peut manquer (suppression partielle antérieure) : toléré.
    await unlink(this.resolveMetadataPath(identifier)).catch(() => undefined);
  }

  async exists(identifier: string): Promise<boolean> {
    try {
      await stat(this.resolveContentPath(identifier));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Résout le chemin d'un fichier de contenu après validation stricte
   * de l'identifiant (aucune concaténation de chemin dangereuse).
   */
  private resolveContentPath(identifier: string): string {
    return this.resolveSafePath(`${this.validate(identifier)}.bin`);
  }

  private resolveMetadataPath(identifier: string): string {
    return this.resolveSafePath(`${this.validate(identifier)}.meta.json`);
  }

  private validate(identifier: string): string {
    if (!IDENTIFIER_PATTERN.test(identifier)) {
      throw new FileNotFoundException();
    }
    return identifier.toLowerCase();
  }

  private resolveSafePath(fileName: string): string {
    const path = resolve(join(this.rootDirectory, fileName));
    // Défense en profondeur : même avec un identifiant validé, le chemin
    // final doit rester dans le répertoire de stockage.
    if (!path.startsWith(this.rootDirectory)) {
      throw new FileNotFoundException();
    }
    return path;
  }

  private async assertExists(path: string): Promise<void> {
    try {
      await stat(path);
    } catch {
      throw new FileNotFoundException();
    }
  }
}
