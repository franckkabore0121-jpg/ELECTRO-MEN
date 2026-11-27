import React, { useMemo } from 'react';
import { Product, INFORMATIQUE_GROUPS, CategoryGroup } from '../data/mockData.ts';
import { BoutiqueStorefront } from './BoutiqueStorefront.tsx';

interface ScreenBoutiqueInformatiqueProps {
  products: Product[];
  isLoadingProducts?: boolean;
  productsLoadError?: string | null;
  onRetryLoadProducts?: () => void;
  cartCount?: number;
  logoUrl?: string;
  locationLabel?: string;
  flag?: string;
  country?: string;
  defaultCustomerName?: string;
  defaultCustomerPhone?: string;
  defaultCustomerEmail?: string;
  onAddToCart: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  onOpenCart: () => void;
  onGoTab: (tab: any) => void;
  groups?: CategoryGroup[];
  customGroups?: CategoryGroup[];
}

export const ScreenBoutiqueInformatique: React.FC<ScreenBoutiqueInformatiqueProps> = ({
  products,
  isLoadingProducts = false,
  productsLoadError = null,
  onRetryLoadProducts,
  cartCount = 0,
  logoUrl,
  locationLabel,
  flag,
  country,
  defaultCustomerName,
  defaultCustomerPhone,
  defaultCustomerEmail,
  onAddToCart,
  onSelectProduct,
  onOpenCart,
  onGoTab,
  groups: propGroups,
  customGroups = []
}) => {
  const groups = useMemo(() => {
    if (propGroups && propGroups.length > 0) return propGroups;
    const adminGroups = customGroups.filter((g) => g.domain === 'informatique');
    return [
      ...INFORMATIQUE_GROUPS,
      ...adminGroups.filter((ag) => !INFORMATIQUE_GROUPS.some((eg) => eg.id === ag.id))
    ];
  }, [propGroups, customGroups]);

  const infoProducts = useMemo(() => {
    const norm = (val?: string) =>
      (val || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    return products.filter((p) => {
      const domainNorm = norm(p.domain);
      return domainNorm === 'informatique' || domainNorm === 'info';
    });
  }, [products]);

  return (
    <BoutiqueStorefront
      domain="informatique"
      tabId="boutique_informatique"
      shopTitle="Boutique Équipements Informatiques"
      shopShortSubtitle="Postes, Composants PC & Réseaux"
      shopDescription="Ordinateurs portables et professionnels, SSD, mémoire RAM, serveurs, routeurs, commutateurs réseau et périphériques informatiques avec support technique local."
      logoUrl={logoUrl}
      locationLabel={locationLabel}
      flag={flag}
      country={country}
      defaultCustomerName={defaultCustomerName}
      defaultCustomerPhone={defaultCustomerPhone}
      defaultCustomerEmail={defaultCustomerEmail}
      searchPlaceholder="Rechercher un ordinateur, SSD, écran, routeur..."
      emptyLabel="Aucun équipement informatique trouvé"
      allDomainProducts={infoProducts}
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
