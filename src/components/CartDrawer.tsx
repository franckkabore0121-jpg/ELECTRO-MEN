import React, { useState, useEffect, useMemo } from 'react';
import {
  CartItem,
  WHATSAPP_CONTACTS,
  DeliveryZone,
  DELIVERY_ZONES
} from '../data/mockData.ts';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  activeCatalog?: 'electronique' | 'electrotechnique' | 'informatique' | 'global';
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  clientDefaultName?: string;
  clientDefaultPhone?: string;
  deliveryZones?: DeliveryZone[];
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  activeCatalog = 'electronique',
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  clientDefaultName = '',
  clientDefaultPhone = '',
  deliveryZones = DELIVERY_ZONES
}) => {
  const activeDeliveryZones = useMemo(() => {
    return deliveryZones.filter((z) => z.isActive);
  }, [deliveryZones]);

  const [selectedZoneId, setSelectedZoneId] = useState<string>(activeDeliveryZones[0]?.id || 'zone-ouaga');
  const [customLocalityInput, setCustomLocalityInput] = useState('');
  const [isCustomLocality, setIsCustomLocality] = useState(false);
  const [localityWarning, setLocalityWarning] = useState<string | null>(null);

  const [isOrdered, setIsOrdered] = useState(false);

  // Client Details
  const [customerName, setCustomerName] = useState(clientDefaultName || 'Franck Kaboré');
  const [customerPhone, setCustomerPhone] = useState(clientDefaultPhone || '65 48 47 38');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (clientDefaultName) setCustomerName(clientDefaultName);
    if (clientDefaultPhone) {
      setCustomerPhone(clientDefaultPhone.replace('+226', '').trim());
    }
  }, [clientDefaultName, clientDefaultPhone]);

  if (!isOpen) return null;

  // Determine target department among electronique, electrotechnique, and informatique
  const hasInformatique = items.some((it) => it.product.domain === 'informatique');
  const hasElectrotech = items.some((it) => it.product.domain === 'electrotechnique');

  const targetDepartment: 'informatique' | 'electrotechnique' | 'electronique' =
    activeCatalog === 'informatique' || hasInformatique
      ? 'informatique'
      : activeCatalog === 'electrotechnique' || hasElectrotech
      ? 'electrotechnique'
      : 'electronique';

  const destinationContact = WHATSAPP_CONTACTS[targetDepartment];

  // Calculate pricing
  const subtotal = items.reduce((acc, it) => acc + it.product.price * it.quantity, 0);

  // Find active zone
  const currentZone = activeDeliveryZones.find((z) => z.id === selectedZoneId);
  const shippingFee = isCustomLocality ? 0 : currentZone ? currentZone.tarif : 1000;

  // Calculate total: subtotal + delivery fee
  const total = subtotal + shippingFee;

  // Check custom locality against delivery zones
  const handleCustomLocalityCheck = (val: string) => {
    setCustomLocalityInput(val);
    const clean = val.toLowerCase().trim();
    if (!clean) {
      setLocalityWarning(null);
      return;
    }

    const matchedZone = activeDeliveryZones.find((z) =>
      z.keywords.some((kw) => clean.includes(kw.toLowerCase()))
    );

    if (matchedZone) {
      setSelectedZoneId(matchedZone.id);
      setIsCustomLocality(false);
      setLocalityWarning(`Zone reconnue automatiquement : ${matchedZone.name} (${matchedZone.tarif.toLocaleString('fr-FR')} FCFA).`);
    } else {
      setIsCustomLocality(true);
      setLocalityWarning(
        "Localité spécifique non reconnue dans le barème standard. Les frais exacts seront confirmés par notre service logistique sur devis plutôt qu’un tarif inventé."
      );
    }
  };

  const handleWhatsAppCheckout = () => {
    setFormError(null);
    if (!customerName.trim()) {
      setFormError('Veuillez renseigner votre Nom complet pour lancer la commande.');
      return;
    }
    if (!customerPhone.trim()) {
      setFormError('Veuillez renseigner votre Numéro WhatsApp pour être contacté.');
      return;
    }

    const domainLabel =
      targetDepartment === 'informatique'
        ? 'BOUTIQUE ÉQUIPEMENTS INFORMATIQUES (56 28 35 26)'
        : targetDepartment === 'electrotechnique'
        ? 'BOUTIQUE ÉLECTROTECHNIQUE & PUISSANCE'
        : 'BOUTIQUE COMPOSANTS ÉLECTRONIQUES';

    let orderText = `*NOUVELLE COMMANDE ELECTRO-MEN*\n`;
    orderText += `*Rayon :* ${domainLabel}\n`;
    orderText += `*Service destinataire :* ${destinationContact.service} (${destinationContact.display})\n\n`;
    orderText += `*COORDONNÉES CLIENT :*\n`;
    orderText += `• Nom du Client : ${customerName.trim()}\n`;
    orderText += `• WhatsApp Client : +226 ${customerPhone.trim()}\n`;
    orderText += `• Zone de livraison : ${isCustomLocality ? `Localité spéciale: ${customLocalityInput}` : currentZone?.name || 'Ouagadougou'}\n`;
    orderText += `• Délai estimé : ${currentZone?.estimatedDelay || 'À confirmer'}\n\n`;

    orderText += `*ARTICLES SÉLECTIONNÉS :*\n`;
    items.forEach((it, idx) => {
      orderText += `${idx + 1}. ${it.product.name} (Réf: ${it.product.ref})\n   Qté: ${it.quantity} × ${it.product.price.toLocaleString('fr-FR')} F = ${(it.product.price * it.quantity).toLocaleString('fr-FR')} FCFA\n`;
    });

    orderText += `\n*RÉCAPITULATIF FINANCIER :*\n`;
    orderText += `• Sous-total : ${subtotal.toLocaleString('fr-FR')} FCFA\n`;
    orderText += `• Frais de livraison : ${isCustomLocality ? 'À convenir avec le transporteur' : `${shippingFee.toLocaleString('fr-FR')} FCFA`}\n`;
    orderText += `*• TOTAL NET À RÉGLER : ${total.toLocaleString('fr-FR')} FCFA*\n\n`;
    orderText += `Bonjour ${destinationContact.service}, je souhaite valider cette commande et convenir des détails de règlement (Orange Money / Moov Money / Espèces). Merci !`;

    const cleanDestNumber = destinationContact.number.replace('+', '').trim();
    const encoded = encodeURIComponent(orderText);
    window.open(`https://wa.me/${cleanDestNumber}?text=${encoded}`, '_blank');
  };

  const handleSimulatePayment = () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      setFormError('Veuillez renseigner votre Nom et Numéro WhatsApp avant de valider.');
      return;
    }

    setIsOrdered(true);
    setTimeout(() => {
      onClearCart();
      setIsOrdered(false);
      onClose();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-fadeIn text-slate-900 font-sans">
      <div className="w-full max-w-md bg-white border-l border-slate-200 h-full flex flex-col justify-between overflow-y-auto no-scrollbar shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">shopping_bag</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Panier {targetDepartment === 'informatique' ? 'Informatique' : targetDepartment === 'electrotechnique' ? 'Électrotechnique' : 'Électronique'}
              </h2>
              <span className="text-[11px] text-cyan-800 font-semibold block">
                {destinationContact.service}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold ml-1">
              {items.length}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Info Routing WhatsApp */}
        <div
          className={`px-4 py-2 text-xs font-semibold flex items-center justify-between border-b ${
            targetDepartment === 'informatique'
              ? 'bg-cyan-50 border-cyan-200 text-cyan-950'
              : targetDepartment === 'electrotechnique'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">chat</span>
            <span>Numéro de commande WhatsApp :</span>
          </div>
          <span className="font-mono font-bold">{destinationContact.display}</span>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 space-y-4">
          {items.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <span className="material-symbols-outlined text-5xl text-slate-300">
                production_quantity_limits
              </span>
              <p className="text-sm text-slate-600 font-medium">Votre panier est actuellement vide.</p>
              <button
                onClick={onClose}
                className="btn-gold-prestige px-4 py-2 rounded-xl text-xs font-bold uppercase cursor-pointer shadow-sm"
              >
                Explorer les boutiques
              </button>
            </div>
          ) : (
            <>
              {/* Formulaire Obligatoire : Nom et Téléphone WhatsApp */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                  <span className="material-symbols-outlined text-amber-600 text-base">badge</span>
                  <span>Coordonnées pour la Commande</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-600 font-semibold block mb-0.5">
                      Nom complet / Entreprise *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: Franck Kaboré"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-600 font-semibold block mb-0.5">
                      Numéro WhatsApp Client *
                    </label>
                    <div className="flex">
                      <span className="px-2.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-lg text-slate-700 text-[11px] font-bold flex items-center">
                        🇧🇫 +226
                      </span>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="70 XX XX XX"
                        className="flex-1 bg-white border border-slate-200 rounded-r-lg p-2 text-xs text-slate-900 focus:border-amber-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                {formError && (
                  <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    <span>{formError}</span>
                  </p>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                <span className="text-[11px] text-slate-500 uppercase font-bold block">
                  Articles dans le panier ({items.length})
                </span>

                {items.map((it) => (
                  <div
                    key={it.product.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex gap-3 items-center justify-between shadow-xs"
                  >
                    <div className="w-13 h-13 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0">
                      {it.product.hasRealPhoto && it.product.image ? (
                        <img
                          src={it.product.image}
                          alt={it.product.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-slate-300 text-xl">photo_camera</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs text-slate-900 font-bold truncate">
                        {it.product.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono">
                        RÉF : {it.product.ref}
                      </p>
                      <span className="text-xs text-amber-700 font-extrabold">
                        {it.product.price.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onUpdateQuantity(it.product.id, -1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-800 flex items-center justify-center hover:bg-slate-100 text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-slate-900 w-5 text-center">
                        {it.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(it.product.id, 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-800 flex items-center justify-center hover:bg-slate-100 text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                      <button
                        onClick={() => onRemoveItem(it.product.id)}
                        className="text-slate-400 hover:text-red-600 p-1 ml-0.5 cursor-pointer"
                        title="Supprimer"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* =========================================================================
                  MODULE GESTION DES FRAIS DE LIVRAISON SELON LA LOCALISATION
                  ========================================================================= */}
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-700 uppercase font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-cyan-700">local_shipping</span>
                    <span>Zone de Livraison</span>
                  </span>
                  {currentZone && (
                    <span className="text-[10px] text-slate-500 font-medium">
                      {currentZone.estimatedDelay}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <select
                    value={selectedZoneId}
                    onChange={(e) => {
                      setSelectedZoneId(e.target.value);
                      setIsCustomLocality(false);
                      setLocalityWarning(null);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-medium outline-none focus:border-amber-500"
                  >
                    {activeDeliveryZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} — {z.tarif === 0 ? 'Gratuit' : `${z.tarif.toLocaleString('fr-FR')} FCFA`} ({z.estimatedDelay})
                      </option>
                    ))}
                  </select>

                  {/* Saisie d'une localité spécifique avec vérification */}
                  <div className="pt-1">
                    <input
                      type="text"
                      value={customLocalityInput}
                      onChange={(e) => handleCustomLocalityCheck(e.target.value)}
                      placeholder="Préciser votre quartier ou ville (ex: Somgandé, Koudougou, Bobo)..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-cyan-600"
                    />
                    {localityWarning && (
                      <p
                        className={`text-[11px] mt-1 flex items-start gap-1 p-2 rounded-lg ${
                          isCustomLocality
                            ? 'bg-amber-50 text-amber-900 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm shrink-0">
                          {isCustomLocality ? 'help_outline' : 'check_circle'}
                        </span>
                        <span>{localityWarning}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Note de commande directe via WhatsApp */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-700 text-base shrink-0 mt-0.5">info</span>
                <p className="text-[11px] leading-relaxed">
                  Votre commande sera transmise directement à notre équipe via WhatsApp pour finalisation et confirmation de livraison.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer Summary & WhatsApp Order CTA */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-white space-y-3 sticky bottom-0">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Sous-total articles</span>
                <span className="font-semibold text-slate-800">{subtotal.toLocaleString('fr-FR')} FCFA</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Frais de livraison ({isCustomLocality ? 'Sur devis' : currentZone?.name})</span>
                <span className="font-semibold text-slate-800">
                  {isCustomLocality ? 'À confirmer' : `${shippingFee.toLocaleString('fr-FR')} FCFA`}
                </span>
              </div>

              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-100">
                <span>Total net</span>
                <span className="text-base font-extrabold text-slate-900">
                  {total.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>

            {/* CTA Commander sur WhatsApp */}
            <div>
              <button
                type="button"
                onClick={handleWhatsAppCheckout}
                className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                <span>Commander sur WhatsApp</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
