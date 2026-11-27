import React, { useState, useEffect } from 'react';
import { getBoutiqueContact } from '../utils/whatsapp.ts';

export type CustomOrderDomain = 'electronique' | 'electrotechnique' | 'informatique' | 'autre';

export interface CustomOrderRecord {
  id: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  domain: CustomOrderDomain;
  articleTitle: string;
  description: string;
  quantity: number;
  budgetFcfa?: number;
  status: 'nouvelle' | 'en_cours' | 'traitee' | 'annulee';
  adminNote?: string;
  source: 'boutique' | 'messagerie';
  createdAt: string;
  updatedAt?: string;
}

interface CustomOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDomain?: CustomOrderDomain;
  source?: 'boutique' | 'messagerie';
  defaultCustomerName?: string;
  defaultCustomerPhone?: string;
  defaultCustomerEmail?: string;
  onOrderCreated?: (order: CustomOrderRecord) => void;
}

const DOMAIN_OPTIONS: Array<{ id: CustomOrderDomain; label: string }> = [
  { id: 'electronique', label: 'Boutique Électronique' },
  { id: 'electrotechnique', label: 'Boutique Électrotechnique' },
  { id: 'informatique', label: 'Boutique Informatique' },
  { id: 'autre', label: 'Autre / Demande générale' }
];

