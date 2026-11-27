import {
  CartItem,
  CategoryGroup,
  Course,
  InvestmentProject,
  InvestorActivity,
  InvestorDocument,
  MarketplaceBoutique,
  Product
} from '../data/mockData.ts';
import { normalizeClientProduct } from './productFormat.ts';

export const OFFLINE_PRODUCTS_KEY = 'electromen_offline_products_v1';
export const OFFLINE_GROUPS_KEY = 'electromen_offline_groups_v1';
export const OFFLINE_BOUTIQUES_KEY = 'electromen_offline_boutiques_v1';
export const OFFLINE_CART_KEY = 'electromen_cart_items_v1';
export const OFFLINE_CATALOG_META_KEY = 'electromen_catalog_cache_meta_v1';
export const OFFLINE_COURSES_KEY = 'electromen_offline_courses_v1';
export const OFFLINE_PROJECTS_KEY = 'electromen_offline_projects_v1';
export const OFFLINE_ACTIVITIES_KEY = 'electromen_offline_activities_v1';
export const OFFLINE_DOCUMENTS_KEY = 'electromen_offline_documents_v1';
export const OFFLINE_CONFIG_KEY = 'electromen_offline_config_v1';

export const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type DomainKey = 'electronique' | 'electrotechnique' | 'informatique';

export interface OfflineAppConfigSnapshot {
  heroVideoUrl?: string;
  formationsVideoUrl?: string;
  customAdminUrl?: string;
  isMaintenanceMode?: boolean;
  isInvestorChatOpen?: boolean;
}

const rawMemoryCache = new Map<string, { raw: string; parsed: unknown }>();

function readStorageJson<T>(key: string): T | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) {
      rawMemoryCache.delete(key);
      return null;
    }
    const cached = rawMemoryCache.get(key);
    if (cached && cached.raw === raw) {
      return cached.parsed as T;
    }
    const parsed = JSON.parse(raw) as T;
    rawMemoryCache.set(key, { raw, parsed });
    return parsed;
  } catch {
    rawMemoryCache.delete(key);
    return null;
  }
}

function writeStorageJson(key: string, value: unknown): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = JSON.stringify(value);
    localStorage.setItem(key, raw);
    rawMemoryCache.set(key, { raw, parsed: value });
  } catch {
    // Ignore storage quota / private mode failures gracefully
  }
}

export function markCatalogCacheUpdated(timestamp = Date.now()): void {
  writeStorageJson(OFFLINE_CATALOG_META_KEY, { updatedAt: timestamp });
}

export function getCatalogCacheTimestamp(): number | null {
  const meta = readStorageJson<{ updatedAt?: unknown }>(OFFLINE_CATALOG_META_KEY);
  const ts = typeof meta?.updatedAt === 'number' ? meta.updatedAt : NaN;
  return Number.isFinite(ts) && ts > 0 ? ts : null;
}

export function getCatalogCacheAgeMs(now = Date.now()): number | null {
  const ts = getCatalogCacheTimestamp();
  if (ts === null) return null;
  return Math.max(0, now - ts);
}

export function isCatalogCacheFresh(
  ttlMs = CATALOG_CACHE_TTL_MS,
  now = Date.now()
): boolean {
  const age = getCatalogCacheAgeMs(now);
  if (age === null) return false;
  return age < ttlMs && loadOfflineProducts().length > 0;
}

export function invalidateCatalogCache(): void {
  try {
    rawMemoryCache.delete(OFFLINE_CATALOG_META_KEY);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(OFFLINE_CATALOG_META_KEY);
    }
  } catch {
    // Ignore
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

export function saveOfflineCourses(courses: Course[]): void {
  if (!Array.isArray(courses)) return;
  writeStorageJson(OFFLINE_COURSES_KEY, courses);
}

export function loadOfflineCourses(): Course[] | null {
  const parsed = readStorageJson<unknown>(OFFLINE_COURSES_KEY);
  return Array.isArray(parsed) ? (parsed as Course[]) : null;
}

export function saveOfflineProjects(projects: InvestmentProject[]): void {
  if (!Array.isArray(projects)) return;
  writeStorageJson(OFFLINE_PROJECTS_KEY, projects);
}

export function loadOfflineProjects(): InvestmentProject[] | null {
  const parsed = readStorageJson<unknown>(OFFLINE_PROJECTS_KEY);
  return Array.isArray(parsed) ? (parsed as InvestmentProject[]) : null;
}

export function saveOfflineActivities(activities: InvestorActivity[]): void {
  if (!Array.isArray(activities)) return;
  writeStorageJson(OFFLINE_ACTIVITIES_KEY, activities);
}

export function loadOfflineActivities(): InvestorActivity[] | null {
  const parsed = readStorageJson<unknown>(OFFLINE_ACTIVITIES_KEY);
  return Array.isArray(parsed) ? (parsed as InvestorActivity[]) : null;
}

export function saveOfflineDocuments(documents: InvestorDocument[]): void {
  if (!Array.isArray(documents)) return;
  writeStorageJson(OFFLINE_DOCUMENTS_KEY, documents);
}

export function loadOfflineDocuments(): InvestorDocument[] | null {
  const parsed = readStorageJson<unknown>(OFFLINE_DOCUMENTS_KEY);
  return Array.isArray(parsed) ? (parsed as InvestorDocument[]) : null;
}

export function saveOfflineConfig(config: OfflineAppConfigSnapshot): void {
  if (!config || typeof config !== 'object') return;
  writeStorageJson(OFFLINE_CONFIG_KEY, config);
}

export function loadOfflineConfig(): OfflineAppConfigSnapshot | null {
  const parsed = readStorageJson<unknown>(OFFLINE_CONFIG_KEY);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed as OfflineAppConfigSnapshot;
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
