import React, { useState } from 'react';
import { MarketplaceBoutique, MARKETPLACE_BOUTIQUES } from '../data/mockData.ts';

interface BoutiquesDirectoryProps {
  boutiques?: MarketplaceBoutique[];
  currentBoutique?: 'electronique' | 'electrotechnique' | 'informatique';
  onSelectBoutique: (tabId: string) => void;
  isAdmin?: boolean;
  onUpdateFlag?: (boutiqueId: string, newFlag: string, countryName?: string) => void;
}

const PRESET_FLAGS = [
  { flag: '🇧🇫', name: 'Burkina Faso' },
  { flag: '🇨🇮', name: "Côte d'Ivoire" },
  { flag: '🇸🇳', name: 'Sénégal' },
  { flag: '🇲🇱', name: 'Mali' },
  { flag: '🇳🇪', name: 'Niger' },
  { flag: '🇹🇬', name: 'Togo' },
  { flag: '🇧🇯', name: 'Bénin' },
  { flag: '🇬🇳', name: 'Guinée' },
  { flag: '🇨🇲', name: 'Cameroun' },
  { flag: '🇬🇭', name: 'Ghana' },
  { flag: '🇳🇬', name: 'Nigeria' },
  { flag: '🇫🇷', name: 'France' },
  { flag: '🇺🇸', name: 'USA' },
  { flag: '🇨🇳', name: 'Chine' },
  { flag: '🇪🇺', name: 'Union Européenne' },
  { flag: '🌍', name: 'International' }
];