export const CustomOrderModal: React.FC<CustomOrderModalProps> = ({
  isOpen,
  onClose,
  defaultDomain = 'electronique',
  source = 'boutique',
  defaultCustomerName = '',
  defaultCustomerPhone = '',
  defaultCustomerEmail = '',
  onOrderCreated
}) => {
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [customerPhone, setCustomerPhone] = useState(defaultCustomerPhone);
  const [customerEmail, setCustomerEmail] = useState(defaultCustomerEmail);
  const [domain, setDomain] = useState<CustomOrderDomain>(defaultDomain);
  const [articleTitle, setArticleTitle] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [budgetFcfa, setBudgetFcfa] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CustomOrderRecord | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDomain(defaultDomain);
      if (defaultCustomerName && !customerName) setCustomerName(defaultCustomerName);
      if (defaultCustomerPhone && !customerPhone) setCustomerPhone(defaultCustomerPhone);
      if (defaultCustomerEmail && !customerEmail) setCustomerEmail(defaultCustomerEmail);
      setErrorMsg(null);
    }
  }, [isOpen, defaultDomain, defaultCustomerName, defaultCustomerPhone, defaultCustomerEmail]);

  if (!isOpen) return null;

  const targetContactDomain = domain === 'autre' ? 'electronique' : domain;
  const contact = getBoutiqueContact(targetContactDomain);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (customerName.trim().length < 2) {
      setErrorMsg('Veuillez renseigner votre nom complet.');
      return;
    }
    if (customerPhone.replace(/\D/g, '').length < 8) {
      setErrorMsg('Veuillez renseigner un numéro de téléphone joignable (8 chiffres minimum).');
      return;
    }
    if (articleTitle.trim().length < 2) {
      setErrorMsg('Veuillez indiquer le nom ou la référence de l’article recherché.');
      return;
    }
    if (description.trim().length < 5) {
      setErrorMsg('Veuillez décrire précisément votre demande ou vos spécifications.');
      return;
    }

    const parsedQty = Math.max(1, Math.min(10000, Number(quantity) || 1));
    const cleanBudget = budgetFcfa.trim() ? Number(budgetFcfa.replace(/\D/g, '')) : undefined;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/custom-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          ...(customerEmail.trim() ? { customerEmail: customerEmail.trim().toLowerCase() } : {}),
          domain,
          articleTitle: articleTitle.trim(),
          quantity: parsedQty,
          ...(cleanBudget && cleanBudget > 0 ? { budgetFcfa: cleanBudget } : {}),
          description: description.trim(),
          source
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.order) {
        setErrorMsg(result.error || 'Impossible d’enregistrer votre commande. Veuillez réessayer.');
        return;
      }

      setCreatedOrder(result.order as CustomOrderRecord);
      onOrderCreated?.(result.order as CustomOrderRecord);
      setArticleTitle('');
      setQuantity('1');
      setBudgetFcfa('');
      setDescription('');
    } catch {
      setErrorMsg('Connexion au serveur indisponible. Vous pouvez envoyer votre demande directement sur WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const buildWhatsAppHref = (order?: CustomOrderRecord | null) => {
    const title = order?.articleTitle || articleTitle.trim() || 'Article non listé';
    const qty = order?.quantity || Math.max(1, Number(quantity) || 1);
    const desc = order?.description || description.trim() || '';
    const refLine = order?.reference ? `*Référence demande :* ${order.reference}\n` : '';
    const budgetText = order?.budgetFcfa
      ? `*Budget indicatif :* ${order.budgetFcfa.toLocaleString('fr-FR')} FCFA\n`
      : budgetFcfa.trim()
      ? `*Budget indicatif :* ${budgetFcfa.trim()} FCFA\n`
      : '';
    const text =
      `*COMMANDE PERSONNALISÉE PAR ÉCRIT — ELECTRO-MEN*\n` +
      refLine +
      `*Rayon concerné :* ${DOMAIN_OPTIONS.find((d) => d.id === domain)?.label || domain}\n` +
      `*Client :* ${(order?.customerName || customerName).trim()}\n` +
      `*Téléphone :* ${(order?.customerPhone || customerPhone).trim()}\n` +
      `*Article recherché :* ${title} (Qté : ${qty})\n` +
      budgetText +
      `*Détails écrits :*\n${desc}\n\n` +
      `Merci de me confirmer la disponibilité, le prix et les modalités de livraison.`;

    return `https://wa.me/${contact.cleanNumber}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 bg-slate-950/65 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-order-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">edit_note</span>
            </span>
            <div className="min-w-0">
              <h3 id="custom-order-modal-title" className="font-syne text-sm sm:text-base font-extrabold text-slate-950 truncate">
                Écrire ma commande sur mesure
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                Article non listé ou besoin spécifique — transmis directement à notre équipe
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCreatedOrder(null);
              onClose();
            }}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-950 flex items-center justify-center cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {createdOrder ? (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
              </div>
              <div className="space-y-1">
                <h4 className="font-syne text-base font-extrabold text-slate-950">
                  Commande enregistrée ({createdOrder.reference})
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Votre demande écrite pour <strong>{createdOrder.articleTitle}</strong> (Qté : {createdOrder.quantity}) a été transmise à l’administrateur et au vendeur concerné.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <a
                  href={buildWhatsAppHref(createdOrder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">chat</span>
                  <span>Envoyer aussi sur WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setCreatedOrder(null);
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Votre nom complet *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex : Moussa Ouédraogo"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-900 px-3 py-2 text-xs text-slate-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Téléphone / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+226 70 00 00 00"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-900 px-3 py-2 text-xs text-slate-900 font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Boutique / Rayon concerné
                  </label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value as CustomOrderDomain)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 font-medium outline-none focus:border-slate-900"
                  >
                    {DOMAIN_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Email <span className="font-normal text-slate-400">(optionnel)</span>
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="client@exemple.com"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-900 px-3 py-2 text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Article ou matériel recherché *
                  </label>
                  <input
                    type="text"
                    required
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    placeholder="Ex : Variateur Siemens G120 5.5kW ou Raspberry Pi 5"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-900 px-3 py-2 text-xs text-slate-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-900 px-3 py-2 text-xs text-slate-900 font-mono outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Description écrite de votre commande / spécifications *
                </label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Précisez la référence exacte, tension/puissance, capacité, modèle souhaité, délai ou toute information utile pour que notre vendeur vous réponde..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-900 p-3 text-xs text-slate-900 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Budget indicatif en FCFA <span className="font-normal text-slate-400">(optionnel)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={budgetFcfa}
                  onChange={(e) => setBudgetFcfa(e.target.value)}
                  placeholder="Ex : 150000"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-900 px-3 py-2 text-xs text-slate-900 font-mono outline-none"
                />
              </div>

              {errorMsg && (
                <div role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <a
                  href={buildWhatsAppHref()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">chat</span>
                  <span>Envoyer via WhatsApp</span>
                </a>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-base">send</span>
                  <span>{isSubmitting ? 'Envoi en cours…' : 'Envoyer à l’administrateur'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
