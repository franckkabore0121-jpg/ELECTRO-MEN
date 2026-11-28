import React, { useState } from 'react';
import { usePWAInstall } from '../utils/pwa.ts';

export interface PWAInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  canNativeInstall?: boolean;
  onRetryNativeInstall?: () => void;
  lang?: 'FR' | 'EN';
}

export const PWAInstallGuideModal: React.FC<PWAInstallGuideModalProps> = ({
  isOpen,
  onClose,
  isIOS,
  canNativeInstall = false,
  onRetryNativeInstall,
  lang = 'FR'
}) => {
  if (!isOpen) return null;

  const isFr = lang === 'FR';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-modal-title"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 space-y-5 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-[#d4af37] bg-slate-950 p-0.5 shrink-0 shadow-sm">
              <img
                src="/pwa-192x192.png"
                alt="ELECTRO-MEN"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div className="min-w-0">
              <h3
                id="pwa-install-modal-title"
                className="font-syne text-base font-extrabold text-slate-950 uppercase tracking-tight"
              >
                {isFr ? 'Installer ELECTRO-MEN' : 'Install ELECTRO-MEN'}
              </h3>
              <p className="text-xs text-slate-500">
                {isFr
                  ? 'Accès instantané depuis votre écran d’accueil, même hors ligne'
                  : 'Instant home screen access, even offline'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isFr ? 'Fermer' : 'Close'}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {isIOS ? (
          <div className="space-y-3 text-xs sm:text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              {isFr
                ? 'Sur iPhone / iPad (Safari) :'
                : 'On iPhone / iPad (Safari):'}
            </p>
            <ol className="space-y-2.5">
              <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-[#d4af37] text-xs font-black flex items-center justify-center shrink-0">
                  1
                </span>
                <span>
                  {isFr ? 'Appuyez sur le bouton ' : 'Tap the '}
                  <strong className="text-slate-950 inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm align-middle">ios_share</span>
                    {isFr ? 'Partager' : 'Share'}
                  </strong>
                  {isFr
                    ? ' dans la barre de Safari.'
                    : ' button in the Safari bar.'}
                </span>
              </li>
              <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-[#d4af37] text-xs font-black flex items-center justify-center shrink-0">
                  2
                </span>
                <span>
                  {isFr ? 'Faites défiler et sélectionnez ' : 'Scroll down and tap '}
                  <strong className="text-slate-950">
                    {isFr ? '« Sur l’écran d’accueil »' : '“Add to Home Screen”'}
                  </strong>
                  .
                </span>
              </li>
              <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-[#d4af37] text-xs font-black flex items-center justify-center shrink-0">
                  3
                </span>
                <span>
                  {isFr ? 'Appuyez sur ' : 'Tap '}
                  <strong className="text-slate-950">{isFr ? 'Ajouter' : 'Add'}</strong>
                  {isFr
                    ? ' en haut à droite pour finaliser.'
                    : ' in the top-right corner to finish.'}
                </span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-3 text-xs sm:text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              {isFr
                ? 'Pour installer l’application sur votre appareil :'
                : 'To install the application on your device:'}
            </p>
            <ol className="space-y-2.5">
              <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-[#d4af37] text-xs font-black flex items-center justify-center shrink-0">
                  1
                </span>
                <span>
                  {isFr
                    ? 'Ouvrez le menu de votre navigateur (⋮ en haut à droite sur Chrome / Edge) ou cliquez sur l’icône d’installation dans la barre d’adresse.'
                    : 'Open your browser menu (⋮ at top-right on Chrome / Edge) or click the install icon in the address bar.'}
                </span>
              </li>
              <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-[#d4af37] text-xs font-black flex items-center justify-center shrink-0">
                  2
                </span>
                <span>
                  {isFr ? 'Sélectionnez ' : 'Select '}
                  <strong className="text-slate-950">
                    {isFr
                      ? '« Installer l’application » ou « Ajouter à l’écran d’accueil »'
                      : '“Install app” or “Add to Home screen”'}
                  </strong>
                  .
                </span>
              </li>
            </ol>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          {canNativeInstall && onRetryNativeInstall && (
            <button
              type="button"
              onClick={onRetryNativeInstall}
              className="px-4 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#c19c27] text-slate-950 text-xs font-extrabold cursor-pointer transition-colors"
            >
              {isFr ? 'Installer maintenant' : 'Install now'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors"
          >
            {isFr ? 'Compris' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};

export interface PWAInstallButtonProps {
  variant?: 'header-desktop' | 'header-mobile' | 'menu-item';
  lang?: 'FR' | 'EN';
  onOpenGuideModal?: () => void;
  onActionDone?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header-desktop',
  lang = 'FR',
  onOpenGuideModal,
  onActionDone
}) => {
  const { canNativeInstall, isInstalled, isIOS, install } = usePWAInstall();
  const [internalGuideOpen, setInternalGuideOpen] = useState(false);

  // Masquer complètement si l'application est déjà installée (mode standalone)
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    const outcome = await install();
    onActionDone?.();
    if (outcome === 'unavailable') {
      if (onOpenGuideModal) {
        onOpenGuideModal();
      } else {
        setInternalGuideOpen(true);
      }
    }
  };

  const label =
    lang === 'FR'
      ? variant === 'header-mobile'
        ? 'App'
        : 'Installer'
      : variant === 'header-mobile'
      ? 'App'
      : 'Install';

  if (variant === 'menu-item') {
    return (
      <>
        <button
          type="button"
          onClick={() => void handleClick()}
          className="w-full px-3 py-2 rounded-xl bg-[#0ea5e9] hover:bg-[#0369a1] active:bg-[#0284c7] text-white flex items-center justify-between text-left text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-base text-white">
              install_mobile
            </span>
            <span>{lang === 'FR' ? "Installer l'application" : 'Install App'}</span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-white/20 text-white text-[10px] font-bold">
            PWA
          </span>
        </button>

        {!onOpenGuideModal && (
          <PWAInstallGuideModal
            isOpen={internalGuideOpen}
            onClose={() => setInternalGuideOpen(false)}
            isIOS={isIOS}
            canNativeInstall={canNativeInstall}
            onRetryNativeInstall={() => {
              setInternalGuideOpen(false);
              void install();
            }}
            lang={lang}
          />
        )}
      </>
    );
  }

  if (variant === 'header-mobile') {
    return (
      <>
        <button
          type="button"
          onClick={() => void handleClick()}
          aria-label={lang === 'FR' ? "Installer l'application ELECTRO-MEN" : 'Install ELECTRO-MEN App'}
          title={lang === 'FR' ? "Installer l'application" : 'Install App'}
          className="md:hidden h-8 px-2.5 rounded-xl bg-[#0ea5e9] hover:bg-[#0369a1] active:bg-[#0284c7] text-white border border-[#0284c7] shadow-sm flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 transition-colors font-semibold"
        >
          <span className="material-symbols-outlined text-[15px] text-white">
            download
          </span>
          <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
            {label}
          </span>
        </button>

        {!onOpenGuideModal && (
          <PWAInstallGuideModal
            isOpen={internalGuideOpen}
            onClose={() => setInternalGuideOpen(false)}
            isIOS={isIOS}
            canNativeInstall={canNativeInstall}
            onRetryNativeInstall={() => {
              setInternalGuideOpen(false);
              void install();
            }}
            lang={lang}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-label={lang === 'FR' ? "Installer l'application ELECTRO-MEN" : 'Install ELECTRO-MEN App'}
        title={lang === 'FR' ? "Installer l'application" : 'Install App'}
        className="hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#0ea5e9] hover:bg-[#0369a1] active:bg-[#0284c7] text-white border border-[#0284c7] shadow-sm text-[11px] font-semibold cursor-pointer active:scale-95 transition-colors whitespace-nowrap"
      >
        <span className="material-symbols-outlined text-[15px] text-white">
          download
        </span>
        <span>{label}</span>
      </button>

      {!onOpenGuideModal && (
        <PWAInstallGuideModal
          isOpen={internalGuideOpen}
          onClose={() => setInternalGuideOpen(false)}
          isIOS={isIOS}
          canNativeInstall={canNativeInstall}
          onRetryNativeInstall={() => {
            setInternalGuideOpen(false);
            void install();
          }}
          lang={lang}
        />
      )}
    </>
  );
};
