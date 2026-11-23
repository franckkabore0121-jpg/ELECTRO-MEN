import React, { useState, useEffect } from 'react';
import { InvestmentProject, InvestorProfile, InvestorActivity, InvestorDocument } from '../data/mockData.ts';
import { validatePersonData } from '../utils/validation.ts';

export type InvestorStatus = 'demande_non_soumise' | 'en_attente' | 'approuve' | 'refuse' | 'suspendu' | 'bloque';

export type BoutiqueSector = 'Électronique' | 'Électrotechnique' | 'Informatique';

export interface ShareAllocation {
  id: string;
  sector: BoutiqueSector;
  operationId: string;
  operationTitle: string;
  shares: number;
  amount: number;
  updatedAt?: string;
}

export interface RegisteredInvestor {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  email: string;
  status: InvestorStatus;
  statusReason?: string;
  statusUpdatedAt?: string;
  createdAt: string;
  totalInvested: number;
  sharesCount: number;
  dividendsEarned: number;
  hasPasswordConfigured?: boolean;
  passwordAlgorithm?: string;
  passwordUpdatedAt?: string;
  shareAllocations?: ShareAllocation[];
}

export interface InvestorMessage {
  id: string;
  senderName: string;
  senderPhone?: string;
  senderRole?: 'admin' | 'investor';
  messageType?: 'text' | 'voice';
  audioUrl?: string;
  audioDuration?: number;
  text: string;
  timestamp: string;
  isOfficial?: boolean;
  replyToId?: string;
}

interface InvestorSubscriptionHistory {
  id: string;
  investorId?: string;
  investorName?: string;
  investorEmail?: string;
  investorPhone?: string;
  operationId?: string;
  operationTitle?: string;
  offerId?: string;
  offerTitle?: string;
  shares: number;
  sharePrice?: number;
  totalAmount: number;
  status: string;
  requestedAt: string;
  approvedAt?: string;
  paidAt?: string;
  paymentMethod?: string;
}

interface ScreenBourseIRProps {
  currentProfile?: InvestorProfile | null;
  onInvestorSessionChange?: (investor: InvestorProfile | null) => void;
  onOpenPdfContract: (investorData: { name: string; phone: string; shares: number; total: number; id: string }) => void;
  onGoTab: (tab: any) => void;
  onRequestSubscription: (data: {
    id?: string;
    name: string;
    email: string;
    phone: string;
    shares: number;
    total: number;
    operationId?: string;
    operationTitle?: string;
  }) => string;
  onOpenPayment: (subId: string) => void;
  onOpenWallet: (action?: 'depot' | 'retrait' | 'history') => void;
  onOpenEmailInbox: () => void;
  // External synchronized messaging
  messages?: InvestorMessage[];
  onSendMessage?: (
    text: string,
    senderName: string,
    isOfficial?: boolean,
    voice?: { audioUrl: string; audioDuration?: number }
  ) => void | Promise<void>;
  isMessagingOpen?: boolean;
  projects?: InvestmentProject[];
  activities?: InvestorActivity[];
  documents?: InvestorDocument[];
}

