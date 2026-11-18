import React, { useState } from 'react';
import { InvestorProfile } from '../data/mockData.ts';
import { validatePersonData } from '../utils/validation.ts';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: (profile: InvestorProfile) => void;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  onAccountCreated
}) => {
  // Mode: 'register' | 'login'
  const [mode, setMode] = useState<'register' | 'login'>('register');

  // Register form fields
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Ouagadougou');
  const [domainInterest, setDomainInterest] = useState<'both' | 'electronique' | 'electrotechnique'>('both');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Login form fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // OTP Verification Step
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');
  const [otpCode, setOtpCode] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [pendingClient, setPendingClient] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successProfile, setSuccessProfile] = useState<InvestorProfile | null>(null);

  if (!isOpen) return null;

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Identity validation
    const validation = validatePersonData({
      lastName,
      firstName,
      email,
      phone
    });

    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Informations non conformes ou incomplètes.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage('La confirmation du mot de passe ne correspond pas au mot de passe saisi.');
      return;
    }

    if (!termsAccepted) {
      setErrorMessage('Veuillez cocher la case d’acceptation des Conditions Générales et de la Politique de Confidentialité.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastName: lastName.trim(),
          firstName: firstName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.startsWith('+226') ? phone.trim() : `+226 ${phone.trim()}`,
          city,
          accountType:
            domainInterest === 'both'
              ? 'Électronique & Électrotechnique'
              : domainInterest === 'electronique'
              ? 'Composants Électroniques'
              : 'Électrotechnique & Puissance',
          password,
          termsAccepted: true
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Erreur lors de l’inscription.');
        setLoading(false);
        return;
      }

      setPendingClient(data.client);
      setDevOtpHint(data.devOtp || null);
      setStep('otp');
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible de contacter le serveur sécurisé.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 4) {
      setErrorMessage('Veuillez saisir le code de vérification reçu.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: otpCode.trim()
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Code de vérification invalide ou expiré.');
        setLoading(false);
        return;
      }

      const fullName = `${lastName.trim().toUpperCase()} ${firstName.trim()}`;
      const newProfile: InvestorProfile = {
        id: pendingClient?.id || `#EM-CLI-${Math.floor(1000 + Math.random() * 9000)}`,
        name: fullName,
        email: email.trim().toLowerCase(),
        phone: phone.startsWith('+226') ? phone.trim() : `+226 ${phone.trim()}`,
        city: city.trim(),
        accountType:
          domainInterest === 'both'
            ? 'Électronique & Électrotechnique'
            : domainInterest === 'electronique'
            ? 'Composants Électroniques'
            : 'Électrotechnique & Puissance',
        isVerified: true,
        registeredDate: new Date().toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      };

      setSuccessProfile(newProfile);
      setStep('success');
      onAccountCreated(newProfile);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur de communication avec le serveur.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!loginEmail || !loginPassword) {
      setErrorMessage('Veuillez renseigner votre email et mot de passe.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Identifiants invalides.');
        setLoading(false);
        return;
      }

      const client = data.client;
      const profile: InvestorProfile = {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        city: client.city || 'Ouagadougou',
        accountType: client.accountType || 'Client Particulier',
        isVerified: client.isVerified,
        registeredDate: client.registeredDate || new Date().toLocaleDateString('fr-FR')
      };

      setSuccessProfile(profile);
      onAccountCreated(profile);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la connexion.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      const data = await res.json();
      if (data.devOtp) {
        setDevOtpHint(data.devOtp);
      }
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-700 shadow-sm">
              <span className="material-symbols-outlined text-[22px]">
                {mode === 'register' ? 'person_add' : 'lock_open'}
              </span>
            </div>
            <div>
              <h2 className="font-syne text-[16px] font-bold text-slate-900">
                {mode === 'register' ? 'Espace Client Officiel ELECTRO-MEN' : 'Connexion Client Sécurisée'}
              </h2>
              <span className="text-[11px] text-cyan-800 font-medium">
                {mode === 'register'
                  ? 'Authentification stricte et traçabilité certifiée (anti-fraude)'
                  : 'Accédez à vos commandes et devis avec vos identifiants'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Tab switch mode */}
        {step === 'form' && (
          <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
              }}
              className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 cursor-pointer transition-all ${
                mode === 'register'
                  ? 'border-amber-600 text-amber-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Créer un Compte Client
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 cursor-pointer transition-all ${
                mode === 'login'
                  ? 'border-amber-600 text-amber-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Déjà un Compte ? Se Connecter
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto no-scrollbar space-y-4 text-xs text-slate-600">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border-2 border-red-300 text-red-700 font-semibold text-xs flex items-center gap-2 animate-fadeIn">
              <span className="material-symbols-outlined text-base text-red-600 shrink-0">error</span>
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: REGISTER FORM */}
          {step === 'form' && mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">verified_user</span>
                <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                  Renseignez vos véritables coordonnées pour le suivi de vos commandes physiques et l'émission de factures certifiées. Les données fictives sont automatiquement rejetées.
                </p>
              </div>

              {/* Nom & Prénom */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-700 font-bold uppercase block">
                    Nom de Famille *
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ex: KABORÉ"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none uppercase font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-700 font-bold uppercase block">
                    Prénom(s) *
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ex: Franck"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none font-semibold"
                  />
                </div>
              </div>

              {/* WhatsApp Phone */}
              <div className="space-y-1">
                <label className="text-[11px] text-emerald-800 font-bold uppercase block flex items-center justify-between">
                  <span>Numéro de Téléphone WhatsApp *</span>
                  <span className="text-[10px] text-slate-400 font-normal">Contact réel joignable</span>
                </label>
                <div className="flex">
                  <span className="px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-700 text-[11px] font-bold flex items-center">
                    🇧🇫 +226
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="65 48 47 38"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-r-xl p-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-emerald-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-[11px] text-cyan-800 font-bold uppercase block">
                  Adresse Email Véritable *
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">mail</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre.email@domaine.bf"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              {/* Ville & Domaine */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-700 font-bold uppercase block">
                    Ville / Région
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-amber-500 font-medium"
                  >
                    <option value="Ouagadougou">Ouagadougou (Centre)</option>
                    <option value="Bobo-Dioulasso">Bobo-Dioulasso (Hauts-Bassins)</option>
                    <option value="Koudougou">Koudougou (Centre-Ouest)</option>
                    <option value="Fada N'Gourma">Fada N'Gourma (Est)</option>
                    <option value="Autre Ville">Autre localité / Zone UEMOA</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-700 font-bold uppercase block">
                    Domaine d'Intérêt
                  </label>
                  <select
                    value={domainInterest}
                    onChange={(e) => setDomainInterest(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-amber-500"
                  >
                    <option value="both">Électronique &amp; Électrotechnique</option>
                    <option value="electronique">Composants Électroniques &amp; IoT</option>
                    <option value="electrotechnique">Électrotechnique &amp; Puissance</option>
                  </select>
                </div>
              </div>

              {/* Mot de passe & Confirmation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-700 font-bold uppercase block">
                    Mot de Passe * (min 6 car.)
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">lock</span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-700 font-bold uppercase block">
                    Confirmation Mot de Passe *
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">lock_reset</span>
                    <input
                      type="password"
                      required
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Conditions d'utilisation Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none text-[11px] text-slate-700 leading-tight">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                  />
                  <span>
                    J'atteste de l'exactitude de mes informations et j'accepte les{' '}
                    <strong className="text-slate-900">Conditions Générales d'Utilisation</strong> ainsi que la{' '}
                    <strong className="text-slate-900">Politique de Confidentialité</strong> d'ELECTRO-MEN.
                  </span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl btn-gold-prestige font-syne text-[14px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">how_to_reg</span>
                  <span>{loading ? 'Traitement sécurisé...' : 'Créer mon Compte Client (Étape 1/2)'}</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: OTP VERIFICATION */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-cyan-50 rounded-xl border border-cyan-200 text-center space-y-1">
                <div className="w-10 h-10 mx-auto rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">mark_email_read</span>
                </div>
                <h3 className="font-bold text-cyan-950 text-sm">Vérification de l'adresse e-mail</h3>
                <p className="text-[11px] text-cyan-800">
                  Un code sécurisé à 6 chiffres a été généré pour <strong>{email}</strong>.
                </p>
              </div>

              {devOtpHint && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-center space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800">
                    Code OTP de vérification de démonstration :
                  </span>
                  <div className="font-mono text-xl font-bold text-emerald-950 tracking-widest">
                    {devOtpHint}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] text-slate-700 font-bold uppercase block text-center">
                  Saisissez le Code OTP reçu *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.5em] font-mono text-xl font-bold bg-slate-50 border-2 border-slate-300 rounded-xl py-3 text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Renvoyer un code
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-1/2 py-2.5 rounded-xl btn-gold-prestige font-bold text-xs uppercase shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Vérification...' : 'Valider & Activer'}
                </button>
              </div>
            </form>
          )}

          {/* STEP 1: LOGIN FORM */}
          {step === 'form' && mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-slate-600 text-lg shrink-0 mt-0.5">security</span>
                <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                  Connectez-vous pour retrouver votre profil client, vos adresses de livraison et le suivi de vos commandes.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-700 font-bold uppercase block">
                  Adresse E-mail *
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">mail</span>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="votre.email@domaine.bf"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-700 font-bold uppercase block">
                  Mot de Passe *
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">lock</span>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl btn-gold-prestige font-syne text-[14px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">login</span>
                  <span>{loading ? 'Connexion en cours...' : 'Se Connecter à mon Espace'}</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: SUCCESS CONFIRMATION */}
          {step === 'success' && (
            <div className="p-6 text-center space-y-4 animate-fadeIn">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>

              <div>
                <h3 className="font-syne text-[18px] text-slate-900 font-bold">
                  Compte Client Officiel Vérifié !
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Bienvenue dans l'écosystème <strong>ELECTRO-MEN</strong>. Votre identité est authentifiée.
                </p>
              </div>

              {successProfile && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
                  <div className="flex justify-between pb-1.5 border-b border-slate-200">
                    <span className="text-slate-500">Identifiant Client :</span>
                    <strong className="text-amber-800 font-mono font-bold">{successProfile.id}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Titulaire :</span>
                    <strong className="text-slate-900">{successProfile.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">WhatsApp lié :</span>
                    <strong className="text-emerald-700">{successProfile.phone}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email :</span>
                    <strong className="text-cyan-700">{successProfile.email}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Statut vérification :</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      VÉRIFIÉ PAR OTP
                    </span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl btn-gold-prestige font-bold text-xs uppercase shadow-sm cursor-pointer"
              >
                Accéder à la Plateforme &amp; Commander
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
