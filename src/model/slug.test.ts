import { describe, expect, it } from 'vitest';
import { exportFilename, slugify } from './slug';

describe('slugify', () => {
  it('lowercases and joins words with dashes', () => {
    expect(slugify('Moderator')).toBe('moderator');
    expect(slugify('  Server  Booster!! ')).toBe('server-booster');
  });

  it('strips diacritics and emoji', () => {
    expect(slugify('Ünïcödé Rôle')).toBe('unicode-role');
    expect(slugify('👑 Admin')).toBe('admin');
  });

  it('falls back when nothing is left', () => {
    expect(slugify('')).toBe('icon');
    expect(slugify('👑👑')).toBe('icon');
  });

  it('caps the length without a trailing dash', () => {
    const slug = slugify('a'.repeat(39) + ' bcdef');
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('exportFilename', () => {
  it('includes the role and the size', () => {
    expect(exportFilename('VIP', 256)).toBe('role-icon-vip-256.png');
  });
});
