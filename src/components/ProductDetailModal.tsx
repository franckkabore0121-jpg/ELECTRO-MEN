import React, { useState } from 'react';
import { Product, WHATSAPP_CONTACTS, getProductStockStatus } from '../data/mockData.ts';
import { openBoutiqueWhatsAppBuy, getBoutiqueContact } from '../utils/whatsapp.ts';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onOpenPdf: () => void;
  onOpenVideo?: (videoUrl: string) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onOpenPdf,
  onOpenVideo
}) => {
  const [quantity, setQuantity] = useState(1);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  if (!product) return null;

  const stockStatus = getProductStockStatus(product);

  const handleAdd = () => {
    if (stockStatus === 'out_of_stock') return;
    onAddToCart(product, quantity);
    onClose();
  };

  const handleWhatsApp = () => {
    const contact =
      product.domain === 'informatique'
        ? WHATSAPP_CONTACTS.informatique
        : product.domain === 'electrotechnique'
        ? WHATSAPP_CONTACTS.electrotechnique
        : WHATSAPP_CONTACTS.electronique;

    let text = '';
    if (stockStatus === 'on_order') {
      text = `Bonjour ELECTRO-MEN, je souhaite passer commande sur approvisionnement pour : ${product.name} (Réf: ${product.ref}, Qté: ${quantity}) au prix de ${(product.price * quantity).toLocaleString('fr-FR')} FCFA. Merci de me confirmer le délai de disponibilité.`;
    } else if (stockStatus === 'out_of_stock') {
      text = `Bonjour ELECTRO-MEN, je souhaite être alerté du réapprovisionnement pour le composant en rupture : ${product.name} (Réf: ${product.ref}).`;
    } else {
      text = `Bonjour ELECTRO-MEN, je souhaite commander : ${product.name} (Réf: ${product.ref}, Qté: ${quantity}) au prix de ${(product.price * quantity).toLocaleString('fr-FR')} FCFA.`;
    }

    const cleanNumber = contact.number.replace('+', '').trim();
    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?prod=${encodeURIComponent(product.id)}`;
    const shareTitle = `ELECTRO-MEN | ${product.name}`;
    const shareText = `Découvrez ${product.name} (Réf: ${product.ref}) sur ELECTRO-MEN au prix de ${product.price.toLocaleString('fr-FR')} FCFA.`;

    if (navigator.share) {
      navigator
        .share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        })
        .catch(() => {
          copyShareLink(shareUrl);
        });
    } else {
      copyShareLink(shareUrl);
    }
  };

  const copyShareLink = (url: string) => {
    navigator.clipboard?.writeText(url).then(() => {
      setShareToast('Lien du produit copié dans le presse-papier !');
      setTimeout(() => setShareToast(null), 3000);
    });
  };

  const handleShareFacebook = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?prod=${encodeURIComponent(product.id)}`;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const handleShareWhatsApp = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?prod=${encodeURIComponent(product.id)}`;
    const msg = `Découvrez ce produit sur ELECTRO-MEN : ${product.name} (${product.price.toLocaleString('fr-FR')} FCFA) : ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const hasReal = Boolean(product.hasRealPhoto && product.image);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-fadeIn text-slate-900 font-sans">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Toast Share Notification */}
        {shareToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg">
            {shareToast}
          </div>
        )}

        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs text-cyan-900 bg-cyan-50 px-2.5 py-0.5 rounded-lg border border-cyan-200 font-mono font-bold">
              RÉF : {product.ref}
            </span>
            {product.brand && (
              <span className="text-xs text-slate-500 font-semibold">{product.brand}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleShare}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
              title="Partager ce produit"
            >
              <span className="material-symbols-outlined text-lg">share</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto no-scrollbar space-y-4">
          {/* Image / Video Showcase */}
          <div className="relative bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-center min-h-[200px] overflow-hidden">
            <span
              className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold z-10 ${
                product.badgeStyle === 'gold'
                  ? 'bg-amber-500 text-slate-950 font-extrabold'
                  : product.badgeStyle === 'cyan'
                  ? 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                  : 'bg-slate-200 text-slate-800'
              }`}
            >
              {product.badge}
            </span>

            {/* Bouton Partager direct à proximité de l'image */}
            <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-7 h-7 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-xs hover:scale-105 active:scale-95 transition-transform"
                title="Partager sur WhatsApp"
              >
                <span className="material-symbols-outlined text-sm">chat</span>
              </button>
              <button
                type="button"
                onClick={handleShareFacebook}
                className="w-7 h-7 rounded-full bg-[#1877F2] text-white flex items-center justify-center shadow-xs hover:scale-105 active:scale-95 transition-transform"
                title="Partager sur Facebook"
              >
                <span className="text-[12px] font-black">f</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="w-7 h-7 rounded-full bg-white text-slate-700 border border-slate-200 flex items-center justify-center shadow-xs hover:scale-105 active:scale-95 transition-transform"
                title="Partager (Lien / Autres)"
              >
                <span className="material-symbols-outlined text-sm">share</span>
              </button>
            </div>

            {/* Gestion Image Réelle vs Image à ajouter */}
            {isVideoPlaying && product.videoUrl ? (
              <div className="w-full h-48 bg-black rounded-xl overflow-hidden select-none">
                <video
                  src={product.videoUrl}
                  autoPlay
                  playsInline
                  controls={false}
                  className="w-full h-full object-contain pointer-events-none"
                />
              </div>
            ) : hasReal ? (
              <img
                src={product.image}
                alt={product.name}
                className="max-h-48 max-w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-4 text-slate-400 space-y-1.5">
                <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                  <span className="material-symbols-outlined text-2xl">photo_camera</span>
                </div>
                <span className="text-xs font-bold text-slate-700">Image à ajouter</span>
                <span className="text-[11px] text-slate-400 max-w-xs">
                  Photographie réelle du produit en attente d'import par l'administrateur
                </span>
              </div>
            )}
          </div>

          {/* Bouton Vidéo si disponible */}
          {product.videoUrl && (
            <button
              type="button"
              onClick={() => {
                if (onOpenVideo) {
                  onOpenVideo(product.videoUrl!);
                } else {
                  setIsVideoPlaying(!isVideoPlaying);
                }
              }}
              className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-base text-amber-400">
                {isVideoPlaying ? 'image' : 'play_circle'}
              </span>
              <span>{isVideoPlaying ? 'Afficher la photo' : 'Regarder la vidéo de démonstration'}</span>
            </button>
          )}

          {/* Details & Disponibilité */}
          <div className="space-y-1.5">
            {stockStatus === 'in_stock' ? (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs text-emerald-800 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  En stock ({product.stock} unités disponibles)
                </span>
              </div>
            ) : stockStatus === 'out_of_stock' ? (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span className="text-xs text-rose-800 font-extrabold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  Rupture de stock (Temporairement indisponible)
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="text-xs text-amber-900 font-extrabold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300">
                  Disponible sur commande
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  (Délai d’approvisionnement à confirmer par l’administrateur)
                </span>
              </div>
            )}

            <h2 className="text-lg font-bold text-slate-900 leading-snug">{product.name}</h2>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">{product.description}</p>
          </div>

          {/* Price */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Prix unitaire TTC</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900">
                  {product.price.toLocaleString('fr-FR')} FCFA
                </span>
                {product.oldPrice && (
                  <span className="text-xs text-slate-400 line-through">
                    {product.oldPrice.toLocaleString('fr-FR')} FCFA
                  </span>
                )}
              </div>
            </div>

            {/* Quantity selector */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-2 py-1 rounded-xl shadow-2xs">
              <button
                type="button"
                disabled={stockStatus === 'out_of_stock'}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-7 h-7 text-slate-600 hover:text-slate-900 flex items-center justify-center font-bold disabled:opacity-30 cursor-pointer"
              >
                -
              </button>
              <span className="font-bold text-xs text-slate-900 w-5 text-center">
                {quantity}
              </span>
              <button
                type="button"
                disabled={stockStatus === 'out_of_stock'}
                onClick={() => setQuantity(quantity + 1)}
                className="w-7 h-7 text-slate-600 hover:text-slate-900 flex items-center justify-center font-bold disabled:opacity-30 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Technical Specifications */}
          {product.details && product.details.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-slate-800 font-bold uppercase tracking-wider">
                Caractéristiques Techniques
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {product.details.map((detail, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-cyan-600 text-sm mt-0.5">
                      check
                    </span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Datasheet shortcut */}
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
            <button
              onClick={onOpenPdf}
              className="text-cyan-700 hover:underline flex items-center gap-1 text-xs font-semibold cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
              <span>Consulter la fiche technique</span>
            </button>
            <span className="text-[11px] text-slate-500">Garantie constructeur</span>
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="p-4 border-t border-slate-100 bg-white flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            {stockStatus === 'in_stock' ? (
              <>
                <button
                  type="button"
                  onClick={() => openBoutiqueWhatsAppBuy(product, quantity)}
                  className="flex-1 py-2.5 px-3 rounded-xl btn-gold-prestige font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                  title={`Acheter sur WhatsApp (${getBoutiqueContact(product.domain).display})`}
                >
                  <span className="material-symbols-outlined text-base text-[#25D366]">chat</span>
                  <span>Acheter ({(product.price * quantity).toLocaleString('fr-FR')} F)</span>
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="py-2.5 px-3.5 rounded-xl border border-amber-300 hover:bg-amber-50 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-colors"
                  title="Ajouter au panier pour commander plusieurs articles ensemble"
                >
                  <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                  <span>Au panier</span>
                </button>
              </>
            ) : stockStatus === 'out_of_stock' ? (
              <>
                <button
                  type="button"
                  disabled
                  className="flex-1 py-2.5 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed opacity-80"
                >
                  <span className="material-symbols-outlined text-base">block</span>
                  <span>Indisponible en stock</span>
                </button>
                <button
                  type="button"
                  onClick={() => openBoutiqueWhatsAppBuy(product, quantity)}
                  className="py-2.5 px-3.5 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  title="Alerter l'équipe sur WhatsApp pour réapprovisionnement"
                >
                  <span className="material-symbols-outlined text-base text-[#25D366]">chat</span>
                  <span>Alerter WhatsApp</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openBoutiqueWhatsAppBuy(product, quantity)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                  title={`Commander sur WhatsApp (${getBoutiqueContact(product.domain).display})`}
                >
                  <span className="material-symbols-outlined text-base text-[#25D366]">chat</span>
                  <span>Commander sur WhatsApp ({(product.price * quantity).toLocaleString('fr-FR')} F)</span>
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="py-2.5 px-3.5 rounded-xl border border-amber-400 hover:bg-amber-50 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-colors"
                  title="Ajouter au panier pour commander plusieurs articles"
                >
                  <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                  <span>Au panier</span>
                </button>
              </>
            )}
          </div>

          {/* Note informative selon l'état */}
          {stockStatus === 'on_order' && (
            <p className="text-[11px] text-amber-800 text-center font-semibold bg-amber-50 py-1 px-2 rounded-lg border border-amber-200">
              ℹ️ Ce produit est disponible sur commande. Le délai de disponibilité doit être confirmé par l'administrateur.
            </p>
          )}
          {stockStatus === 'out_of_stock' && (
            <p className="text-[11px] text-rose-700 text-center font-medium bg-rose-50 py-1 px-2 rounded-lg border border-rose-200">
              Ce composant est temporairement épuisé. Cliquez sur l'icône WhatsApp pour être prévenu dès réapprovisionnement.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
