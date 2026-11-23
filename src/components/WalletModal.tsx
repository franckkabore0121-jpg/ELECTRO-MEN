import React, { useState } from 'react';
import { InvestorWallet, WalletTransaction, FundOperationRequest, InvestmentProject } from '../data/mockData.ts';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: InvestorWallet;
  transactions: WalletTransaction[];
  fundRequests: FundOperationRequest[];
  projects?: InvestmentProject[];
  onSubmitFundRequest: (req: Omit<FundOperationRequest, 'id' | 'requestedAt' | 'status'>) => FundOperationRequest | Promise<FundOperationRequest>;
  defaultAction?: 'depot' | 'retrait' | 'history';
  investorName?: string;
  investorPhone?: string;
  investorEmail?: string;
  investorId?: string;
}

const MIN_FUND_AMOUNT = 500;
const MAX_WITHDRAWAL_PER_TX = 5_000_000;
const MAX_DEPOSIT_PER_TX = 50_000_000;

function generateIdempotencyKey(opType: 'depot' | 'retrait'): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `idem-${opType}-${randomPart}`;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  wallet,
  transactions,
  fundRequests,
  projects = [],
  onSubmitFundRequest,
  defaultAction = 'depot',
  investorName = 'Franck Kaboré',
  investorPhone = '+226 65 48 47 38',
  investorEmail = 'franckkabore454@gmail.com',
  investorId = '#EM-INV-4541'
}) => {
  // Navigation tabs: 'operations' (step flow for deposit / withdrawal), 'requests', or 'history'
  const [activeTab, setActiveTab] = useState<'operations' | 'requests' | 'history'>(
    defaultAction === 'history' ? 'history' : 'operations'
  );

  // Sector configuration with strict official numbers
  const SECTOR_CONTACTS = {
    electronique: {
      sector: 'Électronique' as const,
      label: 'Électronique & IoT',
      number: '+22665484738',
      display: '+226 65 48 47 38',
      raw: '65484738'
    },
    electrotechnique: {
      sector: 'Électrotechnique' as const,
      label: 'Électrotechnique & Puissance 380V',
      number: '+22607315734',
      display: '+226 07 31 57 34',
      raw: '07315734'
    },
    informatique: {
      sector: 'Informatique' as const,
      label: 'Informatique & Réseaux',
      number: '+22656283526',
      display: '+226 56 28 35 26',
      raw: '56283526'
    }
  };

  const [selectedSector, setSelectedSector] = useState<'electronique' | 'electrotechnique' | 'informatique'>('electronique');

  // Operation Type: 'depot' or 'retrait' (Step 1)
  const [operationType, setOperationType] = useState<'depot' | 'retrait'>(
    defaultAction === 'retrait' ? 'retrait' : 'depot'
  );

  // Step state: 1 = Input Amount, 2 = Summary & Validate, 3 = Submitted Ticket
  const [flowStep, setFlowStep] = useState<1 | 2 | 3>(1);

  // Input amount
  const [amountInput, setAmountInput] = useState<string>('25000');
  const [paymentMethod, setPaymentMethod] = useState<'Orange Money' | 'Moov Money' | 'Wave' | 'Virement / Espèces'>(
    'Orange Money'
  );
  const [phoneInput, setPhoneInput] = useState<string>(investorPhone.replace('+226', '').trim());

  // Submitted ticket result
  const [submittedRequest, setSubmittedRequest] = useState<FundOperationRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    generateIdempotencyKey(defaultAction === 'retrait' ? 'retrait' : 'depot')
  );

  const ALL_BOUTIQUES = [
    { id: 'electronique' as const, sector: 'Électronique' as const, phone: '65 48 47 38', icon: 'memory' },
    { id: 'electrotechnique' as const, sector: 'Électrotechnique' as const, phone: '07 31 57 34', icon: 'bolt' },
    { id: 'informatique' as const, sector: 'Informatique' as const, phone: '56 28 35 26', icon: 'laptop_mac' }
  ];

  const openOperationBoutiqueIds = React.useMemo(() => {
    const activeSet = new Set<'electronique' | 'electrotechnique' | 'informatique'>();
    projects.forEach((p) => {
      const isPublished = p.isPublished !== false && p.offerStatus !== 'Brouillon' && p.status !== 'draft';
      const isOpenOp = (p.offerStatus || (p.status === 'completed' ? 'Fermé' : 'Ouvert')) === 'Ouvert';
      if (!isPublished || !isOpenOp) return;
      const raw = `${p.sector || ''} ${p.category || ''}`.toLowerCase();
      if (raw.includes('électrotechnique') || raw.includes('electrotechnique') || raw.includes('puissance')) {
        activeSet.add('electrotechnique');
      } else if (raw.includes('informatique')) {
        activeSet.add('informatique');
      } else {
        activeSet.add('electronique');
      }
    });
    return activeSet;
  }, [projects]);

  const availableBoutiquesForStep1 = React.useMemo(() => {
    if (operationType === 'retrait') return ALL_BOUTIQUES;
    return ALL_BOUTIQUES.filter((b) => openOperationBoutiqueIds.has(b.id));
  }, [operationType, openOperationBoutiqueIds]);

  React.useEffect(() => {
    if (investorPhone) {
      setPhoneInput(investorPhone.replace('+226', '').trim());
    }
  }, [investorPhone]);

  React.useEffect(() => {
    if (!isOpen) return;
    const nextOp: 'depot' | 'retrait' = defaultAction === 'retrait' ? 'retrait' : 'depot';
    setActiveTab(defaultAction === 'history' ? 'history' : 'operations');
    setOperationType(nextOp);
    setFlowStep(1);
    setSubmittedRequest(null);
    setErrorMessage(null);
    setIsSubmitting(false);
    setIdempotencyKey(generateIdempotencyKey(nextOp));
  }, [isOpen, defaultAction]);

  React.useEffect(() => {
    if (operationType === 'depot' && availableBoutiquesForStep1.length > 0) {
      if (!availableBoutiquesForStep1.some((b) => b.id === selectedSector)) {
        setSelectedSector(availableBoutiquesForStep1[0].id);
      }
    }
  }, [operationType, availableBoutiquesForStep1, selectedSector]);

  if (!isOpen) return null;

  // Filter requests strictly for this investor
  const myRequests = fundRequests.filter(
    (r) =>
      r.investorEmail.toLowerCase().trim() === investorEmail.toLowerCase().trim() ||
      r.investorId === investorId
  );

  // Real available withdrawal balance: total cash balance minus pending/processing withdrawals
  const computedPendingWithdrawals = myRequests
    .filter((r) => r.type === 'retrait' && (r.status === 'En attente' || r.status === 'En cours de traitement'))
    .reduce((sum, r) => sum + (Number.isSafeInteger(r.amount) && r.amount > 0 ? r.amount : 0), 0);
  const pendingWithdrawalsTotal = Math.max(
    computedPendingWithdrawals,
    typeof wallet.pendingWithdrawalsTotal === 'number' ? wallet.pendingWithdrawalsTotal : 0
  );
  const localAvailable = Math.max(0, wallet.balance - pendingWithdrawalsTotal);
  const effectiveAvailableForWithdrawal =
    typeof wallet.availableWithdrawalBalance === 'number'
      ? Math.max(0, Math.min(localAvailable, wallet.availableWithdrawalBalance))
      : localAvailable;

  const trimmedAmount = amountInput.trim();
  const isStrictIntegerAmount = /^\d+$/.test(trimmedAmount);
  const numericAmount = isStrictIntegerAmount ? Number(trimmedAmount) : Number.NaN;

  const getWithdrawalOrAmountError = (checkEmpty = false): string | null => {
    if (!trimmedAmount) {
      return checkEmpty ? 'Veuillez saisir un montant valide supérieur à 0 FCFA.' : null;
    }
    if (!isStrictIntegerAmount || !Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
      return 'Veuillez saisir un montant entier valide supérieur à 0 FCFA.';
    }
    if (numericAmount < MIN_FUND_AMOUNT) {
      return `Le montant minimum autorisé est de ${MIN_FUND_AMOUNT.toLocaleString('fr-FR')} FCFA.`;
    }
    if (operationType === 'retrait') {
      if (effectiveAvailableForWithdrawal <= 0) {
        return `Retrait impossible : votre solde disponible réel est de 0 FCFA${
          pendingWithdrawalsTotal > 0
            ? ` (${pendingWithdrawalsTotal.toLocaleString('fr-FR')} FCFA déjà engagés sur des retraits en attente)`
            : ''
        }.`;
      }
      if (numericAmount > effectiveAvailableForWithdrawal) {
        return `Montant refusé : votre solde disponible réel pour retrait est de ${effectiveAvailableForWithdrawal.toLocaleString(
          'fr-FR'
        )} FCFA${
          pendingWithdrawalsTotal > 0
            ? ` (dont ${pendingWithdrawalsTotal.toLocaleString('fr-FR')} FCFA déjà réservés par vos demandes en attente)`
            : ''
        }.`;
      }
      if (numericAmount > MAX_WITHDRAWAL_PER_TX) {
        return `Le plafond maximal autorisé par retrait est de ${MAX_WITHDRAWAL_PER_TX.toLocaleString('fr-FR')} FCFA.`;
      }
    } else if (numericAmount > MAX_DEPOSIT_PER_TX) {
      return `Le plafond maximal autorisé par dépôt est de ${MAX_DEPOSIT_PER_TX.toLocaleString('fr-FR')} FCFA.`;
    }
    return null;
  };

  const liveAmountError = getWithdrawalOrAmountError(false);
  const noActiveDepotBoutiques = operationType === 'depot' && availableBoutiquesForStep1.length === 0;
  const isStep1Blocked =
    noActiveDepotBoutiques ||
    getWithdrawalOrAmountError(true) !== null ||
    phoneInput.replace(/\D/g, '').length < 8;

  // Handle Step 1 to Step 2 : Validate Form
  const handleValidateStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationError = getWithdrawalOrAmountError(true);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (phoneInput.replace(/\D/g, '').length < 8) {
      setErrorMessage('Veuillez saisir un numéro Mobile Money / WhatsApp valide (8 chiffres minimum).');
      return;
    }

    // Move to Step 2: Review summary
    setFlowStep(2);
  };

  // Handle Step 2 to Step 3 : Final Submit Request (Generates reference and status 'En attente')
  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
    setErrorMessage(null);

    const validationError = getWithdrawalOrAmountError(true);
    if (validationError) {
      setErrorMessage(validationError);
      setFlowStep(1);
      return;
    }

    setIsSubmitting(true);

    const refPrefix = operationType === 'depot' ? 'DEP' : 'RET';
    const reference = `${refPrefix}-${Math.floor(10000 + Math.random() * 90000)}`;
    const sectorInfo = SECTOR_CONTACTS[selectedSector];

    try {
      const newReq = await onSubmitFundRequest({
        reference,
        idempotencyKey,
        type: operationType,
        amount: numericAmount,
        investorId,
        investorName,
        investorEmail,
        investorPhone: `+226 ${phoneInput.trim()}`,
        adminWhatsApp: sectorInfo.number,
        sector: sectorInfo.sector,
        paymentMethod: `${paymentMethod} (+226 ${phoneInput.trim()})`,
        notes: `Demande de ${operationType === 'depot' ? 'dépôt' : 'retrait'} initiée pour le secteur ${sectorInfo.sector}.`
      });

      setSubmittedRequest(newReq);
      setFlowStep(3);
      setIdempotencyKey(generateIdempotencyKey(operationType));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'La demande n’a pas pu être validée par le serveur.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate WhatsApp message according to exact specifications:
  // "Le nom ou l'identifiant de l'investisseur, le numéro de référence, le secteur, le type d'opération, le montant demandé"
  const generateWhatsAppUrl = (req: FundOperationRequest) => {
    const cleanAdminNum = req.adminWhatsApp.replace(/\D/g, '');
    const opLabel = req.type === 'depot' ? 'DÉPÔT' : 'RETRAIT';
    const sectorLabel = req.sector || 'Électronique';
    const msg = `Bonjour Responsable ELECTRO-MEN (${sectorLabel}),
Je suis ${req.investorName} (Identifiant : ${req.investorId}).
Je viens d'enregistrer une demande de ${opLabel} sur l'application ELECTRO-MEN.

• Référence de la demande : ${req.reference}
• Secteur concerné : ${sectorLabel}
• Type d'opération : ${opLabel}
• Montant demandé : ${req.amount.toLocaleString('fr-FR')} FCFA
• Moyen de paiement : ${req.paymentMethod || 'Mobile Money'}

Merci de bien vouloir vérifier et confirmer cette opération dans le système après le règlement.`;

    return `https://wa.me/${cleanAdminNum}?text=${encodeURIComponent(msg)}`;
  };

  const getStatusBadge = (status: FundOperationRequest['status']) => {
    switch (status) {
      case 'En attente':
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span>En attente</span>
          </span>
        );
      case 'En cours de traitement':
        return (
          <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300 text-[10px] font-extrabold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-spin"></span>
            <span>En cours de traitement</span>
          </span>
        );
      case 'Confirmé':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
            <span>Confirmé</span>
          </span>
        );
      case 'Refusé':
        return (
          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-300 text-[10px] font-extrabold flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-red-600">cancel</span>
            <span>Refusé</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
            <div>
              <h2 className="font-syne text-[16px] font-bold text-slate-900">
                Portefeuille Investisseur • {investorName}
              </h2>
              <span className="text-[11px] text-cyan-700 font-medium">
                Dépôts &amp; Retraits Sécurisés • Validation par l'Administrateur
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

        {/* Current Balance Banner */}
        <div className="p-4 bg-gradient-to-r from-amber-50/70 via-white to-cyan-50/50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
              Solde Disponible Cash
            </span>
            <div className="font-syne text-[24px] font-extrabold text-amber-800">
              {wallet.balance.toLocaleString('fr-FR')}{' '}
              <span className="text-[13px] text-slate-600 font-bold">FCFA</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-cyan-800 uppercase tracking-wider block font-bold">
              Parts Détenues
            </span>
            <span className="font-syne text-[16px] text-cyan-700 font-bold">
              {wallet.sharesCount.toLocaleString('fr-FR')} parts
            </span>
            <span className="text-[10px] text-slate-500 block">Valeur variable selon les opérations</span>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 pt-2 gap-2 text-xs">
          <button
            onClick={() => {
              setActiveTab('operations');
              setFlowStep(1);
            }}
            className={`pb-2.5 px-3 font-bold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'operations'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">swap_horiz</span>
            <span>Dépôt / Retrait</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-2.5 px-3 font-bold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'requests'
                ? 'border-cyan-600 text-cyan-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            <span>Mes Demandes ({myRequests.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 font-bold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">history</span>
            <span>Mouvements Confirmés ({transactions.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto no-scrollbar space-y-4 flex-1 text-xs text-slate-600">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: 5-STEP DEPOSIT / WITHDRAWAL OPERATION */}
          {activeTab === 'operations' && (
            <div className="space-y-4">
              {/* FLOW STEP 1: CHOOSE TYPE & ENTER AMOUNT */}
              {flowStep === 1 && (
                <form onSubmit={handleValidateStep} className="space-y-4">
                  {/* Step 1 : Choisir « Déposer de l'argent » ou « Retirer de l'argent » */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-800 font-extrabold uppercase tracking-wide block">
                      Étape 1 : Choisissez l'opération souhaitée :
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setOperationType('depot');
                          setErrorMessage(null);
                          setIdempotencyKey(generateIdempotencyKey('depot'));
                        }}
                        className={`p-3.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          operationType === 'depot'
                            ? 'border-amber-500 bg-amber-50 text-amber-950 font-extrabold shadow-sm'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="material-symbols-outlined text-2xl text-amber-600">add_circle</span>
                        <span className="text-xs">Déposer de l'argent</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOperationType('retrait');
                          setErrorMessage(null);
                          setIdempotencyKey(generateIdempotencyKey('retrait'));
                        }}
                        className={`p-3.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          operationType === 'retrait'
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-950 font-extrabold shadow-sm'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="material-symbols-outlined text-2xl text-cyan-600">payments</span>
                        <span className="text-xs">Retirer de l'argent</span>
                      </button>
                    </div>
                  </div>

                  {/* Step 2 : Saisir le montant souhaité */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-800 font-extrabold uppercase tracking-wide block">
                      Étape 2 : Saisissez le montant souhaité (FCFA) :
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {['5000', '10000', '25000', '50000'].map((val) => {
                        const presetNum = parseInt(val, 10);
                        const presetDisabled =
                          operationType === 'retrait' && presetNum > effectiveAvailableForWithdrawal;
                        return (
                          <button
                            key={val}
                            type="button"
                            disabled={presetDisabled}
                            onClick={() => {
                              setAmountInput(val);
                              setErrorMessage(null);
                              setIdempotencyKey(generateIdempotencyKey(operationType));
                            }}
                            className={`py-2 px-1 rounded-xl text-center transition-all font-syne font-bold text-xs ${
                              presetDisabled
                                ? 'border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                                : amountInput === val
                                ? 'border-2 border-amber-500 bg-amber-50 text-amber-900 shadow-sm cursor-pointer'
                                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 cursor-pointer'
                            }`}
                          >
                            {presetNum.toLocaleString('fr-FR')} F
                          </button>
                        );
                      })}
                    </div>

                    <div className="relative mt-2">
                      <input
                        type="number"
                        min={MIN_FUND_AMOUNT}
                        max={operationType === 'retrait' ? Math.max(MIN_FUND_AMOUNT, effectiveAvailableForWithdrawal) : MAX_DEPOSIT_PER_TX}
                        step="1"
                        required
                        value={amountInput}
                        onChange={(e) => {
                          setAmountInput(e.target.value);
                          setErrorMessage(null);
                          setIdempotencyKey(generateIdempotencyKey(operationType));
                        }}
                        placeholder="Montant personnalisé..."
                        className={`w-full bg-slate-50 border rounded-xl p-2.5 text-xs text-slate-900 font-syne font-bold focus:bg-white outline-none pr-14 ${
                          liveAmountError
                            ? 'border-red-400 focus:border-red-500 bg-red-50/40'
                            : 'border-slate-200 focus:border-amber-500'
                        }`}
                      />
                      <span className="absolute right-3 top-2.5 text-[11px] text-slate-500 font-bold">FCFA</span>
                    </div>

                    {operationType === 'retrait' && (
                      <div className="space-y-1">
                        <p className="text-[11px] text-cyan-800 font-medium">
                          Solde disponible réel pour retrait :{' '}
                          <strong>{effectiveAvailableForWithdrawal.toLocaleString('fr-FR')} FCFA</strong>
                          {pendingWithdrawalsTotal > 0 && (
                            <span className="text-amber-800">
                              {' '}
                              ({pendingWithdrawalsTotal.toLocaleString('fr-FR')} FCFA réservés sur retraits en attente)
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {liveAmountError && (
                      <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">block</span>
                        <span>{liveAmountError}</span>
                      </div>
                    )}
                  </div>

                  {/* Moyen de Paiement Mobile Money */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-800 font-bold uppercase block">
                      Opérateur Mobile Money ou Virement :
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'Orange Money', label: 'Orange Money Burkina', icon: 'phone_android' },
                        { id: 'Moov Money', label: 'Moov Money Burkina', icon: 'smartphone' },
                        { id: 'Wave', label: 'Wave Mobile Money', icon: 'waves' },
                        { id: 'Virement / Espèces', label: 'Virement / Espèces Siège', icon: 'account_balance' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id as any)}
                          className={`p-2.5 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                            paymentMethod === m.id
                              ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-xs'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base text-amber-600">{m.icon}</span>
                          <span className="text-[11px]">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Numéro de téléphone */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-700 font-bold">
                      Numéro WhatsApp / Mobile Money :
                    </label>
                    <div className="flex">
                      <span className="px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-700 text-[11px] font-bold flex items-center">
                        🇧🇫 +226
                      </span>
                      <input
                        type="tel"
                        required
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="70 XX XX XX"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-r-xl p-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Étape : Choix du Secteur d'Investissement & Contact Dédié */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-800 font-extrabold uppercase tracking-wide block">
                      {operationType === 'depot'
                        ? 'Boutique / Secteur Actif (opérations ouvertes) :'
                        : 'Secteur d\'Investissement Concerné :'}
                    </label>
                    {availableBoutiquesForStep1.length === 0 ? (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-semibold flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-amber-700">info</span>
                        <span>Aucune boutique ne dispose d'une opération d'investissement ouverte actuellement.</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {availableBoutiquesForStep1.map((sec) => (
                          <button
                            key={sec.id}
                            type="button"
                            onClick={() => setSelectedSector(sec.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                              selectedSector === sec.id
                                ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-xs'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-base text-amber-600">{sec.icon}</span>
                              <span className="text-xs">{sec.sector}</span>
                            </div>
                            <span className="text-[10px] font-mono text-cyan-800 font-semibold">+226 {sec.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bouton 4 : Valider */}
                  <button
                    type="submit"
                    disabled={isStep1Blocked}
                    className={`w-full py-3 rounded-xl font-syne font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm ${
                      isStep1Blocked
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'btn-gold-prestige active:scale-98 cursor-pointer'
                    }`}
                  >
                    <span>
                      {operationType === 'retrait' && liveAmountError
                        ? 'Montant supérieur au solde réel'
                        : 'Valider les Informations'}
                    </span>
                    <span className="material-symbols-outlined text-sm">
                      {operationType === 'retrait' && liveAmountError ? 'lock' : 'arrow_forward'}
                    </span>
                  </button>
                </form>
              )}

              {/* FLOW STEP 2: SUMMARY & SUBMIT REQUEST */}
              {flowStep === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider block">
                      Étape 3 : Récapitulatif de l'Opération
                    </span>

                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="text-xs text-slate-600">Type d'opération :</span>
                      <span className="font-syne text-sm font-black uppercase text-amber-800">
                        {operationType === 'depot' ? 'Dépôt de Fonds' : 'Retrait de Fonds'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="text-xs text-slate-600">Secteur concerné :</span>
                      <span className="font-bold text-slate-900">
                        {SECTOR_CONTACTS[selectedSector].sector}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="text-xs text-slate-600">Montant demandé :</span>
                      <span className="font-syne text-lg font-extrabold text-slate-900">
                        {numericAmount.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>

                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="text-xs text-slate-600">Opérateur :</span>
                      <span className="font-medium text-slate-800">{paymentMethod}</span>
                    </div>

                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="text-xs text-slate-600">Numéro investisseur :</span>
                      <span className="font-mono font-bold text-slate-800">+226 {phoneInput}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Contact WhatsApp du Secteur :</span>
                      <span className="font-mono font-bold text-cyan-800">
                        {SECTOR_CONTACTS[selectedSector].display}
                      </span>
                    </div>
                  </div>

                  {/* Security notice */}
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-[11px] text-amber-900 space-y-1">
                    <span className="font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-amber-700">security</span>
                      <span>Règle de Sécurité des Fonds ELECTRO-MEN</span>
                    </span>
                    <p>
                      Conformément aux règles financières, votre solde <strong>ne sera modifié qu'après validation effective</strong> par l'administrateur suite au règlement réel. Une demande en attente ne modifie jamais le solde.
                    </p>
                  </div>

                  {/* Step 4 & 5 buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setFlowStep(1);
                        setIdempotencyKey(generateIdempotencyKey(operationType));
                      }}
                      className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer disabled:opacity-50"
                    >
                      Modifier
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleFinalSubmit()}
                      className="flex-1 py-3 rounded-xl btn-gold-prestige font-syne font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-base">send</span>
                      <span>{isSubmitting ? 'En attente...' : 'Soumettre ma Demande'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* FLOW STEP 3: SUBMITTED TICKET & WHATSAPP SETTLEMENT */}
              {flowStep === 3 && submittedRequest && (() => {
                const sec = (submittedRequest.sector?.toLowerCase() || '') as keyof typeof SECTOR_CONTACTS;
                const contactInfo = SECTOR_CONTACTS[sec] || SECTOR_CONTACTS.electronique;
                return (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="p-5 rounded-2xl bg-white border-2 border-amber-400 shadow-md space-y-3.5 text-center">
                      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-2xl">pending</span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                          Demande Enregistrée avec Succès
                        </span>
                        <h3 className="font-syne text-lg font-black text-slate-900 mt-0.5">
                          Référence : {submittedRequest.reference}
                        </h3>
                        <div className="mt-1 flex justify-center">
                          {getStatusBadge(submittedRequest.status)}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-left space-y-1.5 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Secteur :</span>
                          <strong className="text-slate-900">{submittedRequest.sector || contactInfo.sector}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Montant :</span>
                          <strong className="text-slate-900">
                            {submittedRequest.amount.toLocaleString('fr-FR')} FCFA
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Opération :</span>
                          <strong className="uppercase text-amber-800">
                            {submittedRequest.type === 'depot' ? 'Dépôt' : 'Retrait'}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Date :</span>
                          <span className="text-slate-700">{submittedRequest.requestedAt}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Investisseur :</span>
                          <span className="text-slate-700">{submittedRequest.investorName}</span>
                        </div>
                      </div>

                      {/* Button: Contacter l'administrateur sur WhatsApp & Fallback Phone */}
                      <div className="pt-1 space-y-2">
                        <a
                          href={generateWhatsAppUrl(submittedRequest)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">chat</span>
                          <span>Contacter l'administrateur sur WhatsApp</span>
                        </a>

                        {/* Fallback Display if WhatsApp cannot open */}
                        <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 text-center">
                          <span>Si WhatsApp ne s'ouvre pas automatiquement, contactez directement le numéro du secteur : </span>
                          <strong className="font-mono text-slate-900 block font-bold mt-0.5">
                            {contactInfo.display}
                          </strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('requests');
                          setFlowStep(1);
                        }}
                        className="text-xs text-cyan-800 hover:underline font-bold pt-2 block mx-auto cursor-pointer"
                      >
                        Consulter le suivi de mes demandes
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: MY PENDING & HISTORICAL REQUESTS */}
          {activeTab === 'requests' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase">
                  Suivi de mes demandes de Dépôt / Retrait
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('operations');
                    setFlowStep(1);
                  }}
                  className="text-xs font-bold text-amber-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Nouvelle Demande</span>
                </button>
              </div>

              {myRequests.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">receipt_long</span>
                  <p className="text-xs">Aucune demande de dépôt ou retrait enregistrée.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {myRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/60 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                              req.type === 'depot' ? 'bg-amber-100 text-amber-800' : 'bg-cyan-100 text-cyan-800'
                            }`}
                          >
                            {req.type === 'depot' ? 'DEP' : 'RET'}
                          </span>
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-900 block">
                              {req.reference}
                            </span>
                            <span className="text-[10px] text-slate-500">{req.requestedAt}</span>
                          </div>
                        </div>

                        <div>{getStatusBadge(req.status)}</div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <span className="text-slate-600 font-medium">{req.paymentMethod || 'Mobile Money'}</span>
                        <span className="font-syne font-bold text-slate-900">
                          {req.type === 'depot' ? '+' : '-'}
                          {req.amount.toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>

                      {req.status === 'Confirmé' && req.validatedBy && (
                        <div className="p-2 rounded bg-emerald-50 text-[10px] text-emerald-800 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">verified</span>
                          <span>Admis par {req.validatedBy} le {req.validatedAt || req.requestedAt}</span>
                        </div>
                      )}

                      {req.status === 'Refusé' && req.rejectionReason && (
                        <div className="p-2 rounded bg-red-50 text-[10px] text-red-700 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">cancel</span>
                          <span>Motif du refus : {req.rejectionReason}</span>
                        </div>
                      )}

                      {req.status === 'En attente' && (() => {
                        const sec = (req.sector?.toLowerCase() || '') as keyof typeof SECTOR_CONTACTS;
                        const contactInfo = SECTOR_CONTACTS[sec] || SECTOR_CONTACTS.electronique;
                        return (
                          <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <a
                              href={generateWhatsAppUrl(req)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#25D366] text-white text-[11px] font-bold"
                            >
                              <span className="material-symbols-outlined text-xs">chat</span>
                              <span>Contacter le Responsable sur WhatsApp ({contactInfo.sector})</span>
                            </a>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Numéro direct : <strong className="text-slate-800">{contactInfo.display}</strong>
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CONFIRMED TRANSACTIONS */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-700 uppercase block">
                Mouvements de Solde Validés &amp; Effectifs
              </span>

              {transactions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">history</span>
                  <p className="text-xs">Aucun mouvement confirmé.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            tx.type === 'depot'
                              ? 'bg-emerald-100 text-emerald-800'
                              : tx.type === 'dividende'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-cyan-100 text-cyan-800'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">
                            {tx.type === 'depot'
                              ? 'arrow_downward'
                              : tx.type === 'dividende'
                              ? 'savings'
                              : 'arrow_upward'}
                          </span>
                        </div>
                        <div>
                          <strong className="text-slate-900 block capitalize">
                            {tx.type === 'achat_parts' ? 'Achat de parts' : tx.type}
                          </strong>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {tx.date} • {tx.method}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-syne font-bold block ${
                            tx.type === 'retrait' || tx.type === 'achat_parts'
                              ? 'text-red-600'
                              : 'text-emerald-700'
                          }`}
                        >
                          {tx.type === 'retrait' || tx.type === 'achat_parts' ? '-' : '+'}
                          {tx.amount.toLocaleString('fr-FR')} FCFA
                        </span>
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                          Confirmé
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
