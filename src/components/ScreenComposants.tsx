import React, { useState } from 'react';
import { Product } from '../data/mockData.ts';

interface ScreenComposantsProps {
  products?: Product[];
  onAddToCart: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  onGoTab: (tab: 'accueil' | 'composants' | 'solutions' | 'bourse' | 'profil') => void;
  onOpenVideo: () => void;
}

export const ScreenComposants: React.FC<ScreenComposantsProps> = ({
  products,
  onAddToCart,
  onSelectProduct,
  onGoTab,
  onOpenVideo
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [addedToast, setAddedToast] = useState<string | null>(null);

  const productList = products ?? [];
  const filteredProducts = activeCategory === 'all'
    ? productList
    : productList.filter((p) => p.category === activeCategory);

  const handleAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    onAddToCart(product);
    setAddedToast(`${product.name} ajouté au panier !`);
    setTimeout(() => setAddedToast(null), 2500);
  };

  const scrollToBoutique = () => {
    const el = document.getElementById('boutique');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6 pb-6 text-[#0f172a]">
      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed top-20 right-4 z-50 bg-white border border-[#d4af37] text-slate-900 px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-bounce text-xs font-semibold">
          <span className="material-symbols-outlined text-[#b48c1e] text-base">check_circle</span>
          <span>{addedToast}</span>
        </div>
      )}

      {/* HERO SECTION: PRESTIGE SUR BLANC */}
      <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-white via-white to-amber-50/30 p-5 shadow-sm">
        {/* Subtle Decorative Glows */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#f2ca50]/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-cyan-500/10 blur-2xl pointer-events-none"></div>

        <div className="relative z-10">
          {/* Prestige Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 mb-3 shadow-xs">
            <span className="material-symbols-outlined text-[#b48c1e] text-xs">bolt</span>
            <span className="text-[#b48c1e] text-[11px] font-bold tracking-widest uppercase">
              Écosystème Technologique d'Élite
            </span>
          </div>

          <h1 className="font-syne text-[26px] sm:text-[34px] font-bold text-slate-900 leading-tight tracking-tight">
            L'Électronique <br />
            <span className="text-[#b48c1e]">
              de Précision
            </span>{' '}
            &amp; <br />
            <span className="text-cyan-700">l'Investissement Futur</span>
          </h1>

          <p className="text-[13px] text-slate-600 mt-2.5 leading-relaxed font-normal">
            Composants certifiés, kits d'ingénierie avancés, formations pratiques de pointe et opportunités de souscription industrielle en Afrique de l'Ouest.
          </p>

          {/* Call to actions hero */}
          <div className="flex items-center gap-2.5 mt-4">
            <button
              onClick={scrollToBoutique}
              className="btn-gold-prestige flex-1 py-2.5 px-3 rounded-lg font-bold text-[13px] flex items-center justify-center gap-1.5 text-center cursor-pointer active:scale-95 shadow-md"
            >
              <span className="material-symbols-outlined text-base">storefront</span>
              Boutique Pro
            </button>
            <button
              onClick={() => onGoTab('bourse')}
              className="flex-1 py-2.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-cyan-800 text-[13px] font-bold flex items-center justify-center gap-1 transition-colors active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">trending_up</span>
              Investir
            </button>
          </div>
        </div>
      </section>

      {/* LES 3 PILIERS MAJEURS */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-syne text-[20px] font-bold text-slate-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d4af37]"></span>
            Trois Piliers Stratégiques
          </h2>
          <span className="text-[11px] text-slate-500 font-bold tracking-wider uppercase">ÉCOSYSTÈME</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {/* Pilier 1: Boutique */}
          <div
            onClick={scrollToBoutique}
            className="group relative flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 hover:border-[#d4af37] transition-all cursor-pointer active:scale-[0.99] shadow-xs hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[#b48c1e] group-hover:scale-105 transition-transform shrink-0">
                <span className="material-symbols-outlined text-2xl">memory</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] text-slate-900 font-bold">Boutique Composants</h3>
                  <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold">
                    DISPO
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Kits ESP32 (16 000 F), microcontrôleurs, circuits intégrés &amp; outillage de précision.
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:text-[#b48c1e] transition-colors text-lg">
              arrow_forward_ios
            </span>
          </div>

          {/* Pilier 2: Académie */}
          <div
            onClick={() => onGoTab('solutions')}
            className="group relative flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 hover:border-cyan-400 transition-all cursor-pointer active:scale-[0.99] shadow-xs hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 group-hover:scale-105 transition-transform shrink-0">
                <span className="material-symbols-outlined text-2xl">school</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] text-slate-900 font-bold">Académie &amp; Cours Pratiques</h3>
                  <span className="text-[10px] bg-cyan-100 text-cyan-900 border border-cyan-300 px-1.5 py-0.2 rounded font-bold">
                    CERTIFIÉ
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Ateliers IoT, programmation C++, soudure et travaux pratiques en présentiel &amp; vidéo.
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:text-cyan-700 transition-colors text-lg">
              arrow_forward_ios
            </span>
          </div>

          {/* Pilier 3: Investissement */}
          <div
            onClick={() => onGoTab('bourse')}
            className="group relative flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 hover:border-[#d4af37] transition-all cursor-pointer active:scale-[0.99] shadow-xs hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-amber-50 border border-amber-300 flex items-center justify-center text-[#b48c1e] group-hover:scale-105 transition-transform shrink-0">
                <span className="material-symbols-outlined text-2xl">trending_up</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] text-slate-900 font-bold">Investir &amp; Actionnariat</h3>
                  <span className="text-[10px] bg-[#d4af37] text-white px-1.5 py-0.2 rounded font-extrabold uppercase shadow-xs">
                    Prix défini par opération
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Financez l'expansion de nos lignes de fabrication et prenez des parts stratégiques.
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:text-[#b48c1e] transition-colors text-lg">
              arrow_forward_ios
            </span>
          </div>
        </div>
      </section>

      {/* CARROUSEL / GRILLE COMPOSANTS & KITS EN VEDETTE */}
      <section id="boutique" className="pt-2">
        <div className="flex items-end justify-between mb-2">
          <div>
            <span className="text-cyan-700 text-[11px] font-bold tracking-wider uppercase">
              STOCK ET OUTILLAGE PRO
            </span>
            <h2 className="font-syne text-[20px] font-bold text-slate-900">
              Composants &amp; Kits Vedettes
            </h2>
          </div>
          <button
            onClick={() => setActiveCategory(activeCategory === 'all' ? 'kit' : 'all')}
            className="text-[12px] text-[#b48c1e] hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
          >
            {activeCategory === 'all' ? 'Filtrer kits' : 'Voir tout'}
            <span className="material-symbols-outlined text-xs">chevron_right</span>
          </button>
        </div>

        {/* Category Filter Chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {[
            { id: 'all', label: 'Tous les produits' },
            { id: 'electrotech', label: '⚡ Électrotechnique' },
            { id: 'kit', label: '🔬 Kits & Didactique' },
            { id: 'tool', label: 'Outillage & Mesure' },
            { id: 'ic', label: 'Circuits Intégrés' },
            { id: 'module', label: 'Microcontrôleurs' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-[#d4af37] text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Horizontal Scrollable Container */}
        <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-4 px-4">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              onClick={() => onSelectProduct(prod)}
              className="shrink-0 w-68 rounded-xl bg-white border border-slate-200 overflow-hidden flex flex-col justify-between shadow-xs hover:border-[#d4af37] hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="relative bg-slate-50 p-3 flex items-center justify-center h-44 overflow-hidden border-b border-slate-100">
                <span
                  className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold z-10 ${
                    prod.badgeStyle === 'gold'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : prod.badgeStyle === 'cyan'
                      ? 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  {prod.badge}
                </span>
                <img
                  src={prod.image}
                  alt={prod.name}
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>

              <div className="p-3.5 flex flex-col gap-2 flex-1 justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono tracking-wider font-semibold">
                    RÉF : {prod.ref}
                  </span>
                  <h3 className="text-[14px] font-bold text-slate-900 line-clamp-2 mt-0.5 group-hover:text-[#b48c1e] transition-colors">
                    {prod.name}
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                    {prod.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Prix unitaire</span>
                    <p className="font-syne text-[17px] font-extrabold text-[#b48c1e]">
                      {prod.price.toLocaleString('fr-FR')}{' '}
                      <span className="text-[10px] text-slate-600 font-normal">FCFA</span>
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleAdd(e, prod)}
                    aria-label={`Ajouter ${prod.name} au panier`}
                    className="w-9 h-9 rounded-lg bg-[#d4af37] text-white flex items-center justify-center hover:bg-[#b8860b] active:scale-90 transition-all shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[19px]">add_shopping_cart</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 2 : ACADÉMIE & FORMATIONS PRATIQUES */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 relative overflow-hidden shadow-sm">
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div>
            <span className="text-[#b48c1e] text-[11px] font-bold tracking-wider uppercase">
              PÔLE TRANSMISSION &amp; COMPÉTENCES
            </span>
            <h2 className="font-syne text-[20px] font-bold text-slate-900">
              Académie &amp; Certifications
            </h2>
          </div>
          <span className="w-8 h-8 rounded-full bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
            <span className="material-symbols-outlined text-base">workspace_premium</span>
          </span>
        </div>

        {/* Hero Course Card */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 mb-3 relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 text-[10px] font-bold border border-cyan-300">
              Débutant → Intermédiaire
            </span>
            <span className="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-[10px] font-medium">
              Kit Matériel Inclus
            </span>
          </div>

          <h3 className="font-syne text-[16px] font-bold text-slate-900">
            Maîtriser l'IoT &amp; l'ESP32 par la Pratique
          </h3>
          <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">
            Programme d'ingénierie appliquée : programmation réseau, télémétrie capteurs vers Cloud, gestion d'énergie et fabrication d'un objet connecté autonome.
          </p>

          {/* Features Matrix */}
          <div className="grid grid-cols-2 gap-2 my-3 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="material-symbols-outlined text-[#b48c1e] text-sm">videocam</span>
              12 Modules Vidéo HD
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="material-symbols-outlined text-[#b48c1e] text-sm">build</span>
              Travaux Pratiques Guidés
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="material-symbols-outlined text-[#b48c1e] text-sm">verified_user</span>
              Instructeur Certifié
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="material-symbols-outlined text-[#b48c1e] text-sm">assignment_turned_in</span>
              Attestation d'Aptitude
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
            <button
              onClick={() => {
                onGoTab('solutions');
                onOpenVideo();
              }}
              className="btn-gold-prestige flex-1 py-2.5 px-3 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 text-center cursor-pointer active:scale-95 shadow"
            >
              <span className="material-symbols-outlined text-base">play_circle</span>
              Découvrir la formation
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Formation IoT & ESP32 ELECTRO-MEN',
                    text: 'Découvrez la formation officielle IoT & ESP32 par la pratique avec ELECTRO-MEN!',
                    url: window.location.href
                  }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  setAddedToast('Lien de la formation copié !');
                  setTimeout(() => setAddedToast(null), 2000);
                }
              }}
              className="w-10 h-10 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#b48c1e] flex items-center justify-center cursor-pointer transition-colors"
              title="Partager la formation"
            >
              <span className="material-symbols-outlined">share</span>
            </button>
          </div>
        </div>

        {/* Express Module Shortcut */}
        <div
          onClick={() => onGoTab('solutions')}
          className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 relative z-10 cursor-pointer hover:border-[#d4af37] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[#b48c1e] shrink-0">
              <span className="material-symbols-outlined">iron</span>
            </div>
            <div>
              <h4 className="text-[13px] text-slate-900 font-bold">Soudure &amp; Prototypage PCB</h4>
              <p className="text-[11px] text-slate-600">Atelier intensif en présentiel (4h d'immersion)</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-slate-400">chevron_right</span>
        </div>
      </section>

      {/* SECTION 3 : ESPACE INVESTISSEMENT & FINANCEMENT PARTICIPATIF */}
      <section className="rounded-xl border-2 border-[#d4af37]/50 bg-white p-4 shadow-md relative overflow-hidden">
        <div className="flex items-start justify-between mb-2 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 text-[10px] font-bold border border-amber-300 mb-1">
              <span className="material-symbols-outlined text-xs text-[#b48c1e]">trending_up</span>
              OPPORTUNITÉ ACTIONNARIAT
            </div>
            <h2 className="font-syne text-[20px] font-bold text-slate-900">
              Investissement Technologique
            </h2>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-[#b48c1e]">
            <span className="material-symbols-outlined text-base">corporate_fare</span>
          </div>
        </div>

        <p className="text-[12px] text-slate-600 relative z-10 leading-relaxed font-normal">
          Participez au financement de l'infrastructure technologique locale et bénéficiez de rendements indexés sur la production industrielle.
        </p>

        {/* Projet Phare : Extension FabLab 2026 */}
        <div className="mt-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 relative z-10">
          <div className="flex justify-between items-start gap-2">
            <div>
              <h3 className="font-syne text-[14px] text-[#b48c1e] font-bold">
                Extension Atelier d'Assemblage &amp; FabLab 2026
              </h3>
              <span className="text-[11px] text-slate-500">
                Projet No. EM-FIN-FAB26 | Ouvert aux souscriptions
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 border border-cyan-300 text-[10px] font-bold shrink-0">
              En Cours
            </span>
          </div>

          {/* Gauge / Bar de financement */}
          <div className="mt-3">
            <div className="flex justify-between items-center text-[11px] mb-1">
              <span className="text-slate-700 font-semibold">68% Financé</span>
              <span className="text-[#b48c1e] font-bold">10 200 000 / 15 000 000 FCFA</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-cyan-500 transition-all duration-700"
                style={{ width: '68%' }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-200 text-[11px]">
            <div>
              <span className="text-slate-500 block">Ticket d'entrée min.</span>
              <span className="font-bold text-slate-900">Selon l'opération</span>
            </div>
            <div>
              <span className="text-slate-500 block">Distribution dividendes</span>
              <span className="font-bold text-cyan-700">Trimestrielle</span>
            </div>
          </div>
        </div>

        {/* Action Button Prestige */}
        <div className="mt-3.5 relative z-10">
          <button
            onClick={() => onGoTab('bourse')}
            className="btn-gold-prestige w-full py-3 px-4 rounded-xl text-[13px] font-extrabold flex items-center justify-center gap-2 text-center uppercase tracking-wide cursor-pointer active:scale-95 shadow-md"
          >
            <span className="material-symbols-outlined text-lg">token</span>
            Demande d'Investissement / Actions (prix variable)
          </button>
          <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-slate-500">
            <span className="material-symbols-outlined text-xs text-[#b48c1e]">lock</span>
            <span>Dossier d'actionnariat audité &amp; formalités juridiques certifiées</span>
          </div>
        </div>
      </section>

      {/* ASSISTANCE & CONTACT DIRECT WHATSAPP */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-600 shrink-0">
            <span className="material-symbols-outlined text-2xl">chat</span>
          </div>
          <div>
            <h4 className="text-[14px] text-slate-900 font-bold">Conseil &amp; Commandes WhatsApp</h4>
            <p className="text-[11px] text-slate-600">+226 65 48 47 38 (Assistance directe 7j/7)</p>
          </div>
        </div>
        <a
          href="https://wa.me/22665484738?text=Bonjour%20ELECTRO-MEN,%20je%20souhaite%20obtenir%20des%20conseils%20sur%20vos%20composants%20et%20formations."
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 hover:text-[#b48c1e] hover:bg-slate-200 text-[12px] font-bold flex items-center gap-1 shrink-0 active:scale-95 transition-all cursor-pointer"
        >
          Discuter
          <span className="material-symbols-outlined text-sm">open_in_new</span>
        </a>
      </section>
    </div>
  );
};
