import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CategoryGroup,
  HEADQUARTERS,
  Product,
  getProductStockStatus
} from '../data/mockData.ts';
import { getBoutiqueContact } from '../utils/whatsapp.ts';
import { formatProductTitle } from '../utils/productFormat.ts';
import { ProductImage } from './ProductImage.tsx';
import { CustomOrderModal } from './CustomOrderModal.tsx';

export type BoutiqueDomain = 'electronique' | 'electrotechnique' | 'informatique';

interface BoutiqueStorefrontProps {
  domain: BoutiqueDomain;
  tabId: 'boutique_electronique' | 'boutique_electrotechnique' | 'boutique_informatique';
  shopTitle: string;
  shopShortSubtitle: string;
  shopDescription: string;
  logoUrl?: string;
  locationLabel?: string;
  flag?: string;
  country?: string;
  defaultCustomerName?: string;
  defaultCustomerPhone?: string;
  defaultCustomerEmail?: string;
  searchPlaceholder: string;
  emptyLabel: string;
  allDomainProducts: Product[];
  groups: CategoryGroup[];
  isLoadingProducts?: boolean;
  productsLoadError?: string | null;
  onRetryLoadProducts?: () => void;
  cartCount?: number;
  onAddToCart: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  onOpenCart: () => void;
  onGoTab: (tab: any) => void;
}

const DEFAULT_LOGO_URL = '/assets/aistudio/Image_1_397aca35.jpeg';

const isPromoProduct = (product: Product): boolean =>
  Boolean(
    product.isPromo ||
      product.isFlashSale ||
      (typeof product.oldPrice === 'number' && product.oldPrice > product.price)
  );

