import { Product } from '../data/mockData.ts';

export const NO_CACHE_FETCH_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0'
};

export const NO_CACHE_FETCH_INIT: RequestInit = {
  cache: 'no-store',
  credentials: 'same-origin',
  headers: NO_CACHE_FETCH_HEADERS
};

export function withNoCacheParam(url: string, timestamp: number = Date.now()): string {
  const [base, hash] = url.split('#');
  const cleanedBase = base
    .replace(/([?&])_t=\d+(&?)/g, (_match, prefix, suffix) => {
      if (prefix === '?' && suffix === '&') return '?';
      if (prefix === '&' && suffix === '&') return '&';
      return '';
    })
    .replace(/[?&]$/, '');
  const separator = cleanedBase.includes('?') ? '&' : '?';
  const busted = `${cleanedBase}${separator}_t=${timestamp}`;
  return hash ? `${busted}#${hash}` : busted;
}

export function formatProductTitle(rawTitle: unknown): string {
  if (rawTitle === null || rawTitle === undefined) return '';
  const collapsed = String(rawTitle).replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  return collapsed.replace(/(?:\s*\.+)+\s*$/, '').trim();
}

export function hasProductRealImage(product: Pick<Product, 'image' | 'hasRealPhoto'>): boolean {
  const img = typeof product.image === 'string' ? product.image.trim() : '';
  return img.length > 0 && product.hasRealPhoto !== false;
}

export function resolveProductImageUrl(
  product: Pick<Product, 'image' | 'hasRealPhoto' | 'updatedAt'>
): string {
  if (!hasProductRealImage(product)) return '';
  const rawImage = (product.image || '').trim();
  if (rawImage.startsWith('/uploads/') && product.updatedAt) {
    const versionToken = encodeURIComponent(String(product.updatedAt));
    if (!/[?&]v=/.test(rawImage)) {
      return `${rawImage}${rawImage.includes('?') ? '&' : '?'}v=${versionToken}`;
    }
  }
  return rawImage;
}

export function normalizeClientProduct(product: Product): Product {
  const cleanName = formatProductTitle(product.name);
  const cleanCategoryLabel = typeof product.categoryLabel === 'string' ? product.categoryLabel.trim() : '';
  const cleanSubGroupLabel = typeof product.subGroupLabel === 'string' ? product.subGroupLabel.trim() : undefined;
  const hasReal = hasProductRealImage(product);
  const cleanImage = hasReal ? (product.image || '').trim() : '';
  const numericPrice = Number(product.price);
  const numericOldPrice = product.oldPrice !== undefined && product.oldPrice !== null ? Number(product.oldPrice) : undefined;

  return {
    ...product,
    name: cleanName || (typeof product.name === 'string' ? product.name.trim() : ''),
    categoryLabel: cleanCategoryLabel,
    ...(cleanSubGroupLabel ? { subGroupLabel: cleanSubGroupLabel } : {}),
    price: Number.isFinite(numericPrice) && numericPrice >= 0 ? numericPrice : 0,
    ...(numericOldPrice !== undefined && Number.isFinite(numericOldPrice) && numericOldPrice > 0
      ? { oldPrice: numericOldPrice }
      : { oldPrice: undefined }),
    hasRealPhoto: hasReal,
    image: cleanImage
  };
}
