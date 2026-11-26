import React, { useState } from 'react';
import { Product } from '../data/mockData.ts';
import { formatProductTitle, resolveProductImageUrl } from '../utils/productFormat.ts';

export interface ProductImageProps {
  product?: Pick<Product, 'image' | 'hasRealPhoto' | 'updatedAt' | 'domain' | 'name'>;
  src?: string;
  alt?: string;
  domain?: 'electronique' | 'electrotechnique' | 'informatique';
  className?: string;
  fallbackClassName?: string;
  compact?: boolean;
  loading?: 'lazy' | 'eager';
  fallbackLabel?: string;
  fallbackSubLabel?: string;
}

const DOMAIN_ICON_MAP: Record<'electronique' | 'electrotechnique' | 'informatique', string> = {
  electronique: 'memory',
  electrotechnique: 'bolt',
  informatique: 'laptop_mac'
};

export const ProductImage: React.FC<ProductImageProps> = ({
  product,
  src,
  alt,
  domain,
  className = 'w-full h-full object-contain',
  fallbackClassName = '',
  compact = false,
  loading = 'lazy',
  fallbackLabel = 'ELECTRO-MEN',
  fallbackSubLabel
}) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const resolvedUrl =
    typeof src === 'string'
      ? src.trim()
      : product
      ? resolveProductImageUrl(product)
      : '';

  const effectiveDomain = domain || product?.domain || 'electronique';
  const effectiveAlt =
    alt ||
    (product?.name ? formatProductTitle(product.name) : '') ||
    'Produit ELECTRO-MEN';

  const shouldShowFallback = !resolvedUrl || failedUrl === resolvedUrl;

  if (!shouldShowFallback) {
    return (
      <img
        src={resolvedUrl}
        alt={effectiveAlt}
        loading={loading}
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(resolvedUrl)}
        className={className}
      />
    );
  }

  const iconName = DOMAIN_ICON_MAP[effectiveDomain] || 'memory';

  if (compact) {
    return (
      <div
        role="img"
        aria-label={effectiveAlt}
        className={`w-full h-full flex flex-col items-center justify-center bg-slate-900 text-[#d4af37] rounded-lg border border-[#d4af37]/30 select-none ${fallbackClassName}`}
      >
        <span className="material-symbols-outlined text-base sm:text-lg leading-none">
          {iconName}
        </span>
        <span className="text-[6.5px] font-syne font-black tracking-tighter text-white/90 leading-none mt-0.5">
          EM
        </span>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={effectiveAlt}
      className={`w-full h-full flex flex-col items-center justify-center text-center p-2.5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 rounded-xl border border-[#d4af37]/35 select-none ${fallbackClassName}`}
    >
      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37] shadow-2xs">
        <span className="material-symbols-outlined text-xl sm:text-2xl">{iconName}</span>
      </div>
      <span className="mt-1.5 font-syne text-[10px] sm:text-[11px] font-black tracking-wide text-white uppercase leading-tight">
        {fallbackLabel}
      </span>
      {fallbackSubLabel && (
        <span className="text-[9px] text-slate-300 mt-0.5 max-w-[180px] leading-snug">
          {fallbackSubLabel}
        </span>
      )}
    </div>
  );
};
