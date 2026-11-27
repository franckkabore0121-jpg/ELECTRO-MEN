import React, { useState, useRef, useEffect } from 'react';
import { PWAInstallButton, PWAInstallGuideModal } from './PWAInstallButton.tsx';
import { usePWAInstall } from '../utils/pwa.ts';

interface HeaderProps {
  currentTab?: string;
  cartCount: number;
  emailsCount?: number;
  notificationsCount?: number;
  isAdminMode?: boolean;
  onOpenCart: () => void;
  onOpenSearch: () => void;
  onOpenEmails?: () => void;
  onOpenNotifications?: () => void;
  onOpenWallet?: () => void;
  onOpenAccount?: () => void;
  onGoTab: (tab: any) => void;
  onExitAdmin?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab = 'accueil',
  cartCount,
  isAdminMode = false,
  onOpenCart,
  onOpenSearch,
  onGoTab,
  onExitAdmin,
  searchQuery = '',
  onSearchChange
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [kebabMenuOpen, setKebabMenuOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState<'FR' | 'EN'>('FR');
  const [currentMode, setCurrentMode] = useState<'light' | 'dark'>('light');
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const { canNativeInstall, isIOS, install } = usePWAInstall();

  const kebabRef = useRef<HTMLDivElement>(null);

  // Close kebab menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setKebabMenuOpen(false);
      }
    };
    if (kebabMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [kebabMenuOpen]);

  const navLinks = [
    { id: 'accueil', label: currentLang === 'FR' ? 'Accueil' : 'Home' },
    { id: 'boutiques', label: currentLang === 'FR' ? 'Boutiques' : 'Shops' },
    { id: 'solutions', label: currentLang === 'FR' ? 'Académie' : 'Academy' },
    { id: 'bourse', label: currentLang === 'FR' ? 'Investissements' : 'Investments' }
  ];

  const handleNavClick = (tabId: string) => {
    onGoTab(tabId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleLang = () => {
    setCurrentLang((prev) => (prev === 'FR' ? 'EN' : 'FR'));
  };

  const toggleMode = () => {
    setCurrentMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  const isInsideBoutique =
    currentTab === 'boutique_electronique' ||
    currentTab === 'boutique_electrotechnique' ||
    currentTab === 'boutique_informatique' ||
    currentTab === 'composants';

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs transition-all">
        {/* =========================================================================
            ROW 1 : LOGO + "ELECTRO-MEN" À GAUCHE | PANIER NOUVEAU MODÈLE & 3 POINTS À DROITE
            (Au même niveau que le logo, AUCUNE phrase "composant et matériel")
            ========================================================================= */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
          {/* GAUCHE : ANCIEN LOGO + NOM ELECTRO-MEN ÉCRIT À CÔTÉ (AUCUNE PHRASE) */}
          <button
            onClick={() => handleNavClick('accueil')}
            className="flex items-center gap-2.5 sm:gap-3 group text-left cursor-pointer shrink-0 transition-transform active:scale-95"
            aria-label="Accueil ELECTRO-MEN"
          >
            {/* Ancien Logo d'origine */}
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden border-2 border-[#d4af37] bg-slate-900 p-0.5 shadow-md flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <img
                src="/assets/aistudio/Image_1_397aca35.jpeg"
                alt="Logo ELECTRO-MEN"
                className="w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://lh3.googleusercontent.com/aida-public/AB6AXuCYQK9PHK1gxPYmsjSpM_WzArRpu3_NpauDk6vI_qVevEsnKANKxumB_VZQl8HRRqW4P8Od5XOJ4Fux7G9O8CMLXh1671NfdLfV5pZ-qOYBY6-qkri1HLIefnkxFKYsWA06s6Xix5hj26MVCs-Cl28xSDEgbcuWJCnF6dni86E2RzGgdv6JgPzsJp8LN3x78yez4MqF6EOf5-k0VknrCJB_xjbzW43R2NnrApiO3dc1z8mWQ5vQDcc50XM16IymZEbat4M';
                }}
              />
            </div>

            {/* Nom ELECTRO-MEN écrit à côté */}
            <span className="font-syne text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase leading-none">
              ELECTRO<span className="text-[#d4af37]">-MEN</span>
            </span>
          </button>

          {/* MILIEU : NAVIGATION DESKTOP */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-semibold text-slate-700">
            {navLinks.map((link) => {
              const isActive =
                currentTab === link.id ||
                (link.id === 'boutiques' && (currentTab === 'boutiques' || currentTab.startsWith('boutique')));
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleNavClick(link.id)}
                  className={`relative py-1 transition-colors cursor-pointer ${
                    isActive ? 'text-slate-950 font-bold' : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#d4af37] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* DROITE : INSTALLER PWA (DESKTOP) + PANIER + 3 POINTS (LANGUE, À PROPOS, MODE) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isInsideBoutique && (
              <PWAInstallButton
                variant="header-mobile"
                lang={currentLang}
                onOpenGuideModal={() => setInstallGuideOpen(true)}
              />
            )}
            <PWAInstallButton
              variant="header-desktop"
              lang={currentLang}
              onOpenGuideModal={() => setInstallGuideOpen(true)}
            />

            {isAdminMode && (
              <button
                type="button"
                onClick={onExitAdmin}
                className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Quitter la console admin"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
                <span className="hidden sm:inline">Quitter Admin</span>
              </button>
            )}

            {/* MODÈLE DE PANIER ÉLÉGANT SANS FOND NOIR (COULEURS DU LOGO) */}
            <button
              type="button"
              onClick={onOpenCart}
              aria-label="Panier d'achat"
              className="group relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-white hover:bg-amber-50/50 text-slate-800 hover:text-[#b48c1e] border border-slate-200 hover:border-[#d4af37] shadow-2xs hover:shadow-xs transition-all duration-200 cursor-pointer active:scale-95"
              title="Voir mon panier"
            >
              <div className="relative flex items-center justify-center text-[#b48c1e]">
                <span className="material-symbols-outlined text-[20px] transition-transform group-hover:scale-110">
                  shopping_bag
                </span>
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#d4af37] text-slate-950 text-[10px] font-black shadow-xs">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-700 group-hover:text-slate-950 hidden sm:inline">
                {currentLang === 'FR' ? 'Panier' : 'Cart'}
              </span>
              {cartCount > 0 && (
                <span className="text-xs font-mono font-bold text-[#b48c1e] hidden md:inline">
                  ({cartCount})
                </span>
              )}
            </button>

            {/* TROIS POINTS (KEBAB MENU) : LANGUE FR/EN, À PROPOS, MODE */}
            <div className="relative" ref={kebabRef}>
              <button
                type="button"
                onClick={() => setKebabMenuOpen((prev) => !prev)}
                aria-label="Options du menu"
                className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-all cursor-pointer ${
                  kebabMenuOpen
                    ? 'bg-slate-100 border-[#d4af37] text-slate-950'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
                title="Options : Langue, À propos, Mode"
              >
                <span className="material-symbols-outlined text-xl">more_vert</span>
              </button>

              {/* DROPDOWN KEBAB MENU */}
              {kebabMenuOpen && (
                <div className="absolute right-0 top-12 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50 animate-fadeIn space-y-1">
                  {/* OPTION 1 : CHANGER DE LANGUE (FR / EN) */}
                  <button
                    type="button"
                    onClick={() => {
                      toggleLang();
                      setKebabMenuOpen(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between text-left text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-base text-[#b48c1e]">
                        language
                      </span>
                      <span>{currentLang === 'FR' ? 'Langue' : 'Language'}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-[#b48c1e] border border-amber-200 font-mono text-[11px] font-bold">
                      {currentLang === 'FR' ? 'FR ➔ EN' : 'EN ➔ FR'}
                    </span>
                  </button>

                  {/* OPTION 2 : À PROPOS */}
                  <button
                    type="button"
                    onClick={() => {
                      setAboutModalOpen(true);
                      setKebabMenuOpen(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 flex items-center gap-2.5 text-left text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base text-cyan-600">
                      info
                    </span>
                    <span>{currentLang === 'FR' ? 'À propos' : 'About'}</span>
                  </button>

                  {/* OPTION 3 : MODE (CLAIR / SOMBRE) */}
                  <button
                    type="button"
                    onClick={() => {
                      toggleMode();
                      setKebabMenuOpen(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between text-left text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-base text-indigo-600">
                        {currentMode === 'light' ? 'dark_mode' : 'light_mode'}
                      </span>
                      <span>{currentLang === 'FR' ? 'Mode d\'affichage' : 'Theme Mode'}</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">
                      {currentMode === 'light' ? 'Clair' : 'Sombre'}
                    </span>
                  </button>
                  {/* OPTION 4 : INSTALLER L'APPLICATION */}
                  <PWAInstallButton
                    variant="menu-item"
                    lang={currentLang}
                    onActionDone={() => setKebabMenuOpen(false)}
                    onOpenGuideModal={() => setInstallGuideOpen(true)}
                  />
                </div>
              )}
            </div>

            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Fermer menu' : 'Ouvrir menu'}
              className="md:hidden w-10 h-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:text-slate-950 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            ROW 2 : BARRE DE RECHERCHE (masquée à l'intérieur des boutiques pour éviter le doublon)
            ========================================================================= */}
        {!isInsideBoutique && (
          <div className="border-t border-slate-100 bg-slate-50/80 px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex items-center gap-2">
              <div className="flex-1 min-w-0 h-11 px-4 sm:px-5 rounded-2xl bg-white border border-slate-300 focus-within:border-[#d4af37] text-slate-800 flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs transition-all">
                <span className="material-symbols-outlined text-slate-400 text-xl shrink-0">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange ? onSearchChange(e.target.value) : onOpenSearch()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onOpenSearch();
                  }}
                  placeholder={currentLang === 'FR' ? 'Rechercher un produit, une boutique...' : 'Search for a product, a shop...'}
                  className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden font-medium"
                />
                {searchQuery && onSearchChange && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs cursor-pointer shrink-0"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenSearch}
                  className="flex items-center gap-1 text-slate-400 hover:text-[#b48c1e] shrink-0 pl-2 border-l border-slate-200 cursor-pointer"
                  title="Filtres avancés"
                >
                  <span className="material-symbols-outlined text-lg">tune</span>
                </button>
              </div>

              <PWAInstallButton
                variant="header-mobile"
                lang={currentLang}
                onOpenGuideModal={() => setInstallGuideOpen(true)}
              />
            </div>
          </div>
        )}

        {/* MOBILE SLIDE-DOWN MENU */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-2 shadow-lg animate-fadeIn">
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleNavClick(link.id)}
                  className={`p-3 rounded-xl text-left flex items-center gap-2 ${
                    currentTab === link.id ||
                    (link.id === 'boutiques' && (currentTab === 'boutiques' || currentTab.startsWith('boutique')))
                      ? 'bg-amber-50 text-[#b48c1e] font-bold border border-amber-200'
                      : 'text-slate-700 hover:bg-slate-50 border border-slate-100'
                  }`}
                >
                  <span>{link.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* MODAL À PROPOS D'ELECTRO-MEN */}
      {aboutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 animate-scaleUp">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#d4af37] bg-slate-900 p-0.5">
                  <img
                    src="/assets/aistudio/Image_1_397aca35.jpeg"
                    alt="Logo ELECTRO-MEN"
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <div>
                  <h3 className="font-syne text-lg font-bold text-slate-950 uppercase">
                    ELECTRO<span className="text-[#d4af37]">-MEN</span>
                  </h3>
                  <span className="text-xs text-slate-500">Ouagadougou, Burkina Faso</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAboutModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <p>
                <strong>ELECTRO-MEN</strong> est une entreprise technologique et commerciale spécialisée dans la distribution de composants électroniques certifiés, d'équipements électrotechniques industriels et de matériels informatiques de pointe.
              </p>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 font-mono text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#b48c1e]">location_on</span>
                  <span>Siège social : Ouagadougou, Burkina Faso</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#b48c1e]">call</span>
                  <span>+226 65 48 47 38 / +226 07 31 57 34</span>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Notre engagement : authenticité rigoureuse, disponibilité locale et support technique assuré par des praticiens.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setAboutModalOpen(false)}
                className="px-5 py-2.5 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INSTRUCTIONS D'INSTALLATION PWA (iOS Safari / Fallback navigateurs) */}
      <PWAInstallGuideModal
        isOpen={installGuideOpen}
        onClose={() => setInstallGuideOpen(false)}
        isIOS={isIOS}
        canNativeInstall={canNativeInstall}
        onRetryNativeInstall={() => {
          setInstallGuideOpen(false);
          void install();
        }}
        lang={currentLang}
      />

      {/* Top spacer dynamically sized whether Row 2 search bar is visible */}
      <div className={isInsideBoutique ? 'h-16 sm:h-[68px]' : 'h-28 sm:h-30'}></div>
    </>
  );
};