export const ScreenBourseIR: React.FC<ScreenBourseIRProps> = ({
  currentProfile,
  onInvestorSessionChange,
  onOpenPdfContract,
  onRequestSubscription,
  onOpenPayment,
  onOpenWallet,
  onOpenEmailInbox,
  messages: externalMessages,
  onSendMessage: externalOnSendMessage,
  isMessagingOpen = true,
  projects = [],
  activities = [],
  documents = []
}) => {
  const [isPdfRulesModalOpen, setIsPdfRulesModalOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  // Active view among the 4 structured buttons
  const [activeSection, setActiveSection] = useState<'operations' | 'dashboard' | 'activities' | 'messages'>('operations');

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [hasSeenInvestorAccount, setHasSeenInvestorAccount] = useState(() => {
    try {
      return localStorage.getItem('electromen_investor_account_seen') === 'true';
    } catch {
      return false;
    }
  });
  const [authMode, setAuthMode] = useState<'login' | 'register'>(() =>
    hasSeenInvestorAccount ? 'login' : 'register'
  );

  // Registration Form State (no username, real name & prenom validation)
  const [regLastName, setRegLastName] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regPhone, setRegPhone] = useState(currentProfile?.phone || '');
  const [regEmail, setRegEmail] = useState(currentProfile?.email || '');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regTermsAccepted, setRegTermsAccepted] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeInvestor, setActiveInvestor] = useState<RegisteredInvestor | null>(null);
  const [subscriptionHistory, setSubscriptionHistory] = useState<InvestorSubscriptionHistory[]>([]);
  const [subscriptionHistoryLoading, setSubscriptionHistoryLoading] = useState(false);
  const [subscriptionHistoryError, setSubscriptionHistoryError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const rememberInvestorAccount = () => {
    setHasSeenInvestorAccount(true);
    try {
      localStorage.setItem('electromen_investor_account_seen', 'true');
    } catch {
      // The server session remains authoritative when local storage is unavailable.
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetch('/api/investor/me', { credentials: 'same-origin' })
      .then(async (res) => {
        const data = await res.json();
        if (!isMounted) return;
        if (res.ok && data.success && data.investor) {
          setActiveInvestor(data.investor);
          setIsLoggedIn(true);
          onInvestorSessionChange?.({
            id: data.investor.id,
            name: data.investor.name,
            email: data.investor.email,
            phone: data.investor.phone,
            isVerified: Boolean(data.investor.isVerified),
            registeredDate: data.investor.createdAt || ''
          });
          rememberInvestorAccount();
        } else {
          setActiveInvestor(null);
          setIsLoggedIn(false);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setActiveInvestor(null);
        setIsLoggedIn(false);
      })
      .finally(() => {
        if (isMounted) setAuthLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !activeInvestor) {
      setSubscriptionHistory([]);
      setSubscriptionHistoryError(null);
      setSubscriptionHistoryLoading(false);
      return;
    }

    let isActive = true;
    setSubscriptionHistoryLoading(true);
    setSubscriptionHistoryError(null);
    fetch('/api/investor/subscriptions', { credentials: 'same-origin' })
      .then(async (response) => {
        const data = await response.json() as {
          success?: boolean;
          error?: string;
          subscriptions?: InvestorSubscriptionHistory[];
        };
        if (!response.ok || !data.success || !Array.isArray(data.subscriptions)) {
          throw new Error(data.error || 'Impossible de charger votre historique de souscriptions.');
        }
        if (isActive) setSubscriptionHistory(data.subscriptions);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setSubscriptionHistoryError(error instanceof Error ? error.message : 'Le chargement de votre historique a échoué.');
      })
      .finally(() => {
        if (isActive) setSubscriptionHistoryLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [isLoggedIn, activeInvestor?.id]);

  // Real-time polling of approved status from server API
  useEffect(() => {
    if (!isLoggedIn || !activeInvestor) return;

    let isMounted = true;
    const checkLiveStatus = async () => {
      try {
        const queryId = activeInvestor.id || activeInvestor.email;
        if (!queryId) return;
        const res = await fetch(`/api/investor/status/${encodeURIComponent(queryId)}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.success && data.investor) {
            const serverInv = data.investor;
            setActiveInvestor((prev) => {
              if (!prev) return null;
              if (
                prev.status !== serverInv.status ||
                prev.sharesCount !== serverInv.sharesCount ||
                prev.totalInvested !== serverInv.totalInvested ||
                prev.dividendsEarned !== serverInv.dividendsEarned ||
                JSON.stringify(prev.shareAllocations || []) !== JSON.stringify(serverInv.shareAllocations || [])
              ) {
                const nextInv = { ...prev, ...serverInv };
                return nextInv;
              }
              return prev;
            });
          }
        }
      } catch {}
    };

    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isLoggedIn, activeInvestor?.id, activeInvestor?.email]);

  // Participation in funding operation
  const [selectedShares, setSelectedShares] = useState<number>(4);
  const [selectedOperationId, setSelectedOperationId] = useState<string>('');
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [selectedInvestmentBoutique, setSelectedInvestmentBoutique] = useState<'all' | BoutiqueSector>('all');
  const [submittingSub, setSubmittingSub] = useState(false);
  const [subSuccess, setSubSuccess] = useState<string | null>(null);

  // Community Chat Messages + WhatsApp-style Voice Notes
  const [localMessages, setLocalMessages] = useState<InvestorMessage[]>([]);

  const activeMessages = externalMessages || localMessages;
  const [newMessageText, setNewMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDurationSec, setVoiceDurationSec] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioStreamRef = React.useRef<MediaStream | null>(null);
  const voiceChunksRef = React.useRef<Blob[]>([]);
  const voiceTimerRef = React.useRef<number | null>(null);
  const voiceCancelledRef = React.useRef(false);
  const voiceStartTimeRef = React.useRef<number>(0);

  // Handle Investor Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const validation = validatePersonData({
      lastName: regLastName,
      firstName: regFirstName,
      email: regEmail,
      phone: regPhone
    });

    if (!validation.isValid) {
      setRegError(validation.error || 'Veuillez saisir des informations réelles et vérifiables.');
      return;
    }

    if (regPassword.length < 12 || regPassword.length > 128) {
      setRegError('Le mot de passe doit comporter entre 12 et 128 caractères.');
      return;
    }

    if (regPassword !== regPasswordConfirm) {
      setRegError('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    if (!regTermsAccepted) {
      setRegError('Vous devez accepter les Conditions Générales et la Charte des Investisseurs.');
      return;
    }

    const normalizedEmail = regEmail.trim().toLowerCase();
    setRegLoading(true);

    try {
      const cleanDigits = regPhone.replace(/\D/g, '');
      const formattedPhone = cleanDigits.startsWith('226') ? `+${cleanDigits}` : `+226 ${cleanDigits}`;

      const res = await fetch('/api/investor/register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastName: regLastName.trim(),
          firstName: regFirstName.trim(),
          email: normalizedEmail,
          phone: formattedPhone,
          password: regPassword,
          termsAccepted: true
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setRegError(data.error || 'La création du compte a échoué.');
        return;
      }

      const investor: RegisteredInvestor = {
        ...data.investor,
        status: data.investor.status || 'en_attente',
        createdAt: data.investor.createdAt || new Date().toLocaleDateString('fr-FR'),
        totalInvested: data.investor.totalInvested || 0,
        sharesCount: data.investor.sharesCount || 0,
        dividendsEarned: data.investor.dividendsEarned || 0
      };
      setActiveInvestor(investor);
      setIsLoggedIn(true);
      onInvestorSessionChange?.({
        id: investor.id,
        name: investor.name,
        email: investor.email,
        phone: investor.phone,
        isVerified: Boolean(data.investor.isVerified),
        registeredDate: investor.createdAt
      });
      rememberInvestorAccount();
      setRegPassword('');
      setRegPasswordConfirm('');
    } catch {
      setRegError('Le serveur est momentanément indisponible. Votre compte n’a pas été créé, veuillez réessayer.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch('/api/investor/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.investor) {
        setLoginError(data.error || 'Adresse e-mail ou mot de passe incorrect.');
        return;
      }
      setActiveInvestor(data.investor);
      setIsLoggedIn(true);
      onInvestorSessionChange?.({
        id: data.investor.id,
        name: data.investor.name,
        email: data.investor.email,
        phone: data.investor.phone,
        isVerified: Boolean(data.investor.isVerified),
        registeredDate: data.investor.createdAt || ''
      });
      rememberInvestorAccount();
    } catch {
      setLoginError('La connexion est momentanément indisponible. Veuillez réessayer.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeMessage(null);
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('La confirmation du nouveau mot de passe ne correspond pas.');
      return;
    }
    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/investor/change-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Le changement de mot de passe a échoué.');
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordChangeMessage(result.message || 'Votre mot de passe a été modifié.');
    } catch (error) {
      setPasswordChangeError(error instanceof Error ? error.message : 'Le changement de mot de passe a échoué.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/investor/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
      if (!res.ok) throw new Error('logout failed');
      setIsLoggedIn(false);
      setActiveInvestor(null);
      setAuthMode('login');
      setLoginEmail('');
      setLoginPassword('');
      setLoginError(null);
      onInvestorSessionChange?.(null);
    } catch {
      window.alert('La déconnexion n’a pas pu être confirmée. Veuillez réessayer.');
    }
  };

  // Handle funding subscription (requiert compte approuvé & sélection opération + offre)
  const handleParticipate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingSub) return;
    if (!isLoggedIn || !activeInvestor) {
      alert("Accès refusé : Vous devez impérativement créer un compte investisseur avant d'accéder à l'achat de parts.");
      return;
    }
    if (activeInvestor.status !== 'approuve') {
      alert(`Accès restreint : Votre compte investisseur est actuellement "${activeInvestor.status === 'en_attente' ? 'en cours de validation administrative' : activeInvestor.status}". L'achat de parts sera débloqué dès l'approbation formelle de votre compte par l'administrateur.`);
      return;
    }
    const currentOpId = selectedOperationId || operationsList[0]?.id;
    if (!currentOpId) {
      alert("Veuillez sélectionner l'opération ou l'offre de financement souhaitée.");
      return;
    }
    if (!selectedSharePrice || selectedShares > remainingShares) {
      alert('Le prix ou le nombre de parts disponibles pour cette opération est invalide.');
      return;
    }

    const currentInv = activeInvestor;
    const idempotencyKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `sub-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
        : `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    setSubmittingSub(true);
    let createdSubscription: InvestorSubscriptionHistory | undefined;

    try {
      const response = await fetch('/api/investor/subscribe-shares', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          idempotencyKey,
          investorId: currentInv.id,
          operationId: currentOpId,
          offerId: selectedOffer?.id || selectedOfferId || 'standard',
          sharesCount: selectedShares,
          amount: selectedShares * selectedSharePrice
        })
      });
      const result = await response.json() as {
        success?: boolean;
        error?: string;
        subscription?: InvestorSubscriptionHistory;
      };
      if (!response.ok || !result.success) {
        alert(result.error || 'La souscription a échoué. Veuillez réessayer.');
        return;
      }
      if (!result.subscription || typeof result.subscription.id !== 'string') {
        alert('Le serveur n’a pas renvoyé la souscription enregistrée. Veuillez actualiser votre espace.');
        return;
      }
      createdSubscription = result.subscription;
    } catch {
      alert('Le serveur est momentanément indisponible. Votre souscription n’a pas été enregistrée.');
      return;
    } finally {
      setSubmittingSub(false);
    }

    if (createdSubscription) {
      const newSubscription = createdSubscription;
      setSubscriptionHistory((previous) => [
        newSubscription,
        ...previous.filter((item) => item.id !== newSubscription.id)
      ]);
      const generatedId = onRequestSubscription({
        id: newSubscription.id,
        name: currentInv.name,
        email: currentInv.email,
        phone: currentInv.phone,
        shares: newSubscription.shares || selectedShares,
        total: newSubscription.totalAmount || (selectedShares * selectedSharePrice),
        operationId: newSubscription.operationId || currentOpId,
        operationTitle: newSubscription.operationTitle || selectedOp?.title
      });
      setSubSuccess(generatedId);
    }
  };

  React.useEffect(() => {
    return () => {
      if (voiceTimerRef.current !== null) window.clearInterval(voiceTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        voiceCancelledRef.current = true;
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const stopVoiceRecording = (cancel = false) => {
    voiceCancelledRef.current = cancel;
    if (voiceTimerRef.current !== null) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      setIsRecordingVoice(false);
      setVoiceDurationSec(0);
    }
  };

  const startVoiceRecording = async () => {
    if (!activeInvestor || !isMessagingOpen || isRecordingVoice || isSendingMessage) return;
    setVoiceError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('Votre navigateur ne prend pas en charge l’enregistrement audio.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const candidateTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const chosenType = candidateTypes.find((type) =>
        typeof MediaRecorder.isTypeSupported === 'function' ? MediaRecorder.isTypeSupported(type) : false
      );
      const recorder = chosenType ? new MediaRecorder(stream, { mimeType: chosenType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      voiceCancelledRef.current = false;
      voiceStartTimeRef.current = Date.now();
      setVoiceDurationSec(0);
      setIsRecordingVoice(true);

      voiceTimerRef.current = window.setInterval(() => {
        setVoiceDurationSec(Math.max(1, Math.round((Date.now() - voiceStartTimeRef.current) / 1000)));
      }, 400);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const wasCancelled = voiceCancelledRef.current;
        const elapsedSec = Math.max(1, Math.round((Date.now() - voiceStartTimeRef.current) / 1000));
        if (voiceTimerRef.current !== null) {
          window.clearInterval(voiceTimerRef.current);
          voiceTimerRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
        setIsRecordingVoice(false);
        setVoiceDurationSec(0);
        if (wasCancelled) return;

        const mimeType = recorder.mimeType || chosenType || 'audio/webm';
        const blob = new Blob(voiceChunksRef.current, { type: mimeType });
        if (blob.size < 128) {
          setVoiceError('Enregistrement audio trop court.');
          return;
        }
        setIsSendingMessage(true);
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Lecture audio impossible.'));
            reader.readAsDataURL(blob);
          });
          const uploadRes = await fetch('/api/messages/voice', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileBase64: dataUrl, mimeType })
          });
          const uploadData = await uploadRes.json();
          if (!uploadRes.ok || !uploadData.success || !uploadData.url) {
            throw new Error(uploadData.error || 'Échec du téléversement du message vocal.');
          }
          if (externalOnSendMessage) {
            await externalOnSendMessage('Message vocal', activeInvestor.name, false, {
              audioUrl: uploadData.url,
              audioDuration: elapsedSec
            });
          } else {
            setLocalMessages((prev) => [
              ...prev,
              {
                id: `msg-${Date.now()}`,
                senderName: activeInvestor.name,
                senderPhone: activeInvestor.phone,
                senderRole: 'investor',
                messageType: 'voice',
                audioUrl: uploadData.url,
                audioDuration: elapsedSec,
                text: 'Message vocal',
                timestamp: 'À l’instant'
              }
            ]);
          }
        } catch (err) {
          setVoiceError(err instanceof Error ? err.message : 'Erreur lors de l’envoi du message vocal.');
        } finally {
          setIsSendingMessage(false);
        }
      };

      recorder.start(250);
    } catch {
      setVoiceError('Accès au microphone refusé ou indisponible.');
      setIsRecordingVoice(false);
    }
  };

  // Handle Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !activeInvestor || isSendingMessage) return;
    if (!isMessagingOpen) {
      alert('La messagerie est actuellement fermée par l’administrateur.');
      return;
    }

    const cleanText = newMessageText.trim();
    if (externalOnSendMessage) {
      setIsSendingMessage(true);
      try {
        await externalOnSendMessage(cleanText, activeInvestor.name, false);
        setNewMessageText('');
      } finally {
        setIsSendingMessage(false);
      }
    } else {
      const newMsg: InvestorMessage = {
        id: `msg-${Date.now()}`,
        senderName: activeInvestor.name,
        senderPhone: activeInvestor.phone,
        text: cleanText,
        timestamp: 'À l’instant'
      };
      setLocalMessages((prev) => [...prev, newMsg]);
      setNewMessageText('');
    }
  };

  const getSectorContact = (categoryStr: string, sectorStr?: string) => {
    const s = `${sectorStr || ''} ${categoryStr || ''}`.toLowerCase();
    if (s.includes('puissance') || s.includes('électrotechnique')) {
      return { number: '+22607315734', display: '+226 07 31 57 34', raw: '07315734', name: 'Électrotechnique' };
    }
    if (s.includes('informatique')) {
      return { number: '+22656283526', display: '+226 56 28 35 26', raw: '56283526', name: 'Informatique' };
    }
    return { number: '+22665484738', display: '+226 65 48 47 38', raw: '65484738', name: 'Électronique' };
  };

  // List of funding operations: purely dynamic from admin published projects (empty when none open)
  const operationsList = React.useMemo(() => {
    if (projects && projects.length > 0) {
      const published = projects.filter((p) => p.isPublished !== false && p.offerStatus !== 'Brouillon');
      return published.map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        yieldAnnual: p.yield,
        status: p.duration ? `Cycle ${p.cycleNumber || 1} • ${p.duration}` : 'En cours',
        description: p.description,
        offerStatus: p.offerStatus || (p.status === 'completed' ? 'Fermé' : 'Ouvert'),
        sector: (p.sector || (p.category.toLowerCase().includes('électrotechnique') ? 'Électrotechnique' : p.category.toLowerCase().includes('informatique') ? 'Informatique' : 'Électronique')) as BoutiqueSector,
        objective: p.objective || p.description,
        conditions: p.conditions || 'Le prix unitaire et le quota de parts sont définis pour chaque opération.',
        sharePrice: p.sharePrice ?? p.offers?.[0]?.sharePrice ?? 0,
        availableShares: p.availableShares ?? 0,
        subscribedShares: p.subscribedShares ?? 0,
        offers: (p.offers && p.offers.length > 0) ? p.offers : [
          {
            id: `off-${p.id}-std`,
            title: `Offre Principale - ${p.title}`,
            description: 'Souscription standard aux dividendes d’exploitation avec redistribution trimestrielle.',
            sharePrice: p.sharePrice ?? 0,
            minShares: 1,
            maxShares: 1000,
            status: 'Ouverte' as const
          }
        ]
      }));
    }
    return [];
  }, [projects]);

  const activeOpenBoutiques = React.useMemo(() => {
    const sectors = new Set<BoutiqueSector>();
    operationsList.forEach((op) => {
      if (op.offerStatus === 'Ouvert') {
        sectors.add(op.sector);
      }
    });
    return Array.from(sectors);
  }, [operationsList]);

  React.useEffect(() => {
    if (selectedInvestmentBoutique !== 'all' && !activeOpenBoutiques.includes(selectedInvestmentBoutique)) {
      setSelectedInvestmentBoutique('all');
    }
  }, [activeOpenBoutiques, selectedInvestmentBoutique]);

  const filteredOperationsList = React.useMemo(() => {
    if (selectedInvestmentBoutique === 'all') return operationsList;
    return operationsList.filter((op) => op.sector === selectedInvestmentBoutique && op.offerStatus === 'Ouvert');
  }, [operationsList, selectedInvestmentBoutique]);

  const selectedOp = operationsList.find((o) => o.id === selectedOperationId) || operationsList[0] || null;
  const currentOffers = selectedOp?.offers || [];
  const selectedOffer = currentOffers.find((off) => off.id === selectedOfferId) || currentOffers[0] || null;
  const selectedSharePrice = Number(selectedOp?.sharePrice ?? selectedOffer?.sharePrice ?? 0);
  const remainingShares = Math.max(0, (selectedOp?.availableShares || 0) - (selectedOp?.subscribedShares || 0));
  const hasOpenOffers = operationsList.some((o) => o.offerStatus === 'Ouvert');

  return (
    <div className="space-y-6 pb-12 animate-fadeIn text-[#0f172a] bg-white">
      {/* =========================================================================
          EN-TÊTE INVESTISSEURS : DÉCORÉE PAR LE LOGO OFFICIEL DE L'ENTREPRISE
          ========================================================================= */}
      {/* =========================================================================
          EN-TÊTE INVESTISSEURS : CASE ÉPURÉE (DEMANDE UTILISATEUR)
          "ELECTRO-MEN / Prix par opération / Espace & Tableau de Bord des Investisseurs"
          ========================================================================= */}
      <section className="p-4 sm:p-5 bg-white rounded-2xl border-2 border-amber-400 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="space-y-1">
            <h2 className="font-syne text-xl sm:text-2xl font-black text-slate-900 uppercase">
              ELECTRO-MEN
            </h2>
            <div className="text-amber-800 font-extrabold text-sm sm:text-base font-mono">
              Prix et quota définis par opération
            </div>
            <h1 className="font-syne text-sm sm:text-base font-bold text-slate-700">
              Espace &amp; Tableau de Bord des Investissements
            </h1>
          </div>

          {/* Boutons Références de Compte et Déconnexion */}
          {isLoggedIn && (
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAccountModal(true)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-sm text-amber-600">badge</span>
                <span>Références du Compte</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
                <span>Déconnexion</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          SI L'INVESTISSEUR N'EST PAS CONNECTÉ :
          CRÉATION DE COMPTE (AVEC MOT DE PASSE AUTOMATIQUEMENT ATTRIBUÉ ET ACCESSIBLE À L'ADMIN)
          ========================================================================= */}
      {!isLoggedIn || !activeInvestor ? (
        <section className="max-w-xl mx-auto p-5 sm:p-6 bg-white rounded-2xl border-2 border-amber-400 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 text-2xl">account_circle</span>
              <h2 className="font-syne text-lg font-extrabold text-slate-900">
                {authMode === 'register' ? 'Devenir Investisseur ELECTRO-MEN' : 'Connexion à votre Espace Investisseur'}
              </h2>
            </div>
            {(authMode === 'register' || !hasSeenInvestorAccount) && (
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'register' ? 'login' : 'register');
                  setLoginError(null);
                }}
                className="text-xs text-cyan-700 hover:underline font-medium"
              >
                {authMode === 'register' ? 'Déjà un compte ? Se connecter' : 'Créer un compte'}
              </button>
            )}
          </div>

          {authLoading ? (
            <div className="py-6 text-center text-xs text-slate-500">Vérification de votre session...</div>
          ) : authMode === 'register' ? (
                <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 font-medium">
                    Renseignez vos informations réelles. Un compte unique est créé après vérification des coordonnées et vous accédez immédiatement à votre espace investisseur.
                  </div>

                  {regError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-700 text-xs font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm shrink-0">error</span>
                      <span>{regError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                        Nom de Famille Réel *
                      </label>
                      <input
                        type="text"
                        required
                        value={regLastName}
                        onChange={(e) => setRegLastName(e.target.value)}
                        placeholder="Ex: OUEDRAOGO"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none uppercase font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                        Prénom(s) Réel(s) *
                      </label>
                      <input
                        type="text"
                        required
                        value={regFirstName}
                        onChange={(e) => setRegFirstName(e.target.value)}
                        placeholder="Ex: Ibrahim"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                      Numéro WhatsApp Réel *
                    </label>
                    <div className="flex">
                      <span className="px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-700 font-bold flex items-center">
                        🇧🇫 +226
                      </span>
                      <input
                        type="tel"
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="70 00 00 00"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-r-xl p-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                      Adresse Email Réelle *
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                        Mot de Passe Sécurisé *
                      </label>
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        minLength={12}
                        maxLength={128}
                        placeholder="12 caractères minimum"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                        Confirmation Mot de Passe *
                      </label>
                      <input
                        type="password"
                        required
                        value={regPasswordConfirm}
                        onChange={(e) => setRegPasswordConfirm(e.target.value)}
                        minLength={12}
                        maxLength={128}
                        placeholder="Répétez le mot de passe"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <input
                      type="checkbox"
                      id="terms-investor"
                      checked={regTermsAccepted}
                      onChange={(e) => setRegTermsAccepted(e.target.checked)}
                      className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <label htmlFor="terms-investor" className="text-[11px] text-slate-700 leading-snug">
                      J'atteste sur l'honneur l'exactitude de mes informations et j'accepte les Conditions Générales et la Charte des Investisseurs ELECTRO-MEN.
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={regLoading}
                    className="w-full py-3.5 px-4 rounded-xl btn-gold-prestige font-bold text-xs uppercase tracking-wider shadow-md cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">verified</span>
                    <span>{regLoading ? 'Création du compte...' : 'Créer mon compte et accéder à mon espace'}</span>
                  </button>
                </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                  Adresse e-mail
                </label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  maxLength={128}
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>

              {loginError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-300 text-red-700 text-xs font-semibold">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3.5 px-4 rounded-xl btn-gold-prestige font-bold text-xs uppercase tracking-wider shadow-md cursor-pointer active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
              >
                <span className="material-symbols-outlined text-base">login</span>
                <span>{loginLoading ? 'Connexion...' : 'Se connecter à mon espace investisseur'}</span>
              </button>
            </form>
          )}
        </section>
      ) : (
        /* =========================================================================
            SI CONNECTÉ : L'INTERFACE STRUCTURÉE AVEC LES 4 BOUTONS DEMANDÉS :
            1. Bouton : Opérations en cours & Participation
            2. Bouton : Tableau de bord (Somme investie & Bénéfices)
            3. Bouton : Activités de l'entreprise (Photos de réussite & Documents)
            4. Bouton : Messagerie entre investisseurs
            ========================================================================= */
        <div className="space-y-6">
          {/* BARRE DE NAVIGATION DES 4 BOUTONS OFFICIELS DE L'INTERFACE INVESTISSEURS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* BOUTON 1 : OPÉRATIONS EN COURS */}
            <button
              type="button"
              onClick={() => setActiveSection('operations')}
              className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer ${
                activeSection === 'operations'
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md font-extrabold'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50/40'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">campaign</span>
              <span className="font-syne text-xs uppercase tracking-wide">
                Opérations en Cours
              </span>
            </button>

            {/* BOUTON 2 : TABLEAU DE BORD (SOMME INVESTIE & BÉNÉFICES) */}
            <button
              type="button"
              onClick={() => setActiveSection('dashboard')}
              className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer ${
                activeSection === 'dashboard'
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md font-extrabold'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50/40'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">dashboard</span>
              <span className="font-syne text-xs uppercase tracking-wide">
                Tableau de Bord
              </span>
            </button>

            {/* BOUTON 3 : ACTIVITÉS & PHOTOS DE RÉUSSITE & DOCUMENTS */}
            <button
              type="button"
              onClick={() => setActiveSection('activities')}
              className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer ${
                activeSection === 'activities'
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md font-extrabold'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50/40'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">workspace_premium</span>
              <span className="font-syne text-xs uppercase tracking-wide">
                Activités &amp; Documents
              </span>
            </button>

            {/* BOUTON 4 : MESSAGERIE ENTRE INVESTISSEURS */}
            <button
              type="button"
              onClick={() => setActiveSection('messages')}
              className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer relative ${
                activeSection === 'messages'
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md font-extrabold'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50/40'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">forum</span>
              <span className="font-syne text-xs uppercase tracking-wide">
                Messagerie Investisseurs
              </span>
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-600 animate-ping"></span>
            </button>
          </div>

          {/* =========================================================================
              CONTENU 1 : OPÉRATIONS DE REGROUPEMENT DE FONDS EN COURS & PARTICIPATION
              ========================================================================= */}
          {activeSection === 'operations' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                  Financement Participatif Industriel
                </span>
                <h2 className="font-syne text-xl font-black text-slate-900">
                  Opérations &amp; Offres d'Investissement
                </h2>
                <p className="text-xs text-slate-600">
                  Chaque opération définit son propre prix unitaire et son nombre de parts disponibles.
                </p>
              </div>

              {/* BANDEAU SI AUCUNE OFFRE N'EST OUVERTE */}
              {!hasOpenOffers && (
                <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-700 text-xl">info</span>
                    <h3 className="font-syne text-sm font-bold">Aucun investissement en cours</h3>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Aucune offre d'investissement n'est actuellement ouverte. Vous pouvez consulter les projets clôturés et contacter les boutiques concernées pour obtenir davantage d'informations.
                  </p>
                </div>
              )}

              {/* Opérations sous forme de boutons ou état vierge */}
              {operationsList.length === 0 ? (
                <div className="p-8 sm:p-12 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-3xl">campaign</span>
                  </div>
                  <h3 className="font-syne text-base font-bold text-slate-800">
                    Aucune opération ou offre de financement en cours
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    L'espace investissement sera automatiquement accessible dès que l'administrateur aura publié une nouvelle opération de financement participatif avec ses conditions officielles.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeOpenBoutiques.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600 mr-1">
                        Boutiques ouvertes à l'investissement :
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedInvestmentBoutique('all')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                          selectedInvestmentBoutique === 'all'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        Toutes ({operationsList.length})
                      </button>
                      {activeOpenBoutiques.map((boutique) => (
                        <button
                          key={boutique}
                          type="button"
                          onClick={() => setSelectedInvestmentBoutique(boutique)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                            selectedInvestmentBoutique === boutique
                              ? 'bg-amber-500 text-slate-950 border-amber-600'
                              : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                          }`}
                        >
                          {boutique} (Ouvert)
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                    Offres &amp; Projets (Sélectionnez un projet pour consulter les conditions autorisées) :
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {filteredOperationsList.map((op) => {
                      const isSelected = selectedOperationId === op.id || (!selectedOperationId && op.id === filteredOperationsList[0]?.id);
                      const isOpClosed = op.offerStatus === 'Fermé';
                      return (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => {
                            setSelectedOperationId(op.id);
                            if (op.offers && op.offers.length > 0) {
                              setSelectedOfferId(op.offers[0].id);
                            }
                            setTimeout(() => {
                              const target = document.getElementById('investment-action-section');
                              if (target) {
                                target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                              }
                            }, 50);
                          }}
                          className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                            isSelected
                              ? 'bg-amber-50 border-amber-500 shadow-md ring-1 ring-amber-400'
                              : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 uppercase">
                              {op.category}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                isOpClosed
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isOpClosed ? 'Clôturé' : 'Ouvert'}
                            </span>
                          </div>
                          <h3 className="font-syne text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                            {op.title}
                          </h3>
                          <div className="text-[11px] font-extrabold text-emerald-700 flex justify-between items-center pt-1 border-t border-slate-100">
                            <span>{(op.sharePrice || 0).toLocaleString('fr-FR')} FCFA / part • {Math.max(0, (op.availableShares || 0) - (op.subscribedShares || 0))} restante(s)</span>
                            {activeInvestor?.status === 'approuve' && !isOpClosed && (op.availableShares || 0) > (op.subscribedShares || 0) ? (
                              <span className="px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] flex items-center gap-1 shadow-2xs">
                                Investir <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-normal">
                                {isSelected ? '● Sélectionné' : 'Voir conditions'}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Détails de l'Opération Sélectionnée (Confidentialité stricte des montants globaux) */}
              {selectedOp && (() => {
                const sectorContact = getSectorContact(selectedOp.category, selectedOp.sector);
                const isOpClosed = selectedOp.offerStatus === 'Fermé';
                const isOpSuspended = selectedOp.offerStatus === 'Suspendu';
                const canInvest = (selectedOp.offerStatus === 'Ouvert' || !selectedOp.offerStatus) &&
                  selectedSharePrice > 0 && remainingShares > 0;

                return (
                  <div id="investment-action-section" className="p-5 rounded-2xl bg-white border-2 border-amber-400 shadow-md space-y-4 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider px-2 py-0.5 bg-amber-100 rounded">
                            {selectedOp.category}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isOpClosed
                                ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                : isOpSuspended
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {isOpClosed ? 'Offre Clôturée' : isOpSuspended ? 'Suspendue' : 'Ouvert à la Souscription'}
                          </span>
                        </div>
                        <h3 className="font-syne text-base sm:text-lg font-bold text-slate-900">
                          {selectedOp.title}
                        </h3>
                        {selectedOp.description && (
                          <p className="text-xs text-slate-600 mt-1">{selectedOp.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg block">
                          {selectedSharePrice.toLocaleString('fr-FR')} FCFA / part
                        </span>
                      </div>
                    </div>

                    {/* Cadre Objectifs & Conditions de Participation (Sans montants globaux secrets) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Objectif du Projet</span>
                        <p className="text-slate-800 font-medium leading-relaxed">
                          {selectedOp.objective || selectedOp.description}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Conditions &amp; Durée</span>
                        <p className="text-slate-800 font-medium">
                          {selectedOp.status || 'Cycle de vente en cours'}
                        </p>
                        <span className="text-[11px] text-slate-500 block mt-1">
                          {selectedOp.conditions || 'Le prix unitaire et le quota de parts sont définis pour cette opération.'}
                        </span>
                      </div>
                    </div>

                    {/* Règle de Répartition Officielle */}
                    <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs space-y-1.5">
                      <span className="font-bold text-amber-950 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-amber-700">gavel</span>
                        <span>Règles Officielles de l'Opération</span>
                      </span>
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        Le prix unitaire de cette opération est de <strong>{selectedSharePrice.toLocaleString('fr-FR')} FCFA</strong>, dans la limite des parts disponibles. Les dividendes éventuels sont répartis selon les règles de l'opération.
                      </p>
                    </div>

                    {/* Contact Boutique WhatsApp dédié par secteur */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Ligne Directe du Secteur</span>
                        <div className="text-xs font-bold text-slate-900">
                          {sectorContact.name} : <span className="font-mono text-cyan-800">{sectorContact.display}</span>
                        </div>
                      </div>
                      <a
                        href={`https://wa.me/${sectorContact.raw}?text=${encodeURIComponent(
                          `Bonjour Administrateur ELECTRO-MEN (${sectorContact.name}),\nJe vous contacte concernant l'offre "${selectedOp.title}".`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold shadow-xs transition-colors shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm">chat</span>
                        <span>Contacter la boutique sur WhatsApp</span>
                      </a>
                    </div>

                    {/* Bloc Souscription si Ouvert, ou blocage sécurisé si Fermé/Suspendu */}
                    {canInvest ? (
                      <div>
                        {activeInvestor?.status !== 'approuve' ? (
                          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 space-y-3">
                            <div className="flex items-center gap-2.5">
                              <span className="material-symbols-outlined text-amber-600 text-2xl">
                                {activeInvestor?.status === 'en_attente' ? 'pending_actions' : 'shield'}
                              </span>
                              <div>
                                <h4 className="font-syne text-sm font-bold">
                                  {activeInvestor?.status === 'en_attente'
                                    ? "Compte Investisseur en Attente d'Approbation"
                                    : `Compte Investisseur : ${activeInvestor?.status || 'Non Approuvé'}`}
                                </h4>
                                <span className="text-[11px] text-amber-800">
                                  Statut du compte : <strong className="uppercase">{activeInvestor?.status || 'demande_non_soumise'}</strong>
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-amber-900 leading-relaxed">
                              {activeInvestor?.status === 'en_attente'
                                ? "Votre dossier d'investisseur a bien été enregistré. Pour garantir la sécurité financière des opérations ELECTRO-MEN, l'achat de parts est strictement réservé aux comptes vérifiés et approuvés manuellement par l'administrateur principal. Dès que votre dossier sera validé, vous pourrez souscrire immédiatement."
                                : activeInvestor?.statusReason || "L'accès à l'achat de parts n'est pas autorisé pour ce compte. Veuillez contacter la direction."}
                            </p>
                            <div className="p-2.5 bg-white/80 rounded-xl border border-amber-300 text-[11px] text-slate-700 font-medium flex items-center gap-2">
                              <span className="material-symbols-outlined text-amber-700 text-base">lock</span>
                              <span>L'achat de parts est temporairement verrouillé jusqu'à validation officielle par l'administration.</span>
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={handleParticipate} className="space-y-4 pt-1 border-t border-slate-100">
                            {/* Étape 1 : Choix de l'Offre au sein de l'Opération */}
                            {currentOffers.length > 0 && (
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm text-amber-600">checklist</span>
                                    <span>Offre d'Investissement Choisie :</span>
                                  </span>
                                  <span className="text-[11px] text-emerald-700 font-bold">
                                    {selectedOffer?.title || 'Offre Standard'}
                                  </span>
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {currentOffers.map((off) => {
                                    const isOffSelected = selectedOfferId === off.id || (!selectedOfferId && off.id === currentOffers[0]?.id);
                                    return (
                                      <button
                                        key={off.id}
                                        type="button"
                                        onClick={() => setSelectedOfferId(off.id)}
                                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer space-y-1 ${
                                          isOffSelected
                                            ? 'bg-amber-50 border-amber-500 shadow-xs ring-1 ring-amber-400'
                                            : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-xs text-slate-900">{off.title}</span>
                                          <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                                            {selectedSharePrice.toLocaleString('fr-FR')} F / part
                                          </span>
                                        </div>
                                        {off.description && (
                                          <p className="text-[11px] text-slate-600 leading-snug">{off.description}</p>
                                        )}
                                        <div className="text-[10px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
                                          <span>Min: {off.minShares || 1} part</span>
                                          <span className="font-bold text-emerald-700">
                                            {isOffSelected ? '✓ Sélectionnée' : 'Sélectionner'}
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Étape 2 : Montant et Parts */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-700 flex justify-between">
                                <span>Nombre de parts à souscrire :</span>
                                <span className="text-amber-700 font-extrabold font-syne text-sm">
                                  {selectedShares} parts = {(selectedShares * selectedSharePrice).toLocaleString('fr-FR')} FCFA
                                </span>
                              </label>

                              {/* Choix rapides prédéfinis */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[1, 2, 4, 8, 12, 20, 50, 100].map((count) => (
                                  <button
                                    key={count}
                                    type="button"
                                    disabled={count > remainingShares}
                                    onClick={() => setSelectedShares(Math.min(count, remainingShares))}
                                    className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                      selectedShares === count
                                        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                                        : count > remainingShares
                                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    {count} {count > 1 ? 'parts' : 'part'} ({(count * selectedSharePrice).toLocaleString('fr-FR')} F)
                                  </button>
                                ))}
                              </div>

                              {/* Saisie Libre */}
                              <div className="pt-1">
                                <label className="text-[11px] text-slate-600 font-bold block mb-1">
                                  Ou saisissez librement le nombre de parts :
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max={remainingShares}
                                  value={Math.min(selectedShares, remainingShares)}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setSelectedShares(isNaN(val) || val < 1 ? 1 : Math.min(val, remainingShares));
                                  }}
                                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl py-2 px-3 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                                  placeholder="Nombre de parts libre..."
                                />
                              </div>
                            </div>

                            {subSuccess && (
                              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
                                  <span>
                                    Demande de souscription <strong>{subSuccess}</strong> enregistrée pour <strong>{selectedShares} parts ({(selectedShares * selectedSharePrice).toLocaleString('fr-FR')} FCFA)</strong> !
                                  </span>
                                </div>
                                <p className="text-[11px] text-emerald-800">
                                  Le règlement effectif se fait directement avec l'administrateur du secteur sur WhatsApp. L'administrateur validera ensuite officiellement vos parts.
                                </p>
                                <a
                                  href={`https://wa.me/${sectorContact.raw}?text=${encodeURIComponent(
                                    `Bonjour Administrateur ELECTRO-MEN, j'ai enregistré ma demande de souscription ${subSuccess} pour ${selectedShares} parts (${(selectedShares * selectedSharePrice).toLocaleString('fr-FR')} FCFA) à l'opération "${selectedOp.title}". Je souhaite procéder au règlement.`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#25D366] text-white font-bold text-xs"
                                >
                                  <span className="material-symbols-outlined text-sm">chat</span>
                                  <span>Régler avec le Responsable sur WhatsApp ({sectorContact.display})</span>
                                </a>
                              </div>
                            )}

                            <div className="pt-2 flex flex-wrap gap-2.5">
                              <button
                                type="submit"
                                disabled={submittingSub || !canInvest || selectedShares > remainingShares}
                                className="flex-1 py-3 px-4 rounded-xl btn-gold-prestige font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <span className="material-symbols-outlined text-base">how_to_reg</span>
                                <span>{submittingSub ? 'En attente...' : 'Investir / Soumettre la Demande'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onOpenPdfContract({
                                  name: activeInvestor?.name || '',
                                  phone: activeInvestor?.phone || '',
                                  shares: selectedShares,
                                  total: selectedShares * selectedSharePrice,
                                  id: activeInvestor?.id || ''
                                })}
                                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-base text-cyan-700">description</span>
                                <span>Contrat</span>
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ) : (
                      /* BLOC INVESTISSEMENT FERMÉ */
                      <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 space-y-2 text-center">
                        <div className="flex items-center justify-center gap-2 text-slate-900 font-bold text-xs">
                          <span className="material-symbols-outlined text-amber-700">lock</span>
                          <span>Investissement fermé / Offre clôturée</span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Cette offre est définitivement clôturée pour les nouvelles souscriptions. Les parts précédemment acquises restent valides et participent aux distributions de bénéfices.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* =========================================================================
              CONTENU 2 : TABLEAU DE BORD (SOMME INVESTIE & BÉNÉFICES)
              ========================================================================= */}
          {activeSection === 'dashboard' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                  Portefeuille Personnel Sécurisé
                </span>
                <h2 className="font-syne text-xl font-black text-slate-900">
                  Tableau de Bord Financier de l'Investisseur
                </h2>
                <p className="text-xs text-slate-600">
                  Visualisez en temps réel la somme que vous avez investie ainsi que vos bénéfices et dividendes.
                </p>
              </div>

              {/* Cartes Clés du Tableau de bord */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* SOMME INVESTIE */}
                <div className="p-4 rounded-2xl bg-white border-2 border-amber-400 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                      Somme Investie
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">account_balance</span>
                    </div>
                  </div>
                  <div className="font-syne text-2xl font-black text-slate-900">
                    {(activeInvestor?.totalInvested || 0).toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-500">FCFA</span>
                  </div>
                  <div className="text-[11px] text-amber-800 font-bold">
                    {activeInvestor?.sharesCount || 0} parts officielles détenues
                  </div>
                </div>

                {/* BÉNÉFICES / DIVIDENDES PERÇUS */}
                <div className="p-4 rounded-2xl bg-white border-2 border-emerald-400 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                      Bénéfices &amp; Dividendes
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">trending_up</span>
                    </div>
                  </div>
                  <div className="font-syne text-2xl font-black text-emerald-700">
                    +{(activeInvestor?.dividendsEarned || 0).toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-500">FCFA</span>
                  </div>
                  <div className="text-[11px] text-emerald-800 font-bold">
                    Rendement annuel estimé : 15% à 18%
                  </div>
                </div>

                {/* VALEUR TOTALE DU PORTEFEUILLE */}
                <div className="p-4 rounded-2xl bg-white border-2 border-cyan-400 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                      Valorisation Totale
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">savings</span>
                    </div>
                  </div>
                  <div className="font-syne text-2xl font-black text-cyan-800">
                    {((activeInvestor?.totalInvested || 0) + (activeInvestor?.dividendsEarned || 0)).toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-500">FCFA</span>
                  </div>
                  <div className="text-[11px] text-cyan-800 font-bold">
                    Capital garanti par actifs réels
                  </div>
                </div>
              </div>

              {/* Détail des parts détenues par Boutique et par Opération */}
              {Array.isArray(activeInvestor?.shareAllocations) && activeInvestor.shareAllocations.length > 0 && (
                <div className="p-4 rounded-2xl bg-white border border-amber-300 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-amber-600 text-lg">pie_chart</span>
                      <span>Répartition de mes parts par Boutique &amp; Opération</span>
                    </h3>
                    <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                      {activeInvestor.shareAllocations.length} ligne(s)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {activeInvestor.shareAllocations.map((alloc) => (
                      <div
                        key={alloc.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div>
                          <span className="inline-block px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 text-[10px] font-bold mb-1">
                            {alloc.sector}
                          </span>
                          <p className="font-bold text-slate-900 leading-snug">{alloc.operationTitle}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-syne font-extrabold text-amber-800">
                            {alloc.shares} part{alloc.shares > 1 ? 's' : ''}
                          </div>
                          <div className="text-[11px] font-mono text-slate-600">
                            {(alloc.amount || 0).toLocaleString('fr-FR')} FCFA
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fiche d'identité Investisseur & Mot de passe attribué */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-syne text-sm font-bold text-slate-900">
                    Informations du Compte Investisseur
                  </h3>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    ID : {activeInvestor?.id || ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Titulaire du compte :</span>
                    <strong className="text-slate-800">{activeInvestor?.name || ''}</strong>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Numéro WhatsApp lié :</span>
                    <strong className="text-slate-800">{activeInvestor?.phone || ''}</strong>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Sécurité du compte :</span>
                    <strong className="text-emerald-700">Mot de passe protégé par chiffrement</strong>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Date d'enregistrement :</span>
                    <strong className="text-slate-800">{activeInvestor?.createdAt || ''}</strong>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenWallet('depot')}
                    className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    <span>Déposer de l'argent</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenWallet('retrait')}
                    className="py-2 px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">payments</span>
                    <span>Retirer de l'argent</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenWallet('history')}
                    className="py-2 px-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm text-amber-400">account_balance_wallet</span>
                    <span>Mon Portefeuille Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenEmailInbox}
                    className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm text-cyan-700">mail</span>
                    <span>Boîte de Réception des Mots de Passe</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div>
                  <h3 className="font-syne text-sm font-bold text-slate-900">Sécurité du compte</h3>
                  <p className="text-[11px] text-slate-500">Vérifiez votre mot de passe actuel pour en choisir un nouveau (12 caractères minimum).</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Mot de passe actuel" className="rounded-lg border border-slate-300 p-2 text-xs" />
                  <input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nouveau mot de passe" className="rounded-lg border border-slate-300 p-2 text-xs" />
                  <input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} placeholder="Confirmer le nouveau mot de passe" className="rounded-lg border border-slate-300 p-2 text-xs" />
                </div>
                {passwordChangeError && <p role="alert" className="text-xs font-semibold text-red-700">{passwordChangeError}</p>}
                {passwordChangeMessage && <p role="status" className="text-xs font-semibold text-emerald-700">{passwordChangeMessage}</p>}
                <button type="submit" disabled={isChangingPassword} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {isChangingPassword ? 'Modification…' : 'Changer mon mot de passe'}
                </button>
              </form>

              <section className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-syne text-sm font-bold text-slate-900">Historique de mes souscriptions</h3>
                  <span className="text-[10px] text-slate-500">{subscriptionHistory.length} opération(s)</span>
                </div>
                {subscriptionHistoryLoading ? (
                  <p className="text-xs text-slate-500">Chargement de votre historique…</p>
                ) : subscriptionHistoryError ? (
                  <p role="alert" className="text-xs font-semibold text-red-700">{subscriptionHistoryError}</p>
                ) : subscriptionHistory.length === 0 ? (
                  <p className="text-xs text-slate-500">Aucune souscription enregistrée pour ce compte.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {subscriptionHistory.map((subscription) => (
                      <li key={subscription.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 first:pt-0 last:pb-0">
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {subscription.operationTitle || subscription.offerTitle || 'Souscription de parts'}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {subscription.requestedAt} • {subscription.shares} part(s) • Prix unitaire : {(subscription.sharePrice || 0).toLocaleString('fr-FR')} FCFA
                          </p>
                          {(subscription.approvedAt || subscription.paidAt || subscription.paymentMethod) && (
                            <p className="text-[10px] text-slate-500">
                              {subscription.approvedAt ? `Validée : ${subscription.approvedAt} ` : ''}
                              {subscription.paidAt ? `Payée : ${subscription.paidAt} ` : ''}
                              {subscription.paymentMethod ? `• ${subscription.paymentMethod}` : ''}
                            </p>
                          )}
                        </div>
                        <div className="sm:text-right">
                          <p className="text-xs font-bold text-slate-900">
                            {(subscription.totalAmount || 0).toLocaleString('fr-FR')} FCFA
                          </p>
                          <p className="text-[10px] text-cyan-800">
                            {subscription.status === 'paid_and_issued'
                              ? 'Parts attribuées'
                              : subscription.status === 'approved_pending_payment'
                                ? 'En attente de paiement'
                                : subscription.status === 'rejected'
                                  ? 'Refusée'
                                  : 'En attente de validation'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {/* =========================================================================
              CONTENU 3 : ACTIVITÉS DE L'ENTREPRISE (PHOTOS DE RÉUSSITE & DOCUMENTS)
              ========================================================================= */}
          {activeSection === 'activities' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                  Réalisations &amp; Transparence
                </span>
                <h2 className="font-syne text-xl font-black text-slate-900">
                  Activités de l'Entreprise, Photos de Réussite &amp; Documents
                </h2>
                <p className="text-xs text-slate-600">
                  Consultez les photos des projets concrétisés et téléchargez les documents légaux et financiers.
                </p>
              </div>

              {/* Réalisations Certifiées des Projets Industriels (Sans images non autorisées) */}
              <div className="space-y-2">
                <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-600">verified</span>
                  <span>Jalons &amp; Réalisations Officielles des Projets Industriels</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {activities.length === 0 ? (
                    <div className="sm:col-span-2 p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                      <span className="material-symbols-outlined text-4xl text-slate-300">photo_library</span>
                      <h4 className="font-syne text-sm font-bold text-slate-800">Aucune activité publiée</h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Les réalisations, photos de projets et jalons industriels apparaîtront ici dès leur publication par l'administrateur.
                      </p>
                    </div>
                  ) : (
                    activities.map((act) => (
                      <div
                        key={act.id}
                        className="rounded-2xl border-2 border-amber-300 bg-amber-50/30 p-4 flex flex-col justify-between gap-3 shadow-xs transition-all hover:shadow-sm"
                      >
                        {(act.imageUrl || act.photoUrl) && (
                          <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 mb-1">
                            <img src={act.imageUrl || act.photoUrl} alt={act.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-800 shadow-2xs shrink-0">
                            <span className="material-symbols-outlined text-2xl text-amber-600">{act.icon || 'precision_manufacturing'}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {act.badge && (
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-300 text-[10px] font-bold">
                                {act.badge}
                              </span>
                            )}
                            {act.sector && (
                              <span className="text-[10px] font-mono text-slate-500 font-semibold">{act.sector}</span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-syne text-sm font-bold text-slate-900">{act.title}</h4>
                          <p className="text-xs text-slate-600 leading-relaxed">{act.description || act.desc}</p>
                          {act.date && (
                            <span className="text-[10px] text-slate-400 font-mono block mt-1">Date : {act.date}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Documents Légaux & Financiers Téléchargeables */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-cyan-700">description</span>
                    <span>Documents Juridiques &amp; Règlement Officiel</span>
                  </h3>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                    Règlement Officiel &amp; RCCM
                  </span>
                </div>

                {/* CARTE VEDETTE : RÈGLEMENT OFFICIEL ELECTRO-MEN (11 PAGES) FOURNI PAR LA DIRECTION */}
                <div className="p-4 sm:p-5 rounded-2xl bg-linear-to-br from-amber-50 via-white to-amber-100/40 border-2 border-amber-400 shadow-md space-y-3.5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-sm shrink-0">
                        <span className="material-symbols-outlined text-2xl">gavel</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-syne text-sm sm:text-base font-black text-slate-900">
                            Règles &amp; Statuts du Groupe d'Investissement ELECTRO-MEN
                          </h4>
                          <span className="px-2 py-0.2 rounded bg-amber-200 text-amber-950 text-[10px] font-mono font-bold">
                            11 Pages Officielles
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium">
                          Signé à Bobo-Dioulasso par <strong className="text-slate-900">M. PARE Badra Aliyou Haidara</strong>, Technicien Supérieur.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white/90 rounded-xl border border-amber-200 text-xs text-slate-700 space-y-1.5 leading-relaxed">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>• <strong>Valeur unitaire :</strong> variable selon l'opération sélectionnée</div>
                      <div>• <strong>Modalité :</strong> Versement direct des dividendes validés</div>
                      <div>• <strong>Droit de vote :</strong> 1 Part = 1 Voix en Assemblée</div>
                      <div>• <strong>Modalités :</strong> Suivi des cycles de commande, rachat &amp; sortie</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <a
                      href="/assets/aistudio/Note_Regle_f4d3053f.pdf"
                      download="Regles_Officielles_ELECTRO-MEN.pdf"
                      className="px-4 py-2 rounded-xl btn-gold-prestige font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                      <span>Télécharger le PDF</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => setIsPdfRulesModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
                    >
                      <span className="material-symbols-outlined text-base text-amber-400">visibility</span>
                      <span>Lire le Document</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {documents.length === 0 ? (
                    <div className="sm:col-span-2 p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400 italic">
                      Aucun document additionnel publié. L'administrateur publiera ici les rapports et bilans officiels.
                    </div>
                  ) : (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => {
                          if (doc.url || doc.fileUrl) {
                            window.open(doc.url || doc.fileUrl, '_blank');
                          } else if (activeInvestor) {
                            onOpenPdfContract({
                              name: activeInvestor.name,
                              phone: activeInvestor.phone,
                              shares: activeInvestor.sharesCount || 0,
                              total: activeInvestor.totalInvested || 0,
                              id: activeInvestor.id
                            });
                          } else {
                            alert(`Document "${doc.title}" disponible auprès de la Direction.`);
                          }
                        }}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-cyan-400 hover:shadow-sm transition-all flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-700 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
                          </div>
                          <div>
                            <h5 className="font-syne text-xs font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">
                              {doc.title}
                            </h5>
                            <span className="text-[10px] text-slate-500">
                              {doc.format || 'PDF Juridique'} • {doc.size || '1.0 Mo'}
                            </span>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-cyan-700 text-lg">
                          download
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              CONTENU 4 : MESSAGERIE ENTRE INVESTISSEURS (RÉSEAU COMMUNAUTAIRE)
              ========================================================================= */}
          {activeSection === 'messages' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-cyan-800 uppercase tracking-wider block">
                  Espace d'Échange Exclusif
                </span>
                <h2 className="font-syne text-xl font-black text-slate-900">
                  Messagerie &amp; Discussion des Investisseurs
                </h2>
                <p className="text-xs text-slate-600">
                  Échangez en direct avec les autres associés, posez vos questions et recevez les réponses de la Direction.
                </p>
              </div>

              {/* BANNIÈRE SI LA MESSAGERIE EST FERMÉE PAR L'ADMINISTRATEUR */}
              {!isMessagingOpen && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 flex items-center gap-3 shadow-sm animate-fadeIn">
                  <span className="material-symbols-outlined text-2xl text-amber-600 shrink-0">lock</span>
                  <div className="text-xs">
                    <strong className="block font-bold">Messagerie Suspendue / Fermée par l'Administrateur</strong>
                    <span>
                      Les nouveaux envois de messages sont temporairement fermés par la Direction. La lecture des messages et annonces officielles reste accessible.
                    </span>
                  </div>
                </div>
              )}

              {/* Boîte de discussion */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col h-[430px]">
                {/* Header du Chat */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isMessagingOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                      }`}
                    ></span>
                    <span className="font-bold text-slate-800">
                      Canal Général des Investisseurs ELECTRO-MEN
                    </span>
                    <span
                      className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                        isMessagingOpen
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {isMessagingOpen ? 'Ouvert' : 'Fermé'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {activeMessages.length} messages
                  </span>
                </div>

                {/* Messages scrollables */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
                  {activeMessages.length === 0 ? (
                    <div className="text-center text-xs text-slate-400 italic py-10">
                      Aucun message dans le canal pour le moment. Soyez le premier à écrire ou envoyer un vocal !
                    </div>
                  ) : (
                    activeMessages.map((msg) => {
                      const isMe = activeInvestor ? msg.senderName === activeInvestor.name : false;
                      const isVoice = msg.messageType === 'voice' || Boolean(msg.audioUrl);
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`text-[11px] font-bold ${
                                msg.isOfficial ? 'text-amber-800' : 'text-slate-800'
                              }`}
                            >
                              {msg.senderName}
                            </span>
                            {msg.isOfficial && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] font-bold flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">verified</span>
                                <span>Direction / Admin</span>
                              </span>
                            )}
                            <span className="text-[9px] text-slate-400">{msg.timestamp}</span>
                          </div>
                          <div
                            className={`p-3 rounded-2xl max-w-sm sm:max-w-md text-xs leading-relaxed shadow-xs space-y-2 ${
                              isMe
                                ? 'bg-slate-900 text-white rounded-tr-none'
                                : msg.isOfficial
                                ? 'bg-amber-100 text-amber-950 border border-amber-300 rounded-tl-none font-medium'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                            }`}
                          >
                            {isVoice && msg.audioUrl ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                  <span className="material-symbols-outlined text-sm">mic</span>
                                  <span>Message vocal{msg.audioDuration ? ` (${msg.audioDuration}s)` : ''}</span>
                                </div>
                                <audio controls preload="metadata" src={msg.audioUrl} className="w-full max-w-[260px] h-9" />
                              </div>
                            ) : (
                              <span>{msg.text}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {voiceError && (
                  <div className="px-3 py-1.5 bg-red-50 border-t border-red-200 text-red-700 text-[11px] font-semibold">
                    {voiceError}
                  </div>
                )}

                {/* Input d'envoi de message texte & vocal */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
                >
                  {isRecordingVoice ? (
                    <>
                      <div className="flex-1 flex items-center gap-2 bg-red-50 border border-red-300 rounded-xl py-2 px-3 text-xs text-red-800 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                        <span>Enregistrement vocal... {voiceDurationSec}s</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => stopVoiceRecording(true)}
                        className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => stopVoiceRecording(false)}
                        className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">send</span>
                        <span>Envoyer vocal</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={!isMessagingOpen || isSendingMessage}
                        onClick={() => void startVoiceRecording()}
                        title="Enregistrer un message vocal"
                        className="p-2 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                      >
                        <span className="material-symbols-outlined text-lg">mic</span>
                      </button>
                      <input
                        type="text"
                        disabled={!isMessagingOpen || isSendingMessage}
                        value={newMessageText}
                        onChange={(e) => setNewMessageText(e.target.value)}
                        placeholder={
                          isMessagingOpen
                            ? 'Écrire un message aux autres associés et à l’administrateur...'
                            : 'La messagerie est actuellement fermée par l’administrateur.'
                        }
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 focus:bg-white focus:border-amber-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      <button
                        type="submit"
                        disabled={!isMessagingOpen || !newMessageText.trim() || isSendingMessage}
                        className="py-2 px-4 rounded-xl btn-gold-prestige font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        <span>{isSendingMessage ? 'En attente...' : 'Envoyer'}</span>
                        <span className="material-symbols-outlined text-sm">send</span>
                      </button>
                    </>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL DE CONSULTATION DU RÈGLEMENT OFFICIEL EN PDF (LECTEUR INTÉGRÉ)
          ========================================================================= */}
      {isPdfRulesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border-2 border-amber-400">
            {/* Header du modal */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-amber-400 text-2xl">menu_book</span>
                <div>
                  <h3 className="font-syne text-sm sm:text-base font-bold text-white">
                    Règles Officielles du Groupe d'Investissement ELECTRO-MEN
                  </h3>
                  <span className="text-[11px] text-slate-300">
                    Document de référence officiel (11 pages) • Signé M. PARE Badra Aliyou Haidara
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/assets/aistudio/Note_Regle_f4d3053f.pdf"
                  download="Regles_Officielles_ELECTRO-MEN.pdf"
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span className="hidden sm:inline">Télécharger</span>
                </a>
                <button
                  type="button"
                  onClick={() => setIsPdfRulesModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>

            {/* Lecteur Iframe du PDF */}
            <div className="flex-1 bg-slate-100">
              <iframe
                src="/assets/aistudio/Note_Regle_f4d3053f.pdf#toolbar=1"
                title="Règles Officielles ELECTRO-MEN"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL RÉFÉRENCES DU COMPTE INVESTISSEUR */}
      {showAccountModal && activeInvestor && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-amber-400">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-xl">badge</span>
                <h3 className="font-syne font-bold text-sm text-white">Références de Votre Compte</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-2.5">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Identifiant Unique :</span>
                  <span className="font-mono font-bold text-slate-900">{activeInvestor.id}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Nom &amp; Prénom :</span>
                  <span className="font-bold text-slate-900">{activeInvestor.name}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">WhatsApp / Tél :</span>
                  <span className="font-semibold text-slate-900">{activeInvestor.phone}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Email :</span>
                  <span className="text-slate-800">{activeInvestor.email}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Parts Détenues :</span>
                  <span className="font-bold text-emerald-700">{activeInvestor.sharesCount} part(s)</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-500">Total Investi Validé :</span>
                  <span className="font-extrabold text-slate-900">{activeInvestor.totalInvested.toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = `Compte Investisseur ELECTRO-MEN\nID: ${activeInvestor.id}\nNom: ${activeInvestor.name}\nTél: ${activeInvestor.phone}\nEmail: ${activeInvestor.email}`;
                    navigator.clipboard.writeText(text);
                    alert('Références copiées dans le presse-papier !');
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  <span>Copier les Références</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
