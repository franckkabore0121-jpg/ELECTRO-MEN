import React, { useMemo } from 'react';
import { Product, ELECTROTECHNIQUE_GROUPS, CategoryGroup } from '../data/mockData.ts';
import { BoutiqueStorefront } from './BoutiqueStorefront.tsx';

interface ScreenBoutiqueElectrotechniqueProps {
  products: Product[];
  isLoadingProducts?: boolean;
  productsLoadError?: string | null;
  onRetryLoadProducts?: () => void;
  cartCount?: number;
  logoUrl?: string;
  locationLabel?: string;
  onAddToCart: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  onOpenCart: () => void;
  onGoTab: (tab: any) => void;
  groups?: CategoryGroup[];
  customGroups?: CategoryGroup[];
}

export const ScreenBoutiqueElectrotechnique: React.FC<ScreenBoutiqueElectrotechniqueProps> = ({
  products,
  isLoadingProducts = false,
  productsLoadError = null,
  onRetryLoadProducts,
  cartCount = 0,
  logoUrl,
  locationLabel,
  onAddToCart,
  onSelectProduct,
  onOpenCart,
  onGoTab,
  groups: propGroups,
  customGroups = []
}) => {
  const groups = useMemo(() => {
    if (propGroups && propGroups.length > 0) return propGroups;
    const adminGroups = customGroups.filter((g) => g.domain === 'electrotechnique');
    return [
      ...ELECTROTECHNIQUE_GROUPS,
      ...adminGroups.filter((ag) => !ELECTROTECHNIQUE_GROUPS.some((eg) => eg.id === ag.id))
    ];
  }, [propGroups, customGroups]);

  const electrotechProducts = useMemo(() => {
    const norm = (val?: string) =>
      (val || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    return products.filter((p) => {
      const domainNorm = norm(p.domain);
      return domainNorm === 'electrotechnique' || domainNorm.includes('electrotech');
    });
  }, [products]);

  return (
    <BoutiqueStorefront
      domain="electrotechnique"
      tabId="boutique_electrotechnique"
      shopTitle="Boutique Électrotechnique Industrielle"
      shopShortSubtitle="Puissance, Protection & Variateurs 380V"
      shopDescription="Disjoncteurs industriels, contacteurs, variateurs de fréquence, automates, onduleurs et appareillage haute puissance pour installations tertiaires et industrielles."
      logoUrl={logoUrl}
      locationLabel={locationLabel}
      searchPlaceholder="Rechercher un disjoncteur, variateur 380V, contacteur..."
      emptyLabel="Aucun matériel électrotechnique trouvé"
      allDomainProducts={electrotechProducts}
      groups={groups}
      isLoadingProducts={isLoadingProducts}
      productsLoadError={productsLoadError}
      onRetryLoadProducts={onRetryLoadProducts}
      cartCount={cartCount}
      onAddToCart={onAddToCart}
      onSelectProduct={onSelectProduct}
      onOpenCart={onOpenCart}
      onGoTab={onGoTab}
    />
  );
};
