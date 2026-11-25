import React, { useMemo } from 'react';
import { Product, ELECTRONIQUE_GROUPS, CategoryGroup } from '../data/mockData.ts';
import { BoutiqueStorefront } from './BoutiqueStorefront.tsx';

interface ScreenBoutiqueElectroniqueProps {
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

export const ScreenBoutiqueElectronique: React.FC<ScreenBoutiqueElectroniqueProps> = ({
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
    const adminGroups = customGroups.filter((g) => !g.domain || g.domain === 'electronique');
    return [
      ...ELECTRONIQUE_GROUPS,
      ...adminGroups.filter((ag) => !ELECTRONIQUE_GROUPS.some((eg) => eg.id === ag.id))
    ];
  }, [propGroups, customGroups]);

  const electroniqueProducts = useMemo(() => {
    const norm = (val?: string) =>
      (val || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    return products.filter((p) => {
      const domainNorm = norm(p.domain);
      if (domainNorm === 'electronique' || domainNorm.includes('microelectron')) return true;
      if (!domainNorm) {
        const catNorm = norm(p.category);
        return ['kit', 'kits', 'module', 'modules', 'ic', 'sensor', 'sensors', 'passif', 'passifs', 'tool', 'tools', 'electronique'].includes(catNorm);
      }
      return false;
    });
  }, [products]);

  return (
    <BoutiqueStorefront
      domain="electronique"
      tabId="boutique_electronique"
      shopTitle="Boutique Composants Électroniques"
      shopShortSubtitle="Composants, IoT & Capteurs"
      shopDescription="Microcontrôleurs, capteurs, modules IoT, circuits intégrés, composants passifs et outillage de prototypage disponibles en stock à Ouagadougou ou sur commande."
      logoUrl={logoUrl}
      locationLabel={locationLabel}
      searchPlaceholder="Rechercher un composant électronique, référence, capteur..."
      emptyLabel="Aucun composant électronique trouvé"
      allDomainProducts={electroniqueProducts}
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
