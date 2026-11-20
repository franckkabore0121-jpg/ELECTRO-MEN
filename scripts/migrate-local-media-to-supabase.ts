import 'dotenv/config';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  createMediaObjectKey,
  getMediaContentType,
  getSupabaseStorage,
  MAX_MEDIA_SIZE_BYTES,
  validateMediaBuffer
} from '../server/supabaseStorage.ts';

const mediaRoots = [
  { folder: 'uploads' as const, localPath: path.resolve('public/uploads') },
  { folder: 'videos' as const, localPath: path.resolve('public/assets/videos') }
];
const dryRun = process.argv.includes('--dry-run');

function collectFiles(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) return [];
      if (entry.isDirectory()) return collectFiles(entryPath);
      return entry.isFile() ? [entryPath] : [];
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function objectExists(
  storage: NonNullable<ReturnType<typeof getSupabaseStorage>>,
  key: string
): Promise<boolean> {
  const separator = key.lastIndexOf('/');
  const folder = key.slice(0, separator);
  const filename = key.slice(separator + 1);
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const { data, error } = await storage.client.storage
      .from(storage.bucket)
      .list(folder, { limit: pageSize, offset });
    if (error) throw new Error(`Impossible de lister le bucket Supabase : ${error.message}`);
    const items = data ?? [];
    if (items.some((item) => item.name === filename)) return true;
    if (items.length < pageSize) return false;
    offset += pageSize;
  }
}

async function main(): Promise<void> {
  const storage = getSupabaseStorage();
  if (!storage) {
    throw new Error('Configurez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY avant la migration.');
  }

  let uploaded = 0;
  let skipped = 0;
  let planned = 0;
  for (const root of mediaRoots) {
    for (const filePath of collectFiles(root.localPath)) {
      const relativePath = path.relative(root.localPath, filePath).split(path.sep).join('/');
      const objectKey = createMediaObjectKey(root.folder, relativePath);
      const contentType = getMediaContentType(filePath);
      if (!contentType) {
        console.warn(`Type de fichier ignoré : ${objectKey}`);
        skipped += 1;
        continue;
      }

      const fileSize = statSync(filePath).size;
      if (fileSize > MAX_MEDIA_SIZE_BYTES) {
        throw new Error(`${objectKey} dépasse la limite de 50 Mo du bucket.`);
      }
      const buffer = readFileSync(filePath);
      validateMediaBuffer(buffer, contentType);

      if (await objectExists(storage, objectKey)) {
        console.log(`Déjà présent, ignoré : ${objectKey}`);
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`À téléverser : ${objectKey} (${fileSize} octets)`);
        planned += 1;
        continue;
      }

      const { error } = await storage.client.storage.from(storage.bucket).upload(objectKey, buffer, {
        cacheControl: '3600',
        contentType,
        upsert: false
      });
      if (error) {
        if (await objectExists(storage, objectKey)) {
          console.log(`Déjà présent après vérification, ignoré : ${objectKey}`);
          skipped += 1;
          continue;
        }
        throw new Error(`Échec du téléversement ${objectKey} : ${error.message}`);
      }

      const { data } = storage.client.storage.from(storage.bucket).getPublicUrl(objectKey);
      console.log(`Téléversé : ${objectKey} -> ${data.publicUrl}`);
      uploaded += 1;
    }
  }

  console.log(
    dryRun
      ? `Simulation terminée : ${planned} fichier(s) à téléverser, ${skipped} ignoré(s); aucun envoi effectué.`
      : `Migration terminée : ${uploaded} envoyé(s), ${skipped} ignoré(s).`
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'La migration média a échoué.');
  process.exitCode = 1;
});
