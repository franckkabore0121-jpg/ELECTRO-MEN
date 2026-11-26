import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Product,
  Course,
  InvestmentProject,
  SOCIAL_LINKS,
  getProductStockStatus,
  getStockStatusLabel
} from '../data/mockData.ts';
import { buildBoutiqueWhatsAppUrl } from '../utils/whatsapp.ts';
import { formatProductTitle } from '../utils/productFormat.ts';
import { ProductImage } from './ProductImage.tsx';

interface ScreenAccueilProps {
  products: Product[];
  isLoadingProducts?: boolean;
  productsLoadError?: string | null;
  onRetryLoadProducts?: () => void;
  courses: Course[];
  projects?: InvestmentProject[];
  heroVideoUrl?: string;
  onGoTab: (tab: any) => void;
  onOpenCreateAccount?: () => void;
  onOpenSearchModal?: () => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onOpenVideo?: () => void;
  onOpenWallet?: () => void;
  onUpdateProduct?: (product: Product) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const ScreenAccueil: React.FC<ScreenAccueilProps> = ({
  products,
  isLoadingProducts = false,
  productsLoadError = null,
  onRetryLoadProducts,
  courses,
  onGoTab,
  onSelectProduct,
  onAddToCart,
  onUpdateProduct,
  searchQuery = '',
  onSearchChange: _onSearchChange
}) => {
  // Published real products from database only
  const publishedProducts = useMemo(
    () => products.filter((p) => p.isPublished !== false && !p.isDraft),
    [products]
  );

  // Uniquement les produits de la vente flash mis par l'administrateur
  const flashSaleProducts = useMemo(
    () => publishedProducts.filter((p) => p.isFlashSale === true),
    [publishedProducts]
  );

  // Produits animés pour le défilement horizontal continu des Ventes Flash (comme dans la vidéo)
  const animatedFlashProducts = useMemo(() => {
    if (flashSaleProducts.length === 0) return [];
    if (flashSaleProducts.length < 5) {
      return [
        ...flashSaleProducts,
        ...flashSaleProducts,
        ...flashSaleProducts,
        ...flashSaleProducts
      ];
    }
    return [...flashSaleProducts, ...flashSaleProducts];
  }, [flashSaleProducts]);

  // Published real courses
  const publishedCourses = useMemo(
    () => courses.filter((c) => c.isPublished || c.status === 'published'),
    [courses]
  );

  // Category filter state ('all' | 'electronique' | 'informatique' | 'electrotechnique')
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'electronique' | 'informatique' | 'electrotechnique'>('all');

  // Dropdown pour le sélecteur de catégorie
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Quick filter tab: 'all' | 'featured' | 'promos' | 'new'
  const [quickFilter, setQuickFilter] = useState<'all' | 'featured' | 'promos' | 'new'>('all');

  // Grid / List view toggle
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modal de gestion Vente Flash pour l'administrateur
  const [isFlashManagerOpen, setIsFlashManagerOpen] = useState(false);

  // Filtered products on Home page
  const displayedProducts = useMemo(() => {
    return publishedProducts.filter((p) => {
      // Category filter
      if (selectedCategory !== 'all' && p.domain !== selectedCategory) {
        return false;
      }
      // Quick filter
      if (quickFilter === 'featured' && !p.isFeaturedOnHome && !p.isPremium) return false;
      if (quickFilter === 'promos' && !p.isPromo && !p.isFlashSale && !(p.oldPrice && p.oldPrice > p.price)) return false;
      if (quickFilter === 'new' && !p.isNew && !p.isNewArrival) return false;
      // Search query from header
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchRef = p.ref.toLowerCase().includes(q);
        const matchCat = (p.categoryLabel || '').toLowerCase().includes(q);
        const matchDomain = (p.domain || '').toLowerCase().includes(q);
        const matchSpecs = (p.details || p.specs || []).some((s) => s.toLowerCase().includes(q));
        if (!matchName && !matchRef && !matchCat && !matchDomain && !matchSpecs) return false;
      }
      return true;
    });
  }, [publishedProducts, selectedCategory, quickFilter, searchQuery]);

