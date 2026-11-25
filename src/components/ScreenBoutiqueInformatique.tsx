import React, { useMemo } from 'react';
import { Product, INFORMATIQUE_GROUPS, CategoryGroup } from '../data/mockData.ts';
import { BoutiqueStorefront } from './BoutiqueStorefront.tsx';

interface ScreenBoutiqueInformatiqueProps {
  products: Product[];
  isLoadingProducts?: boolean;
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

export const ScreenBoutiqueInformatique: React.FC<ScreenBoutiqueInformatiqueProps> = ({
  products,
  isLoadingProducts = false,
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
    const adminGroups = customGroups.filter((g) => g.domain === 'informatique');
    return [
      ...INFORMATIQUE_GROUPS,
      ...adminGroups.filter((ag) => !INFORMATIQUE_GROUPS.some((eg) => eg.id === ag.id))
    ];
  }, [propGroups, customGroups]);

  const infoProducts = useMemo(() => {
    return products.filter((p) => p.domain === 'informatique');
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
      searchPlaceholder="Rechercher un ordinateur, SSD, écran, routeur..."
      emptyLabel="Aucun équipement informatique trouvé"
      allDomainProducts={infoProducts}
      groups={groups}
      isLoadingProducts={isLoadingProducts}
      cartCount={cartCount}
      onAddToCart={onAddToCart}
      onSelectProduct={onSelectProduct}
      onOpenCart={onOpenCart}
      onGoTab={onGoTab}
    />
  );
};
