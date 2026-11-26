import { describe, expect, it } from 'vitest';
import type { Product } from '../data/mockData.ts';
import {
  formatProductTitle,
  hasProductRealImage,
  normalizeClientProduct,
  resolveProductImageUrl,
  withNoCacheParam
} from './productFormat.ts';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    ref: 'ELM-001',
    name: 'Module ESP32-S3',
    domain: 'electronique',
    category: 'kits',
    categoryLabel: 'Microcontrôleurs',
    price: 7500,
    stock: 10,
    inStock: true,
    description: 'Description',
    specs: [],
    hasRealPhoto: true,
    image: '/uploads/esp32.jpg',
    ...overrides
  };
}

describe('productFormat', () => {
  it('strips stray trailing periods while preserving decimals and collapsed spaces', () => {
    expect(formatProductTitle('Module   ESP32-S3.')).toBe('Module ESP32-S3');
    expect(formatProductTitle('Régulateur 3.3V .. ')).toBe('Régulateur 3.3V');
    expect(formatProductTitle('Routeur Wi-Fi 2.4 GHz...')).toBe('Routeur Wi-Fi 2.4 GHz');
    expect(formatProductTitle('  Clé USB 64Go   ')).toBe('Clé USB 64Go');
    expect(formatProductTitle(null)).toBe('');
    expect(formatProductTitle(undefined)).toBe('');
  });

  it('detects real product images accurately', () => {
    expect(hasProductRealImage(makeProduct({ image: '/uploads/a.jpg', hasRealPhoto: true }))).toBe(true);
    expect(hasProductRealImage(makeProduct({ image: 'https://cdn.example.com/a.jpg', hasRealPhoto: undefined }))).toBe(true);
    expect(hasProductRealImage(makeProduct({ image: '/uploads/a.jpg', hasRealPhoto: false }))).toBe(false);
    expect(hasProductRealImage(makeProduct({ image: '   ', hasRealPhoto: true }))).toBe(false);
  });

  it('appends cache version to /uploads images when updatedAt is present and leaves external/data URLs untouched', () => {
    const localWithUpdate = makeProduct({
      image: '/uploads/esp32.jpg',
      updatedAt: '2026-11-26T10:00:00.000Z'
    });
    expect(resolveProductImageUrl(localWithUpdate)).toBe(
      '/uploads/esp32.jpg?v=2026-11-26T10%3A00%3A00.000Z'
    );

    const externalWithUpdate = makeProduct({
      image: 'https://supabase.co/storage/v1/object/public/img.png?token=abc',
      updatedAt: '2026-11-26T10:00:00.000Z'
    });
    expect(resolveProductImageUrl(externalWithUpdate)).toBe(
      'https://supabase.co/storage/v1/object/public/img.png?token=abc'
    );

    const dataUri = makeProduct({
      image: 'data:image/png;base64,AAAA',
      updatedAt: '2026-11-26T10:00:00.000Z'
    });
    expect(resolveProductImageUrl(dataUri)).toBe('data:image/png;base64,AAAA');
  });

  it('normalizes client product fields identically for mobile and desktop', () => {
    const normalized = normalizeClientProduct(
      makeProduct({
        name: '  Disjoncteur   40A . ',
        categoryLabel: '  Protection  ',
        price: 12500,
        oldPrice: 0,
        image: '',
        hasRealPhoto: true
      })
    );

    expect(normalized.name).toBe('Disjoncteur 40A');
    expect(normalized.categoryLabel).toBe('Protection');
    expect(normalized.price).toBe(12500);
    expect(normalized.oldPrice).toBeUndefined();
    expect(normalized.hasRealPhoto).toBe(false);
    expect(normalized.image).toBe('');
  });

  it('replaces or appends _t cache-busting query param safely', () => {
    expect(withNoCacheParam('/api/products', 12345)).toBe('/api/products?_t=12345');
    expect(withNoCacheParam('/api/products?domain=informatique', 12345)).toBe(
      '/api/products?domain=informatique&_t=12345'
    );
    expect(withNoCacheParam('/api/products?_t=111&domain=informatique#top', 999)).toBe(
      '/api/products?domain=informatique&_t=999#top'
    );
  });
});
