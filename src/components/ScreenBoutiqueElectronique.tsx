import React, { useState, useMemo } from 'react';
import { Product, ELECTRONIQUE_GROUPS, CategoryGroup, getProductStockStatus } from '../data/mockData.ts';
import { openBoutiqueWhatsAppBuy } from '../utils/whatsapp.ts';
import { ImageZoomModal } from './ImageZoomModal.tsx';

interface ScreenBoutiqueElectroniqueProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  onOpenCart: () => void;
  onGoTab: (tab: any) => void;
  groups?: CategoryGroup[];
  customGroups?: CategoryGroup[];
}

export const ScreenBoutiqueElectronique: React.FC<ScreenBoutiqueElectroniqueProps> = ({
  products,
  onAddToCart,
  onSelectProduct,
  onOpenCart,
  onGoTab,
  groups: propGroups,
  customGroups = []
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Zoom Lightbox state
  const [zoomedProduct, setZoomedProduct] = useState<{ url: string; title: string } | null>(null);

  // Combine default groups and admin custom groups for electronique
  const groups = useMemo(() => {
    if (propGroups && propGroups.length > 0) return propGroups;
    const adminGroups = customGroups.filter((g) => !g.domain || g.domain === 'electronique');
    return [...ELECTRONIQUE_GROUPS, ...adminGroups.filter((ag) => !ELECTRONIQUE_GROUPS.some((eg) => eg.id === ag.id))];
  }, [propGroups, customGroups]);

  // Filter only electronique domain
  const electroniqueProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.domain === 'electronique' ||
        p.category === 'kit' ||
        p.category === 'module' ||
        p.category === 'ic' ||
        p.category === 'sensor' ||
        p.category === 'passif' ||
        p.category === 'tool'
    );
  }, [products]);

  // Apply group filter and shop-specific search bar
  const displayedProducts = useMemo(() => {
    return electroniqueProducts.filter((p) => {
      const matchGroup = selectedGroup === 'all' || p.subGroup === selectedGroup;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.ref.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      return matchGroup && matchSearch;
    });
  }, [electroniqueProducts, selectedGroup, searchQuery]);

  const handleAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const st = getProductStockStatus(product);
    if (st === 'out_of_stock') return;
    onAddToCart(product);
    if (st === 'on_order') {
      setAddedToast(`${product.name} (Sur commande - délai à confirmer) ajouté !`);
    } else {
      setAddedToast(`${product.name} ajouté !`);
    }
    setTimeout(() => setAddedToast(null), 2500);
  };

  const handleShare = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/?product=${product.id}`;
    const shareText = `Découvrez ${product.name} (${product.price.toLocaleString('fr-FR')} FCFA) sur ELECTRO-MEN : ${shareUrl}`;

    if (navigator.share) {
      navigator
        .share({
          title: product.name,
          text: shareText,
          url: shareUrl
        })
        .catch(() => copyToClipboard(shareUrl));
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard?.writeText(url).then(() => {
      setShareToast('Lien du produit copié pour vos statuts WhatsApp !');
      setTimeout(() => setShareToast(null), 3000);
    });
  };

  return (
    <div className="space-y-5 pb-12 animate-fadeIn text-[#0f172a]">
      {/* Toast Notifications */}
      {addedToast && (
        <div className="fixed top-20 right-4 z-50 bg-white border-2 border-amber-400 text-slate-900 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-bounce text-xs font-bold">
          <span className="material-symbols-outlined text-amber-600 text-base">check_circle</span>
          <span>{addedToast}</span>
        </div>
      )}

      {shareToast && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold">
          <span className="material-symbols-outlined text-cyan-400 text-base">share</span>
          <span>{shareToast}</span>
        </div>
      )}

      {/* Bouton retour vers la page des Boutiques */}
      <div className="flex items-center justify-between pb-1">
        <button
          type="button"
          onClick={() => onGoTab('boutiques')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          <span>Toutes les boutiques</span>
        </button>
      </div>

      {/* HEADER BOUTIQUE ÉLECTRONIQUE (Épuré selon consigne) */}
      <section className="relative overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-gradient-to-br from-white via-amber-50/20 to-white p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5 border border-amber-300">
            <span className="material-symbols-outlined text-sm text-amber-700">memory</span>
            Rayon Microélectronique
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onGoTab('boutique_electrotechnique')}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-cyan-800 border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Électrotechnique</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>

        <div>
          <h1 className="font-syne text-2xl sm:text-3xl font-extrabold text-slate-900">
            Boutique Composants Électroniques
          </h1>
        </div>

        {/* BARRE DE RECHERCHE */}
        <div className="relative pt-1">
          <span className="material-symbols-outlined absolute left-3.5 top-3.5 text-amber-600 text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un composant..."
            className="w-full bg-white border-2 border-slate-200 rounded-xl py-2.5 pl-10 pr-10 text-xs sm:text-sm text-slate-900 focus:border-amber-500 outline-none shadow-xs font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-700"
            >
              <span className="material-symbols-outlined text-base">cancel</span>
            </button>
          )}
        </div>
      </section>

      {/* GROUPES ET FAMILLES (DYNAMIQUES & PERSONNALISABLES PAR ADMIN) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-amber-600 text-sm">category</span>
            <span>Groupes &amp; Familles ({displayedProducts.length})</span>
          </span>
          {selectedGroup !== 'all' && (
            <button
              onClick={() => setSelectedGroup('all')}
              className="text-xs text-amber-700 hover:underline font-bold cursor-pointer"
            >
              Voir tout
            </button>
          )}
        </div>

        {/* Tabs de groupes */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {groups.map((grp) => {
            const isSelected = selectedGroup === grp.id;
            return (
              <button
                key={grp.id}
                type="button"
                onClick={() => setSelectedGroup(grp.id)}
                className={`py-1.5 px-3 rounded-xl font-bold text-xs whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'btn-gold-prestige shadow-xs ring-1 ring-amber-500'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-amber-300 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{grp.icon || 'folder'}</span>
                <span>{grp.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          GRILLE DES COMPOSANTS EN COLONNE DE 2 EN DESCENDANT (DEMANDE UTILISATEUR)
          grid-cols-2 gap-3 sm:gap-4
          ========================================================================= */}
      <section className="space-y-3">
        {displayedProducts.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
            <span className="material-symbols-outlined text-4xl text-slate-300">inventory_2</span>
            <p className="text-slate-800 font-bold text-sm">Aucun composant électronique trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {displayedProducts.map((prod) => (
              <div
                key={prod.id}
                onClick={() => onSelectProduct(prod)}
                className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden cursor-pointer group p-3 space-y-2 relative"
              >
                {/* Image du produit avec zoom au clic */}
                <div className="relative bg-slate-50 rounded-xl p-2 border border-slate-100 flex items-center justify-center h-36 sm:h-44 overflow-hidden group/img">
                  {prod.badge && (
                    <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold z-10 bg-amber-500 text-slate-950 shadow-2xs">
                      {prod.badge}
                    </span>
                  )}

                  {/* Bouton Partager rapide */}
                  <button
                    type="button"
                    onClick={(e) => handleShare(e, prod)}
                    title="Partager sur WhatsApp et réseaux"
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-700 border border-slate-200 flex items-center justify-center shadow-xs cursor-pointer active:scale-90 transition-transform z-10"
                  >
                    <span className="material-symbols-outlined text-sm">share</span>
                  </button>

                  {/* Bouton Zoom */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (prod.image) setZoomedProduct({ url: prod.image, title: prod.name });
                    }}
                    title="Agrandir et zoomer la photo"
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center shadow-xs cursor-pointer active:scale-90 transition-transform z-10"
                  >
                    <span className="material-symbols-outlined text-sm">zoom_in</span>
                  </button>

                  <img
                    src={prod.image}
                    alt={prod.name}
                    className="max-h-full max-w-full object-contain group-hover/img:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Détails du produit & Disponibilité */}
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 flex-wrap gap-1">
                    <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                      {prod.ref}
                    </span>

                    {/* Badge État de Disponibilité */}
                    {(() => {
                      const st = getProductStockStatus(prod);
                      if (st === 'in_stock') {
                        return (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            <span>En stock ({prod.stock})</span>
                          </span>
                        );
                      }
                      if (st === 'out_of_stock') {
                        return (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            <span>Rupture de stock</span>
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                          <span>Disponible sur commande</span>
                        </span>
                      );
                    })()}
                  </div>

                  <h3 className="font-syne text-xs sm:text-sm font-bold text-slate-900 group-hover:text-amber-800 transition-colors line-clamp-2 leading-tight">
                    {prod.name}
                  </h3>

                  {/* Badges Fiche technique & Vidéo YouTube si disponibles */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {prod.youtubeUrl && (
                      <a
                        href={prod.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-1.5 py-0.5 rounded border border-red-200"
                      >
                        <span className="material-symbols-outlined text-xs">play_circle</span>
                        <span>Vidéo</span>
                      </a>
                    )}
                    {(prod.datasheetUrl || prod.pdfUrl) && (
                      <a
                        href={prod.datasheetUrl || prod.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 text-[9px] font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-1.5 py-0.5 rounded border border-cyan-200"
                      >
                        <span className="material-symbols-outlined text-xs">description</span>
                        <span>Fiche</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Prix et Boutons selon l'État de Disponibilité */}
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <span className="font-syne text-sm sm:text-base font-extrabold text-amber-700">
                      {prod.price.toLocaleString('fr-FR')} F
                    </span>

                    {(() => {
                      const st = getProductStockStatus(prod);
                      if (st === 'in_stock') {
                        return (
                          <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openBoutiqueWhatsAppBuy(prod);
                              }}
                              className="py-1.5 px-3 rounded-xl btn-gold-prestige font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 shadow-xs cursor-pointer flex-1 sm:flex-initial"
                              title="Acheter directement sur WhatsApp (+226 65 48 47 38)"
                            >
                              <span className="material-symbols-outlined text-sm text-[#25D366]">chat</span>
                              <span>Acheter</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleAdd(e, prod)}
                              className="p-1.5 rounded-xl border border-amber-300 hover:bg-amber-100 text-amber-900 flex items-center justify-center cursor-pointer transition-colors"
                              title="Ajouter au panier"
                              aria-label="Ajouter au panier"
                            >
                              <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                            </button>
                          </div>
                        );
                      }
                      if (st === 'out_of_stock') {
                        return (
                          <button
                            type="button"
                            disabled
                            onClick={(e) => e.stopPropagation()}
                            className="py-1.5 px-3 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs flex items-center justify-center gap-1 cursor-not-allowed opacity-75 w-full sm:w-auto"
                          >
                            <span className="material-symbols-outlined text-sm">block</span>
                            <span>Indisponible</span>
                          </button>
                        );
                      }
                      return (
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openBoutiqueWhatsAppBuy(prod);
                            }}
                            className="py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 shadow-xs cursor-pointer flex-1 sm:flex-initial"
                            title="Commander sur WhatsApp (+226 65 48 47 38)"
                          >
                            <span className="material-symbols-outlined text-sm text-[#25D366]">chat</span>
                            <span>Commander</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleAdd(e, prod)}
                            className="p-1.5 rounded-xl border border-amber-300 hover:bg-amber-100 text-amber-900 flex items-center justify-center cursor-pointer transition-colors"
                            title="Ajouter au panier"
                            aria-label="Ajouter au panier"
                          >
                            <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  {getProductStockStatus(prod) === 'on_order' && (
                    <span className="text-[10px] text-amber-800 font-medium text-center bg-amber-50 py-0.5 rounded border border-amber-200">
                      Délai à confirmer par l’admin
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Floating cart trigger */}
      <div className="sticky bottom-16 z-30 flex justify-center pt-2 pointer-events-none">
        <button
          type="button"
          onClick={onOpenCart}
          className="pointer-events-auto py-2.5 px-5 rounded-full bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs flex items-center gap-2 shadow-xl border border-slate-700 active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base text-amber-400">shopping_cart</span>
          <span>Voir le Panier</span>
        </button>
      </div>

      {/* Modal Zoom Photo Réelle */}
      <ImageZoomModal
        isOpen={!!zoomedProduct}
        onClose={() => setZoomedProduct(null)}
        imageUrl={zoomedProduct?.url}
        title={zoomedProduct?.title || 'Photographie Réelle'}
      />
    </div>
  );
};
