import { beforeEach, describe, expect, it } from 'vitest';
import {
  CATALOG_CACHE_TTL_MS,
  OFFLINE_BOUTIQUES_KEY,
  OFFLINE_CART_KEY,
  OFFLINE_GROUPS_KEY,
  OFFLINE_PRODUCTS_KEY,
  invalidateCatalogCache,
  isCatalogCacheFresh,
  loadCartItems,
  loadOfflineBoutiques,
  loadOfflineConfig,
  loadOfflineGroups,
  loadOfflineProducts,
  markCatalogCacheUpdated,
  saveCartItems,
  saveOfflineBoutiques,
  saveOfflineConfig,
  saveOfflineGroups,
  saveOfflineProducts
} from './offlineCache.ts';
import { CartItem, MarketplaceBoutique, Product } from '../data/mockData.ts';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    }
  };
}

describe('offlineCache', () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true
    });
  });

  it('persists and normalizes offline products cleanly', () => {
    const sample: Product[] = [
      {
        id: 'prod-1',
        ref: 'EM-01',
        name: 'Multimètre Fluke 117 .',
        category: 'instrumentation',
        categoryLabel: 'Instrumentation',
        domain: 'electronique',
        price: 95000,
        stock: 4,
        description: 'Multimètre True-RMS',
        image: 'https://example.com/fluke.png',
        hasRealPhoto: true
      }
    ];

    saveOfflineProducts(sample);
    const loaded = loadOfflineProducts();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Multimètre Fluke 117');
    expect(loaded[0].price).toBe(95000);
  });

  it('persists and restores category groups and boutiques', () => {
    saveOfflineGroups({
      electronique: [{ id: 'microcontroleurs', label: 'Microcontrôleurs' }]
    });
    const boutiques: MarketplaceBoutique[] = [
      {
        id: 'b-1',
        name: 'Électronique',
        category: 'electronique',
        categoryLabel: 'Électronique',
        location: 'Ouagadougou',
        country: 'Burkina Faso',
        countryCode: 'BF',
        flag: '🇧🇫',
        activities: 'Composants certifiés & IoT',
        tabId: 'boutique_electronique',
        status: 'Actif',
        logoUrl: '/pwa-192x192.png',
        phone: '+22665484738'
      }
    ];
    saveOfflineBoutiques(boutiques);

    expect(loadOfflineGroups()?.electronique?.[0].label).toBe('Microcontrôleurs');
    expect(loadOfflineBoutiques()).toHaveLength(1);
    expect(loadOfflineBoutiques()[0].id).toBe('b-1');
  });

  it('tracks 10-minute catalog cache freshness and invalidation', () => {
    const now = 1_700_000_000_000;
    expect(isCatalogCacheFresh(CATALOG_CACHE_TTL_MS, now)).toBe(false);

    saveOfflineProducts([
      {
        id: 'p-ttl',
        ref: 'TTL-1',
        name: 'Capteur DHT22',
        category: 'capteurs',
        categoryLabel: 'Capteurs',
        domain: 'electronique',
        price: 3500,
        stock: 5,
        description: 'Capteur numérique'
      }
    ]);
    markCatalogCacheUpdated(now);

    expect(isCatalogCacheFresh(CATALOG_CACHE_TTL_MS, now + 5 * 60 * 1000)).toBe(true);
    expect(isCatalogCacheFresh(CATALOG_CACHE_TTL_MS, now + CATALOG_CACHE_TTL_MS + 1000)).toBe(false);

    invalidateCatalogCache();
    expect(isCatalogCacheFresh(CATALOG_CACHE_TTL_MS, now + 1000)).toBe(false);
  });

  it('persists offline config snapshot cleanly', () => {
    saveOfflineConfig({
      heroVideoUrl: 'https://example.com/hero.mp4',
      isMaintenanceMode: false,
      isInvestorChatOpen: true
    });

    const loaded = loadOfflineConfig();
    expect(loaded?.heroVideoUrl).toBe('https://example.com/hero.mp4');
    expect(loaded?.isMaintenanceMode).toBe(false);
    expect(loaded?.isInvestorChatOpen).toBe(true);
  });

  it('persists cart items and filters malformed entries', () => {
    const items: CartItem[] = [
      {
        product: {
          id: 'p-cart',
          ref: 'C-1',
          name: 'ESP32-WROOM.',
          category: 'iot',
          categoryLabel: 'IoT',
          domain: 'electronique',
          price: 4500,
          stock: 10,
          description: 'Module Wi-Fi'
        },
        quantity: 2
      }
    ];

    saveCartItems(items);
    const restored = loadCartItems();

    expect(restored).toHaveLength(1);
    expect(restored[0].product.name).toBe('ESP32-WROOM');
    expect(restored[0].quantity).toBe(2);

    localStorage.setItem(OFFLINE_PRODUCTS_KEY, '{bad-json');
    localStorage.setItem(OFFLINE_GROUPS_KEY, '[]');
    localStorage.setItem(OFFLINE_BOUTIQUES_KEY, 'null');
    localStorage.setItem(OFFLINE_CART_KEY, '[{"quantity":0}]');

    expect(loadOfflineProducts()).toEqual([]);
    expect(loadOfflineGroups()).toBeNull();
    expect(loadOfflineBoutiques()).toEqual([]);
    expect(loadCartItems()).toEqual([]);
  });
});