export const BoutiqueStorefront: React.FC<BoutiqueStorefrontProps> = ({
  domain,
  tabId,
  shopTitle,
  shopShortSubtitle,
  shopDescription,
  logoUrl = DEFAULT_LOGO_URL,
  locationLabel = 'Ouagadougou',
  flag,
  country,
  defaultCustomerName,
  defaultCustomerPhone,
  defaultCustomerEmail,
  searchPlaceholder,
  emptyLabel,
  allDomainProducts,
  groups,
  isLoadingProducts = false,
  productsLoadError = null,
  onRetryLoadProducts,
  cartCount = 0,
  onAddToCart,
  onSelectProduct,
  onOpenCart,
  onGoTab
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [isCustomOrderOpen, setIsCustomOrderOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [logoLoadError, setLogoLoadError] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const contact = useMemo(() => getBoutiqueContact(domain), [domain]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 2600);
  };

  const normalizeToken = (value?: string): string =>
    (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

  // Visible published products for this storefront
  const publishedShopProducts = useMemo(
    () =>
      allDomainProducts.filter(
        (p) => (p.isPublished as unknown) !== false && (p.isPublished as unknown) !== 'false' && !p.isDraft
      ),
    [allDomainProducts]
  );

  // Category chips (always starting with "Tout" + official groups + any subgroups found on live products)
  const categoryOptions = useMemo(() => {
    const customCategories = groups.filter((g) => g.id !== 'all');
    const seenIds = new Set(customCategories.map((g) => normalizeToken(g.id)));
    const discovered: CategoryGroup[] = [];
    for (const product of publishedShopProducts) {
      const subId = (product.subGroup || '').trim();
      const subNorm = normalizeToken(subId);
      if (subId && subNorm !== 'all' && !seenIds.has(subNorm)) {
        seenIds.add(subNorm);
        discovered.push({
          id: subId,
          label: product.subGroupLabel || product.categoryLabel || subId,
          icon: 'category'
        });
      }
    }
    return [{ id: 'all', label: 'Tout', icon: 'apps' }, ...customCategories, ...discovered];
  }, [groups, publishedShopProducts]);

  useEffect(() => {
    if (selectedGroup === 'all') return;
    const selectedNorm = normalizeToken(selectedGroup);
    const stillExists = categoryOptions.some(
      (cat) => cat.id === selectedGroup || normalizeToken(cat.id) === selectedNorm
    );
    if (!stillExists) {
      setSelectedGroup('all');
    }
  }, [categoryOptions, selectedGroup]);

  // Filtered products based on selected category & search query
  const displayedProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const selectedNorm = normalizeToken(selectedGroup);
    const selectedLabelNorm = normalizeToken(
      categoryOptions.find((c) => c.id === selectedGroup)?.label
    );

    return publishedShopProducts.filter((p) => {
      const matchGroup =
        selectedGroup === 'all' ||
        normalizeToken(p.subGroup) === selectedNorm ||
        normalizeToken(p.category) === selectedNorm ||
        (selectedLabelNorm.length > 0 &&
          (normalizeToken(p.subGroupLabel) === selectedLabelNorm ||
            normalizeToken(p.categoryLabel) === selectedLabelNorm));
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.ref.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.categoryLabel || '').toLowerCase().includes(q) ||
        (p.subGroupLabel || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q);
      return matchGroup && matchSearch;
    });
  }, [publishedShopProducts, selectedGroup, searchQuery, categoryOptions]);

  // Curated sections when viewing "Tout" with no search query
  const curatedSections = useMemo(() => {
    const featured = publishedShopProducts.filter((p) => p.isFeaturedOnHome || p.isPremium);
    const promos = publishedShopProducts.filter(isPromoProduct);
    const news = publishedShopProducts.filter((p) => p.isNew || p.isNewArrival);

    const sections: Array<{ id: string; title: string; items: Product[]; subtitle?: string }> = [];

    if (featured.length > 0) {
      sections.push({
        id: 'featured',
        title: 'Nos coups de cœur',
        items: featured
      });
    } else if (publishedShopProducts.length > 0) {
      sections.push({
        id: 'highlights',
        title: 'Nos coups de cœur',
        items: publishedShopProducts.slice(0, Math.min(6, publishedShopProducts.length))
      });
    }

    if (promos.length > 0) {
      sections.push({
        id: 'promos',
        title: 'Promotions',
        items: promos
      });
    }

    if (news.length > 0) {
      sections.push({
        id: 'new',
        title: 'Nouveautés',
        items: news
      });
    }

    const firstSectionIds = new Set(sections[0]?.items.map((p) => p.id) ?? []);
    const hasAdditionalCatalogItems =
      publishedShopProducts.some((p) => !firstSectionIds.has(p.id)) ||
      featured.length > 0 ||
      promos.length > 0 ||
      news.length > 0;

    if (publishedShopProducts.length > 0 && hasAdditionalCatalogItems && !(sections.length === 1 && sections[0].items.length === publishedShopProducts.length)) {
      sections.push({
        id: 'all-catalog',
        title: 'Tout le catalogue',
        items: publishedShopProducts
      });
    }

    return sections;
  }, [publishedShopProducts]);

  const handleToggleSearch = () => {
    setIsSearchOpen((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => searchInputRef.current?.focus(), 40);
      } else {
        setSearchQuery('');
      }
      return next;
    });
  };

  const handleShareBoutique = () => {
    const shareUrl = `${window.location.origin}/?tab=${tabId}`;
    const shareText = `Découvrez la ${shopTitle} ELECTRO-MEN (${locationLabel}) : ${shareUrl}`;
    if (navigator.share) {
      navigator
        .share({
          title: `${shopTitle} · ELECTRO-MEN`,
          text: shareText,
          url: shareUrl
        })
        .catch(() => copyBoutiqueLink(shareUrl));
    } else {
      copyBoutiqueLink(shareUrl);
    }
  };

  const copyBoutiqueLink = (url: string) => {
    navigator.clipboard?.writeText(url).then(() => {
      showToast('Lien de la boutique copié !');
    });
  };

  const handleQuickAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const status = getProductStockStatus(product);
    if (status === 'out_of_stock') return;
    const displayName = formatProductTitle(product.name);
    onAddToCart(product);
    showToast(
      status === 'on_order'
        ? `${displayName} ajouté (sur commande)`
        : `${displayName} ajouté au panier`
    );
  };

  const whatsappDirectHref = `https://wa.me/${contact.cleanNumber}?text=${encodeURIComponent(
    `Bonjour ${contact.service}, je souhaite obtenir des renseignements sur vos produits de la ${shopTitle}.`
  )}`;

  const selectedCategoryLabel =
    categoryOptions.find((c) => c.id === selectedGroup)?.label || 'Tout';

  const isFilteredView = selectedGroup !== 'all' || searchQuery.trim().length > 0;

  const renderProductCard = (prod: Product) => {
    const stockStatus = getProductStockStatus(prod);
    const isOut = stockStatus === 'out_of_stock';
    const isOnOrder = stockStatus === 'on_order';
    const hasDiscount = typeof prod.oldPrice === 'number' && prod.oldPrice > prod.price;
    const showPromoBadge = isPromoProduct(prod);
    const displayTitle = formatProductTitle(prod.name);

    return (
      <article
        key={prod.id}
        onClick={() => onSelectProduct(prod)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectProduct(prod);
          }
        }}
        role="button"
        tabIndex={0}
        className="group min-w-0 overflow-hidden bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-sm p-1.5 sm:p-2.5 flex flex-col justify-between cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
      >
        <div>
          {/* Image carrée légèrement arrondie */}
          <div className="relative aspect-square w-full rounded-lg sm:rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center p-1.5 sm:p-2">
            {showPromoBadge && (
              <span className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-extrabold tracking-wide shadow-2xs">
                PROMO
              </span>
            )}

            <ProductImage
              product={prod}
              alt={displayTitle}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
            />

            {!isOut && (
              <button
                type="button"
                onClick={(e) => handleQuickAdd(e, prod)}
                title="Ajouter au panier"
                aria-label={`Ajouter ${displayTitle} au panier`}
                className="absolute bottom-1.5 right-1.5 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/95 hover:bg-slate-900 text-slate-800 hover:text-white border border-slate-200 shadow-xs flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px] sm:text-base">
                  add_shopping_cart
                </span>
              </button>
            )}
          </div>

          {/* Titre court (1 à 2 lignes) */}
          <h3 className="mt-2 text-[11px] sm:text-xs font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-slate-700">
            {displayTitle}
          </h3>
        </div>

        {/* Prix actuel en gras + ancien prix barré */}
        <div className="mt-1.5 space-y-0.5">
          <div className="flex items-baseline flex-wrap gap-x-1 gap-y-0.5">
            <span className="text-[10.5px] sm:text-sm font-extrabold text-slate-950 font-mono tabular-nums tracking-tight whitespace-nowrap">
              {prod.price.toLocaleString('fr-FR')} FCFA
            </span>
            {hasDiscount && (
              <span className="text-[9.5px] sm:text-[11px] text-slate-400 line-through font-mono tabular-nums whitespace-nowrap">
                {prod.oldPrice!.toLocaleString('fr-FR')} FCFA
              </span>
            )}
          </div>

          {isOut ? (
            <p className="text-[10px] font-medium text-rose-600">Rupture de stock</p>
          ) : isOnOrder ? (
            <p className="text-[10px] font-medium text-amber-700">Sur commande</p>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-4 pb-12 animate-fadeIn text-[#0f172a]">
      {/* Toast notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold"
        >
          <span className="material-symbols-outlined text-emerald-400 text-base">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation retour sobre */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onGoTab('boutiques')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 py-1 px-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span>Toutes les boutiques</span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {onRetryLoadProducts && (
            <button
              type="button"
              onClick={() => {
                onRetryLoadProducts();
                showToast('Actualisation du catalogue lancée');
              }}
              disabled={isLoadingProducts}
              title="Recharger les derniers produits, prix, images et catégories"
              aria-label="Actualiser le catalogue"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-950 text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <span className={`material-symbols-outlined text-sm ${isLoadingProducts ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>Actualiser le catalogue</span>
            </button>
          )}
          <span className="text-xs text-slate-500 font-medium tabular-nums whitespace-nowrap">
            {publishedShopProducts.length} article{publishedShopProducts.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* 1. EN-TÊTE UNIFIÉ DE LA BOUTIQUE (NOM UNIQUE + DRAPEAU + ACTIONS COMPLÈTES) */}
      <header className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          {/* Gauche : Logo + Drapeau + Nom unique de la boutique + Coordonnées/Localisation */}
          <div className="flex items-start gap-3 sm:gap-3.5 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shadow-2xs">
                {!logoLoadError ? (
                  <img
                    src={logoUrl}
                    alt={shopTitle}
                    referrerPolicy="no-referrer"
                    onError={() => setLogoLoadError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-xl text-slate-500">
                    storefront
                  </span>
                )}
              </div>
              {flag && (
                <span
                  title={country || locationLabel}
                  aria-label={country ? `Pays : ${country}` : 'Drapeau de la boutique'}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center text-sm leading-none select-none"
                >
                  {flag}
                </span>
              )}
            </div>

            <div className="min-w-0 space-y-1">
              <h1 className="font-syne text-base sm:text-xl font-extrabold text-slate-950 leading-tight">
                {shopTitle}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-600 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="font-medium text-slate-700">{locationLabel}</span>
                <span aria-hidden="true">·</span>
                <span>Ouvert 08h–18h30</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums font-semibold text-slate-800">
                  {contact.display}
                </span>
              </p>
              <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-2 leading-relaxed">
                {shopShortSubtitle} — {shopDescription}
              </p>
            </div>
          </div>

          {/* Droite : Infos, Partager, Recherche, Panier */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsInfoOpen(true)}
              title="Informations sur la boutique"
              aria-label="Informations sur la boutique"
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">info</span>
            </button>

            <button
              type="button"
              onClick={handleToggleSearch}
              title={isSearchOpen ? 'Fermer la recherche' : 'Rechercher un produit'}
              aria-label={isSearchOpen ? 'Fermer la recherche' : 'Rechercher un produit'}
              aria-expanded={isSearchOpen}
              className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                isSearchOpen || searchQuery
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isSearchOpen ? 'close' : 'search'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenCart}
              title="Ouvrir le panier"
              aria-label={`Ouvrir le panier (${cartCount} article${cartCount > 1 ? 's' : ''})`}
              className="relative w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-slate-950 text-white text-[10px] font-extrabold font-mono tabular-nums flex items-center justify-center border border-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Actions unifiées : Partager, Appeler, WhatsApp & Commande écrite sur mesure */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleShareBoutique}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">share</span>
              <span>Partager</span>
            </button>

            <a
              href={`tel:${contact.number}`}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">call</span>
              <span>Appeler</span>
            </a>

            <a
              href={whatsappDirectHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              <span>WhatsApp</span>
            </a>
          </div>

          <button
            type="button"
            onClick={() => setIsCustomOrderOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-amber-700">edit_note</span>
            <span>Commander un article non listé / Écrire ma commande</span>
          </button>
        </div>

        {/* Barre de recherche rapide intégrée */}
        {(isSearchOpen || searchQuery.length > 0) && (
          <div className="relative pt-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
              search
            </span>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-900 rounded-xl py-2.5 pl-10 pr-9 text-xs sm:text-sm text-slate-900 outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">cancel</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* 2. BARRE DE CATÉGORIES HORIZONTALE (CHIPS / PILLS SCROLLABLES) */}
      <nav aria-label="Catégories de la boutique" className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {categoryOptions.map((cat) => {
          const isActive = selectedGroup === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedGroup(cat.id)}
              aria-pressed={isActive}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </nav>

      {/* 4. SECTIONS PRODUITS STRUCTURÉES EN GRILLES / RANGÉES */}
      {isLoadingProducts && publishedShopProducts.length === 0 ? (
        <section
          role="status"
          aria-live="polite"
          className="py-12 px-4 text-center bg-white rounded-2xl border border-slate-200 space-y-2"
        >
          <span className="material-symbols-outlined text-3xl text-slate-700 animate-spin inline-block">
            progress_activity
          </span>
          <p className="text-sm font-bold text-slate-900">
            Chargement instantané du catalogue en cours...
          </p>
          <p className="text-xs text-slate-500">
            Récupération en direct depuis la base PostgreSQL Neon.
          </p>
        </section>
      ) : productsLoadError && publishedShopProducts.length === 0 ? (
        <section
          role="alert"
          className="py-10 px-4 text-center bg-rose-50 rounded-2xl border border-rose-200 space-y-3"
        >
          <span className="material-symbols-outlined text-4xl text-rose-500">
            cloud_off
          </span>
          <div className="space-y-1 max-w-md mx-auto">
            <p className="text-sm font-bold text-rose-900">
              Erreur de chargement du catalogue
            </p>
            <p className="text-xs text-rose-700">{productsLoadError}</p>
          </div>
          {onRetryLoadProducts && (
            <button
              type="button"
              onClick={onRetryLoadProducts}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              <span>Réessayer</span>
            </button>
          )}
        </section>
      ) : displayedProducts.length === 0 ? (
        <section className="py-12 px-4 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <span className="material-symbols-outlined text-4xl text-slate-300">
            inventory_2
          </span>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900">{emptyLabel}</p>
            {isFilteredView && (
              <p className="text-xs text-slate-500">
                Aucun article ne correspond aux filtres sélectionnés.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {isFilteredView && (
              <button
                type="button"
                onClick={() => {
                  setSelectedGroup('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Afficher tout le catalogue
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCustomOrderOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 text-xs font-bold cursor-pointer transition-colors inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base text-amber-700">edit_note</span>
              <span>Écrire ma commande sur mesure</span>
            </button>
          </div>
        </section>
      ) : isFilteredView ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-syne text-sm sm:text-base font-extrabold text-slate-900 truncate">
              {searchQuery.trim()
                ? `Résultats pour « ${searchQuery.trim()} »`
                : selectedCategoryLabel}
            </h2>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-slate-500 font-medium tabular-nums">
                {displayedProducts.length} produit{displayedProducts.length > 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroup('all');
                  setSearchQuery('');
                }}
                className="text-xs font-semibold text-slate-700 hover:text-slate-950 underline cursor-pointer whitespace-nowrap"
              >
                Tout voir
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
            {displayedProducts.map(renderProductCard)}
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          {curatedSections.map((section) => (
            <section key={section.id} className="space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-syne text-sm sm:text-base font-extrabold text-slate-950">
                  {section.title}
                </h2>
                <span className="text-xs text-slate-500 font-medium tabular-nums">
                  {section.items.length} article{section.items.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
                {section.items.map(renderProductCard)}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Modal Infos Boutique */}
      {isInfoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setIsInfoOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full overflow-hidden border border-slate-200 bg-slate-50 shrink-0 flex items-center justify-center">
                  {!logoLoadError ? (
                    <img
                      src={logoUrl}
                      alt={shopTitle}
                      referrerPolicy="no-referrer"
                      onError={() => setLogoLoadError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-syne text-xs font-black text-slate-900">EM</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-syne text-base font-extrabold text-slate-950 truncate">
                    {shopTitle}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {HEADQUARTERS.siegeSocial}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInfoOpen(false)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {shopDescription}
            </p>

            <div className="space-y-2 text-xs text-slate-700 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Téléphone &amp; WhatsApp</span>
                <span className="font-mono font-bold tabular-nums text-slate-900">
                  {contact.display}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Horaires</span>
                <span className="font-semibold text-slate-900">Lun – Sam · 08h00 – 18h30</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Livraison</span>
                <span className="font-semibold text-slate-900">Négociée avec le vendeur</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-2">
              <p className="text-[11px] font-semibold text-slate-500">
                Autres boutiques ELECTRO-MEN
              </p>
              <div className="flex flex-wrap gap-2">
                {domain !== 'electronique' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsInfoOpen(false);
                      onGoTab('boutique_electronique');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    Électronique
                  </button>
                )}
                {domain !== 'informatique' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsInfoOpen(false);
                      onGoTab('boutique_informatique');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    Informatique
                  </button>
                )}
                {domain !== 'electrotechnique' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsInfoOpen(false);
                      onGoTab('boutique_electrotechnique');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    Électrotechnique
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <a
                href={`tel:${contact.number}`}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs font-bold text-center inline-flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">call</span>
                <span>Appeler</span>
              </a>
              <a
                href={whatsappDirectHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold text-center inline-flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
      {/* Modal Commande Personnalisée par écrit */}
      <CustomOrderModal
        isOpen={isCustomOrderOpen}
        onClose={() => setIsCustomOrderOpen(false)}
        defaultDomain={domain}
        source="boutique"
        defaultCustomerName={defaultCustomerName}
        defaultCustomerPhone={defaultCustomerPhone}
        defaultCustomerEmail={defaultCustomerEmail}
      />
    </div>
  );
};
