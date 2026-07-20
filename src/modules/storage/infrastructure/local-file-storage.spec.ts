import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FileNotFoundException,
  FileTooLargeException,
  FileTypeNotAllowedException,
} from '../../../common/exceptions/app-exceptions';
import { StorageDriver } from '../../../config/environment.validation';
import { LocalFileStorage } from './local-file-storage';

describe('LocalFileStorage', () => {
  let directory: string;
  let storage: LocalFileStorage;

  beforeEach(async () => {
    // Répertoire temporaire isolé par test : aucun état partagé.
    directory = await mkdtemp(join(tmpdir(), 'storage-test-'));
    storage = new LocalFileStorage({
      driver: StorageDriver.Local,
      localPath: directory,
      maxFileSize: 1024,
      allowedMimeTypes: ['application/pdf', 'text/plain'],
    });
    await storage.onModuleInit();
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const validFile = {
    originalName: 'rapport.pdf',
    mimeType: 'application/pdf',
    content: Buffer.from('%PDF-contenu-de-test'),
  };

  it('enregistre puis relit un fichier (cycle complet)', async () => {
    const stored = await storage.save(validFile);

    expect(stored.identifier).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored.originalName).toBe('rapport.pdf');
    expect(stored.sizeBytes).toBe(validFile.content.length);

    const streamChunks: Buffer[] = [];
    const stream = await storage.read(stored.identifier);
    for await (const chunk of stream) {
      streamChunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(streamChunks).toString()).toBe('%PDF-contenu-de-test');

    const metadata = await storage.stat(stored.identifier);
    expect(metadata.mimeType).toBe('application/pdf');
    expect(metadata.originalName).toBe('rapport.pdf');
  });

  it('refuse un type MIME non autorisé', async () => {
    await expect(
      storage.save({ ...validFile, mimeType: 'application/x-msdownload' }),
    ).rejects.toThrow(FileTypeNotAllowedException);
  });

  it('refuse un fichier trop volumineux', async () => {
    await expect(
      storage.save({ ...validFile, content: Buffer.alloc(2048) }),
    ).rejects.toThrow(FileTooLargeException);
  });

  it('neutralise un nom original contenant un chemin', async () => {
    const stored = await storage.save({
      ...validFile,
      originalName: '../../../etc/passwd',
    });

    expect(stored.originalName).toBe('passwd');
    // Le fichier reste bien dans le répertoire de stockage.
    await expect(storage.exists(stored.identifier)).resolves.toBe(true);
  });

  it('rejette les identifiants de traversée de répertoires', async () => {
    for (const malicious of [
      '../secret',
      '..\\secret',
      'a/../../b',
      'nom-simple',
      '',
    ]) {
      await expect(storage.read(malicious)).rejects.toThrow(
        FileNotFoundException,
      );
    }
  });

  it('répond FILE_NOT_FOUND pour un identifiant valide mais inconnu', async () => {
    const unknown = '00000000-0000-4000-8000-000000000000';

    await expect(storage.read(unknown)).rejects.toThrow(FileNotFoundException);
    await expect(storage.stat(unknown)).rejects.toThrow(FileNotFoundException);
    await expect(storage.delete(unknown)).rejects.toThrow(
      FileNotFoundException,
    );
    await expect(storage.exists(unknown)).resolves.toBe(false);
  });

  it('supprime un fichier définitivement', async () => {
    const stored = await storage.save(validFile);

    await storage.delete(stored.identifier);

    await expect(storage.exists(stored.identifier)).resolves.toBe(false);
    await expect(storage.read(stored.identifier)).rejects.toThrow(
      FileNotFoundException,
    );
  });
});
