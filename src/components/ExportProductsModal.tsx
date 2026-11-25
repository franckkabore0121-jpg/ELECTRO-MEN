import React, { useState, useMemo, useEffect } from 'react';
import { Product } from '../data/mockData.ts';
import { exportProductsToXlsx } from '../utils/xlsxExport.ts';

export interface ExportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopTitle?: string;
  domain?: 'electronique' | 'electrotechnique' | 'informatique' | 'all';
  products?: Product[];
  currentFilteredProducts?: Product[];
}

export const ExportProductsModal: React.FC<ExportProductsModalProps> = ({
  isOpen,
  onClose,
  shopTitle = 'Boutique',
  domain: initialDomain = 'all',
  products = [],
  currentFilteredProducts
}) => {
  // 1. CHOOSE WHICH BOUTIQUE TO EXPORT FROM
  const [selectedBoutique, setSelectedBoutique] = useState<'all' | 'electronique' | 'electrotechnique' | 'informatique'>(
    initialDomain || 'all'
  );

  // Search within modal
  const [modalSearch, setModalSearch] = useState<string>('');

  // Active view tab: 'selection' | 'preview_text' | 'preview_pdf'
  const [activeTab, setActiveTab] = useState<'selection' | 'preview_text' | 'preview_pdf'>('selection');

  // Client WhatsApp number (optional, for direct click to WhatsApp)
  const [clientPhone, setClientPhone] = useState<string>('');
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  // Products filtered by selected boutique
  const boutiqueProducts = useMemo(() => {
    if (selectedBoutique === 'all') return products;
    return products.filter((p) => p.domain === selectedBoutique);
  }, [products, selectedBoutique]);

  // Selected product IDs for custom export
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(products.map((p) => p.id)));

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds((prev) => {
      const validIds = new Set(boutiqueProducts.map((p) => p.id));
      const kept = Array.from(prev).filter((id) => validIds.has(id));
      if (kept.length > 0) return new Set(kept);
      return new Set(boutiqueProducts.map((p) => p.id));
    });
  }, [isOpen, boutiqueProducts]);

  // If boutique changes, ensure we select the items in that boutique
  const handleBoutiqueChange = (b: 'all' | 'electronique' | 'electrotechnique' | 'informatique') => {
    setSelectedBoutique(b);
    const inBoutique = b === 'all' ? products : products.filter((p) => p.domain === b);
    setSelectedIds(new Set(inBoutique.map((p) => p.id)));
  };

  // Target products currently checked and matching modal search
  const displayedInModal = useMemo(() => {
    const q = modalSearch.toLowerCase().trim();
    return boutiqueProducts.filter((p) => {
      if (!q) return true;
      const matchName = p.name?.toLowerCase().includes(q);
      const matchRef = p.ref?.toLowerCase().includes(q);
      const matchDesc = p.description?.toLowerCase().includes(q);
      const matchSpecs = p.specs?.some((s) => s.toLowerCase().includes(q));
      return matchName || matchRef || matchDesc || matchSpecs;
    });
  }, [boutiqueProducts, modalSearch]);

  const targetExportProducts = useMemo(() => {
    return displayedInModal.filter((p) => selectedIds.has(p.id));
  }, [displayedInModal, selectedIds]);

  if (!isOpen) return null;

  // Toggle single product checkbox
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(boutiqueProducts.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const getBoutiqueLabel = (b: string) => {
    switch (b) {
      case 'electronique':
        return 'Boutique Composants Électroniques';
      case 'electrotechnique':
        return 'Boutique Électrotechnique Industrielle';
      case 'informatique':
        return 'Boutique Équipements Informatiques';
      default:
        return 'Toutes les Boutiques (Catalogue Général)';
    }
  };

  // Helper to extract characteristics cleanly
  const getProductCharacteristics = (p: Product): string[] => {
    const items: string[] = [];
    if (p.specs && Array.isArray(p.specs) && p.specs.length > 0) {
      p.specs.forEach((s) => {
        if (s && s.trim()) items.push(s.trim());
      });
    }
    if (p.description && p.description.trim()) {
      // If no specs array was provided, break description into sentences or lines
      if (items.length === 0) {
        p.description
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .forEach((line) => items.push(line));
      }
    }
    if (items.length === 0) {
      items.push('Caractéristiques techniques disponibles sur demande auprès de notre atelier.');
    }
    return items;
  };

  // BUILD TEXT FOR CLIENT (NAMES AND CHARACTERISTICS ONLY)
  const buildCharacteristicsText = () => {
    let msg = `⚡ *ELECTRO-MEN - CARACTÉRISTIQUES PRODUITS*\n`;
    msg += `📍 *Ouagadougou, Burkina Faso* • Tél : +226 65 48 47 38 / +226 07 31 57 34\n`;
    msg += `🏷️ *Rayon :* ${getBoutiqueLabel(selectedBoutique)}\n`;
    msg += `────────────────────────────\n\n`;

    if (targetExportProducts.length === 0) {
      msg += `Aucun produit sélectionné.\n`;
      return msg;
    }

    targetExportProducts.forEach((p, idx) => {
      msg += `${idx + 1}. *${p.name}*\n`;
      if (p.ref) {
        msg += `   • Réf : \`${p.ref}\`\n`;
      }
      if (p.subGroupLabel || p.subGroup) {
        msg += `   • Catégorie : ${p.subGroupLabel || p.subGroup}\n`;
      }

      const chars = getProductCharacteristics(p);
      msg += `   • *Caractéristiques :*\n`;
      chars.forEach((c) => {
        msg += `     - ${c}\n`;
      });
      msg += `\n`;
    });

    msg += `────────────────────────────\n`;
    msg += `📞 Pour toute commande, devis chiffré ou question technique : +226 65 48 47 38`;
    return msg;
  };

  // COPY TEXT
  const handleCopyText = () => {
    const text = buildCharacteristicsText();
    navigator.clipboard?.writeText(text).then(() => {
      showToast('Noms et caractéristiques copiés dans le presse-papier !');
    });
  };

  // OPEN WHATSAPP
  const handleOpenWhatsApp = () => {
    const text = buildCharacteristicsText();
    const cleanPhone = clientPhone.replace(/[^0-9]/g, '');
    let url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (cleanPhone) {
      url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    }
    window.open(url, '_blank');
  };

  // EXPORT REAL EXCEL (.xlsx) WORKBOOK (SELECTION, FILTERED OR FULL CATALOG)
  const handleExportXlsx = (scope: 'selected' | 'filtered' | 'all' = 'selected') => {
    const itemsToExport =
      scope === 'all'
        ? products
        : scope === 'filtered' && Array.isArray(currentFilteredProducts)
        ? currentFilteredProducts
        : targetExportProducts;

    if (itemsToExport.length === 0) {
      alert('Veuillez sélectionner au moins un produit à exporter.');
      return;
    }

    const cleanDate = new Date().toISOString().slice(0, 10);
    const scopeSuffix =
      scope === 'all'
        ? 'catalogue-complet'
        : scope === 'filtered'
        ? 'produits-filtres'
        : selectedBoutique;
    exportProductsToXlsx(itemsToExport, {
      sheetName: scope === 'all' ? 'Catalogue ELECTRO-MEN' : getBoutiqueLabel(selectedBoutique),
      filename: `ELECTRO-MEN_Catalogue_${scopeSuffix}_${cleanDate}.xlsx`
    });

    showToast(`Fichier Excel (.xlsx) généré (${itemsToExport.length} produit(s)) !`);
  };

  const handlePrint = () => {
    window.print();
  };

  const showToast = (msg: string) => {
    setCopiedToast(msg);
    setTimeout(() => setCopiedToast(null), 3000);
  };

  const todayStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      {/* Toast Feedback */}
      {copiedToast && (
        <div className="fixed top-6 right-6 z-60 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{copiedToast}</span>
        </div>
      )}

      <div className="w-full max-w-4xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* HEADER MODAL */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
              <span className="material-symbols-outlined text-xl">ios_share</span>
            </div>
            <div>
              <h3 className="font-syne text-base sm:text-lg font-bold text-white">
                Exporter Noms &amp; Caractéristiques des Produits
              </h3>
              <p className="text-xs text-slate-300">
                Transmettez à votre client uniquement le descriptif technique et les références, sans informations superflues.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* CHOIX DE LA BOUTIQUE (DEMANDE UTILISATEUR) */}
        <div className="p-3 bg-amber-50/60 border-b border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 uppercase text-[11px] flex items-center gap-1">
              <span className="material-symbols-outlined text-amber-600 text-sm">storefront</span>
              <span>Choisir la Boutique :</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleBoutiqueChange('electronique')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                selectedBoutique === 'electronique'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-xs">memory</span>
              <span>Composants Électroniques</span>
            </button>

            <button
              type="button"
              onClick={() => handleBoutiqueChange('electrotechnique')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                selectedBoutique === 'electrotechnique'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-xs">bolt</span>
              <span>Électrotechnique</span>
            </button>

            <button
              type="button"
              onClick={() => handleBoutiqueChange('informatique')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                selectedBoutique === 'informatique'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-xs">computer</span>
              <span>Informatique</span>
            </button>

            <button
              type="button"
              onClick={() => handleBoutiqueChange('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                selectedBoutique === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-xs">all_inclusive</span>
              <span>Toutes ({products.length})</span>
            </button>
          </div>
        </div>

        {/* ONGLETS DU CONTENU */}
        <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('selection')}
              className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === 'selection'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-base text-amber-600">checklist</span>
              <span>Sélection des Produits ({targetExportProducts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('preview_text')}
              className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === 'preview_text'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-base text-emerald-600">chat</span>
              <span>Texte WhatsApp / Copie Directe</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('preview_pdf')}
              className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === 'preview_pdf'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-base text-cyan-600">picture_as_pdf</span>
              <span>Fiche Technique Imprimable (PDF)</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-semibold">
            {targetExportProducts.length} produit(s) prêt(s) à être envoyé(s)
          </div>
        </div>

        {/* CORPS DU MODAL */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-slate-800">
          {/* ONGLET 1 : SÉLECTION DES PRODUITS */}
          {activeTab === 'selection' && (
            <div className="space-y-4">
              {/* Barre de recherche dans la boutique & boutons de sélection rapide */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-base">
                    search
                  </span>
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Filtrer par nom ou caractéristique..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-8 text-xs text-slate-900 focus:border-amber-500 outline-none"
                  />
                  {modalSearch && (
                    <button
                      onClick={() => setModalSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                    >
                      <span className="material-symbols-outlined text-sm">cancel</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {Array.isArray(currentFilteredProducts) && currentFilteredProducts.length > 0 && currentFilteredProducts.length < products.length && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBoutique('all');
                        setSelectedIds(new Set(currentFilteredProducts.map((p) => p.id)));
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold cursor-pointer"
                    >
                      Filtre actif ({currentFilteredProducts.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={selectAll}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                  >
                    Tout cocher
                  </button>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold cursor-pointer"
                  >
                    Tout décocher
                  </button>
                </div>
              </div>

              {/* LISTE DES PRODUITS AVEC LEURS NOMS ET CARACTÉRISTIQUES */}
              {displayedInModal.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-2">
                  <span className="material-symbols-outlined text-4xl text-slate-300">inventory_2</span>
                  <p className="text-slate-800 font-bold text-sm">Aucun produit dans ce rayon pour le moment</p>
                  <p className="text-xs text-slate-500">
                    Vous pouvez créer vos produits depuis l'espace administrateur, puis revenir les exporter ici.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {displayedInModal.map((p) => {
                    const isChecked = selectedIds.has(p.id);
                    const characteristics = getProductCharacteristics(p);

                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleSelect(p.id)}
                        className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                          isChecked ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div click
                          className="w-4 h-4 mt-0.5 text-amber-600 rounded cursor-pointer accent-amber-500 shrink-0"
                        />

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                            {p.ref && (
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                                Réf : {p.ref}
                              </span>
                            )}
                            <span className="text-[10px] text-amber-800 font-semibold px-2 py-0.5 rounded bg-amber-100/60">
                              {p.subGroupLabel || p.subGroup || p.category}
                            </span>
                          </div>

                          {/* Caractéristiques */}
                          <div className="text-xs text-slate-600 space-y-0.5 pt-1">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                              Caractéristiques :
                            </div>
                            <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5 pl-1">
                              {characteristics.slice(0, 4).map((c, i) => (
                                <li key={i} className="truncate">{c}</li>
                              ))}
                              {characteristics.length > 4 && (
                                <li className="text-[10px] text-slate-400 italic">
                                  + {characteristics.length - 4} autre(s) caractéristique(s)
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 2 : TEXTE WHATSAPP / COPIER NOMS ET CARACTÉRISTIQUES */}
          {activeTab === 'preview_text' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-1">
                  <label className="font-bold text-slate-700 shrink-0">N° WhatsApp Client (optionnel) :</label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ex: +226 70 00 00 00"
                    className="w-full max-w-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                    <span>Copier le Descriptif</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="px-3.5 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-sm">chat</span>
                    <span>Envoyer sur WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Bloc prévisualisation du texte */}
              <div className="p-4 bg-slate-900 text-emerald-400 rounded-2xl border border-slate-800 font-mono text-xs whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed shadow-inner">
                {buildCharacteristicsText()}
              </div>
            </div>
          )}

          {/* ONGLET 3 : FICHE TECHNIQUE IMPRIMABLE (PDF) */}
          {activeTab === 'preview_pdf' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase">
                  Fiche Technique &amp; Descriptif des Produits :
                </span>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  <span>Imprimer / Sauvegarder en PDF</span>
                </button>
              </div>

              {/* DOCUMENT IMPRIMABLE STYLISÉ (UNIQUEMENT NOMS ET CARACTÉRISTIQUES) */}
              <div
                id="printable-technical-sheet"
                className="p-6 sm:p-8 bg-white border border-slate-300 rounded-2xl shadow-xs space-y-6 text-slate-900 font-sans print:border-none print:shadow-none print:p-0"
              >
                {/* EN-TÊTE ÉPURÉ */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-amber-500 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black font-syne text-slate-950 uppercase tracking-wider">
                        ELECTRO-MEN
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] uppercase">
                        Burkina Faso
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      Fiche Technique &amp; Descriptif Matériel
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Ouagadougou, Burkina Faso • Tél : +226 65 48 47 38 / +226 07 31 57 34
                    </p>
                  </div>

                  <div className="text-right sm:border-l sm:border-slate-200 sm:pl-5 space-y-1 text-xs">
                    <div className="font-bold text-amber-700 uppercase">Rayon :</div>
                    <div className="font-semibold text-slate-900">{getBoutiqueLabel(selectedBoutique)}</div>
                    <div className="text-slate-400 text-[11px]">Date : {todayStr}</div>
                  </div>
                </div>

                {/* LISTE DES PRODUITS : NOM ET CARACTÉRISTIQUES SEULEMENT */}
                <div className="space-y-4">
                  {targetExportProducts.map((p, idx) => {
                    const characteristics = getProductCharacteristics(p);

                    return (
                      <div
                        key={p.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 break-inside-avoid"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <span className="text-amber-600 font-mono">{idx + 1}.</span>
                            <span>{p.name}</span>
                          </h4>
                          {p.ref && (
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700">
                              Réf : {p.ref}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                            Caractéristiques &amp; Spécifications Techniques :
                          </span>
                          <ul className="list-disc list-inside text-xs text-slate-700 space-y-1 pl-1">
                            {characteristics.map((c, i) => (
                              <li key={i} className="leading-relaxed">{c}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* BAS DE PAGE */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
                  <span>ELECTRO-MEN • Documentation Technique Matériel</span>
                  <span>Contact Assistance : +226 65 48 47 38</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PIED DE MODAL & ACTIONS */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-600">
            <span className="font-bold text-slate-900">{targetExportProducts.length}</span> produit(s) sélectionné(s) dans{' '}
            <span className="font-semibold text-amber-800">{getBoutiqueLabel(selectedBoutique)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Bouton Exporter Sélection en Excel (.xlsx) */}
            <button
              type="button"
              onClick={() => handleExportXlsx('selected')}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              title="Télécharger un fichier Excel (.xlsx) structuré avec la sélection actuelle"
            >
              <span className="material-symbols-outlined text-base">table_view</span>
              <span>Excel (.xlsx) · Sélection ({targetExportProducts.length})</span>
            </button>

            {targetExportProducts.length !== products.length && (
              <button
                type="button"
                onClick={() => handleExportXlsx('all')}
                className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                title="Télécharger tout le catalogue au format Excel (.xlsx)"
              >
                <span className="material-symbols-outlined text-base">download</span>
                <span>Tout le catalogue (.xlsx)</span>
              </button>
            )}

            {/* Bouton Copier le Descriptif */}
            <button
              type="button"
              onClick={handleCopyText}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              title="Copier les noms et caractéristiques dans le presse-papier"
            >
              <span className="material-symbols-outlined text-base">content_copy</span>
              <span>Copier Noms &amp; Caractéristiques</span>
            </button>

            {/* Bouton WhatsApp */}
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              title="Envoyer la fiche technique au client via WhatsApp"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              <span>Envoyer sur WhatsApp</span>
            </button>

            {/* Bouton Imprimer / PDF */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('preview_pdf');
                setTimeout(() => handlePrint(), 200);
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              title="Imprimer ou enregistrer en PDF la fiche technique"
            >
              <span className="material-symbols-outlined text-base text-amber-400">print</span>
              <span>Fiche Technique (PDF)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