  const toggleProductFlash = (prod: Product) => {
    if (onUpdateProduct) {
      onUpdateProduct({
        ...prod,
        isFlashSale: !prod.isFlashSale
      });
    }
  };

  const getBoutiqueLabel = (domain?: string) => {
    switch (domain) {
      case 'electronique':
        return 'Boutique Électronique';
      case 'electrotechnique':
        return 'Boutique Électrotechnique';
      case 'informatique':
        return 'Boutique Informatique';
      default:
        return 'Boutique ELECTRO-MEN';
    }
  };

  const CATEGORY_OPTIONS: {
    id: 'all' | 'electronique' | 'informatique' | 'electrotechnique';
    label: string;
    sublabel: string;
    icon: string;
  }[] = [
    {
      id: 'all',
      label: 'Toutes les catégories',
      sublabel: 'Tous les composants et équipements',
      icon: 'apps'
    },
    {
      id: 'electronique',
      label: 'Boutique Électronique',
      sublabel: 'Composants électroniques, capteurs, modules',
      icon: 'memory'
    },
    {
      id: 'electrotechnique',
      label: 'Boutique Électrotechnique',
      sublabel: 'Équipements électrotechniques, appareillage, câblage',
      icon: 'bolt'
    },
    {
      id: 'informatique',
      label: 'Boutique Informatique',
      sublabel: 'Matériels informatiques, périphériques, réseaux',
      icon: 'laptop_mac'
    }
  ];

  const currentCategoryOption =
    CATEGORY_OPTIONS.find((c) => c.id === selectedCategory) || CATEGORY_OPTIONS[0];

