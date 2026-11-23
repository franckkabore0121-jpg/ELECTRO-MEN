import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import path from 'node:path';

export const DEFAULT_STORAGE_BUCKET = 'media';
export const MAX_MEDIA_SIZE_BYTES = 50 * 1024 * 1024;

const extensionContentTypes: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.webp': 'image/webp'
};

const contentTypeExtensions = Object.fromEntries(
  Object.entries(extensionContentTypes).map(([extension, contentType]) => [contentType, extension])
) as Record<string, string>;

export class MediaStorageConfigurationError extends Error {}
export class InvalidMediaUploadError extends Error {}

export interface ParsedMediaUpload {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

export interface SupabaseStorage {
  client: SupabaseClient;
  bucket: string;
}

let cachedStorage: (SupabaseStorage & { url: string; key: string }) | undefined;

export function getSupabaseStorage(env: NodeJS.ProcessEnv = process.env): SupabaseStorage | undefined {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url && !key) return undefined;
  if (!url || !key) {
    throw new MediaStorageConfigurationError(
      'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être configurées ensemble.'
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new MediaStorageConfigurationError('SUPABASE_URL doit être une URL valide.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new MediaStorageConfigurationError('SUPABASE_URL doit utiliser HTTP ou HTTPS.');
  }

  const bucket = env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_STORAGE_BUCKET;
  if (!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(bucket)) {
    throw new MediaStorageConfigurationError('SUPABASE_STORAGE_BUCKET contient un nom invalide.');
  }

  if (cachedStorage?.url === url && cachedStorage.key === key && cachedStorage.bucket === bucket) {
    return cachedStorage;
  }

  cachedStorage = {
    url,
    key,
    bucket,
    client: createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false
      }
    })
  };
  return cachedStorage;
}

export function getMediaContentType(filename: string): string | undefined {
  return extensionContentTypes[path.extname(filename).toLowerCase()];
}

export function createMediaObjectKey(folder: 'uploads' | 'videos' | 'voice', filename: string): string {
  const normalizedFilename = filename.replace(/\\/g, '/');
  const segments = normalizedFilename.split('/');
  if (
    segments.length === 0 ||
    segments.some((segment) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(segment))
  ) {
    throw new InvalidMediaUploadError('Nom de fichier invalide.');
  }
  return `${folder}/${segments.join('/')}`;
}

function detectContentType(buffer: Buffer): string | undefined {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp';
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'video/webm';

  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand === 'qt  ') return 'video/quicktime';
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    return 'video/mp4';
  }
  return undefined;
}

const VOICE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

const voiceContentTypeExtensions: Record<string, string> = {
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/aac': '.aac'
};

function detectVoiceAudioContainer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // WebM / Matroska (EBML header)
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return true;
  // OggS
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return true;
  // RIFF / WAVE
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE') return true;
  // MP4 / M4A ftyp
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') return true;
  // MP3 ID3 or MPEG sync frame, or AAC ADTS frame
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') return true;
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true;
  return false;
}

export function validateMediaBuffer(buffer: Buffer, contentType: string): void {
  if (!contentTypeExtensions[contentType]) {
    throw new InvalidMediaUploadError('Type de fichier non pris en charge.');
  }
  if (buffer.length === 0 || buffer.length > MAX_MEDIA_SIZE_BYTES) {
    throw new InvalidMediaUploadError('Le fichier doit peser au maximum 50 Mo.');
  }
  if (detectContentType(buffer) !== contentType) {
    throw new InvalidMediaUploadError('Le contenu du fichier ne correspond pas à son type annoncé.');
  }
}

export function parseBase64MediaUpload(
  fileBase64: unknown,
  declaredMimeType: unknown
): ParsedMediaUpload {
  if (typeof fileBase64 !== 'string' || fileBase64.length === 0) {
    throw new InvalidMediaUploadError('Données de fichier invalides.');
  }

  const dataUrlMatch = /^data:([^;,]+)(?:;[^;,]+)*;base64,/.exec(fileBase64);
  const dataUrlMimeType = dataUrlMatch?.[1].toLowerCase();
  const suppliedMimeType = typeof declaredMimeType === 'string'
    ? declaredMimeType.split(';', 1)[0].trim().toLowerCase()
    : undefined;
  if (dataUrlMimeType && suppliedMimeType && dataUrlMimeType !== suppliedMimeType) {
    throw new InvalidMediaUploadError('Le type MIME du fichier est incohérent.');
  }

  const contentType = dataUrlMimeType || suppliedMimeType;
  const extension = contentType ? contentTypeExtensions[contentType] : undefined;
  if (!contentType || !extension) {
    throw new InvalidMediaUploadError('Type de fichier non pris en charge.');
  }

  const base64 = dataUrlMatch ? fileBase64.slice(dataUrlMatch[0].length) : fileBase64;
  if (
    base64.length > Math.ceil(MAX_MEDIA_SIZE_BYTES / 3) * 4 + 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
  ) {
    throw new InvalidMediaUploadError('Encodage base64 invalide ou fichier trop volumineux.');
  }

  const buffer = Buffer.from(base64, 'base64');
  validateMediaBuffer(buffer, contentType);

  return { buffer, contentType, extension };
}

export function parseBase64VoiceUpload(
  fileBase64: unknown,
  declaredMimeType: unknown
): ParsedMediaUpload {
  if (typeof fileBase64 !== 'string' || fileBase64.length === 0) {
    throw new InvalidMediaUploadError('Données audio invalides.');
  }

  const dataUrlMatch = /^data:([^;,]+)(?:;[^;,]+)*;base64,/.exec(fileBase64);
  const dataUrlMimeType = dataUrlMatch?.[1].toLowerCase();
  const suppliedMimeType = typeof declaredMimeType === 'string'
    ? declaredMimeType.split(';', 1)[0].trim().toLowerCase()
    : undefined;

  const rawType = suppliedMimeType || dataUrlMimeType;
  const normalizedType = rawType === 'video/webm' ? 'audio/webm' : rawType;
  const extension = normalizedType ? voiceContentTypeExtensions[normalizedType] : undefined;
  if (!normalizedType || !extension) {
    throw new InvalidMediaUploadError('Format audio non pris en charge (WebM, OGG, MP4/M4A, MP3 ou WAV requis).');
  }

  const base64 = dataUrlMatch ? fileBase64.slice(dataUrlMatch[0].length) : fileBase64;
  if (
    base64.length > Math.ceil(VOICE_MAX_SIZE_BYTES / 3) * 4 + 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
  ) {
    throw new InvalidMediaUploadError('Message vocal trop volumineux (5 Mo maximum) ou encodage invalide.');
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0 || buffer.length > VOICE_MAX_SIZE_BYTES) {
    throw new InvalidMediaUploadError('Le message vocal doit peser au maximum 5 Mo.');
  }
  if (!detectVoiceAudioContainer(buffer)) {
    throw new InvalidMediaUploadError('Le contenu audio est invalide ou corrompu.');
  }

  return { buffer, contentType: normalizedType, extension };
}
