import { describe, expect, it } from 'vitest';
import { sanitizeAdminConfig } from './applicationStore.ts';

describe('sanitizeAdminConfig', () => {
  it('keeps public settings and removes legacy credentials and session data', () => {
    expect(sanitizeAdminConfig({
      customAdminUrl: '/gestion-electromen',
      heroVideoUrl: '/assets/hero.mp4',
      formationsVideoUrl: '/assets/training.mp4',
      isMaintenanceMode: true,
      masterPasswordHash: 'secret-hash',
      masterPasswordHint: 'secret-hint',
      admins: [{ email: 'admin@example.com', assignedPasswordPlainText: 'secret' }],
      activeTokens: { token: { email: 'admin@example.com' } }
    })).toEqual({
      customAdminUrl: '/gestion-electromen',
      heroVideoUrl: '/assets/hero.mp4',
      formationsVideoUrl: '/assets/training.mp4',
      isMaintenanceMode: true,
      masterPasswordHash: '',
      masterPasswordHint: '',
      admins: [],
      activeTokens: {}
    });
  });
});