  return (
    <div className="bg-white text-slate-900 min-h-screen space-y-5 sm:space-y-7 pb-20 animate-fadeIn relative">
      {/* =========================================================================
          1. BOUTON SÉLECTEUR DE CATÉGORIE (AU-DESSUS DE LA VENTE FLASH)
          - Taille réduite, design classique et très professionnel
          - Texte sur le bouton : « Catégorie »
          - Au clic : affiche toutes les catégories et les boutiques correspondantes
          ========================================================================= */}
      <section className="pt-1 flex items-center justify-between">
        <div className="relative inline-block" ref={categoryDropdownRef}>
          <button
            type="button"
            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 hover:border-[#d4af37] text-slate-900 shadow-2xs hover:shadow-xs transition-all cursor-pointer text-xs font-bold"
          >
            <span className="material-symbols-outlined text-[#d4af37] text-sm shrink-0">
              category
            </span>
            <span className="font-syne font-extrabold uppercase tracking-wide text-xs">
              Catégorie
            </span>
            {selectedCategory !== 'all' && (
              <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-[#b48c1e] text-[9px] font-black uppercase">
                {selectedCategory === 'electronique'
                  ? 'Électro'
                  : selectedCategory === 'electrotechnique'
                  ? 'Électrotech'
                  : 'Info'}
              </span>
            )}
            <span
              className={`material-symbols-outlined text-slate-400 text-sm transition-transform duration-200 shrink-0 ${
                isCategoryDropdownOpen ? 'rotate-180 text-[#b48c1e]' : ''
              }`}
            >
              expand_more
            </span>
          </button>

          {isCategoryDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 z-40 w-72 sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 space-y-1 animate-fadeIn">
              <div className="px-2 py-1 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                <span>Toutes les catégories & Boutiques</span>
                {selectedCategory !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('all');
                      setIsCategoryDropdownOpen(false);
                    }}
                    className="text-[#b48c1e] hover:underline cursor-pointer"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>

              {CATEGORY_OPTIONS.map((opt) => {
                const isSelected = selectedCategory === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(opt.id);
                      setIsCategoryDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/80 border border-amber-200 text-slate-950 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#d4af37] text-slate-950'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {opt.icon}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-syne text-xs font-bold text-slate-900 truncate">
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {opt.sublabel}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-[#b48c1e] text-base shrink-0 ml-1">
                        check
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedCategory !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="text-[11px] text-[#b48c1e] hover:underline font-bold cursor-pointer whitespace-nowrap"
            >
              Toutes les catégories
            </button>
          )}
          {onRetryLoadProducts && (
            <button
              type="button"
              onClick={onRetryLoadProducts}
              disabled={isLoadingProducts}
              title="Recharger les derniers produits, prix et images"
              aria-label="Actualiser le catalogue"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#d4af37] text-slate-700 hover:text-slate-950 text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <span className={`material-symbols-outlined text-sm ${isLoadingProducts ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>Actualiser</span>
            </button>
          )}
        </div>
      </section>

      {/* =========================================================================
          2. SECTION VENTES FLASH (RÉFÉRENCE VIDÉO / CAPTURE)
          - Titre simple : ⚡ Ventes flash
          - Cartes défilantes horizontales
          - Pas de temporisation
          - Couleurs du logo uniquement
          - Uniquement les produits configurés par l'administrateur
          ========================================================================= */}
      {(flashSaleProducts.length > 0 || onUpdateProduct) && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#d4af37] text-lg animate-pulse">
                bolt
              </span>
              <h2 className="font-syne text-xs sm:text-sm font-extrabold text-slate-950 uppercase tracking-wider">
                Ventes flash
              </h2>
            </div>

            {onUpdateProduct && (
              <button
                type="button"
                onClick={() => setIsFlashManagerOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-[#b48c1e] text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors border border-amber-200/70"
                title="Gérer les produits de la Vente Flash"
              >
                <span className="material-symbols-outlined text-xs">tune</span>
                <span>Gérer Flash</span>
              </button>
            )}
          </div>

          {flashSaleProducts.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400 rounded-xl bg-slate-50 border border-slate-100">
              Aucun produit configuré en Vente Flash pour le moment.
            </div>
          ) : (
            /* DÉFILEMENT HORIZONTAL ANIMÉ DES VENTES FLASH (COMME DANS LA VIDÉO) */
            <div className="relative overflow-hidden w-full pb-2">
              <div className="animate-flash-scroll flex items-stretch gap-3">
                {animatedFlashProducts.map((p, idx) => {
                  const displayTitle = formatProductTitle(p.name);
                  return (
                  <div
                    key={`${p.id}-flash-${idx}`}
                    onClick={() => onSelectProduct(p)}
                    className="relative w-36 sm:w-44 shrink-0 rounded-2xl bg-white border border-slate-200 hover:border-[#d4af37] p-2.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group cursor-pointer"
                  >
                    <div className="space-y-1.5">
                      <div className="aspect-square rounded-xl overflow-hidden bg-slate-50 border border-slate-100 p-2 flex items-center justify-center">
                        <ProductImage
                          product={p}
                          alt={displayTitle}
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                        />
                      </div>

                      <div className="flex items-baseline gap-1 text-[11px] font-bold font-mono">
                        <span className="text-[#b48c1e]">{p.price.toLocaleString('fr-FR')} FCFA</span>
                        {p.oldPrice && p.oldPrice > p.price && (
                          <span className="text-[9px] text-slate-400 line-through font-normal">
                            {p.oldPrice.toLocaleString('fr-FR')} F
                          </span>
                        )}
                      </div>

                      <h4 className="font-syne text-[11px] font-bold text-slate-900 group-hover:text-[#b48c1e] transition-colors truncate">
                        {displayTitle}
                      </h4>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          3. CHIPS DE FILTRAGE RAPIDE (EXACTEMENT COMME DANS LA VIDÉO)
          - Tous | 👑 Premium | 🏷️ Promos | ⚡ Nouveautés
          ========================================================================= */}
      <section className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setQuickFilter('all')}
          className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all ${
            quickFilter === 'all'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          Tous
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter('featured')}
          className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
            quickFilter === 'featured'
              ? 'bg-[#d4af37] text-slate-950 shadow-2xs font-extrabold'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <span>👑 Premium</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter('promos')}
          className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
            quickFilter === 'promos'
              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <span>🏷️ Promos</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter('new')}
          className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
            quickFilter === 'new'
              ? 'bg-slate-900 text-white shadow-2xs font-extrabold'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <span>⚡ Nouveautés</span>
        </button>
      </section>

      {/* =========================================================================
          4. SECTION PRODUITS EN 2 COLONNES (DIRECTEMENT SOUS LES FILTRES)
          - Grille 2 colonnes sur smartphone
          - Photo, badge, drapeau 🇧🇫, nom, boutique d'appartenance, prix FCFA
          - Interaction complète fiche / panier
          ========================================================================= */}
      <section className="space-y-3">
        {isLoadingProducts && displayedProducts.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-50 border border-slate-200 space-y-2" role="status" aria-live="polite">
            <span className="material-symbols-outlined text-3xl text-amber-600 animate-spin inline-block">progress_activity</span>
            <h4 className="font-syne text-xs sm:text-sm font-bold text-slate-800">
              Chargement instantané du catalogue produits...
            </h4>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Récupération des équipements en direct depuis la base PostgreSQL.
            </p>
          </div>
        ) : productsLoadError && publishedProducts.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-rose-50 border border-rose-200 space-y-2" role="alert">
            <span className="material-symbols-outlined text-3xl text-rose-500">cloud_off</span>
            <h4 className="font-syne text-xs sm:text-sm font-bold text-rose-900">
              Erreur de chargement du catalogue
            </h4>
            <p className="text-[11px] text-rose-700 max-w-sm mx-auto">{productsLoadError}</p>
            {onRetryLoadProducts && (
              <button
                type="button"
                onClick={onRetryLoadProducts}
                className="mt-1 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span>Réessayer</span>
              </button>
            )}
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="material-symbols-outlined text-2xl text-slate-400">inventory_2</span>
            <h4 className="font-syne text-xs font-bold text-slate-800">
              Aucun produit ne correspond aux filtres
            </h4>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Sélectionnez une autre catégorie ou effacez la recherche.
            </p>
          </div>
        ) : (
          /* GRILLE DEUX COLONNES SUR MOBILE - EXACTEMENT COMME DANS LA VIDÉO */
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4'
                : 'space-y-2.5'
            }
          >
            {displayedProducts.map((p) => {
              const stockStatus = getProductStockStatus(p);
              const canBuy = stockStatus === 'in_stock' || stockStatus === 'on_order';
              const displayTitle = formatProductTitle(p.name);

              return (
                <div
                  key={p.id}
                  className="rounded-2xl bg-white border border-slate-200 hover:border-slate-300 p-2.5 sm:p-3 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    {/* Image avec Badge & Drapeau */}
                    <div
                      onClick={() => onSelectProduct(p)}
                      className="aspect-square rounded-xl overflow-hidden bg-slate-50 border border-slate-100 p-2 flex items-center justify-center cursor-pointer relative"
                    >
                      <ProductImage
                        product={p}
                        alt={displayTitle}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                        fallbackSubLabel="Photo certifiée"
                      />

                      {/* Badges sur l'image */}
                      {p.isFeaturedOnHome || p.isPremium ? (
                        <span className="absolute top-1 left-1 text-[7.5px] font-bold text-slate-950 bg-[#d4af37] px-1 py-0.5 rounded shadow-2xs uppercase">
                          👑 Premium
                        </span>
                      ) : p.isPromo ? (
                        <span className="absolute top-1 left-1 text-[7.5px] font-bold text-amber-900 bg-amber-100 px-1 py-0.5 rounded border border-amber-300 uppercase shadow-2xs">
                          🏷️ Promo
                        </span>
                      ) : p.isNew || p.isNewArrival ? (
                        <span className="absolute top-1 left-1 text-[7.5px] font-bold text-white bg-slate-900 px-1 py-0.5 rounded shadow-2xs uppercase">
                          ⚡ Neuf
                        </span>
                      ) : (
                        <span className="absolute top-1 left-1 text-[7.5px] font-mono font-bold text-slate-700 bg-white/95 px-1 py-0.2 rounded border border-slate-200 uppercase shadow-2xs">
                          {p.domain === 'electronique' ? 'Électro' : p.domain === 'electrotechnique' ? 'Électrotech' : 'Info'}
                        </span>
                      )}

                      {/* Badge pourcentage de réduction si prix barré supérieur */}
                      {p.oldPrice && p.oldPrice > p.price && (
                        <span className="absolute top-1 right-1 text-[7.5px] font-black text-white bg-red-600 px-1 py-0.2 rounded shadow-xs">
                          -{Math.round((1 - p.price / p.oldPrice) * 100)}%
                        </span>
                      )}
                    </div>

                    {/* Nom du produit */}
                    <h4
                      onClick={() => onSelectProduct(p)}
                      className="font-syne text-xs sm:text-sm font-bold text-slate-900 hover:text-[#b48c1e] transition-colors cursor-pointer line-clamp-2 leading-tight"
                    >
                      {displayTitle}
                    </h4>

                    {/* Étiquette Boutique d'appartenance */}
                    <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 truncate">
                      <span className="material-symbols-outlined text-[11px] text-slate-400">storefront</span>
                      <span className="truncate">{getBoutiqueLabel(p.domain)}</span>
                    </div>

                    {/* Prix en FCFA (Prix réel + Prix barré si promo) */}
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-syne text-xs sm:text-sm font-black text-slate-950 font-mono tabular-nums">
                          {p.price.toLocaleString('fr-FR')} <span className="text-[9px] font-normal text-slate-500 font-sans">FCFA</span>
                        </span>
                        {p.oldPrice && p.oldPrice > p.price && (
                          <span className="text-[10px] font-semibold text-slate-400 line-through font-mono tabular-nums">
                            {p.oldPrice.toLocaleString('fr-FR')} F
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                          stockStatus === 'in_stock'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : stockStatus === 'out_of_stock'
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {getStockStatusLabel(stockStatus)}
                      </span>
                    </div>
                  </div>

                  {/* Action Acheter sur WhatsApp (Modèle officiel WhatsApp) */}
                  <div className="pt-2 border-t border-slate-100 mt-2 flex items-center gap-1.5">
                    <a
                      href={buildBoutiqueWhatsAppUrl(p)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 min-h-9 flex-1 px-3 rounded-xl font-bold text-xs uppercase tracking-wide inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 bg-[#25D366] hover:bg-[#1faa53] text-white shadow-sm hover:shadow-md"
                      title={`Acheter sur WhatsApp • ${getBoutiqueLabel(p.domain)}`}
                    >
                      <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                      </svg>
                      <span>Acheter</span>
                    </a>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (canBuy) onAddToCart(p);
                      }}
                      disabled={!canBuy}
                      className="shrink-0 w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-300 text-amber-900 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 shadow-sm"
                      title={canBuy ? 'Ajouter au panier' : 'Produit indisponible'}
                      aria-label={canBuy ? `Ajouter ${displayTitle} au panier` : `${displayTitle} indisponible`}
                    >
                      <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =========================================================================
          6. SECTION FORMATIONS TECHNIQUES ET SPÉCIALISÉES (FORMAT COMPACT)
          ========================================================================= */}
      <section className="rounded-xl bg-slate-50 border border-slate-200 p-3 sm:p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-[#b48c1e]">school</span>
            <h4 className="font-syne text-xs sm:text-sm font-bold text-slate-900">
              Formations Spécialisées
            </h4>
          </div>

          <button
            type="button"
            onClick={() => onGoTab('solutions')}
            className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-[#b48c1e] text-white hover:text-slate-950 font-bold text-[10px] uppercase tracking-wide flex items-center gap-1 shadow-2xs cursor-pointer transition-all shrink-0"
          >
            <span>Accéder à l'Académie</span>
            <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
          </button>
        </div>

        {publishedCourses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {publishedCourses.slice(0, 3).map((c) => (
              <div
                key={c.id}
                onClick={() => onGoTab('solutions')}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:border-[#d4af37] transition-all cursor-pointer space-y-0.5 shadow-2xs"
              >
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className="font-bold text-[#b48c1e] uppercase truncate mr-1">
                    {c.category}
                  </span>
                  {c.duration && <span className="text-slate-400 shrink-0">{c.duration}</span>}
                </div>
                <h5 className="font-syne text-xs font-bold text-slate-900 line-clamp-1">
                  {c.title}
                </h5>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 leading-snug">
            Apprentissage pratique et formations certifiantes. Consultez les sessions ouvertes directement dans l'Académie.
          </p>
        )}
      </section>

      {/* =========================================================================
          7. BOUTON FLOTTANT DOCK MARKETPLACE (RÉFÉRENCE VIDÉO - BAS DE L'ÉCRAN)
          [ ⊞ Grille | ≡ Liste | 🏪 Boutiques ]
          ========================================================================= */}
      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-300 shadow-lg text-xs font-bold">
        <button
          type="button"
          onClick={() => setViewMode('grid')}
          aria-label="Affichage Grille"
          className={`p-1.5 rounded-full cursor-pointer transition-all ${
            viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Affichage 2 colonnes"
        >
          <span className="material-symbols-outlined text-base">grid_view</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('list')}
          aria-label="Affichage Liste"
          className={`p-1.5 rounded-full cursor-pointer transition-all ${
            viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Affichage Liste"
        >
          <span className="material-symbols-outlined text-base">format_list_bulleted</span>
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5"></div>

        <button
          type="button"
          onClick={() => onGoTab('boutiques')}
          className="px-3 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 cursor-pointer transition-all"
          title="Voir les boutiques"
        >
          <span className="material-symbols-outlined text-sm text-emerald-600">storefront</span>
          <span className="font-extrabold text-[11px]">Boutiques</span>
        </button>
      </div>

      {/* =========================================================================
          8. PIED DE PAGE : UNIQUEMENT LES 3 ICÔNES OFFICIELLES
          ========================================================================= */}
      <footer className="pt-4 border-t border-slate-200 text-center space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <a
            href={SOCIAL_LINKS.facebook}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook Officiel"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-950 text-xs font-bold transition-all shadow-2xs"
          >
            <svg className="w-3.5 h-3.5 fill-current text-blue-600" viewBox="0 0 24 24">
              <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95C18.05 21.45 22 17.19 22 12z" />
            </svg>
            <span>Facebook Officiel</span>
          </a>

          <a
            href={SOCIAL_LINKS.tiktok}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok Officiel"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-950 text-xs font-bold transition-all shadow-2xs"
          >
            <svg className="w-3.5 h-3.5 fill-current text-slate-900" viewBox="0 0 24 24">
              <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-3.48.07-6.96.08-10.44V.02z" />
            </svg>
            <span>TikTok Officiel</span>
          </a>

          <a
            href={SOCIAL_LINKS.youtube}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chaîne YouTube"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-950 text-xs font-bold transition-all shadow-2xs"
          >
            <svg className="w-3.5 h-3.5 fill-current text-red-600" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <span>Chaîne YouTube</span>
          </a>
        </div>

        <div className="text-[10px] text-slate-400">
          © {new Date().getFullYear()} ELECTRO-MEN. Tous droits réservés.
        </div>
      </footer>

      {/* =========================================================================
          MODAL DE SÉLECTION RAPIDE DES PRODUITS VENTE FLASH (ADMINISTRATEUR)
          ========================================================================= */}
      {isFlashManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-xl p-5 sm:p-6 space-y-4 max-h-[85vh] flex flex-col animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#d4af37] text-xl">bolt</span>
                <div>
                  <h3 className="font-syne text-base font-bold text-slate-950">
                    Sélection Vente Flash
                  </h3>
                  <p className="text-xs text-slate-500">
                    Choisissez les produits à afficher dans la Vente Flash.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFlashManagerOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 pr-1">
              {publishedProducts.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Aucun produit publié dans le catalogue.
                </div>
              ) : (
                publishedProducts.map((prod) => {
                  const displayTitle = formatProductTitle(prod.name);
                  return (
                  <div
                    key={prod.id}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        <ProductImage
                          product={prod}
                          alt={displayTitle}
                          compact
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">{displayTitle}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {prod.ref} · {prod.price.toLocaleString('fr-FR')} FCFA
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleProductFlash(prod)}
                      className={`px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                        prod.isFlashSale
                          ? 'bg-[#d4af37] text-slate-950 shadow-2xs font-extrabold'
                          : 'bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-[#b48c1e]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">
                        {prod.isFlashSale ? 'check' : 'add'}
                      </span>
                      <span>{prod.isFlashSale ? 'En Flash' : 'Ajouter'}</span>
                    </button>
                  </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {flashSaleProducts.length} produit(s) en Vente Flash
              </span>
              <button
                type="button"
                onClick={() => setIsFlashManagerOpen(false)}
                className="px-5 py-2 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
