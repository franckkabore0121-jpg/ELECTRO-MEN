import React from 'react';

export type TabType =
  | 'accueil'
  | 'boutiques'
  | 'boutique_electronique'
  | 'boutique_electrotechnique'
  | 'boutique_informatique'
  | 'solutions'
  | 'bourse'
  | 'profil'
  | 'admin'
  | 'composants';

interface NavigationProps {
  currentTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onChangeTab }) => {
  // Mobile dock matching the clean white navigation: Accueil, Boutiques, Académie, Investissements
  const tabs = [
    {
      id: 'accueil' as TabType,
      label: 'Accueil',
      icon: 'home'
    },
    {
      id: 'boutiques' as TabType,
      label: 'Boutiques',
      icon: 'storefront'
    },
    {
      id: 'solutions' as TabType,
      label: 'Académie',
      icon: 'school'
    },
    {
      id: 'bourse' as TabType,
      label: 'Investissements',
      icon: 'trending_up'
    }
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-4 py-2 border-t border-slate-200 bg-white/95 backdrop-blur-xl shadow-lg">
      {tabs.map((tab) => {
        const isActive =
          currentTab === tab.id ||
          (tab.id === 'boutiques' && (currentTab === 'boutiques' || currentTab.startsWith('boutique')));
        return (
          <button
            key={tab.id}
            onClick={() => {
              onChangeTab(tab.id);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-95 py-1 min-w-[56px] cursor-pointer ${
              isActive
                ? 'text-[#b48c1e] font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[22px] ${isActive ? 'font-bold' : ''}`}
            >
              {tab.icon}
            </span>
            <span className="text-[10px] tracking-tight mt-0.5 font-semibold">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
