import React from 'react';
import { EmailNotification } from '../data/mockData.ts';

interface EmailViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  emails: EmailNotification[];
  currentInvestorEmail?: string;
  onOpenPaymentForSubscription: (subId: string) => void;
}

export const EmailViewerModal: React.FC<EmailViewerModalProps> = ({
  isOpen,
  onClose,
  emails,
  currentInvestorEmail,
  onOpenPaymentForSubscription
}) => {
  const [selectedEmailIndex, setSelectedEmailIndex] = React.useState<number>(0);
  const [copiedCode, setCopiedCode] = React.useState<boolean>(false);

  if (!isOpen) return null;

  const currentEmail = emails[selectedEmailIndex] || emails[0];

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-300 flex items-center justify-center text-cyan-700">
              <span className="material-symbols-outlined text-[20px]">mark_email_unread</span>
            </div>
            <div>
              <h3 className="font-syne text-[15px] font-bold text-slate-900">
                Boîte de Réception Personnelle • Investisseur
              </h3>
              <span className="text-[11px] text-cyan-800 font-mono">
                {currentInvestorEmail ? `Compte sécurisé : ${currentInvestorEmail}` : "Notifications officielles d'accord de l'Administrateur"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto no-scrollbar space-y-4 flex-1 text-xs text-slate-600">
          {emails.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <span className="material-symbols-outlined text-4xl text-slate-300">inbox</span>
              <p className="text-slate-900 font-bold">Aucun email reçu pour ce compte.</p>
              <p className="text-[12px] text-slate-500 max-w-md mx-auto">
                {currentInvestorEmail
                  ? `Les emails contenant les mots de passe de paiement d'actions destinés à ${currentInvestorEmail} apparaîtront exclusivement ici.`
                  : "Dès que vous soumettez une demande d'action et que l'administrateur donne son accord, votre mot de passe d'activation apparaîtra ici."}
              </p>
            </div>
          ) : (
            <>
              {/* Emails List Tabs if multiple */}
              {emails.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-slate-100">
                  {emails.map((m, idx) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedEmailIndex(idx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                        idx === selectedEmailIndex
                          ? 'bg-cyan-50 text-cyan-900 border border-cyan-300 shadow-sm'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {m.recipientName} ({m.code})
                    </button>
                  ))}
                </div>
              )}

              {/* Email Client Preview Card */}
              {currentEmail && (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 p-5">
                  {/* Meta Bar */}
                  <div className="space-y-1.5 pb-3 border-b border-slate-100">
                    <div className="flex justify-between items-start">
                      <h4 className="font-syne text-[15px] text-slate-900 font-bold">
                        {currentEmail.subject}
                      </h4>
                      <span className="text-[11px] text-slate-400 shrink-0 font-mono">{currentEmail.date}</span>
                    </div>
                    <div className="text-[11px] space-y-0.5">
                      <div>
                        <span className="text-slate-500">De :</span>{' '}
                        <strong className="text-amber-800">Direction Générale ELECTRO-MEN &lt;admin@electro-men.com&gt;</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">À :</span>{' '}
                        <strong className="text-slate-900">{currentEmail.recipientName} &lt;{currentEmail.recipientEmail}&gt;</strong>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="space-y-3 text-[12px] leading-relaxed text-slate-700">
                    <p>Bonjour {currentEmail.recipientName},</p>
                    <p>
                      Nous avons le plaisir de vous informer que la Direction Générale d'<strong>ELECTRO-MEN</strong> a{' '}
                      <span className="text-emerald-700 font-bold">validé votre demande de souscription</span> (Réf :{' '}
                      <strong className="font-mono text-amber-800">{currentEmail.subscriptionId}</strong>) portant sur{' '}
                      <strong>{currentEmail.shares} part(s)</strong> pour un montant total de{' '}
                      <strong className="text-amber-800 font-syne">{currentEmail.amount.toLocaleString('fr-FR')} FCFA</strong>.
                    </p>

                    {/* Highlighted Password Callout */}
                    <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-center space-y-2 shadow-sm my-2">
                      <span className="text-[10px] text-amber-900 uppercase tracking-wider block font-bold">
                        Votre Mot de Passe Sécurisé d'Accès au Paiement :
                      </span>
                      <div className="font-syne text-[24px] font-mono font-extrabold text-amber-900 tracking-widest selection:bg-amber-200">
                        {currentEmail.code}
                      </div>
                      <p className="text-[11px] text-cyan-800 font-medium">
                        Saisissez ce mot de passe dans l'application pour débloquer le règlement de vos actions.
                      </p>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Ce mot de passe est strictement confidentiel et vous permet de finaliser le règlement de vos parts soit
                      par votre solde portefeuille, soit directement par Orange Money / Moov Money.
                    </p>

                    <p className="text-[11px] text-slate-500">
                      Cordialement,<br />
                      <strong className="text-slate-800">La Direction Financière &amp; Relations Actionnaires</strong><br />
                      ELECTRO-MEN SAS • Ouagadougou, Burkina Faso
                    </p>
                  </div>

                  {/* Actions inside email */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(currentEmail.code)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                      <span>{copiedCode ? 'Mot de passe copié !' : 'Copier le Mot de Passe'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenPaymentForSubscription(currentEmail.subscriptionId);
                      }}
                      className="flex-1 py-2 px-3 rounded-xl btn-gold-prestige font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">payments</span>
                      <span>Payer mes Parts Maintenant</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
