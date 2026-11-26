import React, { useState } from 'react';
import { PROJECTS, Product, Course, InvestmentProject } from '../data/mockData.ts';
import { formatProductTitle, resolveProductImageUrl } from '../utils/productFormat.ts';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: Product[];
  courses?: Course[];
  onSelectProduct: (p: Product) => void;
  onSelectCourse: (c: Course) => void;
  onSelectProject: (p: InvestmentProject) => void;
  onNavigateToShop?: (domain: 'electronique' | 'electrotechnique' | 'informatique') => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  products = [],
  courses = [],
  onSelectProduct,
  onSelectCourse,
  onSelectProject,
  onNavigateToShop
}) => {
  const [query, setQuery] = useState('');
  const [filterCatalog, setFilterCatalog] = useState<'all' | 'electronique' | 'electrotechnique' | 'informatique'>('all');

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  const matchingProducts = products.filter((p) => {
    const matchFilter = filterCatalog === 'all' || p.domain === filterCatalog;
    const matchQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.ref.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.subGroupLabel?.toLowerCase().includes(q);
    return matchFilter && matchQuery;
  });

  const matchingCourses = courses.filter(
    (c) =>
      (!c.status || c.status === 'published') &&
      (!q ||
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q))
  );

  const matchingProjects = PROJECTS.filter(
    (pr) =>
      pr.title.toLowerCase().includes(q) ||
      pr.category.toLowerCase().includes(q) ||
      pr.description.toLowerCase().includes(q)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]">
        {/* Banner Recherche Globale Simultanée */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-500 px-4 py-2 text-slate-950 font-bold text-[11px] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">travel_explore</span>
            <span>Moteur de Recherche Simultané (Électronique &amp; Électrotechnique)</span>
          </div>
          <span className="bg-slate-950/20 px-2 py-0.5 rounded-full text-[10px] font-mono">
            {products.length} références indexées
          </span>
        </div>

        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-slate-100 flex items-center gap-3 bg-white">
          <span className="material-symbols-outlined text-amber-600 text-[22px]">search</span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher simultanément dans les 2 catalogues (ESP32, disjoncteur, variateur, fer)..."
            className="w-full bg-transparent text-[13px] sm:text-[14px] text-slate-900 outline-none placeholder:text-slate-400 font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">cancel</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer shrink-0"
          >
            Fermer
          </button>
        </div>

        {/* Scope Filter Chips */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
          <span className="text-[11px] text-slate-400 font-semibold uppercase shrink-0">Périmètre :</span>
          <button
            type="button"
            onClick={() => setFilterCatalog('all')}
            className={`py-1 px-2.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              filterCatalog === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tous les Catalogues ({matchingProducts.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterCatalog('informatique')}
            className={`py-1 px-2.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              filterCatalog === 'informatique'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            💻 Informatique
          </button>

          <button
            type="button"
            onClick={() => setFilterCatalog('electronique')}
            className={`py-1 px-2.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              filterCatalog === 'electronique'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            ⚡ Électronique
          </button>

          <button
            type="button"
            onClick={() => setFilterCatalog('electrotechnique')}
            className={`py-1 px-2.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              filterCatalog === 'electrotechnique'
                ? 'bg-cyan-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            🏭 Électrotechnique
          </button>
        </div>

        {/* Results Content */}
        <div className="p-4 overflow-y-auto no-scrollbar space-y-4 flex-1">
          {/* Quick suggestions when query is empty */}
          {!q && (
            <div className="space-y-3">
              <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider block">
                Recherches Fréquentes Simultanées
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  'ESP32 Basic Starter Kit',
                  'Disjoncteur Différentiel 40A',
                  'Variateur de Fréquence 2.2kW',
                  'Contacteur 32A',
                  'Fer à souder LCD',
                  'Oscilloscope Numérique',
                  'Capteur DHT22'
                ].map((term) => (
                  <button
                    key={term}
                    onClick={() => setQuery(term)}
                    className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 hover:text-amber-800 hover:border-amber-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {matchingProducts.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] text-slate-700 font-bold uppercase tracking-wider block flex items-center justify-between">
                <span>Composants &amp; Matériels Trouvés ({matchingProducts.length})</span>
                <span className="text-[10px] text-slate-400 font-normal">Cliquez pour voir la fiche</span>
              </span>
              <div className="space-y-2">
                {matchingProducts.map((p) => {
                  const isElectrotech = p.domain === 'electrotechnique';
                  const isInfo = p.domain === 'informatique';
                  const displayTitle = formatProductTitle(p.name);
                  const resolvedImage = resolveProductImageUrl(p);
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onSelectProduct(p);
                        onClose();
                      }}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-400 hover:shadow-xs flex items-center justify-between cursor-pointer group transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0">
                          {resolvedImage ? (
                            <img src={resolvedImage} alt={displayTitle} className="max-h-full object-contain" />
                          ) : (
                            <span className="material-symbols-outlined text-slate-300 text-lg">photo_camera</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                              isElectrotech
                                ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                : isInfo
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-amber-100 text-amber-900 border border-amber-200'
                            }`}>
                              {isElectrotech ? 'Électrotechnique' : isInfo ? 'Informatique' : 'Électronique'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">RÉF : {p.ref}</span>
                          </div>
                          <h4 className="text-[13px] text-slate-900 font-bold group-hover:text-amber-700 transition-colors truncate">
                            {displayTitle}
                          </h4>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <span className="font-syne text-[14px] text-slate-900 font-extrabold block">
                          {p.price.toLocaleString('fr-FR')} FCFA
                        </span>
                        {onNavigateToShop && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose();
                              onNavigateToShop(p.domain);
                            }}
                            className="text-[10px] text-cyan-700 hover:underline font-bold block"
                          >
                            Aller au rayon &rarr;
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Courses */}
          {matchingCourses.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] text-cyan-800 font-bold uppercase tracking-wider block">
                Formations &amp; Ateliers ({matchingCourses.length})
              </span>
              <div className="space-y-2">
                {matchingCourses.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelectCourse(c);
                      onClose();
                    }}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-cyan-400 flex items-center justify-between cursor-pointer group transition-all"
                  >
                    <div>
                      <h4 className="text-[13px] text-slate-900 font-bold group-hover:text-cyan-700 transition-colors">
                        {c.title}
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {c.category} • {c.duration}
                      </span>
                    </div>
                    <span className="font-syne text-[14px] text-cyan-700 font-extrabold shrink-0">
                      {c.price.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {matchingProjects.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] text-amber-800 font-bold uppercase tracking-wider block">
                Actionnariat &amp; Projets ({matchingProjects.length})
              </span>
              <div className="space-y-2">
                {matchingProjects.map((pr) => (
                  <div
                    key={pr.id}
                    onClick={() => {
                      onSelectProject(pr);
                      onClose();
                    }}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-400 flex items-center justify-between cursor-pointer group transition-all"
                  >
                    <div>
                      <h4 className="text-[13px] text-slate-900 font-bold group-hover:text-amber-700 transition-colors">
                        {pr.title}
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {pr.category} • Rendement : {pr.yield}
                      </span>
                    </div>
                    <span className="text-[12px] text-cyan-700 font-extrabold shrink-0">
                      {pr.percent}% financé
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {q && matchingProducts.length === 0 && matchingCourses.length === 0 && matchingProjects.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-xs font-medium">
              Aucun résultat trouvé pour « {query} ».
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