export const BoutiquesDirectory: React.FC<BoutiquesDirectoryProps> = ({
  boutiques = MARKETPLACE_BOUTIQUES,
  currentBoutique,
  onSelectBoutique,
  isAdmin = false,
  onUpdateFlag
}) => {
  // Modal pour modifier le drapeau de la boutique par l'administrateur
  const [editingBoutique, setEditingBoutique] = useState<MarketplaceBoutique | null>(null);
  const [customFlagInput, setCustomFlagInput] = useState('');
  const [customCountryInput, setCustomCountryInput] = useState('');

  const openFlagModal = (e: React.MouseEvent, boutique: MarketplaceBoutique) => {
    e.stopPropagation();
    setEditingBoutique(boutique);
    setCustomFlagInput(boutique.flag || '🇧🇫');
    setCustomCountryInput(boutique.country || 'Burkina Faso');
  };

  const handleApplyFlag = (flag: string, countryName: string) => {
    if (editingBoutique && onUpdateFlag) {
      onUpdateFlag(editingBoutique.id, flag, countryName);
    }
    setEditingBoutique(null);
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-12">
      {/* En-tête épuré de la page des boutiques */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#d4af37] text-xl">
            storefront
          </span>
          <h2 className="font-syne text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
            LES BOUTIQUES
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-400 font-medium">
          {boutiques.length} boutiques officielles
        </span>
      </div>

      {/* GRILLE 2 COLONNES SUR MOBILE (RÉFÉRENCE VISUELLE EXACTE) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {boutiques.map((b) => {
          const isSelected = currentBoutique === b.category;
          const cleanName = b.name.replace(/^ELECTRO-MEN\s*/i, '').trim();

          return (
            <div
              key={b.id}
              onClick={() => onSelectBoutique(b.tabId)}
              className={`group relative rounded-2xl bg-white p-3.5 sm:p-5 flex flex-col justify-between text-center cursor-pointer transition-all duration-200 active:scale-95 ${
                isSelected
                  ? 'border-2 border-[#d4af37] shadow-sm bg-amber-50/10'
                  : 'border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-[#d4af37]'
              }`}
            >
              {/* Drapeau Pays dans le coin supérieur (uniquement configuré par l'administrateur) */}
              <div className="flex justify-end w-full min-h-[24px]">
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={(e) => openFlagModal(e, b)}
                    title={b.flag ? `Modifier le drapeau (${b.country || ''})` : "Ajouter le drapeau de cette boutique"}
                    className="group/flag inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border border-dashed border-slate-300 hover:border-[#d4af37]"
                  >
                    {b.flag ? (
                      <>
                        <span className="text-base sm:text-lg leading-none">{b.flag}</span>
                        <span className="material-symbols-outlined text-[10px] text-slate-400 group-hover/flag:text-[#b48c1e]">
                          edit
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400 group-hover/flag:text-[#b48c1e] flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-xs text-[#d4af37]">flag</span>
                        <span>+ Drapeaux</span>
                      </span>
                    )}
                  </button>
                ) : (
                  b.flag ? (
                    <span className="text-base sm:text-lg leading-none" title={b.country}>
                      {b.flag}
                    </span>
                  ) : null
                )}
              </div>

              {/* Logo / Image de profil de la boutique */}
              <div className="my-1.5 flex justify-center">
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl p-1 flex items-center justify-center overflow-hidden shadow-2xs transition-transform group-hover:scale-105 ${
                    isSelected
                      ? 'bg-white border-2 border-[#d4af37]'
                      : 'bg-slate-50 border border-slate-200'
                  }`}
                >
                  <img
                    src={b.logoUrl || '/assets/aistudio/Image_1_397aca35.jpeg'}
                    alt={cleanName}
                    className="w-full h-full object-cover rounded-xl"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        '/assets/aistudio/Image_1_397aca35.jpeg';
                    }}
                  />
                </div>
              </div>

              {/* Nom & localisation & activités (UNIQUEMENT LE NOM DE LA BOUTIQUE) */}
              <div className="space-y-1">
                <h3
                  className={`font-syne text-xs sm:text-sm font-black line-clamp-1 transition-colors ${
                    isSelected ? 'text-[#b48c1e]' : 'text-slate-900 group-hover:text-[#b48c1e]'
                  }`}
                >
                  {cleanName}
                </h3>

                {b.location && (
                  <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-0.5">
                    <span className="material-symbols-outlined text-[12px] text-slate-400">
                      location_on
                    </span>
                    <span>{b.location}</span>
                  </div>
                )}

                {/* Catégories d'activités */}
                <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight pt-0.5">
                  {b.activities}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          MODAL DE CONFIGURATION DU DRAPEAU PAR L'ADMINISTRATEUR
          ========================================================================= */}
      {editingBoutique && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
          onClick={() => setEditingBoutique(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 space-y-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl leading-none">{customFlagInput || '🇧🇫'}</span>
                <div>
                  <h3 className="font-syne text-sm font-bold text-slate-950">
                    Drapeau de la boutique
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate max-w-[240px]">
                    {editingBoutique.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingBoutique(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Présélections de drapeaux */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                Choisir un drapeau :
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50/50">
                {PRESET_FLAGS.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setCustomFlagInput(item.flag);
                      setCustomCountryInput(item.name);
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                      customFlagInput === item.flag
                        ? 'bg-white border-[#d4af37] shadow-xs ring-1 ring-[#d4af37]'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xl leading-none">{item.flag}</span>
                    <span className="text-[9px] font-bold text-slate-700 truncate w-full text-center">
                      {item.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Saisie personnalisée */}
            <div className="space-y-1">
              <label className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                Ou saisir un drapeau / pays personnalisé :
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={customFlagInput}
                  onChange={(e) => setCustomFlagInput(e.target.value)}
                  placeholder="ex: 🇧🇫 ou BF"
                  className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-[#d4af37] font-mono text-center"
                />
                <input
                  type="text"
                  value={customCountryInput}
                  onChange={(e) => setCustomCountryInput(e.target.value)}
                  placeholder="Nom du pays"
                  className="col-span-2 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingBoutique(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleApplyFlag(customFlagInput || '🇧🇫', customCountryInput || 'Burkina Faso')}
                className="px-5 py-2 rounded-xl bg-slate-950 hover:bg-[#b48c1e] text-white hover:text-slate-950 font-bold text-xs uppercase tracking-wide cursor-pointer transition-all shadow-xs"
              >
                Enregistrer le drapeau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
