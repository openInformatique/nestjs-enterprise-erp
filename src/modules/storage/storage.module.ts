import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import {
  DeleteDemoFileUseCase,
  ReadDemoFileUseCase,
  StoreDemoFileUseCase,
} from './application/demo-file.use-cases';
import { FILE_STORAGE } from './domain/file-storage.port';
import { LocalFileStorage } from './infrastructure/local-file-storage';

/**
 * Module de stockage de fichiers.
 *
 * Fournit FileStoragePort avec l'implémentation locale (STORAGE_DRIVER=local,
 * seul pilote de cette version). Le port permet un remplacement futur par
 * Azure Blob Storage, Amazon S3 ou un stockage réseau.
 */
@Module({
  imports: [AuditModule],
  providers: [
    StoreDemoFileUseCase,
    ReadDemoFileUseCase,
    DeleteDemoFileUseCase,
    {
      provide: FILE_STORAGE,
      useClass: LocalFileStorage,
    },
  ],
  exports: [
    FILE_STORAGE,
    StoreDemoFileUseCase,
    ReadDemoFileUseCase,
    DeleteDemoFileUseCase,
  ],
})
export class StorageModule {}
