import { Inject, Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { FILE_STORAGE } from '../domain/file-storage.port';
import type {
  FileStoragePort,
  FileToStore,
  StoredFile,
} from '../domain/file-storage.port';

/**
 * Cas d'utilisation de démonstration du stockage de fichiers.
 *
 * Regroupés dans un seul fichier : ils se réduisent chacun à une
 * délégation au port de stockage plus un audit ; les éclater n'apporterait
 * aucune valeur.
 */

/** Dépôt d'un fichier de démonstration (audité). */
@Injectable()
export class StoreDemoFileUseCase {
  constructor(
    @Inject(FILE_STORAGE)
    private readonly fileStorage: FileStoragePort,
    private readonly auditService: AuditService,
  ) {}

  async execute(file: FileToStore, userId: string): Promise<StoredFile> {
    const stored = await this.fileStorage.save(file);

    await this.auditService.record({
      category: AuditCategory.Technical,
      action: 'storage.file.stored',
      actorUserId: userId,
      resourceType: 'file',
      resourceId: stored.identifier,
      metadata: {
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
      },
    });

    return stored;
  }
}

/** Téléchargement d'un fichier de démonstration (flux + métadonnées). */
@Injectable()
export class ReadDemoFileUseCase {
  constructor(
    @Inject(FILE_STORAGE)
    private readonly fileStorage: FileStoragePort,
  ) {}

  async execute(
    identifier: string,
  ): Promise<{ metadata: StoredFile; stream: Readable }> {
    const metadata = await this.fileStorage.stat(identifier);
    const stream = await this.fileStorage.read(identifier);
    return { metadata, stream };
  }
}

/** Suppression d'un fichier de démonstration (auditée). */
@Injectable()
export class DeleteDemoFileUseCase {
  constructor(
    @Inject(FILE_STORAGE)
    private readonly fileStorage: FileStoragePort,
    private readonly auditService: AuditService,
  ) {}

  async execute(identifier: string, userId: string): Promise<void> {
    await this.fileStorage.delete(identifier);

    await this.auditService.record({
      category: AuditCategory.Technical,
      action: 'storage.file.deleted',
      actorUserId: userId,
      resourceType: 'file',
      resourceId: identifier,
    });
  }
}
