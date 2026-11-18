import React, { useState } from 'react';
import { AppNotification } from '../data/mockData.ts';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateToContent?: (notif: AppNotification) => void;
  onSelectNotification?: (notif: AppNotification) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToContent,
  onSelectNotification
}) => {
  const handleItemClick = (notif: AppNotification) => {
    onMarkAsRead(notif.id);
    if (onSelectNotification) onSelectNotification(notif);
    else if (onNavigateToContent) onNavigateToContent(notif);
  };
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filtered = activeFilter === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const handleRequestPush = async () => {
    if (!('Notification' in window)) {
      setPushStatusMessage("Les notifications push ne sont pas supportées sur ce navigateur.");
      setTimeout(() => setPushStatusMessage(null), 4000);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushStatusMessage("Notifications push autorisées ! Vous recevrez des alertes en direct.");
      } else {
        setPushStatusMessage("Autorisation des notifications refusée dans les paramètres de votre navigateur.");
      }
    } catch {
      setPushStatusMessage("Impossible d'activer les notifications push sur cet appareil.");
    }
    setTimeout(() => setPushStatusMessage(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-fadeIn text-slate-900 font-sans">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* HEADER STYLE WHATSAPP ÉLÉGANT */}
        <div className="bg-[#075E54] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-2xl">chat</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base">
                  Centre de Notifications ELECTRO-MEN
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.2 rounded-full bg-[#25D366] text-white text-[10px] font-bold">
                    {unreadCount} nouveau{unreadCount > 1 ? 'x' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/80">
                Mises à jour officielles reçues en direct
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* FILTERS & ACTION BAR */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tous ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unread')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                activeFilter === 'unread'
                  ? 'bg-[#075E54] text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Non lus ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="text-[#075E54] hover:underline font-bold text-[11px] cursor-pointer"
            >
              Tout marquer comme lu
            </button>
          )}
        </div>

        {/* PUSH STATUS NOTICE IF ANY */}
        {pushStatusMessage && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-emerald-700">info</span>
            <span>{pushStatusMessage}</span>
          </div>
        )}

        {/* NOTIFICATIONS LIST - PRESENTED AS WHATSAPP MESSAGE CARDS */}
        <div className="p-4 overflow-y-auto no-scrollbar space-y-3 bg-[#EFEAE2]/30 flex-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <span className="material-symbols-outlined text-4xl text-slate-300">notifications_off</span>
              <p className="text-xs font-semibold">Aucune notification à afficher</p>
              <p className="text-[11px] text-slate-400">
                Vous serez alerté dès qu’un nouveau produit, une formation ou une actualité sera officiellement publiée.
              </p>
            </div>
          ) : (
            filtered.map((notif) => {
              const badgeIcon =
                notif.type === 'product'
                  ? 'shopping_bag'
                  : notif.type === 'course'
                  ? 'school'
                  : notif.type === 'promo'
                  ? 'local_offer'
                  : 'campaign';

              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative shadow-xs group ${
                    !notif.isRead
                      ? 'bg-white border-[#25D366] shadow-sm hover:border-[#075E54]'
                      : 'bg-white/80 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Top Bar with Sender, Icon & Timestamp */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#128C7E] text-white flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-xs">{badgeIcon}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900">
                        {notif.sender || 'Direction ELECTRO-MEN'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span>{notif.timestamp}</span>
                      {notif.isRead ? (
                        <span
                          className="material-symbols-outlined text-cyan-600 text-sm font-bold"
                          title="Message lu"
                        >
                          done_all
                        </span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-[#25D366]"></span>
                      )}
                    </div>
                  </div>

                  {/* Title & Preview Text */}
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#075E54] transition-colors mb-1">
                    {notif.title}
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {notif.message}
                  </p>

                  {/* Open link indicator */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-mono text-[10px]">{notif.dateFormatted}</span>
                    <span className="text-[#075E54] font-bold flex items-center gap-0.5 group-hover:underline">
                      <span>Ouvrir le contenu</span>
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER AVEC OPT-IN NOTIFICATIONS PUSH NAVIGATEUR */}
        <div className="p-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="material-symbols-outlined text-base text-amber-600">notifications_active</span>
            <span className="text-[11px]">Recevoir aussi les alertes quand l'application est fermée :</span>
          </div>

          <button
            type="button"
            onClick={handleRequestPush}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer shadow-xs active:scale-95 transition-transform"
          >
            Activer Notifications Push
          </button>
        </div>
      </div>
    </div>
  );
};
