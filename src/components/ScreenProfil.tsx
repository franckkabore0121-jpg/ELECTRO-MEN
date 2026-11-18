import React, { useState } from 'react';
import { InvestorWallet, InvestorProfile, ProfitDistribution } from '../data/mockData.ts';

interface ScreenProfilProps {
  currentProfile?: InvestorProfile | null;
  onUpdateProfile: (updated: Partial<InvestorProfile>) => void;
  wallet?: InvestorWallet;
  profitDistributions?: ProfitDistribution[];
  onOpenWallet?: (defaultAction?: 'depot' | 'retrait' | 'history') => void;
  onOpenCertificate?: () => void;
  onOpenPdf?: () => void;
  onOpenVideo?: () => void;
  onGoTab: (tab: 'composants' | 'solutions' | 'bourse' | 'profil') => void;
  onOpenCreateAccount?: () => void;
  onLogout?: () => void;
}

export const ScreenProfil: React.FC<ScreenProfilProps> = ({
  currentProfile,
  onUpdateProfile,
  wallet = { balance: 0, sharesCount: 0, dividendsEarned: 0 },
  profitDistributions = [],
  onOpenWallet,
  onGoTab,
  onOpenCreateAccount,
  onLogout
}) => {
  // Navigation inside profile: 'overview' or 'settings'
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');

  // Settings sub-section: 'infos' | 'security' | 'notifications' | 'preferences'
  const [settingsSection, setSettingsSection] = useState<'infos' | 'security' | 'notifications' | 'preferences'>('infos');

  // Personal Info Form State
  const [editName, setEditName] = useState(currentProfile?.name || '');
  const [editEmail, setEditEmail] = useState(currentProfile?.email || '');
  const [editPhone, setEditPhone] = useState(currentProfile?.phone || '');
  const [editCity, setEditCity] = useState(currentProfile?.city || 'Ouagadougou');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Security & Password Change State (Passwords never displayed in plain text)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securitySuccessMsg, setSecuritySuccessMsg] = useState<string | null>(null);
  const [securityErrorMsg, setSecurityErrorMsg] = useState<string | null>(null);
  const [securitySubmitting, setSecuritySubmitting] = useState(false);

  // Notifications Preferences State
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifWhatsApp, setNotifWhatsApp] = useState(true);
  const [notifProfits, setNotifProfits] = useState(true);
  const [notifSuccessMsg, setNotifSuccessMsg] = useState<string | null>(null);

  // Display & Language Preferences
  const [prefLang, setPrefLang] = useState<'fr'>('fr');
  const [prefCurrency, setPrefCurrency] = useState<'FCFA'>('FCFA');

  // Handle Save Profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim() || !editPhone.trim()) {
      alert('Veuillez renseigner votre nom, email et téléphone.');
      return;
    }

    onUpdateProfile({
      name: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      city: editCity.trim()
    });

    setSaveSuccessMsg('Vos coordonnées personnelles ont été enregistrées avec succès.');
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 2500);
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;
    setSecurityErrorMsg(null);
    setSecuritySuccessMsg(null);

    if (!currentPassword) {
      setSecurityErrorMsg('Veuillez saisir votre mot de passe actuel.');
      return;
    }

    if (newPassword.length < 12 || newPassword.length > 128) {
      setSecurityErrorMsg('Le nouveau mot de passe doit comporter entre 12 et 128 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityErrorMsg('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setSecuritySubmitting(true);
    try {
      const response = await fetch('/api/investor/change-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setSecurityErrorMsg(result.error || 'La modification du mot de passe a échoué.');
        return;
      }

      setSecuritySuccessMsg('Votre mot de passe a été modifié avec succès.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSecuritySuccessMsg(null);
      }, 3000);
    } catch {
      setSecurityErrorMsg('Le serveur est momentanément indisponible. Veuillez réessayer.');
    } finally {
      setSecuritySubmitting(false);
    }
  };

  // Handle Logout safely
  const handleLogoutClick = async () => {
    if (confirm('Voulez-vous vraiment vous déconnecter de votre compte investisseur ?')) {
      try {
        const response = await fetch('/api/investor/logout', {
          method: 'POST',
          credentials: 'same-origin'
        });
        if (!response.ok) throw new Error('logout failed');
        if (onLogout) {
          onLogout();
        } else {
          onGoTab('bourse');
        }
      } catch {
        alert('La déconnexion n’a pas pu être confirmée. Veuillez réessayer.');
      }
    }
  };

  if (!currentProfile) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6 animate-fadeIn">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
          <span className="material-symbols-outlined text-3xl">no_accounts</span>
        </div>
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-widest text-[#b48c1e] font-bold">
            Espace Compte Personnel
          </span>
          <h2 className="font-syne text-2xl font-black text-slate-900">
            Aucun Compte Actif
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Vous n'avez pas encore créé de compte. Pour suivre vos commandes de matériels, accéder à vos attestations ou participer aux offres, veuillez créer votre compte officiel vérifié.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {onOpenCreateAccount && (
            <button
              type="button"
              onClick={onOpenCreateAccount}
              className="w-full sm:w-auto px-6 py-3 rounded-xl btn-gold-prestige font-bold text-xs uppercase tracking-wider shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              <span>Créer mon Compte Client Vérifié</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onGoTab('bourse')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">trending_up</span>
            <span>Espace Investissements</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fadeIn text-slate-800">
      {/* Profile Header & Identity */}
      <section className="p-5 bg-white rounded-2xl border border-slate-200 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-50 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 border-2 border-amber-500 flex items-center justify-center text-amber-800 shadow-sm shrink-0 font-syne font-extrabold text-lg">
              {currentProfile.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'EM'}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-syne text-[18px] font-bold text-slate-900 truncate">
                  {currentProfile.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-300 text-cyan-800 text-[10px] font-bold shrink-0">
                  {currentProfile.isVerified ? 'VÉRIFIÉ' : 'ACTIF'}
                </span>
              </div>

              <p className="text-[12px] text-slate-500 font-mono">
                Identifiant Actionnaire : <span className="text-amber-700 font-bold">{currentProfile.id}</span>
              </p>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                <span className="flex items-center gap-1 text-cyan-700 font-medium">
                  <span className="material-symbols-outlined text-[14px]">mail</span>
                  <span className="truncate max-w-[170px] sm:max-w-xs">{currentProfile.email}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-700">
                  <span className="material-symbols-outlined text-[14px]">call</span>
                  <span>{currentProfile.phone}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick tab switcher: Mon Espace vs Réglages */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-sm">dashboard</span>
              <span>Mon Portefeuille</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-sm">settings</span>
              <span>Réglages</span>
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          VUE 1 : MON PORTEFEUILLE & BÉNÉFICES (PAS DE FORMATIONS NI ATTESTATIONS)
          ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-5 animate-fadeIn">
          {/* SYNTHÈSE PATRIMONIALE PERSONNELLE & PORTEFEUILLE CASH */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-syne text-[17px] text-slate-900 font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">account_balance_wallet</span>
                <span>Mon Portefeuille &amp; Trésorerie</span>
              </h3>
              <span
                className="text-[12px] text-cyan-700 font-bold hover:underline cursor-pointer"
                onClick={() => onGoTab('bourse')}
              >
                + Souscrire des parts
              </span>
            </div>

            {/* Solde Cash Personnel */}
            <div className="p-5 rounded-2xl bg-white border-2 border-amber-300 shadow-[0_4px_24px_-4px_rgba(212,175,55,0.18)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Solde Personnel Disponible
                </span>
                <span className="text-[10px] text-cyan-700 font-bold bg-cyan-50 px-2.5 py-0.5 rounded-full border border-cyan-200">
                  Retirable 24/7
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="font-syne text-[28px] sm:text-[34px] text-amber-700 font-extrabold tracking-tight">
                  {wallet.balance.toLocaleString('fr-FR')} <span className="text-[16px] text-slate-600 font-bold">FCFA</span>
                </div>
              </div>

              {/* Action Buttons: Dépôt & Retrait */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onOpenWallet && onOpenWallet('depot')}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  <span>Déposer de l'argent</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenWallet && onOpenWallet('retrait')}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
                >
                  <span className="material-symbols-outlined text-base text-amber-600">arrow_circle_down</span>
                  <span>Retirer de l'argent</span>
                </button>
              </div>
            </div>

            {/* Détails du Capital & Dividendes de CET investisseur */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Parts détenues</span>
                <div className="font-syne text-[18px] text-slate-900 font-extrabold">
                  {wallet.sharesCount.toLocaleString('fr-FR')}
                </div>
                <span className="text-[11px] text-cyan-700 font-medium block">
                  Leur valeur dépend du prix de chaque opération
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Mes Dividendes Cumulés</span>
                <div className="font-syne text-[18px] text-cyan-700 font-extrabold">
                  {wallet.dividendsEarned.toLocaleString('fr-FR')} <span className="text-[11px] text-slate-600 font-bold">FCFA</span>
                </div>
                <span className="text-[11px] text-slate-500 block">Partagés équitablement</span>
              </div>
            </div>

            {/* Bouton Historique de Dépôts et Retraits */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
              <button
                type="button"
                onClick={() => onOpenWallet && onOpenWallet('history')}
                className="text-[12px] text-slate-700 hover:text-cyan-700 flex items-center gap-1.5 cursor-pointer font-bold"
              >
                <span className="material-symbols-outlined text-sm text-cyan-600">receipt_long</span>
                <span>Consulter Mon Historique de Dépôts &amp; Retraits</span>
              </button>
              <span className="text-[11px] text-slate-500 font-mono">Compte : {currentProfile.id}</span>
            </div>
          </section>

          {/* HISTORIQUE PERSONNEL DES PARTAGES DE BÉNÉFICES */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-syne text-[17px] text-slate-900 font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[20px]">payments</span>
                <span>Mes Bénéfices &amp; Dividendes Validés</span>
              </h3>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Versements Directs
              </span>
            </div>

            <div className="space-y-2.5">
              {profitDistributions.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 space-y-1">
                  <span className="material-symbols-outlined text-2xl text-slate-300">account_balance</span>
                  <p className="text-xs">Aucun partage de bénéfice publié pour le moment.</p>
                  <p className="text-[10px] text-slate-400">
                    Les distributions officielles validées par la direction apparaîtront ici avec votre montant individuel.
                  </p>
                </div>
              ) : (
                profitDistributions.map((dist) => (
                  <div
                    key={dist.id}
                    className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 uppercase">
                          Secteur {dist.sector}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{dist.period}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({dist.reference})</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{dist.notes}</p>
                      <div className="text-[11px] text-slate-400">
                        Date de publication : {dist.publishedAt} • Validé par : {dist.validatedBy}
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">
                        Votre Part Individuelle
                      </span>
                      <div className="font-syne text-lg font-black text-emerald-700">
                        +{dist.individualAmount.toLocaleString('fr-FR')} FCFA
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold block">
                        ✓ Versé au solde
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* BANDEAU CONFIDENTIALITÉ DES DONNÉES */}
          <section className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5 text-xs text-slate-700">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-[12px]">
              <span className="material-symbols-outlined text-[18px] text-amber-600">lock</span>
              <span>Cloisonnement &amp; Confidentialité des Données</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Vos souscriptions de parts, vos soldes de dépôt et vos données personnelles sont strictement rattachés à votre compte <strong>{currentProfile.email}</strong>. Aucun autre investisseur ne peut voir vos transactions ou montants individuels.
            </p>
          </section>

          {/* VIP SUPPORT WHATSAPP */}
          <section className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                <span className="material-symbols-outlined text-xl">support_agent</span>
              </div>
              <div>
                <h4 className="text-[13px] text-slate-900 font-bold">Conseiller Dédié Actionnaires</h4>
                <p className="text-[11px] text-slate-500">Ligne directe &amp; assistance personnalisée aux investisseurs</p>
              </div>
            </div>

            <a
              href={`https://wa.me/22665484738?text=${encodeURIComponent(
                `Bonjour, je suis ${currentProfile.name} (ID: ${currentProfile.id}), je souhaite un point personnel sur mes investissements.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1 shrink-0 shadow-sm transition-colors"
            >
              <span>WhatsApp VIP</span>
            </a>
          </section>
        </div>
      )}

      {/* =========================================================================
          VUE 2 : RUBRIQUE « RÉGLAGES » DU COMPTE INVESTISSEUR (DEMANDE UTILISATEUR)
          - Informations personnelles
          - Coordonnées (Téléphone, Email)
          - Sécurité du compte (Changer mot de passe)
          - Notifications
          - Préférences (Langue, Affichage)
          - Déconnexion
          - Protection stricte : l'investisseur ne peut pas altérer ses soldes ou parts
          ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="space-y-5 animate-fadeIn">
          {/* En-tête Réglages */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">settings</span>
              </span>
              <div>
                <h3 className="font-syne text-base font-bold text-slate-900">
                  Réglages &amp; Paramètres du Compte
                </h3>
                <p className="text-xs text-slate-500">
                  Gérez vos informations personnelles, vos coordonnées et la sécurité de votre compte.
                </p>
              </div>
            </div>
          </div>

          {/* Notice de Sécurité & Restrictions */}
          <div className="p-3.5 rounded-xl bg-cyan-50 border border-cyan-200 text-xs text-cyan-950 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-cyan-700 text-lg shrink-0 mt-0.5">shield</span>
            <div className="space-y-0.5">
              <span className="font-bold block">Protection des Accès &amp; Données Sensibles</span>
              <p className="text-[11px] text-cyan-900 leading-relaxed">
                Vous pouvez modifier librement vos coordonnées de contact et vos préférences de sécurité. Votre solde de trésorerie, vos parts acquises et vos dividendes validés sont sécurisés et ne peuvent être altérés que par les transactions officielles vérifiées par l'administrateur.
              </p>
            </div>
          </div>

          {/* Menu des 4 sous-sections de Réglages */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'infos', label: 'Informations & Contact', icon: 'person' },
              { id: 'security', label: 'Sécurité & Mot de passe', icon: 'lock' },
              { id: 'notifications', label: 'Notifications', icon: 'notifications' },
              { id: 'preferences', label: 'Préférences & Sortie', icon: 'tune' }
            ].map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSettingsSection(sub.id as any)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                  settingsSection === sub.id
                    ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-base text-amber-700">{sub.icon}</span>
                <span className="text-xs">{sub.label}</span>
              </button>
            ))}
          </div>

          {/* 1. INFORMATIONS PERSONNELLES & COORDONNÉES */}
          {settingsSection === 'infos' && (
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h4 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-600 text-base">manage_accounts</span>
                <span>Informations Personnelles &amp; Coordonnées</span>
              </h4>

              <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Nom Complet / Raison Sociale *
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:bg-white focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Ville / Localisation
                    </label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      placeholder="Ouagadougou"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:bg-white focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Adresse Email Principale *
                    </label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:bg-white focus:border-amber-500 outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      Utilisée pour les notifications et récapitulatifs d'opérations.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Numéro de Téléphone Mobile Money *
                    </label>
                    <input
                      type="tel"
                      required
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+226 65 48 47 38"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:bg-white focus:border-amber-500 outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      Numéro utilisé lors des dépôts et retraits avec l'administrateur.
                    </span>
                  </div>
                </div>

                {saveSuccessMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs">
                    ✓ {saveSuccessMsg}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl btn-gold-prestige font-bold text-xs uppercase cursor-pointer shadow-sm active:scale-98"
                  >
                    Enregistrer mes informations
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 2. SÉCURITÉ DU COMPTE & MOT DE PASSE (JAMAIS EN CLAIR) */}
          {settingsSection === 'security' && (
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h4 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-red-600 text-base">lock</span>
                <span>Sécurité du Compte &amp; Modification du Mot de Passe</span>
              </h4>

              <p className="text-xs text-slate-600">
                Pour votre sécurité, les mots de passe sont strictement confidentiels et ne sont jamais affichés en clair sur l'écran.
              </p>

              {securityErrorMsg && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs font-semibold">
                  {securityErrorMsg}
                </div>
              )}

              {securitySuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
                  ✓ {securitySuccessMsg}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs max-w-md">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Mot de passe actuel *
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Saisissez votre mot de passe actuel..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Nouveau mot de passe *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="12 à 128 caractères..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Confirmer le nouveau mot de passe *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Retapez le nouveau mot de passe..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={securitySubmitting}
                    className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase cursor-pointer shadow-sm active:scale-98"
                  >
                    {securitySubmitting ? 'Modification...' : 'Mettre à jour le mot de passe'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 3. PRÉFÉRENCES DE NOTIFICATIONS */}
          {settingsSection === 'notifications' && (
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h4 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-cyan-600 text-base">notifications</span>
                <span>Préférences de Notifications</span>
              </h4>

              <div className="space-y-3 text-xs divide-y divide-slate-100">
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <span className="font-bold text-slate-900 block">Notifications par Email</span>
                    <span className="text-[11px] text-slate-500">
                      Recevoir un récapitulatif lors de chaque souscription ou validation de transaction.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifEmail}
                    onChange={(e) => {
                      setNotifEmail(e.target.checked);
                      setNotifSuccessMsg('Préférences de notifications mises à jour.');
                      setTimeout(() => setNotifSuccessMsg(null), 2000);
                    }}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-3">
                  <div>
                    <span className="font-bold text-slate-900 block">Alertes de Règlement WhatsApp</span>
                    <span className="text-[11px] text-slate-500">
                      Rappels et confirmation de contact avec le responsable du secteur sélectionné.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifWhatsApp}
                    onChange={(e) => {
                      setNotifWhatsApp(e.target.checked);
                      setNotifSuccessMsg('Préférences de notifications mises à jour.');
                      setTimeout(() => setNotifSuccessMsg(null), 2000);
                    }}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-3">
                  <div>
                    <span className="font-bold text-slate-900 block">Annonces des Partages de Bénéfices</span>
                    <span className="text-[11px] text-slate-500">
                      Être notifié dès qu'une distribution de dividendes est validée et versée par la direction.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifProfits}
                    onChange={(e) => {
                      setNotifProfits(e.target.checked);
                      setNotifSuccessMsg('Préférences de notifications mises à jour.');
                      setTimeout(() => setNotifSuccessMsg(null), 2000);
                    }}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              {notifSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs">
                  ✓ {notifSuccessMsg}
                </div>
              )}
            </div>
          )}

          {/* 4. PRÉFÉRENCES D'AFFICHAGE & DÉCONNEXION */}
          {settingsSection === 'preferences' && (
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h4 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-600 text-base">tune</span>
                <span>Affichage &amp; Déconnexion Sécurisée</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700 block">Langue de l'application</span>
                  <select
                    value={prefLang}
                    onChange={(e) => setPrefLang(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium"
                  >
                    <option value="fr">Français (Burkina Faso)</option>
                  </select>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700 block">Devise des transactions</span>
                  <select
                    value={prefCurrency}
                    onChange={(e) => setPrefCurrency(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium"
                  >
                    <option value="FCFA">Franc CFA (FCFA / XOF)</option>
                  </select>
                </div>
              </div>

              {/* Bouton visible de Déconnexion */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">Fermer la session active</span>
                  <span className="text-[11px] text-slate-500">
                    Se déconnecter de son espace investisseur en toute sécurité sur cet appareil.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLogoutClick}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shrink-0 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  <span>Déconnexion Sécurisée</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
