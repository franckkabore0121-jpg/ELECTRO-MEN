import { describe, expect, it } from 'vitest';
import {
  createMediaObjectKey,
  getMediaContentType,
  getSupabaseStorage,
  InvalidMediaUploadError,
  parseBase64MediaUpload
} from './supabaseStorage.ts';

describe('Supabase media storage helpers', () => {
  it('uses the configurable bucket with a safe default', () => {
    const storage = getSupabaseStorage({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
    });

    expect(storage?.bucket).toBe('media');
    expect(getSupabaseStorage({})).toBeUndefined();
  });

  it('accepts a supported image with matching content bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const parsed = parseBase64MediaUpload(`data:image/png;base64,${png.toString('base64')}`, 'image/png');

    expect(parsed.contentType).toBe('image/png');
    expect(parsed.extension).toBe('.png');
    expect(parsed.buffer).toEqual(png);
  });

  it('rejects MIME spoofing and unsafe object paths', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(() => parseBase64MediaUpload(png.toString('base64'), 'image/jpeg'))
      .toThrow(InvalidMediaUploadError);
    expect(() => createMediaObjectKey('uploads', '../secret.png'))
      .toThrow(InvalidMediaUploadError);
    expect(getMediaContentType('intro.mp4')).toBe('video/mp4');
  });
});
