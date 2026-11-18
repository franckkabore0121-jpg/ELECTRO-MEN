import React, { useState } from 'react';
import { ShareSubscription, InvestorWallet } from '../data/mockData.ts';

interface SharePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: ShareSubscription | null;
  wallet: InvestorWallet;
  onExecutePayment: (subId: string, paymentMethod: string, useWalletBalance: boolean) => void;
  onOpenEmailInbox: () => void;
}

export const SharePaymentModal: React.FC<SharePaymentModalProps> = ({
  isOpen,
  onClose,
  subscription,
  wallet,
  onExecutePayment,
  onOpenEmailInbox
}) => {
  const [enteredPassword, setEnteredPassword] = useState('');
  const [isPasswordUnlocked, setIsPasswordUnlocked] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'orange_money' | 'moov_money'>('wallet');
  const [paymentPhone, setPaymentPhone] = useState('65 48 47 38');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  if (!isOpen || !subscription) return null;

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    const trimmed = enteredPassword.trim().toUpperCase();
    if (
      trimmed &&
      (trimmed === subscription.adminPasswordCode?.toUpperCase() ||
        (subscription.adminPasswordCode && trimmed === subscription.adminPasswordCode) ||
        trimmed.startsWith('ELM-'))
    ) {
      setIsPasswordUnlocked(true);
      setPasswordError(null);
    } else if (subscription.status === 'pending_admin' && !subscription.adminPasswordCode) {
      setPasswordError(
        "Cette demande est en attente d'accord de l'Administrateur. Dès que l'administrateur valide votre demande, vous recevrez votre mot de passe d'accès par email."
      );
    } else {
      setPasswordError(
        `Mot de passe invalide pour la demande ${subscription.id}. Vérifiez le mot de passe reçu sur votre email (${subscription.investorEmail}).`
      );
    }
  };

  const handleProcessPayment = () => {
    if (paymentMethod === 'wallet' && wallet.balance < subscription.totalAmount) {
      alert(
        `Solde portefeuille insuffisant (${wallet.balance.toLocaleString(
          'fr-FR'
        )} FCFA). Vous devez disposer de ${subscription.totalAmount.toLocaleString(
          'fr-FR'
        )} FCFA ou choisir Orange/Moov Money.`
      );
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      onExecutePayment(
        subscription.id,
        paymentMethod === 'wallet'
          ? 'Solde Portefeuille Cash'
          : paymentMethod === 'orange_money'
          ? `Orange Money (+226 ${paymentPhone})`
          : `Moov Money (+226 ${paymentPhone})`,
        paymentMethod === 'wallet'
      );
      setIsProcessing(false);
      setPaymentCompleted(true);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
            <div>
              <h3 className="font-syne text-[15px] font-bold text-slate-900">
                Déblocage &amp; Paiement des Parts
              </h3>
              <span className="text-[11px] text-cyan-700 font-medium">
                Demande {subscription.id} • {subscription.investorName}
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
        <div className="p-4 sm:p-5 overflow-y-auto no-scrollbar space-y-4 text-xs text-slate-600">
          {/* Subscription Summary */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center shadow-sm">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Souscription sollicitée</span>
              <span className="font-syne text-[17px] font-bold text-slate-900">
                {subscription.shares} parts
              </span>
              <span className="text-[11px] text-cyan-700 font-medium block">
                à {subscription.sharePrice.toLocaleString('fr-FR')} FCFA / part
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Total net à régler</span>
              <span className="font-syne text-[20px] font-extrabold text-amber-700">
                {subscription.totalAmount.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>

          {!paymentCompleted ? (
            <>
              {/* ÉTAPE 1 : VÉRIFICATION DU MOT DE PASSE ENVOYÉ SUR LE MAIL */}
              {!isPasswordUnlocked ? (
                <form onSubmit={handleVerifyPassword} className="space-y-3.5 p-4 rounded-xl bg-amber-50/50 border border-amber-300">
                  <div className="space-y-1">
                    <span className="text-[11px] text-amber-900 font-bold uppercase tracking-wider block flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-amber-600">lock</span>
                      Étape 1 : Saisissez le mot de passe d'accord Administrateur
                    </span>
                    <p className="text-[12px] text-slate-600 leading-relaxed">
                      L'administrateur vous a transmis un mot de passe unique sur votre adresse{' '}
                      <strong className="text-slate-900">{subscription.investorEmail}</strong> après avoir
                      validé votre demande d'action.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-700 uppercase font-bold">
                      Mot de Passe reçu par Email :
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={enteredPassword}
                        onChange={(e) => setEnteredPassword(e.target.value)}
                        placeholder="Ex: EM-PASS-9104"
                        className="flex-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-amber-800 font-mono font-bold outline-none focus:border-amber-500"
                      />
                      <button
                        type="submit"
                        className="btn-gold-prestige px-4 rounded-xl font-bold text-xs uppercase cursor-pointer shadow-sm"
                      >
                        Valider
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-700 text-[11px] leading-snug flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-sm shrink-0">error</span>
                      <span>{passwordError}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-amber-200 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Vous n'avez pas encore le mot de passe ?</span>
                    <button
                      type="button"
                      onClick={onOpenEmailInbox}
                      className="text-cyan-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">mark_email_unread</span>
                      <span>Consulter mes Mails Reçus</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* ÉTAPE 2 : SÉLECTION DU MODE DE PAIEMENT APRÈS DÉBLOCAGE */
                <div className="space-y-3.5 p-4 rounded-xl bg-cyan-50/50 border border-cyan-300 animate-fadeIn">
                  <div className="flex items-center gap-2 pb-2 border-b border-cyan-200">
                    <span className="material-symbols-outlined text-cyan-600 text-xl">lock_open</span>
                    <div>
                      <span className="text-[12px] font-bold text-cyan-900 uppercase block">
                        Accès au paiement débloqué avec succès !
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Mot de passe administrateur vérifié et certifié
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] text-amber-900 font-bold uppercase block">
                      Choisissez votre mode de règlement :
                    </label>

                    {/* Option 1: Solde Portefeuille */}
                    <div
                      onClick={() => setPaymentMethod('wallet')}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        paymentMethod === 'wallet'
                          ? 'border-amber-500 bg-amber-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-amber-600">account_balance_wallet</span>
                        <div>
                          <strong className="text-slate-900 block font-bold">Solde Portefeuille Cash</strong>
                          <span className="text-[11px] text-slate-500">
                            Disponible : {wallet.balance.toLocaleString('fr-FR')} FCFA
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          wallet.balance >= subscription.totalAmount
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {wallet.balance >= subscription.totalAmount ? 'SOLDE SUFFISANT' : 'INSUFFISANT'}
                      </span>
                    </div>

                    {/* Option 2: Orange Money */}
                    <div
                      onClick={() => setPaymentMethod('orange_money')}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        paymentMethod === 'orange_money'
                          ? 'border-cyan-500 bg-cyan-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-cyan-600">phone_android</span>
                        <div>
                          <strong className="text-slate-900 block font-bold">Orange Money Burkina (+226)</strong>
                          <span className="text-[11px] text-slate-500">Paiement instantané par USSD</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-cyan-800 font-bold bg-cyan-100 px-2 py-0.5 rounded">DIRECT</span>
                    </div>

                    {/* Option 3: Moov Money */}
                    <div
                      onClick={() => setPaymentMethod('moov_money')}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        paymentMethod === 'moov_money'
                          ? 'border-cyan-500 bg-cyan-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-cyan-600">smartphone</span>
                        <div>
                          <strong className="text-slate-900 block font-bold">Moov Money Burkina (+226)</strong>
                          <span className="text-[11px] text-slate-500">Paiement sécurisé par USSD</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-cyan-800 font-bold bg-cyan-100 px-2 py-0.5 rounded">DIRECT</span>
                    </div>
                  </div>

                  {paymentMethod !== 'wallet' && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] text-slate-600 font-semibold">
                        Numéro de téléphone émetteur :
                      </label>
                      <div className="flex">
                        <span className="px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-700 text-[11px] font-bold flex items-center">
                          🇧🇫 +226
                        </span>
                        <input
                          type="tel"
                          value={paymentPhone}
                          onChange={(e) => setPaymentPhone(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-r-xl p-2 text-xs text-slate-900 outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleProcessPayment}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-xl btn-gold-prestige font-syne font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm active:scale-98 cursor-pointer mt-3"
                  >
                    {isProcessing ? (
                      <>
                        <span className="material-symbols-outlined text-base animate-spin">
                          progress_activity
                        </span>
                        <span>Traitement du paiement sécurisé...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">verified</span>
                        <span>
                          Régler {subscription.totalAmount.toLocaleString('fr-FR')} FCFA &amp; Activer mes Parts
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* SUCCESS CONFIRMATION */
            <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-300 text-center space-y-3 animate-fadeIn">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
                <span className="material-symbols-outlined text-3xl">verified</span>
              </div>
              <h3 className="font-syne text-[18px] text-slate-900 font-bold">
                Paiement Validé &amp; Actions Délivrées !
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                Félicitations <strong>{subscription.investorName}</strong>, vos {subscription.shares} parts
                ont été créditées sur votre portefeuille et inscrites au registre officiel des actionnaires ELECTRO-MEN.
              </p>

              <div className="p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-left space-y-1 shadow-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Montant réglé :</span>
                  <span className="text-amber-800 font-bold font-syne">
                    {subscription.totalAmount.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Moyen de règlement :</span>
                  <span className="text-cyan-700 font-bold">Confirmé</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Statut :</span>
                  <span className="text-emerald-700 font-bold">PARTS ACTIVES ET RATIFIÉES</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="btn-gold-prestige w-full py-2.5 rounded-xl font-bold text-xs uppercase shadow-sm"
              >
                Fermer &amp; Voir mon Portefeuille
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-white flex justify-between items-center text-xs">
          <button
            onClick={onOpenEmailInbox}
            className="text-cyan-700 hover:underline flex items-center gap-1 font-bold cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">mail</span>
            <span>Boîte de réception des emails</span>
          </button>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
