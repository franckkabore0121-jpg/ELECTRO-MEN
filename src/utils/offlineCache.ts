import { CartItem, CategoryGroup, MarketplaceBoutique, Product } from '../data/mockData.ts';
import { normalizeClientProduct } from './productFormat.ts';

export const OFFLINE_PRODUCTS_KEY = 'electromen_offline_products_v1';
export const OFFLINE_GROUPS_KEY = 'electromen_offline_groups_v1';
export const OFFLINE_BOUTIQUES_KEY = 'electromen_offline_boutiques_v1';
export const OFFLINE_CART_KEY = 'electromen_cart_items_v1';

export type DomainKey = 'electronique' | 'electrotechnique' | 'informatique';

function readStorageJson<T>(key: string): T | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStorageJson(key: string, value: unknown): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota / private mode failures gracefully
  }
}

export function saveOfflineProducts(products: Product[]): void {
  if (!Array.isArray(products)) return;
  writeStorageJson(OFFLINE_PRODUCTS_KEY, products.map(normalizeClientProduct));
}

export function loadOfflineProducts(): Product[] {
  const parsed = readStorageJson<unknown>(OFFLINE_PRODUCTS_KEY);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is Product => Boolean(item && typeof item === 'object' && 'id' in item && 'name' in item))
    .map(normalizeClientProduct);
}

export function saveOfflineGroups(
  groups: Partial<Record<DomainKey, CategoryGroup[]>>
): void {
  if (!groups || typeof groups !== 'object') return;
  writeStorageJson(OFFLINE_GROUPS_KEY, groups);
}

export function loadOfflineGroups(): Partial<Record<DomainKey, CategoryGroup[]>> | null {
  const parsed = readStorageJson<unknown>(OFFLINE_GROUPS_KEY);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed as Partial<Record<DomainKey, CategoryGroup[]>>;
}

export function saveOfflineBoutiques(boutiques: MarketplaceBoutique[]): void {
  if (!Array.isArray(boutiques) || boutiques.length === 0) return;
  writeStorageJson(OFFLINE_BOUTIQUES_KEY, boutiques);
}

export function loadOfflineBoutiques(): MarketplaceBoutique[] {
  const parsed = readStorageJson<unknown>(OFFLINE_BOUTIQUES_KEY);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item): item is MarketplaceBoutique =>
      Boolean(item && typeof item === 'object' && 'id' in item && 'name' in item)
  );
}

export function saveCartItems(items: CartItem[]): void {
  if (!Array.isArray(items)) return;
  writeStorageJson(
    OFFLINE_CART_KEY,
    items
      .filter((item) => item && item.product && Number(item.quantity) > 0)
      .map((item) => ({
        product: normalizeClientProduct(item.product),
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 1))
      }))
  );
}

export function loadCartItems(): CartItem[] {
  const parsed = readStorageJson<unknown>(OFFLINE_CART_KEY);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (item): item is CartItem =>
        Boolean(
          item &&
            typeof item === 'object' &&
            'product' in item &&
            item.product &&
            typeof item.product === 'object' &&
            'id' in item.product &&
            Number((item as CartItem).quantity) > 0
        )
    )
    .map((item) => ({
      product: normalizeClientProduct(item.product),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1))
    }));
}
