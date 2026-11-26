import React, { useState, useEffect, useRef } from 'react';
import {
  Product,
  ProductStockStatus,
  getProductStockStatus,
  getStockStatusLabel,
  Course,
  CourseModule,
  InvestmentProject,
  InvestmentOffer,
  ShareSubscription,
  WalletTransaction,
  InvestorWallet,
  EmailNotification,
  DeliveryZone,
  AppNotification,
  FundOperationRequest,
  ProfitDistribution,
  CategoryGroup,
  InvestorActivity,
  InvestorDocument,
  INFORMATIQUE_GROUPS,
  ELECTRONIQUE_GROUPS,
  ELECTROTECHNIQUE_GROUPS,
  MarketplaceBoutique
} from '../data/mockData.ts';
import {
  BoutiqueSector,
  InvestorMessage,
  RegisteredInvestor,
  ShareAllocation
} from './ScreenBourseIR.tsx';
import { ExportProductsModal } from './ExportProductsModal.tsx';
import { ImportProductsCsvModal } from './ImportProductsCsvModal.tsx';
import { exportProductsToXlsx } from '../utils/xlsxExport.ts';
import { exportProductsToCsv } from '../utils/csvProducts.ts';
import { formatProductTitle } from '../utils/productFormat.ts';
import { ProductImage } from './ProductImage.tsx';
import { useOnlineStatus } from '../utils/pwa.ts';
import {
  ADMIN_PERMISSION_DEFINITIONS,
  ALL_ADMIN_PERMISSIONS,
  AdminPermission,
  DEFAULT_SECONDARY_ADMIN_PERMISSIONS
} from '../data/adminPermissions.ts';

export type AdminRole = 'admin_principal' | 'admin_secondaire' | 'utilisateur';

export interface AuditAction {
  id: string;
  author: string;
  date: string;
  actionType: string;
  description: string;
  entityType: 'product' | 'course' | 'video' | 'role' | 'subscription' | 'wallet' | 'investor' | 'promo' | 'delivery' | 'notification' | 'chat' | 'system';
  previousState?: any;
  newState?: any;
  targetId?: string;
  isReverted?: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AdminRole;
  permissions?: AdminPermission[];
  isProtected?: boolean;
  addedDate: string;
}

export interface AdminArchive {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  parentId?: string;
  archivedAt: string;
}

export interface AdminPageProps {
  currentAdminRole: AdminRole;
  currentAdminName: string;
  currentAdminPermissions?: AdminPermission[];

  adminCustomUrl: string;
  onChangeAdminCustomUrl: (newUrl: string) => void | Promise<void>;
  onChangeAdminMasterPassword: (newPassword: string) => Promise<void>;

  siteBaseUrl?: string;
  onChangeSiteBaseUrl?: (newBaseUrl: string) => void;

  heroVideoUrl: string;
  onChangeHeroVideoUrl: (newUrl: string) => void;

  formationsVideoUrl?: string;
  onChangeFormationsVideoUrl?: (newUrl: string) => void;

  products: Product[];
  isLoadingProducts?: boolean;
  onRefreshProducts?: () => void;
  onUpdateProduct: (p: Product) => void | Promise<void>;
  onAddProduct: (p: Product) => void | Promise<void>;
  onDeleteProduct: (id: string) => void;
  onImportProducts?: (
    items: Product[],
    options: { upsertByRef: boolean; filename: string }
  ) => Promise<{ createdCount: number; updatedCount: number }>;

  courses: Course[];
  onUpdateCourse: (c: Course) => void;
  onAddCourse: (c: Course) => void;
  onDeleteCourse: (id: string) => void;

  subscriptions: ShareSubscription[];
  onApproveSubscription: (id: string, code?: string) => void | Promise<void>;
  onForceValidateSubscription: (id: string) => void | Promise<void>;
  onRejectSubscription: (id: string) => void | Promise<void>;
  projects: InvestmentProject[];
  onUpdateProject: (p: InvestmentProject) => void;
  onAddProject: (p: InvestmentProject) => void;

  registeredInvestors: RegisteredInvestor[];
  onUpdateInvestorStatus?: (investorId: string, status: any, reason?: string) => void;
  walletsByEmail: Record<string, InvestorWallet>;
  onAdjustWallet: (email: string, deltaBalance: number, reason: string) => void;
  transactions: WalletTransaction[];
  emails: EmailNotification[];

  deliveryZones?: DeliveryZone[];
  onUpdateDeliveryZones?: (zones: DeliveryZone[]) => void;

  appNotifications?: AppNotification[];
  onAddNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp'>) => void;

  isInvestorChatOpen?: boolean;
  onToggleInvestorChat?: () => void;
  investorMessages?: InvestorMessage[];
  onSendAdminMessage?: (
    text: string,
    voice?: { audioUrl: string; audioDuration?: number }
  ) => void | Promise<void>;

  auditLogs: AuditAction[];
  onAddAuditLog: (action: Omit<AuditAction, 'id'>) => void;
  onRevertAuditAction: (actionId: string) => void;
  onRelaunchAuditAction?: (actionId: string, updatedStateOverride?: any) => void;

  isMaintenanceMode?: boolean;
  onToggleMaintenanceMode?: (active: boolean) => void;
  onDistributeProfits?: (
    projectName: string,
    totalAmount: number,
    notes?: string,
    sector?: BoutiqueSector,
    period?: string,
    companyAmount?: number,
    operationId?: string,
    idempotencyKey?: string
  ) => boolean | void | Promise<boolean | void>;
  customGroups?: Record<string, { id: string; label: string }[]>;
  onAddCustomGroup?: (domain: 'electronique' | 'electrotechnique' | 'informatique', group: { id: string; label: string }) => void;

  fundRequests?: FundOperationRequest[];
  onConfirmFundRequest?: (reqId: string) => void | Promise<void>;
  onRejectFundRequest?: (reqId: string, reason: string) => void | Promise<void>;
  onSetFundRequestProcessing?: (reqId: string) => void | Promise<void>;

  profitDistributions?: ProfitDistribution[];
  onDeleteInvestor?: (investorId: string) => void;
  onCreateInvestor?: (data: {
    email: string;
    password: string;
    lastName?: string;
    firstName?: string;
    phone?: string;
    totalInvested?: number;
    sharesCount?: number;
    dividendsEarned?: number;
    shareAllocations?: ShareAllocation[];
  }) => Promise<void>;
  onUpdateInvestor?: (investorId: string, data: Partial<RegisteredInvestor>) => Promise<void>;
  onResetInvestorPassword?: (investorId: string, password: string) => Promise<void>;
  onUpdateInvestorSubscription?: (
    investorId: string,
    subscriptionId: string,
    data: Partial<ShareSubscription>
  ) => Promise<void>;
  onDeleteSubscription?: (subId: string) => void;
  onDeleteFundRequest?: (reqId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onDeleteProfitDistribution?: (distId: string) => void;
  onDeleteInvestorMessage?: (msgId: string) => void;
  onClearInvestorMessages?: () => void;
  onPurgeTestData?: (target: 'all' | 'requests' | 'investors' | 'wallets') => void;

  domainGroups?: Record<'electronique' | 'electrotechnique' | 'informatique', CategoryGroup[]>;
  onAddGroup?: (domain: 'electronique' | 'electrotechnique' | 'informatique', group: CategoryGroup) => void;
  onDeleteGroup?: (domain: 'electronique' | 'electrotechnique' | 'informatique', groupId: string) => void;

  onDeleteAuditLog?: (logId: string) => void;
  onClearAuditLogs?: () => void;
  onTotalReset?: () => void;

  investorActivities?: InvestorActivity[];
  onAddInvestorActivity?: (act: InvestorActivity) => void;
  onDeleteInvestorActivity?: (actId: string) => void;

  investorDocuments?: InvestorDocument[];
  onAddInvestorDocument?: (doc: InvestorDocument) => void;
  onDeleteInvestorDocument?: (docId: string) => void;

  marketplaceBoutiques?: MarketplaceBoutique[];
  onUpdateBoutiqueFlag?: (boutiqueId: string, newFlag: string, countryName?: string) => void;

  onExitAdmin: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  currentAdminRole,
  currentAdminName,
  currentAdminPermissions = [],
  adminCustomUrl,
  onChangeAdminCustomUrl,
  onChangeAdminMasterPassword,
  siteBaseUrl = 'https://electromen.bf',
  onChangeSiteBaseUrl,
  heroVideoUrl,
  onChangeHeroVideoUrl,
  formationsVideoUrl = '/assets/videos/electromen-hero.mp4',
  onChangeFormationsVideoUrl,
  products,
  isLoadingProducts = false,
  onRefreshProducts,
  onUpdateProduct,
  onAddProduct,
  onDeleteProduct,
  onImportProducts,
  courses,
  onUpdateCourse,
  onAddCourse,
  onDeleteCourse,
  subscriptions,
  onApproveSubscription,
  onForceValidateSubscription,
  onRejectSubscription,

  projects = [],
  onUpdateProject,
  onAddProject,
  registeredInvestors,
  onUpdateInvestorStatus,
  walletsByEmail,
  onAdjustWallet,
  transactions = [],
  auditLogs,
  onAddAuditLog,
  onRevertAuditAction,
  onRelaunchAuditAction,
  deliveryZones = [],
  onUpdateDeliveryZones,
  appNotifications = [],
  onAddNotification,
  isInvestorChatOpen = true,
  onToggleInvestorChat,
  investorMessages = [],
  onSendAdminMessage,
  isMaintenanceMode = false,
  onToggleMaintenanceMode,
  onDistributeProfits,
  customGroups,
  onAddCustomGroup,
  fundRequests = [],
  onConfirmFundRequest,
  onRejectFundRequest,
  onSetFundRequestProcessing,
  profitDistributions = [],
  onDeleteInvestor,
  onCreateInvestor,
  onUpdateInvestor,
  onResetInvestorPassword,
  onUpdateInvestorSubscription,
  onDeleteSubscription,
  onDeleteFundRequest,
  onDeleteProject,
  onDeleteProfitDistribution,
  onDeleteInvestorMessage,
  onClearInvestorMessages,
  onPurgeTestData,
  domainGroups = {
    electronique: ELECTRONIQUE_GROUPS,
    electrotechnique: ELECTROTECHNIQUE_GROUPS,
    informatique: INFORMATIQUE_GROUPS
  },
  onAddGroup,
  onDeleteGroup,
  onDeleteAuditLog,
  onClearAuditLogs,
  onTotalReset,
  investorActivities = [],
  onAddInvestorActivity,
  onDeleteInvestorActivity,
  investorDocuments = [],
  onAddInvestorDocument,
  onDeleteInvestorDocument,
  marketplaceBoutiques = [],
  onUpdateBoutiqueFlag,
  onExitAdmin
}) => {
  // Navigation tabs in clean white admin
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'realtime' | 'market' | 'academy' | 'logistique' | 'investors' | 'subscriptions' | 'funds' | 'content' | 'audit' | 'roles' | 'seo' | 'archives'
  >('dashboard');
  const isOnline = useOnlineStatus();
  useEffect(() => {
    if (activeTab !== 'archives') return;
    let active = true;
    const refreshArchives = async () => {
      try {
        const response = await fetch('/api/admin/archives', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de charger la corbeille.');
        if (active && Array.isArray(data.archives)) {
          setArchives(data.archives);
          setArchiveError(null);
        }
      } catch (error) {
        if (active) setArchiveError(error instanceof Error ? error.message : 'Impossible de charger la corbeille.');
      }
    };
    void refreshArchives();
    const eventSource = new EventSource('/api/events/stream');
    const onDataChanged = (event: Event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (data.resource === 'archives') void refreshArchives();
      } catch {
        // Ignore malformed live-data messages; the next event or tab visit will retry.
      }
    };
    eventSource.addEventListener('DATA_CHANGED', onDataChanged);
    return () => {
      active = false;
      eventSource.removeEventListener('DATA_CHANGED', onDataChanged);
      eventSource.close();
    };
  }, [activeTab]);

  const isPrincipal = currentAdminRole === 'admin_principal';
  const hasPerm = (perm: AdminPermission): boolean =>
    isPrincipal || (currentAdminRole === 'admin_secondaire' && currentAdminPermissions.includes(perm));
  const canViewRealtime = hasPerm('view_realtime');

  const allAdminTabs: Array<{
    id: 'dashboard' | 'realtime' | 'market' | 'academy' | 'logistique' | 'content' | 'investors' | 'subscriptions' | 'funds' | 'roles' | 'archives' | 'seo' | 'audit';
    label: string;
    icon: string;
    visible: boolean;
  }> = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: 'dashboard', visible: true },
    { id: 'realtime', label: 'En Direct (Temps Réel)', icon: 'sensors', visible: canViewRealtime },
    { id: 'market', label: 'Produits (3 Rayons)', icon: 'inventory_2', visible: hasPerm('manage_products') || hasPerm('delete_products') },
    { id: 'academy', label: 'Formations (3 Domaines)', icon: 'school', visible: hasPerm('manage_courses') || hasPerm('delete_courses') },
    { id: 'logistique', label: 'Frais Livraison', icon: 'local_shipping', visible: hasPerm('manage_delivery') },
    { id: 'content', label: 'Vidéos & Médias', icon: 'video_settings', visible: hasPerm('manage_content') },
    {
      id: 'investors',
      label: 'Investisseurs & Messagerie',
      icon: 'forum',
      visible:
        hasPerm('manage_investors') ||
        hasPerm('manage_investors_password') ||
        hasPerm('manage_content') ||
        hasPerm('manage_subscriptions')
    },
    {
      id: 'subscriptions',
      label: 'Projets & Souscriptions',
      icon: 'verified_user',
      visible: hasPerm('manage_subscriptions') || hasPerm('manage_operations') || hasPerm('manage_content')
    },
    { id: 'funds', label: 'Dépôts & Retraits', icon: 'account_balance', visible: hasPerm('manage_funds') || hasPerm('manage_wallet_adjust') },
    { id: 'roles', label: 'Rôles & Sécurité', icon: 'key', visible: isPrincipal },
    { id: 'archives', label: 'Corbeille / Archives', icon: 'delete', visible: isPrincipal || hasPerm('view_audit') },
    { id: 'seo', label: 'Domaine & SEO', icon: 'travel_explore', visible: isPrincipal },
    { id: 'audit', label: 'Journal Audit', icon: 'history', visible: hasPerm('view_audit') }
  ];
  const allowedAdminTabs = allAdminTabs.filter((tab) => tab.visible);

  useEffect(() => {
    if (!allowedAdminTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, currentAdminRole, currentAdminPermissions]);

  // Real-Time Connected Users State (Real-time SSE & Presence Stream)
  interface LiveUserPresence {
    sessionId: string;
    userId?: string;
    userName: string;
    userEmail?: string;
    userPhone?: string;
    userRole: 'admin' | 'investor' | 'client' | 'visitor';
    investorStatus?: string;
    currentTab: string;
    pageTitle: string;
    ip: string;
    deviceType: 'Mobile' | 'Tablette' | 'Ordinateur';
    browser: string;
    connectedAt: number;
    lastSeen: number;
    secondsAgo: number;
    durationMinutes: number;
  }

  const [liveUsers, setLiveUsers] = useState<LiveUserPresence[]>([]);
  const [presenceBreakdown, setPresenceBreakdown] = useState<{
    total: number;
    admins: number;
    investors: number;
    clients: number;
    visitors: number;
  }>({
    total: 0,
    admins: 0,
    investors: 0,
    clients: 0,
    visitors: 0
  });
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);
  const [disconnectingSid, setDisconnectingSid] = useState<string | null>(null);

  // Synchronize connected users via SSE and backup polling (only if allowed)
  useEffect(() => {
    if (!canViewRealtime) {
      setLiveUsers([]);
      setRealtimeConnected(false);
      return;
    }

    let eventSource: EventSource | null = null;
    let pollInterval: any = null;

    const fetchSnapshot = () => {
      fetch('/api/presence/online-users', { credentials: 'same-origin' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.sessions)) {
            setLiveUsers(data.sessions);
            if (data.breakdown) setPresenceBreakdown(data.breakdown);
            setRealtimeConnected(true);
          }
        })
        .catch(() => setRealtimeConnected(false));
    };

    fetchSnapshot();

    try {
      eventSource = new EventSource('/api/presence/stream');
      eventSource.onopen = () => {
        setRealtimeConnected(true);
      };
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && Array.isArray(data.sessions)) {
            setLiveUsers(data.sessions);
            if (data.breakdown) setPresenceBreakdown(data.breakdown);
            setRealtimeConnected(true);
          }
        } catch {}
      };
      eventSource.onerror = () => {
        setRealtimeConnected(false);
      };
    } catch {
      pollInterval = setInterval(fetchSnapshot, 4000);
    }

    pollInterval = setInterval(fetchSnapshot, 5000);

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [canViewRealtime]);

  const handleDisconnectSession = async (sessionId: string) => {
    if (!confirm("Voulez-vous forcer la déconnexion de cette session utilisateur ?")) return;
    setDisconnectingSid(sessionId);
    try {
      await fetch('/api/admin/disconnect-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      setLiveUsers((prev) => prev.filter((u) => u.sessionId !== sessionId));
    } catch {}
    setDisconnectingSid(null);
  };

  // Custom Admin Route edit state
  const [editingUrl, setEditingUrl] = useState(adminCustomUrl);
  const [urlMessage, setUrlMessage] = useState<string | null>(null);
  const [masterPasswordInput, setMasterPasswordInput] = useState('');
  const [masterPasswordConfirm, setMasterPasswordConfirm] = useState('');
  const [masterPasswordMessage, setMasterPasswordMessage] = useState<string | null>(null);
  const [masterPasswordError, setMasterPasswordError] = useState<string | null>(null);
  const [isSavingMasterPassword, setIsSavingMasterPassword] = useState(false);

  // Official Domain Base URL edit state
  const [siteBaseUrlInput, setSiteBaseUrlInput] = useState(siteBaseUrl);
  const [seoMessage, setSeoMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setEditingUrl(adminCustomUrl);
  }, [adminCustomUrl]);

  useEffect(() => {
    setSiteBaseUrlInput(siteBaseUrl);
  }, [siteBaseUrl]);

  // Video URL edit state
  const [videoInput, setVideoInput] = useState(heroVideoUrl);
  const [formationsVideoInput, setFormationsVideoInput] = useState(formationsVideoUrl);
  const [videoMessage, setVideoMessage] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ isUploading: boolean; message: string }>({
    isUploading: false,
    message: ''
  });

  // Market add/edit form state
  const [isAddProdOpen, setIsAddProdOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newProdName, setNewProdName] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('');
  const [newProdRef, setNewProdRef] = useState('');
  const [newProdDomain, setNewProdDomain] = useState<'electronique' | 'electrotechnique' | 'informatique'>('informatique');
  const [newProdSubGroup, setNewProdSubGroup] = useState<string>('ordinateurs');
  const [newProdCategoryAutoDetected, setNewProdCategoryAutoDetected] = useState<string | null>('Ordinateurs & Postes de Travail');
  const [newProdPrice, setNewProdPrice] = useState(150000);
  const [newProdOldPrice, setNewProdOldPrice] = useState<number | ''>('');
  const [newProdStock, setNewProdStock] = useState(5);
  const [newProdStockStatus, setNewProdStockStatus] = useState<ProductStockStatus>('in_stock');
  const [productStockFilter, setProductStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock' | 'on_order'>('all');
  const filteredCatalogProducts = products.filter((p) => {
    if (productStockFilter === 'all') return true;
    if ((productStockFilter as string) === 'featured') return Boolean(p.isFeaturedOnHome);
    if ((productStockFilter as string) === 'flash') return Boolean(p.isFlashSale);
    return getProductStockStatus(p) === productStockFilter;
  });
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdSpecs, setNewProdSpecs] = useState('');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdHasRealPhoto, setNewProdHasRealPhoto] = useState(false);
  const [newProdVideoUrl, setNewProdVideoUrl] = useState('');
  const [newProdIsDraft, setNewProdIsDraft] = useState(false);
  const [newProdIsFeaturedOnHome, setNewProdIsFeaturedOnHome] = useState(false);
  const [newProdIsPromo, setNewProdIsPromo] = useState(false);
  const [newProdIsNew, setNewProdIsNew] = useState(false);
  const [newProdIsFlashSale, setNewProdIsFlashSale] = useState(false);
  const [notifyUsersOnPublish, setNotifyUsersOnPublish] = useState(true);

  // Product Preview modal before publish
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [isExportProductsOpen, setIsExportProductsOpen] = useState<boolean>(false);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState<boolean>(false);
  const [csvImportFeedback, setCsvImportFeedback] = useState<string | null>(null);

  // Course add/edit form state
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDomain, setNewCourseDomain] = useState<'electronique' | 'electrotechnique' | 'informatique'>('informatique');
  const [newCoursePrice, setNewCoursePrice] = useState(35000);
  const [newCourseIsFree, setNewCourseIsFree] = useState(false);
  const [newCourseLevel, setNewCourseLevel] = useState('Pratique & Professionnel');
  const [newCourseDuration, setNewCourseDuration] = useState('30 Heures (4 Semaines)');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCoursePdfUrl, setNewCoursePdfUrl] = useState('');
  const [newCoursePdfTitle, setNewCoursePdfTitle] = useState('');
  const [newCourseVideoUrl, setNewCourseVideoUrl] = useState('');
  const [newCourseModules, setNewCourseModules] = useState<CourseModule[]>([
    { id: 'mod-1', title: 'Module 1 : Fondamentaux & Diagnostic', duration: '6h', summary: 'Introduction et principes clés' }
  ]);
  const [notifyCourseOnPublish, setNotifyCourseOnPublish] = useState(true);

  // Delivery Zone Form
  const [isAddZoneOpen, setIsAddZoneOpen] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneFee, setNewZoneFee] = useState(2500);
  const [newZoneDelay, setNewZoneDelay] = useState('24h à 48h');
  const [newZoneKeywords, setNewZoneKeywords] = useState('');

  // Investor Chat Admin Message & Voice Note state
  const [adminChatText, setAdminChatText] = useState('');
  const [isSendingAdminChat, setIsSendingAdminChat] = useState(false);
  const [isRecordingAdminVoice, setIsRecordingAdminVoice] = useState(false);
  const [adminRecordingSeconds, setAdminRecordingSeconds] = useState(0);
  const [adminVoiceError, setAdminVoiceError] = useState<string | null>(null);
  const [adminVoiceDraft, setAdminVoiceDraft] = useState<{ audioUrl: string; audioDuration: number } | null>(null);
  const adminMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const adminVoiceStreamRef = useRef<MediaStream | null>(null);
  const adminVoiceChunksRef = useRef<Blob[]>([]);
  const adminVoiceTimerRef = useRef<number | null>(null);
  const adminVoiceCancelledRef = useRef(false);
  const adminVoiceStartRef = useRef(0);

  useEffect(() => {
    return () => {
      if (adminVoiceTimerRef.current !== null) {
        window.clearInterval(adminVoiceTimerRef.current);
      }
      if (adminMediaRecorderRef.current && adminMediaRecorderRef.current.state !== 'inactive') {
        adminVoiceCancelledRef.current = true;
        try {
          adminMediaRecorderRef.current.stop();
        } catch {}
      }
      if (adminVoiceStreamRef.current) {
        adminVoiceStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Total reset is authorized by the active administrator session.
  const [isTotalResetModalOpen, setIsTotalResetModalOpen] = useState(false);
  const [resetConfirmedCheckbox, setResetConfirmedCheckbox] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Editing Secondary Admin Password Modal
  const [editingSecondaryAdminPass, setEditingSecondaryAdminPass] = useState<{
    user: AdminUser;
    newPass: string;
  } | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Profit Distribution Modal State
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const [distSector, setDistSector] = useState<BoutiqueSector>('Électronique');
  const [distOperationId, setDistOperationId] = useState<string>('');
  const [distPeriod, setDistPeriod] = useState('3ème Trimestre 2026');
  const [distProjectName, setDistProjectName] = useState('');
  const [distAmount, setDistAmount] = useState<number>(70000);
  const [distCompanyAmount, setDistCompanyAmount] = useState<number>(30000);
  const [distNotes, setDistNotes] = useState('Distribution directe des bénéfices validés');
  const [isDistributingProfit, setIsDistributingProfit] = useState(false);
  const [profitDistIdempotencyKey, setProfitDistIdempotencyKey] = useState<string>('');
  const [profitDistError, setProfitDistError] = useState<string | null>(null);

  // Per-item anti-double-click action locks
  const [processingSubIds, setProcessingSubIds] = useState<Record<string, boolean>>({});
  const [processingFundIds, setProcessingFundIds] = useState<Record<string, boolean>>({});

  // Custom Category / Group Creation State
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [newGroupDomain, setNewGroupDomain] = useState<'electronique' | 'electrotechnique' | 'informatique'>('electronique');
  const [newGroupLabel, setNewGroupLabel] = useState('');

  // Fund Requests Management State
  const [fundFilterStatus, setFundFilterStatus] = useState<'all' | 'En attente' | 'En cours de traitement' | 'Confirmé' | 'Refusé'>('all');
  const [fundFilterType, setFundFilterType] = useState<'all' | 'depot' | 'retrait'>('all');
  const [rejectingFundReq, setRejectingFundReq] = useState<FundOperationRequest | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  // Investor Activities & Documents states
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityDesc, setNewActivityDesc] = useState('');
  const [newActivitySector, setNewActivitySector] = useState('Électronique & IoT');
  const [newActivityBadge, setNewActivityBadge] = useState('Production Active');
  const [newActivityImage, setNewActivityImage] = useState('');
  const [newActivityDate, setNewActivityDate] = useState('Octobre 2026');

  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocDesc, setNewDocDesc] = useState('');
  const [newDocFormat, setNewDocFormat] = useState('PDF Juridique (Certifié)');
  const [newDocSize, setNewDocSize] = useState('1.4 Mo');
  const [newDocUrl, setNewDocUrl] = useState('');

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [secondaryAdminPermissions, setSecondaryAdminPermissions] = useState<AdminPermission[]>([]);
  const [savingAdminPermId, setSavingAdminPermId] = useState<string | null>(null);
  const [adminPermFeedback, setAdminPermFeedback] = useState<string | null>(null);
  const [adminPermDrafts, setAdminPermDrafts] = useState<Record<string, AdminPermission[]>>({});
  const [expandedPermAdminId, setExpandedPermAdminId] = useState<string | null>(null);

  // Sync admin users from backend API (Principal Admin only)
  useEffect(() => {
    localStorage.removeItem('electromen_admin_users');
    if (!isPrincipal) {
      setAdminUsers([]);
      return;
    }
    let active = true;
    const refreshAdmins = () => {
      fetch('/api/admin/users', { credentials: 'same-origin', cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (active && Array.isArray(data)) {
            setAdminUsers(data);
          }
        })
        .catch(() => {});
    };
    refreshAdmins();

    const eventSource = new EventSource('/api/events/stream');
    const onDataChanged = (event: Event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (data.resource === 'admins') refreshAdmins();
      } catch {}
    };
    eventSource.addEventListener('DATA_CHANGED', onDataChanged);
    return () => {
      active = false;
      eventSource.removeEventListener('DATA_CHANGED', onDataChanged);
      eventSource.close();
    };
  }, [isPrincipal]);

  // Synchronize selected operation & idempotency key when Profit Distribution modal opens or sector changes
  const openProfitDistributionModal = () => {
    const firstMatchingOp =
      projects.find((p) => (p.sector || p.category) === distSector) || projects[0];
    if (firstMatchingOp) {
      const opSector = ((firstMatchingOp.sector || firstMatchingOp.category) as BoutiqueSector) || distSector;
      if (['Électronique', 'Électrotechnique', 'Informatique'].includes(opSector)) {
        setDistSector(opSector);
      }
      setDistOperationId(firstMatchingOp.id);
      setDistProjectName(firstMatchingOp.title);
    } else {
      setDistOperationId('');
      setDistProjectName('');
    }
    setProfitDistIdempotencyKey(`dist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setProfitDistError(null);
    setIsDistributeModalOpen(true);
  };

  // Video Master Controls for Administrator (Accueil & Formations)
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const formationsVideoRef = useRef<HTMLVideoElement | null>(null);

  const parseVideoSource = (rawUrl?: string): { isEmbed: boolean; embedUrl?: string; cleanUrl: string } => {
    const url = (rawUrl || '').trim();
    const defaultLocal = '/assets/videos/electromen-hero.mp4';
    if (!url || url.includes('BigBuckBunny') || url.includes('commondatastorage.googleapis.com') || url.includes('mixkit.co')) {
      return { isEmbed: false, cleanUrl: defaultLocal };
    }
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return {
        isEmbed: true,
        embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${ytMatch[1]}&controls=1&modestbranding=1&rel=0&playsinline=1`,
        cleanUrl: url
      };
    }
    const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/i);
    if (vimeoMatch && vimeoMatch[3]) {
      return {
        isEmbed: true,
        embedUrl: `https://player.vimeo.com/video/${vimeoMatch[3]}?autoplay=1&muted=1&loop=1`,
        cleanUrl: url
      };
    }
    return { isEmbed: false, cleanUrl: url };
  };

  const [isHeroPlaying, setIsHeroPlaying] = useState(true);
  const [isHeroMuted, setIsHeroMuted] = useState(true);
  const [heroVolume, setHeroVolume] = useState(0.8);

  const [isFormationsPlaying, setIsFormationsPlaying] = useState(true);
  const [isFormationsMuted, setIsFormationsMuted] = useState(true);
  const [formationsVolume, setFormationsVolume] = useState(0.8);

  const toggleHeroPlay = () => {
    if (heroVideoRef.current) {
      if (heroVideoRef.current.paused) {
        heroVideoRef.current.play();
        setIsHeroPlaying(true);
      } else {
        heroVideoRef.current.pause();
        setIsHeroPlaying(false);
      }
    }
  };

  const toggleHeroMute = () => {
    if (heroVideoRef.current) {
      heroVideoRef.current.muted = !heroVideoRef.current.muted;
      setIsHeroMuted(heroVideoRef.current.muted);
    }
  };

  const handleHeroVolumeChange = (vol: number) => {
    setHeroVolume(vol);
    if (heroVideoRef.current) {
      heroVideoRef.current.volume = vol;
      if (vol > 0 && heroVideoRef.current.muted) {
        heroVideoRef.current.muted = false;
        setIsHeroMuted(false);
      }
    }
  };

  const toggleFormationsPlay = () => {
    if (formationsVideoRef.current) {
      if (formationsVideoRef.current.paused) {
        formationsVideoRef.current.play();
        setIsFormationsPlaying(true);
      } else {
        formationsVideoRef.current.pause();
        setIsFormationsPlaying(false);
      }
    }
  };

  const toggleFormationsMute = () => {
    if (formationsVideoRef.current) {
      formationsVideoRef.current.muted = !formationsVideoRef.current.muted;
      setIsFormationsMuted(formationsVideoRef.current.muted);
    }
  };

  const handleFormationsVolumeChange = (vol: number) => {
    setFormationsVolume(vol);
    if (formationsVideoRef.current) {
      formationsVideoRef.current.volume = vol;
      if (vol > 0 && formationsVideoRef.current.muted) {
        formationsVideoRef.current.muted = false;
        setIsFormationsMuted(false);
      }
    }
  };

  // Funding Operations (Projets d'Investissement) creation & publication state
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjCategory, setNewProjCategory] = useState<'Électronique' | 'Électrotechnique' | 'Informatique'>('Électronique');
  const [newProjObjective, setNewProjObjective] = useState('');
  const [newProjTarget, setNewProjTarget] = useState<number>(10000000);
  const [newProjDuration, setNewProjDuration] = useState('12 Mois');
  const [newProjYield, setNewProjYield] = useState('15% à 18%');
  const [newProjDistribution, setNewProjDistribution] = useState('Trimestrielle');
  const [newProjSharePrice, setNewProjSharePrice] = useState<number>(0);
  const [newProjAvailableShares, setNewProjAvailableShares] = useState<number>(0);
  const [newProjStatus, setNewProjStatus] = useState<'Ouvert' | 'Brouillon'>('Ouvert');
  const [newProjConditions, setNewProjConditions] = useState('Prix unitaire et nombre de parts définis spécifiquement pour cette opération.');
  const [newProjOfferTitle, setNewProjOfferTitle] = useState('Parts Ordinaires Standard');
  const [newProjOfferDesc, setNewProjOfferDesc] = useState('Souscription ouverte avec attribution directe de parts certifiées.');
  const [editingOperation, setEditingOperation] = useState<{ id: string; sharePrice: string; availableShares: string } | null>(null);
  const [investorProvisioningMode, setInvestorProvisioningMode] = useState<'existing' | 'new'>('existing');
  const [newInvestor, setNewInvestor] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    lastName: '',
    firstName: '',
    phone: '',
    totalInvested: '0',
    sharesCount: '0',
    dividendsEarned: '0'
  });
  const [investorCreateError, setInvestorCreateError] = useState<string | null>(null);
  const [investorCreateMessage, setInvestorCreateMessage] = useState<string | null>(null);
  const [isCreatingInvestor, setIsCreatingInvestor] = useState(false);
  const [expandedInvestorId, setExpandedInvestorId] = useState<string | null>(null);
  const [investorDetail, setInvestorDetail] = useState<{ investor: RegisteredInvestor; subscriptions: ShareSubscription[] } | null>(null);
  const [investorDetailLoading, setInvestorDetailLoading] = useState(false);
  const [investorDetailError, setInvestorDetailError] = useState<string | null>(null);
  const [investorEdit, setInvestorEdit] = useState<RegisteredInvestor | null>(null);
  const [investorEditError, setInvestorEditError] = useState<string | null>(null);
  const [investorEditMessage, setInvestorEditMessage] = useState<string | null>(null);
  const [investorResetPassword, setInvestorResetPassword] = useState('');
  const [investorPasswordError, setInvestorPasswordError] = useState<string | null>(null);
  const [investorPasswordMessage, setInvestorPasswordMessage] = useState<string | null>(null);
  const [investorManagementLoading, setInvestorManagementLoading] = useState(false);
  const [editingInvestorSubscription, setEditingInvestorSubscription] = useState<ShareSubscription | null>(null);
  const [subscriptionEditError, setSubscriptionEditError] = useState<string | null>(null);
  const [subscriptionEditMessage, setSubscriptionEditMessage] = useState<string | null>(null);
  const [sessionTemporaryPasswords, setSessionTemporaryPasswords] = useState<Record<string, { password: string; updatedAt: string }>>({});
  const [revealedTempPasswordKeys, setRevealedTempPasswordKeys] = useState<Record<string, boolean>>({});
  const [investorDossierPasswords, setInvestorDossierPasswords] = useState<
    Record<string, { currentPassword: string | null; loading: boolean; error?: string }>
  >({});
  const [revealedDossierPasswordIds, setRevealedDossierPasswordIds] = useState<Record<string, boolean>>({});
  const [showNewInvestorPassword, setShowNewInvestorPassword] = useState(false);
  const [showResetInvestorPassword, setShowResetInvestorPassword] = useState(false);
  const [newInvestorAllocations, setNewInvestorAllocations] = useState<ShareAllocation[]>([]);
  const [allocationsTouched, setAllocationsTouched] = useState(false);
  const [archives, setArchives] = useState<AdminArchive[]>([]);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const generateProvisionalPassword = (): string => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const array = new Uint32Array(14);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(array);
      return Array.from(array, (n) => alphabet[n % alphabet.length]).join('');
    }
    return `ELM-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}!`;
  };

  const handleCreateAndPublishOperation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPerm('manage_operations')) {
      alert('Action restreinte : Vous ne disposez pas du droit de gestion des opérations.');
      return;
    }
    if (!newProjTitle.trim()) {
      alert("Veuillez saisir le titre de l'opération de financement.");
      return;
    }
    if (!Number.isSafeInteger(newProjSharePrice) || newProjSharePrice <= 0) {
      alert('Veuillez définir un prix unitaire valide pour cette opération.');
      return;
    }
    if (!Number.isSafeInteger(newProjAvailableShares) || newProjAvailableShares < 1) {
      alert('Veuillez définir un nombre de parts disponibles supérieur à zéro.');
      return;
    }

    const opId = `op-${Date.now()}`;
    const isPub = newProjStatus === 'Ouvert';
    const price = Number(newProjSharePrice);

    const defaultOffer: InvestmentOffer = {
      id: `off-${Date.now()}-std`,
      ref: `OFF-${Date.now().toString().slice(-4)}`,
      title: newProjOfferTitle.trim() || `Parts Ordinaires - ${newProjTitle.trim()}`,
      category: `${newProjCategory} • Souscription Directe`,
      sharePrice: price,
      yield: newProjYield.trim() || '15% à 18%',
      yieldType: 'Dividendes directs',
      duration: newProjDuration.trim() || '12 Mois',
      risk: 'Faible (Garanti par stock actif)',
      description: newProjOfferDesc.trim() || `Souscription standard à l'opération ${newProjTitle.trim()}`,
      isOpen: isPub,
      isPublished: isPub,
      minShares: 1,
      maxShares: newProjAvailableShares,
      status: isPub ? 'Ouverte' : 'Brouillon'
    };

    const newProject: InvestmentProject = {
      id: opId,
      ref: `OP-${Date.now().toString().slice(-4)}`,
      title: newProjTitle.trim(),
      category: newProjCategory,
      sector: newProjCategory,
      categoryStyle: newProjCategory === 'Électronique' ? 'gold' : newProjCategory === 'Électrotechnique' ? 'cyan' : 'neutral',
      description: newProjObjective.trim() || `Opération de financement pour ${newProjTitle.trim()}`,
      objective: newProjObjective.trim() || `Financement participatif d'équipements et stocks industriels pour ${newProjTitle.trim()}`,
      conditions: newProjConditions.trim(),
      targetAmount: Number(newProjTarget) || 10000000,
      collectedAmount: 0,
      percent: 0,
      yield: newProjYield.trim() || '15% à 18%',
      yieldType: 'Dividendes directs annuels',
      duration: newProjDuration.trim() || '12 Mois',
      risk: 'Faible',
      riskColor: 'emerald',
      distribution: newProjDistribution || 'Trimestrielle',
      investorsCount: 0,
      cycleNumber: 1,
      status: isPub ? 'published' : 'draft',
      offerStatus: newProjStatus,
      isPublished: isPub,
      sharePrice: price,
      availableShares: newProjAvailableShares,
      subscribedShares: 0,
      openDate: new Date().toLocaleDateString('fr-FR'),
      offers: [defaultOffer]
    };

    if (onAddProject) {
      onAddProject(newProject);
    }

    onAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'create_operation',
      description: `Création et ${isPub ? 'publication officielle' : 'enregistrement en brouillon'} de l'opération "${newProjTitle.trim()}" (Cible: ${Number(newProjTarget).toLocaleString('fr-FR')} FCFA)`,
      entityType: 'subscription'
    });

    setNewProjTitle('');
    setNewProjObjective('');
    setNewProjTarget(10000000);
    setNewProjDuration('12 Mois');
    setNewProjYield('15% à 18%');
    setNewProjSharePrice(0);
    setNewProjAvailableShares(0);
    setNewProjConditions('Prix unitaire et nombre de parts définis spécifiquement pour cette opération.');
    setNewProjOfferTitle('Parts Ordinaires Standard');
    setNewProjOfferDesc('Souscription ouverte avec attribution directe de parts certifiées.');
    setNewProjStatus('Ouvert');
    setIsAddProjectOpen(false);
  };

  // Secondary admin appointment (collapsible accordion state & inputs)
  const [isAddSecondaryAdminOpen, setIsAddSecondaryAdminOpen] = useState(false);
  const [secondaryAdminEmailInput, setSecondaryAdminEmailInput] = useState('');
  const [secondaryAdminNameInput, setSecondaryAdminNameInput] = useState('');
  const [secondaryAdminPhoneInput, setSecondaryAdminPhoneInput] = useState('');
  const [isCreatingSecondaryAdmin, setIsCreatingSecondaryAdmin] = useState(false);
  const [secondaryAdminFormError, setSecondaryAdminFormError] = useState<string | null>(null);
  const [secondaryAdminFeedback, setSecondaryAdminFeedback] = useState<{
    message: string;
    email?: string;
    tempPassword?: string;
  } | null>(null);
  const [copiedTempPass, setCopiedTempPass] = useState(false);

  // Handle URL Change (Only Principal Admin)
  const handleSaveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPrincipal) {
      alert('Seul l’administrateur principal peut modifier l’URL de l’administration.');
      return;
    }
    let formatted = editingUrl.trim();
    if (!formatted.startsWith('/')) formatted = `/${formatted}`;
    try {
      await onChangeAdminCustomUrl(formatted);
      setUrlMessage(`URL d'administration mise à jour : ${formatted}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "La mise à jour de l'URL a échoué.");
      return;
    }
    onAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'update_admin_url',
      description: `Modification de l'URL personnalisée d'administration : ${formatted}`,
      entityType: 'role',
      previousState: adminCustomUrl,
      newState: formatted
    });
    setTimeout(() => setUrlMessage(null), 3000);
  };

  const handleSaveMasterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPrincipal) return;
    setMasterPasswordError(null);
    setMasterPasswordMessage(null);
    if (masterPasswordInput.trim().length < 8 || masterPasswordInput.trim().length > 128) {
      setMasterPasswordError('Le code maître doit comporter entre 8 et 128 caractères.');
      return;
    }
    if (masterPasswordInput !== masterPasswordConfirm) {
      setMasterPasswordError('Les deux saisies du code maître ne correspondent pas.');
      return;
    }
    setIsSavingMasterPassword(true);
    try {
      await onChangeAdminMasterPassword(masterPasswordInput.trim());
      setMasterPasswordInput('');
      setMasterPasswordConfirm('');
      setMasterPasswordMessage('Le code maître a été modifié. Le nouveau code est actif immédiatement.');
    } catch (error) {
      setMasterPasswordError(error instanceof Error ? error.message : 'La mise à jour du code maître a échoué.');
    } finally {
      setIsSavingMasterPassword(false);
    }
  };

  const handleCreateInvestor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onCreateInvestor || !hasPerm('manage_investors')) return;
    setInvestorCreateError(null);
    setInvestorCreateMessage(null);
    if (newInvestor.password !== newInvestor.passwordConfirm) {
      setInvestorCreateError('La confirmation du mot de passe ne correspond pas.');
      return;
    }
    const cleanEmail = newInvestor.email.trim().toLowerCase();
    const submittedPassword = newInvestor.password;
    setIsCreatingInvestor(true);
    try {
      const request = investorProvisioningMode === 'new'
        ? {
            email: cleanEmail,
            password: submittedPassword,
            lastName: newInvestor.lastName,
            firstName: newInvestor.firstName,
            phone: newInvestor.phone,
            totalInvested: Number(newInvestor.totalInvested),
            sharesCount: Number(newInvestor.sharesCount),
            dividendsEarned: Number(newInvestor.dividendsEarned),
            ...(newInvestorAllocations.length > 0 ? { shareAllocations: newInvestorAllocations } : {})
          }
        : { email: cleanEmail, password: submittedPassword };
      await onCreateInvestor(request);
      setSessionTemporaryPasswords((prev) => ({
        ...prev,
        [cleanEmail]: {
          password: submittedPassword,
          updatedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        }
      }));
      setRevealedTempPasswordKeys((prev) => ({ ...prev, [cleanEmail]: true }));
      setNewInvestor({
        email: '',
        password: '',
        passwordConfirm: '',
        lastName: '',
        firstName: '',
        phone: '',
        totalInvested: '0',
        sharesCount: '0',
        dividendsEarned: '0'
      });
      setNewInvestorAllocations([]);
      setShowNewInvestorPassword(false);
      setInvestorCreateMessage(investorProvisioningMode === 'new'
        ? `Compte investisseur créé pour ${cleanEmail}. Le mot de passe provisoire est disponible ci-dessous pour cette session uniquement.`
        : `Accès activé pour ${cleanEmail}. Le mot de passe provisoire est disponible ci-dessous pour cette session uniquement.`);
    } catch (error) {
      setInvestorCreateError(error instanceof Error ? error.message : 'La création du compte investisseur a échoué.');
    } finally {
      setIsCreatingInvestor(false);
    }
  };

  const handleToggleInvestorDetails = async (investorId: string) => {
    if (expandedInvestorId === investorId) {
      setExpandedInvestorId(null);
      setInvestorDetail(null);
      setInvestorEdit(null);
      setEditingInvestorSubscription(null);
      setAllocationsTouched(false);
      return;
    }
    setExpandedInvestorId(investorId);
    setInvestorDetail(null);
    setEditingInvestorSubscription(null);
    setInvestorEditError(null);
    setInvestorEditMessage(null);
    setInvestorDetailError(null);
    setInvestorPasswordError(null);
    setInvestorPasswordMessage(null);
    setShowResetInvestorPassword(false);
    setAllocationsTouched(false);
    setInvestorDetailLoading(true);
    if (hasPerm('manage_investors_password')) {
      setInvestorDossierPasswords((prev) => ({
        ...prev,
        [investorId]: {
          currentPassword: prev[investorId]?.currentPassword ?? null,
          loading: true
        }
      }));
    }
    try {
      const response = await fetch(`/api/admin/investors/${encodeURIComponent(investorId)}`, {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.investor || !Array.isArray(data.subscriptions)) {
        throw new Error(data.error || 'Impossible de charger le dossier investisseur.');
      }
      setInvestorDetail({ investor: data.investor, subscriptions: data.subscriptions });
      setInvestorEdit(data.investor);

      if (hasPerm('manage_investors_password')) {
        try {
          const pwdResponse = await fetch(`/api/admin/investors/${encodeURIComponent(investorId)}/password`, {
            credentials: 'same-origin',
            cache: 'no-store'
          });
          const pwdData = await pwdResponse.json();
          if (pwdResponse.ok && pwdData.success) {
            setInvestorDossierPasswords((prev) => ({
              ...prev,
              [investorId]: {
                currentPassword: typeof pwdData.currentPassword === 'string' ? pwdData.currentPassword : null,
                loading: false
              }
            }));
          } else {
            setInvestorDossierPasswords((prev) => ({
              ...prev,
              [investorId]: {
                currentPassword: prev[investorId]?.currentPassword ?? null,
                loading: false,
                error: pwdData.error || 'Impossible de récupérer le mot de passe actuel.'
              }
            }));
          }
        } catch {
          setInvestorDossierPasswords((prev) => ({
            ...prev,
            [investorId]: {
              currentPassword: prev[investorId]?.currentPassword ?? null,
              loading: false,
              error: 'Erreur réseau lors de la lecture du mot de passe.'
            }
          }));
        }
      }
    } catch (error) {
      setInvestorDetailError(error instanceof Error ? error.message : 'Impossible de charger le dossier investisseur.');
    } finally {
      setInvestorDetailLoading(false);
    }
  };

  const handleSaveInvestor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!investorDetail || !investorEdit || !onUpdateInvestor || !hasPerm('manage_investors')) return;
    setInvestorManagementLoading(true);
    setInvestorEditError(null);
    setInvestorEditMessage(null);
    try {
      const hasAllocations = Array.isArray(investorEdit.shareAllocations) && investorEdit.shareAllocations.length > 0;
      const payload: Partial<RegisteredInvestor> = {
        ...investorEdit,
        ...(hasAllocations || allocationsTouched ? { shareAllocations: investorEdit.shareAllocations || [] } : { shareAllocations: undefined })
      };
      await onUpdateInvestor(investorDetail.investor.id, payload);
      const response = await fetch(`/api/admin/investors/${encodeURIComponent(investorDetail.investor.id)}`, {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.investor || !Array.isArray(data.subscriptions)) {
        throw new Error(data.error || 'Le dossier a été mis à jour mais son actualisation a échoué.');
      }
      setInvestorDetail({ investor: data.investor, subscriptions: data.subscriptions });
      setInvestorEdit(data.investor);
      setAllocationsTouched(false);
      setInvestorEditMessage('Profil et données financières enregistrés.');
    } catch (error) {
      setInvestorEditError(error instanceof Error ? error.message : 'La mise à jour du dossier a échoué.');
    } finally {
      setInvestorManagementLoading(false);
    }
  };

  const handleResetInvestorPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!investorDetail || !onResetInvestorPassword || !hasPerm('manage_investors_password')) return;
    setInvestorManagementLoading(true);
    setInvestorPasswordError(null);
    setInvestorPasswordMessage(null);
    const submittedPassword = investorResetPassword;
    const targetInvestorId = investorDetail.investor.id;
    const emailKey = investorDetail.investor.email.trim().toLowerCase();
    try {
      await onResetInvestorPassword(targetInvestorId, submittedPassword);
      setSessionTemporaryPasswords((prev) => ({
        ...prev,
        [emailKey]: {
          password: submittedPassword,
          updatedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        }
      }));
      setRevealedTempPasswordKeys((prev) => ({ ...prev, [emailKey]: true }));
      setInvestorDossierPasswords((prev) => ({
        ...prev,
        [targetInvestorId]: { currentPassword: submittedPassword, loading: false }
      }));
      setRevealedDossierPasswordIds((prev) => ({ ...prev, [targetInvestorId]: true }));
      setInvestorResetPassword('');
      setInvestorDetail((prev) =>
        prev
          ? {
              ...prev,
              investor: {
                ...prev.investor,
                hasPasswordConfigured: true,
                passwordAlgorithm: 'pbkdf2-sha512-v2',
                passwordUpdatedAt: new Date().toISOString()
              }
            }
          : prev
      );
      setInvestorPasswordMessage('Mot de passe enregistré et actif immédiatement pour la connexion de l’investisseur.');
    } catch (error) {
      setInvestorPasswordError(error instanceof Error ? error.message : 'La modification du mot de passe a échoué.');
    } finally {
      setInvestorManagementLoading(false);
    }
  };

  const handleSaveInvestorSubscription = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!investorDetail || !editingInvestorSubscription || !onUpdateInvestorSubscription) return;
    setInvestorManagementLoading(true);
    setSubscriptionEditError(null);
    setSubscriptionEditMessage(null);
    try {
      await onUpdateInvestorSubscription(
        investorDetail.investor.id,
        editingInvestorSubscription.id,
        editingInvestorSubscription
      );
      const response = await fetch(`/api/admin/investors/${encodeURIComponent(investorDetail.investor.id)}`, {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.investor || !Array.isArray(data.subscriptions)) {
        throw new Error(data.error || 'La souscription a été modifiée mais son actualisation a échoué.');
      }
      setInvestorDetail({ investor: data.investor, subscriptions: data.subscriptions });
      setEditingInvestorSubscription(null);
      setSubscriptionEditMessage('Historique de souscription actualisé.');
    } catch (error) {
      setSubscriptionEditError(error instanceof Error ? error.message : 'La mise à jour de la souscription a échoué.');
    } finally {
      setInvestorManagementLoading(false);
    }
  };

  const handleRestoreArchive = async (archive: AdminArchive) => {
    try {
      const response = await fetch(`/api/admin/archives/${encodeURIComponent(archive.id)}/restore`, {
        method: 'POST'
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'La restauration a échoué.');
      setArchives((previous) => previous.filter((item) => item.id !== archive.id));
      setArchiveError(null);
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : 'La restauration a échoué.');
    }
  };

  // Handle Official Site Base URL Change (Only Principal Admin)
  const handleSaveBaseUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPrincipal) {
      alert('Seul l’administrateur principal peut configurer le domaine officiel.');
      return;
    }
    let formatted = siteBaseUrlInput.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = `https://${formatted}`;
    }
    formatted = formatted.replace(/\/+$/, '');
    if (onChangeSiteBaseUrl) {
      onChangeSiteBaseUrl(formatted);
    }
    setSeoMessage(`Domaine officiel enregistré : ${formatted}`);
    onAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'update_site_domain',
      description: `Mise à jour du domaine officiel pour le SEO : ${formatted}`,
      entityType: 'role',
      previousState: siteBaseUrl,
      newState: formatted
    });
    setTimeout(() => setSeoMessage(null), 3500);
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadSitemap = () => {
    const cleanBase = (siteBaseUrlInput.trim() || siteBaseUrl).replace(/\/+$/, '');
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${cleanBase}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${cleanBase}/?tab=solutions</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>
  <url>
    <loc>${cleanBase}/?tab=bourse</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.90</priority>
  </url>
  <url>
    <loc>${cleanBase}/?tab=boutique_electronique</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>${cleanBase}/?tab=boutique_electrotechnique</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>${cleanBase}/?tab=boutique_informatique</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>${cleanBase}/?tab=composants</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
  </url>
</urlset>`;

    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sitemap.xml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Video URL change
  const handleSaveVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoInput.trim()) return;
    const oldUrl = heroVideoUrl;
    const clean = videoInput.trim();
    onChangeHeroVideoUrl(clean);
    fetch('/api/admin/hero-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: clean })
    }).catch(() => {});

    setVideoMessage('Vidéo d’accueil mise à jour avec succès sur le serveur.');
    onAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'update_video',
      description: `Mise à jour de la vidéo d'accueil`,
      entityType: 'video',
      previousState: oldUrl,
      newState: clean
    });
    setTimeout(() => setVideoMessage(null), 3500);
  };

  // Handle Formations Video change
  const handleSaveFormationsVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formationsVideoInput.trim() || !onChangeFormationsVideoUrl) return;
    const clean = formationsVideoInput.trim();
    onChangeFormationsVideoUrl(clean);
    fetch('/api/admin/formations-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: clean })
    }).catch(() => {});

    setVideoMessage('Vidéo promotionnelle des Formations mise à jour sur le serveur.');
    onAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'update_video_formations',
      description: `Mise à jour de la vidéo promotionnelle de la page Formations`,
      entityType: 'video',
      previousState: formationsVideoUrl,
      newState: clean
    });
    setTimeout(() => setVideoMessage(null), 3500);
  };

  // Intelligent Auto-detection of Product Category based on Name & Domain
  const handleProductNameChange = (
    name: string,
    domain: 'electronique' | 'electrotechnique' | 'informatique' = newProdDomain,
    forceAutoDetect = false
  ) => {
    setNewProdName(name);
    if (editingProductId && !forceAutoDetect) {
      return;
    }
    const lower = name.toLowerCase();

    if (domain === 'informatique') {
      if (
        lower.includes('laptop') ||
        lower.includes('portable') ||
        lower.includes('dell') ||
        lower.includes('hp') ||
        lower.includes('thinkpad') ||
        lower.includes('macbook') ||
        lower.includes('pc bureau') ||
        lower.includes('desktop') ||
        lower.includes('ordinateur')
      ) {
        setNewProdSubGroup('ordinateurs');
        setNewProdCategoryAutoDetected('Ordinateurs & Postes de Travail');
      } else if (
        lower.includes('ram') ||
        lower.includes('ddr') ||
        lower.includes('ssd') ||
        lower.includes('nvme') ||
        lower.includes('disque') ||
        lower.includes('cpu') ||
        lower.includes('processeur') ||
        lower.includes('core') ||
        lower.includes('ryzen') ||
        lower.includes('graphique') ||
        lower.includes('carte mère')
      ) {
        setNewProdSubGroup('composants_pc');
        setNewProdCategoryAutoDetected('Composants PC & Cartes');
      } else if (
        lower.includes('clavier') ||
        lower.includes('souris') ||
        lower.includes('écran') ||
        lower.includes('ecran') ||
        lower.includes('moniteur') ||
        lower.includes('casque') ||
        lower.includes('webcam') ||
        lower.includes('hub')
      ) {
        setNewProdSubGroup('peripheriques');
        setNewProdCategoryAutoDetected('Périphériques & Affichage');
      } else if (
        lower.includes('switch') ||
        lower.includes('routeur') ||
        lower.includes('wifi') ||
        lower.includes('rj45') ||
        lower.includes('câble réseau') ||
        lower.includes('cable réseau') ||
        lower.includes('patch') ||
        lower.includes('brassage') ||
        lower.includes('ethernet')
      ) {
        setNewProdSubGroup('reseau');
        setNewProdCategoryAutoDetected('Réseau & Câblage Structuré');
      } else if (
        lower.includes('onduleur') ||
        lower.includes('ups') ||
        lower.includes('multiprise') ||
        lower.includes('parasurtenseur') ||
        lower.includes('batterie pc')
      ) {
        setNewProdSubGroup('energie_pc');
        setNewProdCategoryAutoDetected('Onduleurs & Protection Informatique');
      } else {
        setNewProdSubGroup('ordinateurs');
        setNewProdCategoryAutoDetected('Ordinateurs & Équipements');
      }
    } else if (domain === 'electronique') {
      if (
        lower.includes('esp') ||
        lower.includes('stm') ||
        lower.includes('arduino') ||
        lower.includes('carte') ||
        lower.includes('kit') ||
        lower.includes('dev') ||
        lower.includes('raspberry')
      ) {
        setNewProdSubGroup('kits');
        setNewProdCategoryAutoDetected('Microcontrôleurs & Cartes Dev');
      } else if (
        lower.includes('capteur') ||
        lower.includes('sensor') ||
        lower.includes('dht') ||
        lower.includes('ultrason') ||
        lower.includes('iot') ||
        lower.includes('mq')
      ) {
        setNewProdSubGroup('sensors');
        setNewProdCategoryAutoDetected('Capteurs & Modules IoT');
      } else if (
        lower.includes('fer') ||
        lower.includes('soud') ||
        lower.includes('pince') ||
        lower.includes('outil') ||
        lower.includes('station') ||
        lower.includes('multimètre')
      ) {
        setNewProdSubGroup('tools');
        setNewProdCategoryAutoDetected('Outillage & Soudure');
      } else if (
        lower.includes('ic') ||
        lower.includes('ampli') ||
        lower.includes('ne555') ||
        lower.includes('circuit') ||
        lower.includes('régulateur') ||
        lower.includes('7805')
      ) {
        setNewProdSubGroup('ic');
        setNewProdCategoryAutoDetected('Circuits Intégrés & Régulateurs');
      } else {
        setNewProdSubGroup('passifs');
        setNewProdCategoryAutoDetected('Composants Passifs & Discrets');
      }
    } else {
      if (
        lower.includes('disjoncteur') ||
        lower.includes('différentiel') ||
        lower.includes('fusible') ||
        lower.includes('protection') ||
        lower.includes('parafoudre')
      ) {
        setNewProdSubGroup('protection');
        setNewProdCategoryAutoDetected('Protection & Disjoncteurs');
      } else if (
        lower.includes('contacteur') ||
        lower.includes('relais') ||
        lower.includes('bouton') ||
        lower.includes('commutateur')
      ) {
        setNewProdSubGroup('commande');
        setNewProdCategoryAutoDetected('Commande & Contacteurs');
      } else if (
        lower.includes('variateur') ||
        lower.includes('vfd') ||
        lower.includes('moteur') ||
        lower.includes('démarreur')
      ) {
        setNewProdSubGroup('variateurs');
        setNewProdCategoryAutoDetected('Variateurs de Fréquence & Moteurs');
      } else if (
        lower.includes('transfo') ||
        lower.includes('alimentation') ||
        lower.includes('redresseur')
      ) {
        setNewProdSubGroup('alimentation');
        setNewProdCategoryAutoDetected('Alimentations & Transformateurs');
      } else {
        setNewProdSubGroup('cablage');
        setNewProdCategoryAutoDetected('Câblage, Borniers & Coffrets');
      }
    }
  };

  // Strict Server-Backed Upload Helper (signed direct upload to Supabase for >3 MB, server upload otherwise)
  const uploadFileToServer = async (file: File): Promise<string> => {
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      const msg = 'Mode hors ligne : le téléversement de fichiers nécessite une connexion Internet.';
      setUploadStatus({ isUploading: false, message: msg });
      alert(msg);
      throw new Error(msg);
    }
    setUploadStatus({ isUploading: true, message: `Téléversement de "${file.name}" en cours...` });
    try {
      if (file.size > 3 * 1024 * 1024) {
        const prepRes = await fetch('/api/upload/signed-url', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type
          })
        });
        const prepData = await prepRes.json().catch(() => ({}));
        if (prepRes.ok && prepData.success && prepData.signedUrl && prepData.publicUrl) {
          const putRes = await fetch(prepData.signedUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': prepData.contentType || file.type || 'application/octet-stream'
            },
            body: file
          });
          if (!putRes.ok) {
            throw new Error(`Échec du téléversement direct vers Supabase Storage (HTTP ${putRes.status}).`);
          }
          setUploadStatus({ isUploading: false, message: 'Fichier enregistré sur Supabase Storage.' });
          return prepData.publicUrl as string;
        }
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileBase64: base64,
          mimeType: file.type
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.url) {
        const errMsg = data?.error || `Échec du téléversement serveur (HTTP ${res.status}).`;
        setUploadStatus({ isUploading: false, message: errMsg });
        alert(errMsg);
        throw new Error(errMsg);
      }

      setUploadStatus({ isUploading: false, message: 'Fichier enregistré sur le serveur.' });
      return data.url as string;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Échec de transmission vers le serveur.';
      setUploadStatus({ isUploading: false, message: errMsg });
      throw err instanceof Error ? err : new Error(errMsg);
    } finally {
      setTimeout(() => setUploadStatus({ isUploading: false, message: '' }), 3500);
    }
  };

  // Handle Real Photo File Upload from Admin Phone or Computer
  const handlePhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide.');
      return;
    }

    try {
      const publicUrl = await uploadFileToServer(file);
      setNewProdImage(publicUrl);
      setNewProdHasRealPhoto(true);
    } catch {
      // Handled in helper
    }
  };

  // Handle Video File Upload from Admin Phone or Computer
  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'product' | 'course' | 'hero' | 'formations') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Veuillez sélectionner un fichier vidéo valide.');
      return;
    }

    try {
      const publicUrl = await uploadFileToServer(file);
      if (target === 'product') setNewProdVideoUrl(publicUrl);
      else if (target === 'course') setNewCourseVideoUrl(publicUrl);
      else if (target === 'hero') setVideoInput(publicUrl);
      else if (target === 'formations') setFormationsVideoInput(publicUrl);
    } catch {
      // Handled in helper
    }
  };

  // Handle PDF File Upload for Formations
  const handlePdfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const publicUrl = await uploadFileToServer(file);
      setNewCoursePdfUrl(publicUrl);
      if (!newCoursePdfTitle) setNewCoursePdfTitle(file.name.replace(/\.[^/.]+$/, ''));
    } catch {
      // Handled in helper
    }
  };

  // Handle Product Create or Update
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPerm('manage_products')) {
      alert('Action restreinte : Vous ne disposez pas du droit de gestion des produits.');
      return;
    }
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      alert('Mode hors ligne : la création ou modification de produit nécessite une connexion Internet.');
      return;
    }
    if (!newProdName.trim()) return;

    let subGroupKey = newProdSubGroup;
    let categoryKey: any = 'kit';
    let catLabel = newProdCategoryAutoDetected || 'Composants';

    const activeDomainGroups =
      domainGroups[newProdDomain] ||
      (newProdDomain === 'informatique'
        ? INFORMATIQUE_GROUPS
        : newProdDomain === 'electronique'
        ? ELECTRONIQUE_GROUPS
        : ELECTROTECHNIQUE_GROUPS);

    if (newProdDomain === 'informatique') {
      categoryKey = 'informatique';
      const found =
        activeDomainGroups.find((g) => g.id === subGroupKey) ||
        INFORMATIQUE_GROUPS.find((g) => g.id === subGroupKey);
      if (found) catLabel = found.label;
    } else if (newProdDomain === 'electronique') {
      const found =
        activeDomainGroups.find((g) => g.id === subGroupKey) ||
        ELECTRONIQUE_GROUPS.find((g) => g.id === subGroupKey);
      if (found) {
        catLabel = found.label;
        categoryKey = found.id;
      }
    } else {
      const found =
        activeDomainGroups.find((g) => g.id === subGroupKey) ||
        ELECTROTECHNIQUE_GROUPS.find((g) => g.id === subGroupKey);
      if (found) {
        catLabel = found.label;
        categoryKey = found.id;
      }
    }

    const techSpecs = newProdSpecs
      ? newProdSpecs.split(',').map((s) => s.trim()).filter(Boolean)
      : ['Conforme normes industrielles', 'Garantie officielle ELECTRO-MEN'];

    // Availability state logic
    let effectiveStockStatus = newProdStockStatus;
    let effectiveStock = Number(newProdStock) || 0;
    if (effectiveStockStatus === 'in_stock' && effectiveStock <= 0) {
      effectiveStockStatus = 'out_of_stock';
    } else if (effectiveStockStatus === 'out_of_stock') {
      effectiveStock = 0;
    }

    const formattedName = formatProductTitle(newProdName) || newProdName.trim();
    const targetId = editingProductId || `prod-${Date.now()}`;
    const productData: Product = {
      id: targetId,
      name: formattedName,
      brand: newProdBrand.trim() || undefined,
      ref: newProdRef.trim() || targetId.toUpperCase(),
      domain: newProdDomain,
      subGroup: subGroupKey,
      category: categoryKey,
      categoryLabel: catLabel,
      price: Number(newProdPrice) || 0,
      oldPrice: newProdOldPrice !== '' && Number(newProdOldPrice) > 0 ? Number(newProdOldPrice) : undefined,
      stock: effectiveStock,
      stockStatus: effectiveStockStatus,
      inStock: effectiveStockStatus === 'in_stock' && effectiveStock > 0,
      description: newProdDesc.trim() || `Produit haute précision certifié ELECTRO-MEN.`,
      details: techSpecs,
      specs: techSpecs,
      // Strict photo policy: only use real photo if provided, else mark hasRealPhoto: false
      image: newProdHasRealPhoto ? newProdImage : undefined,
      hasRealPhoto: newProdHasRealPhoto,
      videoUrl: newProdVideoUrl.trim() || undefined,
      isPublished: !newProdIsDraft,
      isDraft: newProdIsDraft,
      isFeaturedOnHome: newProdIsFeaturedOnHome,
      isPremium: newProdIsFeaturedOnHome,
      isPromo: newProdIsPromo,
      isNew: newProdIsNew,
      isNewArrival: newProdIsNew,
      isFlashSale: newProdIsFlashSale
    };

    try {
      if (editingProductId) {
        await Promise.resolve(onUpdateProduct(productData));
        onAddAuditLog({
          author: currentAdminName,
          date: new Date().toLocaleString('fr-FR'),
          actionType: 'update_product',
          description: `Mise à jour du produit "${productData.name}" (${productData.ref}) - Disponibilité: ${getStockStatusLabel(effectiveStockStatus)}`,
          entityType: 'product',
          newState: productData,
          targetId: productData.id
        });
      } else {
        await Promise.resolve(onAddProduct(productData));
        onAddAuditLog({
          author: currentAdminName,
          date: new Date().toLocaleString('fr-FR'),
          actionType: 'create_product',
          description: `Ajout du produit "${productData.name}" (${productData.ref}) - Disponibilité: ${getStockStatusLabel(effectiveStockStatus)}`,
          entityType: 'product',
          newState: productData,
          targetId: productData.id
        });

        // Dispatch WhatsApp-style notification if requested
        if (notifyUsersOnPublish && !newProdIsDraft && onAddNotification) {
          onAddNotification({
            type: 'product',
            title: `Nouveau produit : ${productData.name}`,
            message: `Nouveau produit disponible au rayon ${newProdDomain === 'informatique' ? 'Informatique' : newProdDomain === 'electrotechnique' ? 'Électrotechnique' : 'Électronique'} : ${productData.name} (${productData.price.toLocaleString('fr-FR')} FCFA).`,
            actionTab: newProdDomain === 'informatique' ? 'boutique_informatique' : newProdDomain === 'electrotechnique' ? 'boutique_electrotechnique' : 'boutique_electronique',
            actionProductId: productData.id,
            priority: 'high'
          });
        }
      }

      // Reset Form after server save
      setIsAddProdOpen(false);
      setEditingProductId(null);
      setNewProdName('');
      setNewProdBrand('');
      setNewProdRef('');
      setNewProdPrice(150000);
      setNewProdOldPrice('');
      setNewProdStock(5);
      setNewProdStockStatus('in_stock');
      setNewProdDesc('');
      setNewProdSpecs('');
      setNewProdImage('');
      setNewProdHasRealPhoto(false);
      setNewProdVideoUrl('');
      setNewProdIsDraft(false);
      setNewProdIsFeaturedOnHome(false);
      setNewProdIsPromo(false);
      setNewProdIsNew(false);
      setNewProdIsFlashSale(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde du produit.');
    }
  };

  // Quick toggle availability status from table
  const handleQuickChangeStockStatus = (prod: Product, newStatus: ProductStockStatus) => {
    if (!hasPerm('manage_products')) return;
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      alert('Mode hors ligne : la mise à jour du stock nécessite une connexion Internet.');
      return;
    }
    const updatedProd: Product = {
      ...prod,
      stockStatus: newStatus,
      inStock: newStatus === 'in_stock' && (prod.stock > 0),
      stock: newStatus === 'out_of_stock' ? 0 : prod.stock > 0 ? prod.stock : 5
    };
    onUpdateProduct(updatedProd);
    onAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'update_stock_status',
      description: `Modification disponibilité "${prod.name}" (${prod.ref}) : ${getStockStatusLabel(newStatus)}`,
      entityType: 'product',
      previousState: getProductStockStatus(prod),
      newState: newStatus,
      targetId: prod.id
    });
  };

  // Open edit modal for an existing product
  const handleEditProduct = (prod: Product) => {
    if (!hasPerm('manage_products')) return;
    setEditingProductId(prod.id);
    setNewProdName(prod.name);
    setNewProdBrand(prod.brand || '');
    setNewProdRef(prod.ref);
    setNewProdDomain(prod.domain || 'informatique');
    setNewProdSubGroup(prod.subGroup || 'ordinateurs');
    setNewProdCategoryAutoDetected(prod.categoryLabel || '');
    setNewProdPrice(prod.price);
    setNewProdOldPrice(prod.oldPrice !== undefined ? prod.oldPrice : '');
    setNewProdStock(prod.stock || 0);
    setNewProdStockStatus(getProductStockStatus(prod));
    setNewProdDesc(prod.description);
    setNewProdSpecs(prod.specs ? prod.specs.join(', ') : '');
    setNewProdImage(prod.image || '');
    setNewProdHasRealPhoto(Boolean(prod.hasRealPhoto));
    setNewProdVideoUrl(prod.videoUrl || '');
    setNewProdIsDraft(Boolean(prod.isDraft));
    setNewProdIsFeaturedOnHome(Boolean(prod.isFeaturedOnHome));
    setNewProdIsPromo(Boolean(prod.isPromo || (prod.oldPrice && prod.oldPrice > prod.price)));
    setNewProdIsNew(Boolean(prod.isNew || prod.isNewArrival));
    setNewProdIsFlashSale(Boolean(prod.isFlashSale));
    setIsAddProdOpen(true);
  };

  // Handle Product Delete with confirmation
  const handleRequestDeleteProduct = (prod: Product) => {
    if (!hasPerm('delete_products')) {
      alert('Action restreinte : Vous ne disposez pas du droit de suppression de produits.');
      return;
    }
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      alert('Mode hors ligne : la suppression de produit nécessite une connexion Internet.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Supprimer ce produit ?',
      message: `Voulez-vous supprimer définitivement "${prod.name}" (${prod.ref}) ?`,
      onConfirm: () => {
        onDeleteProduct(prod.id);
        onAddAuditLog({
          author: currentAdminName,
          date: new Date().toLocaleString('fr-FR'),
          actionType: 'delete_product',
          description: `Suppression du produit "${prod.name}" (${prod.ref})`,
          entityType: 'product',
          previousState: prod,
          targetId: prod.id
        });
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Cancel & collapse secondary admin creation form
  const handleCancelSecondaryAdminForm = () => {
    setSecondaryAdminEmailInput('');
    setSecondaryAdminNameInput('');
    setSecondaryAdminPhoneInput('');
    setSecondaryAdminPermissions([]);
    setSecondaryAdminFormError(null);
    setIsAddSecondaryAdminOpen(false);
  };

  // Handle Secondary Admin creation
  const handleAddSecondaryAdminByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPrincipal) {
      setSecondaryAdminFormError('Action restreinte : Seul l’administrateur principal peut nommer un administrateur secondaire.');
      return;
    }

    const cleanEmail = secondaryAdminEmailInput.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setSecondaryAdminFormError('Veuillez saisir une adresse email professionnelle valide.');
      return;
    }

    const existing = adminUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      setSecondaryAdminFormError(`L'utilisateur ${cleanEmail} est déjà administrateur (${existing.role === 'admin_principal' ? 'Principal' : 'Secondaire'}).`);
      return;
    }

    const investor = registeredInvestors.find((inv) => inv.email.toLowerCase() === cleanEmail);
    const assignedName =
      secondaryAdminNameInput.trim() ||
      investor?.name ||
      cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const assignedPhone = secondaryAdminPhoneInput.trim() || investor?.phone || '+226 -- -- -- --';
    const initialPass = `SEC-${Math.floor(1000 + Math.random() * 9000)}-ELM`;

    setIsCreatingSecondaryAdmin(true);
    setSecondaryAdminFormError(null);

    let response: Response;
    let result: { success?: boolean; error?: string; admin?: AdminUser };
    try {
      response = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: assignedName,
          phone: assignedPhone,
          role: 'admin_secondaire',
          password: initialPass,
          permissions: secondaryAdminPermissions
        })
      });
      result = await response.json();
    } catch {
      setIsCreatingSecondaryAdmin(false);
      setSecondaryAdminFormError('Le serveur est momentanément indisponible. Le compte administrateur n’a pas été créé.');
      return;
    }

    setIsCreatingSecondaryAdmin(false);

    if (!response.ok || !result.success || !result.admin) {
      setSecondaryAdminFormError(result.error || 'La création du compte administrateur a échoué.');
      return;
    }

    const newAdminUser = result.admin;
    const grantedCount = (newAdminUser.permissions || secondaryAdminPermissions).length;
    setAdminUsers((prev) => [...prev, newAdminUser]);
    setSecondaryAdminEmailInput('');
    setSecondaryAdminNameInput('');
    setSecondaryAdminPhoneInput('');
    setSecondaryAdminPermissions([]);
    setSecondaryAdminFormError(null);
    setIsAddSecondaryAdminOpen(false);
    setCopiedTempPass(false);
    setSecondaryAdminFeedback({
      message: `${assignedName} (${cleanEmail}) a été nommé administrateur secondaire avec ${grantedCount} droit${grantedCount > 1 ? 's' : ''}.`,
      email: cleanEmail,
      tempPassword: initialPass
    });

    onAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'add_secondary_admin',
      description: `Nomination de ${assignedName} (${cleanEmail}) comme Administrateur Secondaire (${grantedCount} permission(s))`,
      entityType: 'role',
      newState: newAdminUser
    });
  };

  // Principal Admin updates Secondary Admin granular permissions (including full revocation)
  const handleUpdateAdminPermissions = async (user: AdminUser, nextPermissions: AdminPermission[]) => {
    if (!isPrincipal || user.role !== 'admin_secondaire') return;
    setSavingAdminPermId(user.id);
    setAdminPermFeedback(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/permissions`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: nextPermissions })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        alert(result.error || 'La mise à jour des droits a échoué.');
        return;
      }
      const updatedPermissions: AdminPermission[] = Array.isArray(result.permissions) ? result.permissions : nextPermissions;
      setAdminUsers((prev) =>
        prev.map((item) => (item.id === user.id ? { ...item, permissions: updatedPermissions } : item))
      );
      setAdminPermDrafts((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      setExpandedPermAdminId(null);
      setAdminPermFeedback(
        `Droits de ${user.name} mis à jour (${updatedPermissions.length} droit(s) actif(s)).`
      );
      onAddAuditLog({
        author: currentAdminName,
        date: new Date().toLocaleString('fr-FR'),
        actionType: 'update_secondary_admin_permissions',
        description: `Mise à jour des droits de ${user.email} : ${updatedPermissions.length} permission(s) active(s).`,
        entityType: 'role',
        newState: updatedPermissions
      });
      setTimeout(() => setAdminPermFeedback(null), 5000);
    } catch {
      alert('Impossible de joindre le serveur pour mettre à jour les droits.');
    } finally {
      setSavingAdminPermId(null);
    }
  };

  // Principal Admin edits Secondary Admin password
  const handleSaveSecondaryAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPrincipal || !editingSecondaryAdminPass) return;
    const cleanPass = editingSecondaryAdminPass.newPass.trim();
    if (cleanPass.length < 8 || cleanPass.length > 128) {
      alert('Le mot de passe doit comporter entre 8 et 128 caractères.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(editingSecondaryAdminPass.user.id)}/password`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: cleanPass })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        alert(result.error || 'La modification du mot de passe a échoué.');
        return;
      }
    } catch {
      alert('Le serveur est momentanément indisponible. Le mot de passe n’a pas été modifié.');
      return;
    }

    onAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'update_secondary_admin_password',
      description: `Modification manuelle du mot de passe de l'administrateur secondaire : ${editingSecondaryAdminPass.user.name} (${editingSecondaryAdminPass.user.email})`,
      entityType: 'role'
    });

    setAdminPermFeedback(`Mot de passe de ${editingSecondaryAdminPass.user.name} modifié avec succès.`);
    setTimeout(() => setAdminPermFeedback(null), 5000);
    setEditingSecondaryAdminPass(null);
  };

  // Principal Admin deletes Secondary Admin
  const handleDeleteSecondaryAdmin = (userId: string, userName: string, userEmail: string) => {
    if (!isPrincipal) {
      alert("Action refusée : Seul le Super-Administrateur Principal peut supprimer un compte administrateur.");
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Révoquer cet administrateur secondaire ?',
      message: `Supprimer définitivement le compte "${userName}" (${userEmail}) ? Il perdra immédiatement tout accès à l'administration.`,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
            method: 'DELETE',
            credentials: 'same-origin'
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            alert(result.error || 'La suppression du compte administrateur a échoué.');
            return;
          }
        } catch {
          alert('Le serveur est momentanément indisponible. Le compte administrateur n’a pas été supprimé.');
          return;
        }

        setAdminUsers((prev) => prev.filter((u) => u.id !== userId));
        if (expandedPermAdminId === userId) {
          setExpandedPermAdminId(null);
        }

        onAddAuditLog({
          author: currentAdminName,
          date: new Date().toLocaleString('fr-FR'),
          actionType: 'delete_secondary_admin',
          description: `Révocation et suppression définitive du compte administrateur secondaire : ${userName} (${userEmail})`,
          entityType: 'role'
        });

        setSecondaryAdminFeedback({
          message: `Le compte administrateur secondaire « ${userName} » (${userEmail}) a été révoqué et supprimé.`
        });
      }
    });
  };

  // Handle Course Create
  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPerm('manage_courses')) {
      alert('Action restreinte : Vous ne disposez pas du droit de gestion des formations.');
      return;
    }
    if (!newCourseTitle.trim()) return;

    const courseData: Course = {
      id: `crs-${Date.now()}`,
      title: newCourseTitle.trim(),
      category: newCourseDomain === 'informatique' ? 'Informatique & Réseaux' : newCourseDomain === 'electrotechnique' ? 'Électrotechnique Industrielle' : 'Électronique & IoT',
      domain: newCourseDomain,
      level: newCourseLevel,
      duration: newCourseDuration,
      rating: 4.95,
      price: newCourseIsFree ? 0 : Number(newCoursePrice) || 0,
      isFree: newCourseIsFree,
      badge: newCourseIsFree ? '100% Gratuit' : 'Certifiant',
      description: newCourseDesc.trim() || `Programme d'excellence certifié ELECTRO-MEN.`,
      features: ['Vidéos pratiques HD', 'Supports de cours téléchargeables', 'Attestation officielle'],
      instructor: 'Direction Pédagogique ELECTRO-MEN',
      hasHardwareKit: false,
      modulesCount: newCourseModules.length,
      status: 'published',
      pdfUrl: newCoursePdfUrl.trim() || undefined,
      pdfTitle: newCoursePdfTitle.trim() || undefined,
      videoUrl: newCourseVideoUrl.trim() || undefined,
      syllabus: newCourseModules
    };

    onAddCourse(courseData);
    onAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'create_course',
      description: `Création du programme de formation "${courseData.title}" (${newCourseDomain})`,
      entityType: 'course',
      newState: courseData,
      targetId: courseData.id
    });

    if (notifyCourseOnPublish && onAddNotification) {
      onAddNotification({
        type: 'course',
        title: `Nouvelle Formation : ${courseData.title}`,
        message: `Nouveau programme ${newCourseDomain} : ${courseData.title} (${courseData.isFree ? '100% Gratuit' : `${courseData.price} FCFA`}).`,
        actionTab: 'solutions',
        priority: 'medium'
      });
    }

    setIsAddCourseOpen(false);
    setNewCourseTitle('');
    setNewCourseDesc('');
    setNewCoursePdfUrl('');
    setNewCoursePdfTitle('');
    setNewCourseVideoUrl('');
    setNewCourseModules([
      { id: 'mod-1', title: 'Module 1 : Fondamentaux & Diagnostic', duration: '6h', summary: 'Introduction' }
    ]);
  };

  // Delivery Zone Creation
  const handleCreateDeliveryZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPerm('manage_delivery')) {
      alert('Action restreinte : Vous ne disposez pas du droit de gestion de la logistique et livraison.');
      return;
    }
    if (!newZoneName.trim()) return;

    const zoneFee = Number(newZoneFee) || 0;
    const zoneDelay = newZoneDelay.trim() || '24h à 48h';
    const zone: DeliveryZone = {
      id: `zone-${Date.now()}`,
      name: newZoneName.trim(),
      tarif: zoneFee,
      fee: zoneFee,
      estimatedDelay: zoneDelay,
      delay: zoneDelay,
      keywords: newZoneKeywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean),
      isActive: true
    };

    const nextZones = [...deliveryZones, zone];
    if (onUpdateDeliveryZones) onUpdateDeliveryZones(nextZones);

    onAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'create_delivery_zone',
      description: `Ajout de la zone de livraison "${zone.name}" (${zone.tarif} FCFA)`,
      entityType: 'delivery',
      newState: zone
    });

    setIsAddZoneOpen(false);
    setNewZoneName('');
    setNewZoneKeywords('');
  };

  // Admin Voice Note Recording (WhatsApp-style)
  const startAdminVoiceRecording = async () => {
    if (!hasPerm('manage_content') || isRecordingAdminVoice || isSendingAdminChat) return;
    setAdminVoiceError(null);
    setAdminVoiceDraft(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setAdminVoiceError('Votre navigateur ne prend pas en charge l’enregistrement audio.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      adminVoiceStreamRef.current = stream;
      const candidateTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const chosenType = candidateTypes.find((type) =>
        typeof MediaRecorder.isTypeSupported === 'function' ? MediaRecorder.isTypeSupported(type) : false
      );
      const recorder = chosenType ? new MediaRecorder(stream, { mimeType: chosenType }) : new MediaRecorder(stream);
      adminMediaRecorderRef.current = recorder;
      adminVoiceChunksRef.current = [];
      adminVoiceCancelledRef.current = false;
      adminVoiceStartRef.current = Date.now();
      setAdminRecordingSeconds(0);
      setIsRecordingAdminVoice(true);

      adminVoiceTimerRef.current = window.setInterval(() => {
        setAdminRecordingSeconds(Math.max(1, Math.round((Date.now() - adminVoiceStartRef.current) / 1000)));
      }, 400);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          adminVoiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const wasCancelled = adminVoiceCancelledRef.current;
        const elapsedSec = Math.max(1, Math.round((Date.now() - adminVoiceStartRef.current) / 1000));
        if (adminVoiceTimerRef.current !== null) {
          window.clearInterval(adminVoiceTimerRef.current);
          adminVoiceTimerRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        adminVoiceStreamRef.current = null;
        setIsRecordingAdminVoice(false);
        setAdminRecordingSeconds(0);
        if (wasCancelled) return;

        const mimeType = recorder.mimeType || chosenType || 'audio/webm';
        const blob = new Blob(adminVoiceChunksRef.current, { type: mimeType });
        if (blob.size < 128) {
          setAdminVoiceError('Enregistrement audio trop court.');
          return;
        }
        setIsSendingAdminChat(true);
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
          const uploadData = await uploadRes.json().catch(() => ({}));
          if (!uploadRes.ok || !uploadData.success || !uploadData.url) {
            throw new Error(uploadData.error || 'Échec du téléversement du message vocal.');
          }
          setAdminVoiceDraft({
            audioUrl: uploadData.url,
            audioDuration: elapsedSec
          });
        } catch (err) {
          setAdminVoiceError(err instanceof Error ? err.message : 'Erreur lors du traitement du vocal.');
        } finally {
          setIsSendingAdminChat(false);
        }
      };

      recorder.start(250);
    } catch {
      setAdminVoiceError('Accès au microphone refusé ou indisponible.');
      setIsRecordingAdminVoice(false);
    }
  };

  const stopAdminVoiceRecording = (cancel = false) => {
    adminVoiceCancelledRef.current = cancel;
    if (adminMediaRecorderRef.current && adminMediaRecorderRef.current.state !== 'inactive') {
      try {
        adminMediaRecorderRef.current.stop();
      } catch {}
    } else if (cancel) {
      setIsRecordingAdminVoice(false);
      setAdminRecordingSeconds(0);
    }
  };

  const handleSendAdminVoiceDraft = async () => {
    if (!adminVoiceDraft || !onSendAdminMessage || isSendingAdminChat || !hasPerm('manage_content')) return;
    setIsSendingAdminChat(true);
    setAdminVoiceError(null);
    try {
      const labelText = adminChatText.trim() || 'Message vocal officiel';
      await Promise.resolve(onSendAdminMessage(labelText, adminVoiceDraft));
      setAdminVoiceDraft(null);
      setAdminChatText('');
      onAddAuditLog({
        author: currentAdminName,
        date: new Date().toLocaleString('fr-FR'),
        actionType: 'admin_chat_voice',
        description: `Note vocale officielle envoyée sur l'espace Investisseurs (${adminVoiceDraft.audioDuration}s)`,
        entityType: 'chat'
      });
    } catch (err) {
      setAdminVoiceError(err instanceof Error ? err.message : 'Envoi du message vocal refusé.');
    } finally {
      setIsSendingAdminChat(false);
    }
  };

  // Admin writes to Investor Chat (anti-double-send lock)
  const handleSendAdminChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPerm('manage_content') || isSendingAdminChat || !onSendAdminMessage) return;
    if (adminVoiceDraft) {
      await handleSendAdminVoiceDraft();
      return;
    }
    if (!adminChatText.trim()) return;

    setIsSendingAdminChat(true);
    setAdminVoiceError(null);
    try {
      await Promise.resolve(onSendAdminMessage(adminChatText.trim()));
      setAdminChatText('');
      onAddAuditLog({
        author: currentAdminName,
        date: new Date().toLocaleString('fr-FR'),
        actionType: 'admin_chat_message',
        description: `Message officiel envoyé sur l'espace Investisseurs`,
        entityType: 'chat'
      });
    } catch (err) {
      setAdminVoiceError(err instanceof Error ? err.message : 'Envoi du message refusé.');
    } finally {
      setIsSendingAdminChat(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {!isOnline && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-semibold flex items-center gap-2.5 shadow-2xs"
        >
          <span className="material-symbols-outlined text-lg text-amber-700 shrink-0">wifi_off</span>
          <span>
            Mode hors ligne : la consultation du catalogue local reste possible, mais les actions administrateur nécessitant Internet (import CSV, création, édition ou suppression de produits) sont temporairement bloquées.
          </span>
        </div>
      )}
      {/* =========================================================================
          ADMIN CONSOLE HEADER (FOND BLANC STRICT CONFORME À LA DEMANDE)
          ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white text-slate-900 shadow-sm border-2 border-slate-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#b48c1e] p-0.5 flex items-center justify-center shrink-0 shadow-md">
              <span className="material-symbols-outlined text-white text-2xl">admin_panel_settings</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-syne text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                  Centre de Commande Centralisé
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    isPrincipal ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                  }`}
                >
                  {isPrincipal
                    ? 'Super-Admin Principal'
                    : `Admin Secondaire (${currentAdminPermissions.length} droit${currentAdminPermissions.length > 1 ? 's' : ''})`}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Opérateur : <span className="font-semibold text-slate-900">{currentAdminName}</span> • Ouagadougou, BF
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Live Connected Users Counter */}
            {canViewRealtime && (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{presenceBreakdown.total} connectés</span>
              </div>
            )}

            {/* Maintenance Mode Switch */}
            {isPrincipal && (
              <button
                type="button"
                onClick={() => {
                  const nextState = !isMaintenanceMode;
                  if (confirm(nextState ? 'Mettre le site en veille / maintenance technique ? Les visiteurs verront l’écran de maintenance.' : 'Désactiver le mode maintenance et réouvrir le site au public ?')) {
                    if (onToggleMaintenanceMode) onToggleMaintenanceMode(nextState);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs border ${
                  isMaintenanceMode
                    ? 'bg-amber-500 text-slate-950 border-amber-600 animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
                title="Mettre le site en veille / maintenance"
              >
                <span className="material-symbols-outlined text-sm">
                  {isMaintenanceMode ? 'build_circle' : 'offline_bolt'}
                </span>
                <span>{isMaintenanceMode ? 'Site en Maintenance' : 'Mettre en Veille'}</span>
              </button>
            )}

            {/* Exit Admin */}
            <button
              type="button"
              onClick={onExitAdmin}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-sm">visibility</span>
              <span>Vue Publique</span>
            </button>
          </div>
        </div>

        {/* Admin Navigation Pills */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          {allowedAdminTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-[#d4af37] to-[#b48c1e] text-slate-950 shadow-sm font-extrabold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === 'realtime' && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          TAB: DASHBOARD OVERVIEW
          ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Fast KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-bold block">Catalogue Produits</span>
              <div className="text-xl font-bold text-slate-900 mt-1">{products.length} réf.</div>
              <span className="text-[10px] text-emerald-600 font-semibold">Électronique, Électrotech &amp; Info</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-bold block">Programmes Formations</span>
              <div className="text-xl font-bold text-slate-900 mt-1">{courses.length} cours</div>
              <span className="text-[10px] text-cyan-600 font-semibold">3 Domaines Pratiques</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-bold block">Actionnariat Partenaire</span>
              <div className="text-xl font-bold text-slate-900 mt-1">{subscriptions.length} souscriptions</div>
              <span className="text-[10px] text-amber-600 font-semibold">Tarification définie par opération</span>
            </div>

            {canViewRealtime ? (
              <button
                type="button"
                onClick={() => setActiveTab('realtime')}
                className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 shadow-xs text-left cursor-pointer transition-all hover:bg-emerald-50/30 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-bold block">Activité en Direct</span>
                  <span className="flex items-center gap-1 text-[9px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>EN DIRECT</span>
                  </span>
                </div>
                <div className="text-xl font-bold text-emerald-600 mt-1 flex items-baseline gap-1">
                  <span>{presenceBreakdown.total}</span>
                  <span className="text-xs text-slate-500 font-semibold">connecté{presenceBreakdown.total > 1 ? 's' : ''}</span>
                </div>
                <span className="text-[10px] text-emerald-700 font-semibold group-hover:underline">
                  Voir la console temps réel →
                </span>
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs text-left">
                <span className="text-[11px] text-slate-500 font-bold block">Profil Administrateur</span>
                <div className="text-base font-bold text-slate-900 mt-1">
                  {currentAdminPermissions.length} droit{currentAdminPermissions.length > 1 ? 's' : ''} actif{currentAdminPermissions.length > 1 ? 's' : ''}
                </div>
                <span className="text-[10px] text-slate-500 font-semibold">
                  Accès délégué par l’admin principal
                </span>
              </div>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#b48c1e]">rocket_launch</span>
              <span>Actions Rapides de Gestion</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {hasPerm('manage_products') && (
                <button
                  onClick={() => {
                    setActiveTab('market');
                    setIsAddProdOpen(true);
                    setNewProdDomain('informatique');
                  }}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left font-bold text-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>+ Ajouter Matériel Informatique</span>
                  <span className="material-symbols-outlined text-sm text-cyan-700">laptop_mac</span>
                </button>
              )}

              {hasPerm('manage_subscriptions') && (
                <button
                  onClick={() => {
                    setActiveTab('subscriptions');
                    openProfitDistributionModal();
                  }}
                  className="p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left font-bold text-emerald-950 flex items-center justify-between cursor-pointer"
                >
                  <span>+ Distribuer des Dividendes</span>
                  <span className="material-symbols-outlined text-sm text-emerald-700">account_balance_wallet</span>
                </button>
              )}

              {(hasPerm('manage_content') || hasPerm('manage_investors')) && (
                <button
                  onClick={() => {
                    setActiveTab('investors');
                  }}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left font-bold text-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>Modérer la Messagerie ({investorMessages.length})</span>
                  <span className="material-symbols-outlined text-sm text-emerald-600">forum</span>
                </button>
              )}
            </div>
          </div>

          {/* CENTRE OFFICIEL DE NETTOYAGE & PURGE DES DONNÉES DE TEST */}
          {isPrincipal && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-50/70 via-white to-amber-50/70 border-2 border-red-300 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-red-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-600 text-2xl">delete_sweep</span>
                  <div>
                    <h3 className="font-syne text-sm font-black text-slate-900 uppercase">
                      Centre de Nettoyage &amp; Purge des Données de Test
                    </h3>
                    <span className="text-[10px] text-slate-500">
                      Suppression définitive des données de test avant hébergement &amp; production officielle
                    </span>
                  </div>
                </div>
                <span className="text-[10px] bg-red-600 text-white font-extrabold px-2.5 py-1 rounded-full uppercase shadow-2xs">
                  Direction Générale
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                Utilisez ces commandes pour supprimer les données saisies par vous-même ou par les utilisateurs lors des tests (souscriptions, dépôts/retraits, comptes investisseurs fictifs, transactions). Les catalogues produits, cours et formations sont quant à eux préservés.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 text-xs">
                {/* 1. Purger demandes */}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Purger TOUTES les demandes de souscription et les demandes de dépôt/retrait enregistrées lors des tests ?\n\nCette action remettra les compteurs de demandes à zéro.")) {
                      onPurgeTestData?.('requests');
                      onAddAuditLog({
                        author: currentAdminName,
                        date: new Date().toLocaleString('fr-FR'),
                        actionType: 'purge_requests',
                        description: 'Purge complète des demandes utilisateurs (Souscriptions, Dépôts, Retraits)',
                        entityType: 'wallet'
                      });
                      alert('Toutes les demandes de souscription et de trésorerie ont été purgées avec succès !');
                    }
                  }}
                  className="p-3.5 rounded-xl bg-white hover:bg-red-50/80 border border-slate-200 hover:border-red-300 text-slate-800 flex flex-col justify-between gap-2 shadow-2xs transition-all cursor-pointer text-left active:scale-95"
                >
                  <div className="flex items-center gap-1.5 font-bold text-red-800">
                    <span className="material-symbols-outlined text-base">receipt_long</span>
                    <span>Purger les Demandes</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Efface les {subscriptions.length} souscription(s) et {fundRequests.length} demande(s) de fonds.
                  </span>
                </button>

                {/* 2. Purger investisseurs */}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Purger TOUS les comptes investisseurs créés lors des tests ?\n\nSeuls les futurs comptes créés officiellement par les utilisateurs apparaîtront.")) {
                      onPurgeTestData?.('investors');
                      onAddAuditLog({
                        author: currentAdminName,
                        date: new Date().toLocaleString('fr-FR'),
                        actionType: 'purge_investors',
                        description: 'Purge complète des comptes investisseurs de test',
                        entityType: 'investor'
                      });
                      alert('Tous les comptes investisseurs de test ont été purgés !');
                    }
                  }}
                  className="p-3.5 rounded-xl bg-white hover:bg-amber-50/80 border border-slate-200 hover:border-amber-300 text-slate-800 flex flex-col justify-between gap-2 shadow-2xs transition-all cursor-pointer text-left active:scale-95"
                >
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <span className="material-symbols-outlined text-base">group_remove</span>
                    <span>Purger les Investisseurs</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Efface les {registeredInvestors.length} compte(s) investisseur(s) de test.
                  </span>
                </button>

                {/* 3. Purger portefeuilles */}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Purger l’historique des transactions financières et réinitialiser les soldes des portefeuilles à zéro ?")) {
                      onPurgeTestData?.('wallets');
                      onAddAuditLog({
                        author: currentAdminName,
                        date: new Date().toLocaleString('fr-FR'),
                        actionType: 'purge_wallets',
                        description: 'Purge des transactions et réinitialisation des portefeuilles financiers',
                        entityType: 'wallet'
                      });
                      alert('Historique des transactions et soldes des portefeuilles remis à zéro !');
                    }
                  }}
                  className="p-3.5 rounded-xl bg-white hover:bg-cyan-50/80 border border-slate-200 hover:border-cyan-300 text-slate-800 flex flex-col justify-between gap-2 shadow-2xs transition-all cursor-pointer text-left active:scale-95"
                >
                  <div className="flex items-center gap-1.5 font-bold text-cyan-900">
                    <span className="material-symbols-outlined text-base">account_balance</span>
                    <span>Purger les Portefeuilles</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Efface les {transactions.length} transaction(s) et remet les soldes à 0 F.
                  </span>
                </button>

                {/* 4. Remise à zéro intégrale */}
                <button
                  type="button"
                  onClick={() => {
                    setResetConfirmedCheckbox(false);
                    setResetError(null);
                    setResetSuccessMessage(null);
                    setIsTotalResetModalOpen(true);
                  }}
                  className="p-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white flex flex-col justify-between gap-2 shadow-sm transition-all cursor-pointer text-left active:scale-95"
                >
                  <div className="flex items-center gap-1.5 font-extrabold text-white">
                    <span className="material-symbols-outlined text-base text-amber-300">restart_alt</span>
                    <span>Remise à Zéro Totale</span>
                  </div>
                  <span className="text-[10px] text-red-100">
                    Procédure de sécurité renforcée avec sauvegarde JSON &amp; Code Maître.
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB: UTILISATEURS CONNECTÉS EN TEMPS RÉEL (FLUX SERVEUR SSE & SESSIONS)
          ========================================================================= */}
      {activeTab === 'realtime' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Flux SSE Temps Réel Actif</span>
                </span>
                <span className="text-xs text-slate-400 font-mono">Ping 10s • Émission directe</span>
              </div>
              <h2 className="font-syne text-base sm:text-lg font-bold text-slate-900">
                Surveillance des Utilisateurs Connectés
              </h2>
              <p className="text-xs text-slate-500">
                Visionnez en temps réel chaque session active sur ELECTRO-MEN : identité, rôles, pages consultées, appareils et temps de navigation.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  fetch('/api/presence/online-users')
                    .then(r => r.json())
                    .then(data => {
                      if (data?.sessions) setLiveUsers(data.sessions);
                      if (data?.breakdown) setPresenceBreakdown(data.breakdown);
                    });
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Actualiser instantanément la liste des sessions"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span>Rafraîchir</span>
              </button>
            </div>
          </div>

          {/* Breakdown KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-bold block">Total Connectés</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{presenceBreakdown.total}</div>
              <span className="text-[10px] text-slate-400">Sessions ouvertes</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-bold block">Investisseurs</span>
              <div className="text-2xl font-black text-amber-600 mt-1">{presenceBreakdown.investors}</div>
              <span className="text-[10px] text-amber-700 font-semibold">Comptes partenaires</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-bold block">Clients Connectés</span>
              <div className="text-2xl font-black text-cyan-600 mt-1">{presenceBreakdown.clients}</div>
              <span className="text-[10px] text-cyan-700 font-semibold">Acheteurs boutiques</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-bold block">Visiteurs Publics</span>
              <div className="text-2xl font-black text-slate-700 mt-1">{presenceBreakdown.visitors}</div>
              <span className="text-[10px] text-slate-400">Non authentifiés</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-bold block">Administrateurs</span>
              <div className="text-2xl font-black text-purple-600 mt-1">{presenceBreakdown.admins}</div>
              <span className="text-[10px] text-purple-700 font-semibold">Console de gestion</span>
            </div>
          </div>

          {/* Active Sessions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-lg">radar</span>
                <span className="font-syne text-xs font-bold text-slate-800">
                  Sessions Utilisateurs en Ligne ({liveUsers.length})
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                Expiration automatique après 35s d'inactivité
              </span>
            </div>

            {liveUsers.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-2xl">sensors_off</span>
                </div>
                <h4 className="font-syne text-xs font-bold text-slate-800">Aucun utilisateur connecté pour le moment</h4>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Dès qu'un client, investisseur ou visiteur ouvrira l'application, sa session s'affichera ici en direct avec son statut et sa navigation.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                <div className="grid grid-cols-12 gap-2 p-2.5 bg-slate-100/70 text-[10px] font-bold text-slate-600 uppercase tracking-wider min-w-[700px]">
                  <div className="col-span-3">Utilisateur / Session</div>
                  <div className="col-span-2">Rôle</div>
                  <div className="col-span-2">Page Consultée</div>
                  <div className="col-span-2">Appareil &amp; OS</div>
                  <div className="col-span-2">Activité</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                {liveUsers.map((session) => {
                  const roleBadgeClass =
                    session.userRole === 'admin'
                      ? 'bg-purple-100 text-purple-800'
                      : session.userRole === 'investor'
                      ? 'bg-amber-100 text-amber-800'
                      : session.userRole === 'client'
                      ? 'bg-cyan-100 text-cyan-800'
                      : 'bg-slate-100 text-slate-700';

                  const roleLabel =
                    session.userRole === 'admin'
                      ? 'Admin'
                      : session.userRole === 'investor'
                      ? 'Investisseur'
                      : session.userRole === 'client'
                      ? 'Client'
                      : 'Visiteur';

                  return (
                    <div
                      key={session.sessionId}
                      className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-slate-50 transition-colors text-xs text-slate-800 min-w-[700px]"
                    >
                      {/* Utilisateur */}
                      <div className="col-span-3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                          {session.userName ? session.userName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-slate-900 block truncate">{session.userName}</span>
                          <span className="text-[10px] text-slate-400 font-mono truncate block">{session.userEmail || session.sessionId.slice(0, 14)}</span>
                        </div>
                      </div>

                      {/* Rôle */}
                      <div className="col-span-2">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${roleBadgeClass}`}>
                          {roleLabel}
                        </span>
                      </div>

                      {/* Page */}
                      <div className="col-span-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-xs text-slate-400">arrow_forward</span>
                        <span className="font-semibold text-slate-800 capitalize truncate">
                          {session.currentTab || 'Accueil'}
                        </span>
                      </div>

                      {/* Appareil */}
                      <div className="col-span-2 text-[11px] text-slate-600">
                        <div className="flex items-center gap-1 font-semibold truncate">
                          <span className="material-symbols-outlined text-xs text-slate-400">
                            {session.deviceType === 'Mobile' ? 'smartphone' : session.deviceType === 'Tablette' ? 'tablet' : 'laptop'}
                          </span>
                          <span>{session.deviceType}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 truncate block">{session.browser}</span>
                      </div>

                      {/* Activité */}
                      <div className="col-span-2 text-[11px]">
                        <span className="font-semibold text-emerald-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Il y a {session.secondsAgo || 0}s</span>
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Durée : {session.durationMinutes || 1} min
                        </span>
                      </div>

                      {/* Action */}
                      <div className="col-span-1 text-right">
                        {isPrincipal && (
                          <button
                            type="button"
                            disabled={disconnectingSid === session.sessionId}
                            onClick={() => handleDisconnectSession(session.sessionId)}
                            className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] cursor-pointer transition-colors"
                            title="Forcer la déconnexion de cette session"
                          >
                            {disconnectingSid === session.sessionId ? '...' : 'Éjecter'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: GESTION DES PRODUITS (3 RAYONS AVEC IMPORT PHOTO REELLE)
          ========================================================================= */}
      {activeTab === 'market' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-syne text-base sm:text-lg font-bold text-slate-900">
                Gestion des Produits &amp; Catalogues
              </h2>
              <p className="text-xs text-slate-500">
                Électronique, Électrotechnique et Équipements Informatiques. Photographies réelles obligatoires.
              </p>
            </div>
            {hasPerm('manage_products') && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddGroupModalOpen(true)}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-sm text-cyan-600">category</span>
                  <span>+ Nouveau Groupe / Famille</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingProductId(null);
                    setIsAddProdOpen(!isAddProdOpen);
                  }}
                  className="py-2 px-3 rounded-xl btn-gold-prestige font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">
                    {isAddProdOpen ? 'close' : 'add'}
                  </span>
                  <span>{isAddProdOpen ? 'Fermer' : 'Nouveau Produit'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Formulaire d'ajout / modification */}
          {isAddProdOpen && hasPerm('manage_products') && (
            <form
              onSubmit={handleSaveProduct}
              className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 border-2 border-amber-300 space-y-4 text-xs text-slate-800 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <h3 className="font-syne text-sm font-bold text-amber-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">
                    {editingProductId ? 'edit_note' : 'add_box'}
                  </span>
                  <span>{editingProductId ? 'Modifier le Produit' : 'Ajouter un Produit au Catalogue'}</span>
                </h3>
                <span className="text-[11px] text-amber-800 font-semibold">
                  Rayon sélectionné : {newProdDomain.toUpperCase()}
                </span>
              </div>

              {/* 1. Rayon & Nom */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Rayon / Domaine *</label>
                  <select
                    value={newProdDomain}
                    onChange={(e) => {
                      const nextDomain = e.target.value as any;
                      setNewProdDomain(nextDomain);
                      handleProductNameChange(newProdName, nextDomain, true);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 font-semibold"
                  >
                    <option value="informatique">💻 Équipements Informatiques</option>
                    <option value="electronique">⚡ Électronique Haute Précision</option>
                    <option value="electrotechnique">🏭 Électrotechnique &amp; Puissance</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Nom du Produit *</label>
                  <input
                    type="text"
                    required
                    value={newProdName}
                    onChange={(e) => handleProductNameChange(e.target.value)}
                    placeholder="Ex: Dell Latitude 5420 i7 16GB"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Marque / Fabricant</label>
                  <input
                    type="text"
                    value={newProdBrand}
                    onChange={(e) => setNewProdBrand(e.target.value)}
                    placeholder="Ex: Dell, Cisco, Schneider, ESPRESSIF..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* 2. Catégorie automatique & Référence */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">
                    Sous-Catégorie ({newProdCategoryAutoDetected})
                  </label>
                  <select
                    value={newProdSubGroup}
                    onChange={(e) => {
                      setNewProdSubGroup(e.target.value);
                      const currentGroups = domainGroups[newProdDomain as 'electronique' | 'electrotechnique' | 'informatique'] || [];
                      const found = currentGroups.find((g) => g.id === e.target.value);
                      if (found) setNewProdCategoryAutoDetected(found.label);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 font-semibold"
                  >
                    {(domainGroups[newProdDomain as 'electronique' | 'electrotechnique' | 'informatique'] || []).map((grp) => (
                      <option key={grp.id} value={grp.id}>
                        {grp.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Référence Article</label>
                  <input
                    type="text"
                    value={newProdRef}
                    onChange={(e) => setNewProdRef(e.target.value)}
                    placeholder="Ex: DELL-LAT-5420"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-700 font-bold block mb-1">Prix réel de vente (FCFA) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-700 font-bold block mb-1">Prix barré (FCFA) <span className="text-slate-400 font-normal">(Optionnel)</span></label>
                    <input
                      type="number"
                      min={0}
                      value={newProdOldPrice}
                      onChange={(e) => setNewProdOldPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ex: 180000"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 line-through text-slate-500 font-mono"
                    />
                  </div>
                </div>

                {/* État de disponibilité du produit (3 états) */}
                <div className="col-span-1 sm:col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <label className="text-xs text-slate-900 font-extrabold flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-amber-600 text-sm">inventory_2</span>
                      <span>État de Disponibilité du Produit *</span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Définissez si le composant est en stock, temporairement épuisé ou proposé sur commande avec délai d’approvisionnement.
                    </p>
                  </div>

                  {/* 3 options de sélection claires */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Option 1 : En Stock */}
                    <button
                      type="button"
                      onClick={() => {
                        setNewProdStockStatus('in_stock');
                        if (newProdStock <= 0) setNewProdStock(5);
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        newProdStockStatus === 'in_stock'
                          ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-800">
                          <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                          <span>1. En Stock</span>
                        </span>
                        {newProdStockStatus === 'in_stock' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600 leading-snug">
                        Disponible immédiatement à la vente. Bouton « Acheter » actif.
                      </p>
                    </button>

                    {/* Option 2 : Rupture de stock */}
                    <button
                      type="button"
                      onClick={() => {
                        setNewProdStockStatus('out_of_stock');
                        setNewProdStock(0);
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        newProdStockStatus === 'out_of_stock'
                          ? 'bg-rose-50/80 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="inline-flex items-center gap-1 text-xs font-black text-rose-800">
                          <span className="material-symbols-outlined text-sm text-rose-600">do_not_disturb_on</span>
                          <span>2. En Rupture</span>
                        </span>
                        {newProdStockStatus === 'out_of_stock' && (
                          <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600 leading-snug">
                        Temporairement indisponible. Bouton d'achat direct désactivé (« Indisponible »).
                      </p>
                    </button>

                    {/* Option 3 : Sur commande */}
                    <button
                      type="button"
                      onClick={() => {
                        setNewProdStockStatus('on_order');
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        newProdStockStatus === 'on_order'
                          ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="inline-flex items-center gap-1 text-xs font-black text-amber-800">
                          <span className="material-symbols-outlined text-sm text-amber-600">pending_actions</span>
                          <span>3. Sur Commande</span>
                        </span>
                        {newProdStockStatus === 'on_order' && (
                          <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600 leading-snug">
                        Approvisionnement sur demande. Bouton « Commander » avec délai à confirmer.
                      </p>
                    </button>
                  </div>

                  {/* Gestion de la quantité selon l'état */}
                  {newProdStockStatus === 'in_stock' ? (
                    <div className="pt-2 border-t border-slate-200/80 space-y-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <label className="text-[11px] text-slate-700 font-bold">
                          Quantité disponible en stock physique *
                        </label>
                        <div className="w-full sm:w-48">
                          <input
                            type="number"
                            required
                            min={0}
                            value={newProdStock}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setNewProdStock(val);
                            }}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 font-bold text-center"
                          />
                        </div>
                      </div>

                      {/* Alerte si le stock atteint 0 pour proposer le passage en rupture */}
                      {newProdStock <= 0 && (
                        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                            <span className="material-symbols-outlined text-sm">warning</span>
                            <span>Quantité épuisée (0) : ce produit ne peut plus être livré immédiatement.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setNewProdStockStatus('out_of_stock');
                              setNewProdStock(0);
                            }}
                            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer shrink-0"
                          >
                            Passer en Rupture de Stock
                          </button>
                        </div>
                      )}
                    </div>
                  ) : newProdStockStatus === 'out_of_stock' ? (
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center justify-between">
                      <span className="font-semibold">
                        Le produit sera affiché comme « Rupture de stock » et l’achat immédiat sera bloqué pour les clients.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setNewProdStockStatus('in_stock');
                          setNewProdStock(5);
                        }}
                        className="text-rose-700 font-bold underline hover:text-rose-900 ml-2 shrink-0 cursor-pointer"
                      >
                        Remettre en stock
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center justify-between">
                      <span className="font-semibold">
                        Le produit sera affiché comme « Disponible sur commande ». Le client cliquera sur « Commander » et sera notifié que le délai d’approvisionnement sera validé par l'administrateur.
                      </span>
                      <span className="text-[10px] font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300 shrink-0">
                        Délai à convenir
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Description & Spécifications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Description Détaillée</label>
                  <textarea
                    rows={2}
                    value={newProdDesc}
                    onChange={(e) => setNewProdDesc(e.target.value)}
                    placeholder="Description technique et commerciale..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">
                    Spécifications Techniques (séparées par des virgules)
                  </label>
                  <textarea
                    rows={2}
                    value={newProdSpecs}
                    onChange={(e) => setNewProdSpecs(e.target.value)}
                    placeholder="Ex: Intel Core i7 11e Gén, 16GB DDR4, 512GB SSD NVMe, Écran 14 pouces FHD..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* 4. Gestion de la Photo Réelle (Règle Anti-IA Slop) */}
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-700 text-sm">photo_camera</span>
                    <span>Photographie Réelle du Produit (Téléphone / Ordinateur)</span>
                  </span>
                  {newProdHasRealPhoto ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      ✓ Photo Réelle Fournie
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                      Image à ajouter (Pas d'image artificielle)
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <label className="w-full sm:w-auto px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer border border-slate-300 text-center flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">upload</span>
                    <span>Importer la Photo Réelle</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoFileUpload}
                    />
                  </label>

                  {newProdHasRealPhoto && newProdImage && (
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-300 bg-slate-50 shrink-0">
                        <ProductImage
                          src={newProdImage}
                          alt="Aperçu"
                          domain={newProdDomain}
                          compact
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNewProdImage('');
                          setNewProdHasRealPhoto(false);
                        }}
                        className="text-[10px] text-red-600 font-bold hover:underline"
                      >
                        Retirer la photo
                      </button>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500 italic">
                    Conformément aux directives, aucune image illustrative d'IA ne sera affichée. Sans photo réelle, le produit restera marqué « Image à ajouter ».
                  </p>
                </div>
              </div>

              {/* 5. Vidéo Démo Produit & Options de publication */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">
                    Lien Vidéo de Démonstration (YouTube ou MP4)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newProdVideoUrl}
                      onChange={(e) => setNewProdVideoUrl(e.target.value)}
                      placeholder="https://... ou vidéo importée"
                      className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500"
                    />
                    <label className="px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold cursor-pointer shrink-0" title="Importer une vidéo depuis l'appareil">
                      <span className="material-symbols-outlined text-sm">video_file</span>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => handleVideoFileUpload(e, 'product')}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex flex-col justify-end space-y-2">
                  <label className="flex items-center gap-2 text-slate-800 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newProdIsDraft}
                      onChange={(e) => setNewProdIsDraft(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-0"
                    />
                    <span>Conserver comme Brouillon (non visible du public)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-800 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyUsersOnPublish}
                      onChange={(e) => setNotifyUsersOnPublish(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <span>Diffuser une notification WhatsApp aux utilisateurs</span>
                  </label>

                  <label className="flex items-center gap-2 text-amber-900 font-bold cursor-pointer bg-amber-50/80 p-2 rounded-xl border border-amber-200">
                    <input
                      type="checkbox"
                      checked={newProdIsFeaturedOnHome}
                      onChange={(e) => setNewProdIsFeaturedOnHome(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-0"
                    />
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm">👑</span>
                      <span>Produit Premium (Filtre Premium sur l'Accueil)</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-amber-950 font-bold cursor-pointer bg-amber-100/60 p-2 rounded-xl border border-amber-300">
                    <input
                      type="checkbox"
                      checked={newProdIsPromo}
                      onChange={(e) => setNewProdIsPromo(e.target.checked)}
                      className="rounded text-amber-700 focus:ring-0"
                    />
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm">🏷️</span>
                      <span>Produit en Promotion (Filtre Promos sur l'Accueil)</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-900 font-bold cursor-pointer bg-slate-100 p-2 rounded-xl border border-slate-300">
                    <input
                      type="checkbox"
                      checked={newProdIsNew}
                      onChange={(e) => setNewProdIsNew(e.target.checked)}
                      className="rounded text-slate-800 focus:ring-0"
                    />
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm">⚡</span>
                      <span>Produit Nouveauté (Filtre Nouveautés sur l'Accueil)</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-rose-900 font-bold cursor-pointer bg-rose-50/80 p-2 rounded-xl border border-rose-200">
                    <input
                      type="checkbox"
                      checked={newProdIsFlashSale}
                      onChange={(e) => setNewProdIsFlashSale(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-0"
                    />
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-rose-600">bolt</span>
                      <span>Intégrer ce produit à la VENTE FLASH animée sur l'accueil</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddProdOpen(false);
                    setEditingProductId(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewProduct({
                      id: editingProductId || 'preview-temp',
                      name: formatProductTitle(newProdName) || 'Nom Produit Aperçu',
                      brand: newProdBrand || undefined,
                      ref: newProdRef || 'REF-PREVIEW',
                      domain: newProdDomain,
                      category: 'informatique',
                      categoryLabel: newProdCategoryAutoDetected || 'Catégorie',
                      price: newProdPrice,
                      stock: newProdStockStatus === 'out_of_stock' ? 0 : newProdStock,
                      stockStatus: newProdStockStatus,
                      inStock: newProdStockStatus === 'in_stock' && newProdStock > 0,
                      description: newProdDesc || 'Description du produit',
                      specs: newProdSpecs ? newProdSpecs.split(',').map((s) => s.trim()) : [],
                      hasRealPhoto: newProdHasRealPhoto,
                      image: newProdHasRealPhoto ? newProdImage : undefined,
                      videoUrl: newProdVideoUrl || undefined
                    });
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  <span>Prévisualiser</span>
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-gold-prestige font-bold text-white cursor-pointer shadow-sm"
                >
                  {editingProductId ? 'Enregistrer les Modifications' : 'Publier le Produit'}
                </button>
              </div>
            </form>
          )}

          {csvImportFeedback && (
            <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-900 font-semibold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                <span>{csvImportFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setCsvImportFeedback(null)}
                className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
                aria-label="Fermer la notification d'import CSV"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* Table des Produits du Catalogue avec Filtres d'État de Disponibilité */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">
                  Total : {products.length} référence(s)
                </span>
                <div className="hidden sm:flex items-center gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 font-bold">
                    Info : {products.filter((p) => p.domain === 'informatique').length}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                    Électro : {products.filter((p) => p.domain === 'electronique').length}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                    Électrotech : {products.filter((p) => p.domain === 'electrotechnique').length}
                  </span>
                </div>

                <div className="ml-auto sm:ml-2 flex flex-wrap items-center gap-1.5">
                  {onRefreshProducts && (
                    <button
                      type="button"
                      onClick={() => onRefreshProducts()}
                      disabled={isLoadingProducts}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-2xs active:scale-95 whitespace-nowrap shrink-0"
                      title="Recharger les dernières données produits depuis PostgreSQL"
                    >
                      <span
                        className={`material-symbols-outlined text-sm font-bold text-amber-600 ${
                          isLoadingProducts ? 'animate-spin' : ''
                        }`}
                      >
                        refresh
                      </span>
                      <span>Actualiser</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      const isFiltered = productStockFilter !== 'all';
                      const target = isFiltered ? filteredCatalogProducts : products;
                      if (target.length === 0) return;
                      exportProductsToXlsx(target, {
                        sheetName: isFiltered ? 'Catalogue Filtré' : 'Catalogue Produits',
                        filename: `ELECTRO-MEN_Catalogue_${isFiltered ? 'Filtre_' : ''}${today}.xlsx`
                      });
                    }}
                    disabled={(productStockFilter === 'all' ? products.length : filteredCatalogProducts.length) === 0}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-2xs active:scale-95 whitespace-nowrap shrink-0"
                    title="Télécharger directement un fichier tableau Excel (.xlsx) prêt à envoyer à un client"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">table_view</span>
                    <span>Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      const isFiltered = productStockFilter !== 'all';
                      const target = isFiltered ? filteredCatalogProducts : products;
                      if (target.length === 0) return;
                      exportProductsToCsv(
                        target,
                        `ELECTRO-MEN_Catalogue_${isFiltered ? 'Filtre_' : ''}${today}.csv`
                      );
                    }}
                    disabled={(productStockFilter === 'all' ? products.length : filteredCatalogProducts.length) === 0}
                    className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-2xs active:scale-95 whitespace-nowrap shrink-0"
                    title="Exporter les produits en fichier CSV UTF-8 avec BOM (séparateur ;)"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">csv</span>
                    <span>Exporter CSV</span>
                  </button>
                  {hasPerm('manage_products') && onImportProducts && (
                    <button
                      type="button"
                      onClick={() => setIsImportCsvOpen(true)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-2xs active:scale-95 whitespace-nowrap shrink-0"
                      title="Importer des produits depuis un fichier CSV vers PostgreSQL"
                    >
                      <span className="material-symbols-outlined text-sm font-bold text-amber-400">upload_file</span>
                      <span>Importer CSV</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsExportProductsOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-2xs border border-amber-400 active:scale-95 whitespace-nowrap shrink-0"
                    title="Exporter les produits du catalogue pour envoyer à un client (PDF, Devis, WhatsApp, Excel .xlsx, CSV)"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">ios_share</span>
                    <span>Exporter pour un Client</span>
                  </button>
                </div>
              </div>

              {/* Filtre par État de Disponibilité */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                <span className="text-[11px] text-slate-500 font-semibold mr-1">Filtrer :</span>
                <button
                  type="button"
                  onClick={() => setProductStockFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    productStockFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Tous ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setProductStockFilter('in_stock')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                    productStockFilter === 'in_stock'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <span>En stock</span>
                  <span>({products.filter((p) => getProductStockStatus(p) === 'in_stock').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductStockFilter('out_of_stock')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                    productStockFilter === 'out_of_stock'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <span>En rupture</span>
                  <span>({products.filter((p) => getProductStockStatus(p) === 'out_of_stock').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductStockFilter('on_order')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                    productStockFilter === 'on_order'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <span>Sur commande</span>
                  <span>({products.filter((p) => getProductStockStatus(p) === 'on_order').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductStockFilter('featured' as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                    productStockFilter === ('featured' as any)
                      ? 'bg-amber-500 text-slate-950 font-black shadow-2xs'
                      : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">star</span>
                  <span>En Vedette Accueil ({products.filter((p) => p.isFeaturedOnHome).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductStockFilter('flash' as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                    productStockFilter === ('flash' as any)
                      ? 'bg-rose-600 text-white font-black shadow-2xs'
                      : 'bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">bolt</span>
                  <span>⚡ Vente Flash ({products.filter((p) => p.isFlashSale).length})</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
              {isLoadingProducts && filteredCatalogProducts.length === 0 ? (
                <div className="p-8 text-center space-y-2" role="status" aria-live="polite">
                  <span className="material-symbols-outlined text-3xl text-amber-600 animate-spin inline-block">progress_activity</span>
                  <p className="text-xs font-bold text-slate-700">Chargement des produits depuis PostgreSQL Neon...</p>
                </div>
              ) : filteredCatalogProducts.length === 0 ? (
                <div className="p-8 text-center space-y-1 text-slate-500">
                  <span className="material-symbols-outlined text-2xl text-slate-300">inventory_2</span>
                  <p className="text-xs font-bold text-slate-700">Aucun produit dans cette sélection.</p>
                </div>
              ) : filteredCatalogProducts
                .map((prod) => {
                  const status = getProductStockStatus(prod);
                  const displayTitle = formatProductTitle(prod.name);
                  return (
                    <div
                      key={prod.id}
                      className="p-3 sm:p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                          <ProductImage
                            product={prod}
                            alt={displayTitle}
                            compact
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 truncate">{displayTitle}</span>
                            {prod.brand && (
                              <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.2 rounded">
                                {prod.brand}
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                                prod.domain === 'informatique'
                                  ? 'bg-cyan-100 text-cyan-800'
                                  : prod.domain === 'electrotechnique'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {prod.domain || 'Électro'}
                            </span>
                            {prod.isDraft && (
                              <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded">
                                Brouillon
                              </span>
                            )}

                            {/* Badge État de Disponibilité */}
                            {status === 'in_stock' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                <span>En stock ({prod.stock})</span>
                              </span>
                            ) : status === 'out_of_stock' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold border border-rose-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                <span>Rupture de stock</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                <span>Disponible sur commande</span>
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span className="font-mono text-slate-700 font-semibold">{prod.ref}</span>
                            <span>•</span>
                            <span className="font-bold text-[#b48c1e]">{prod.price.toLocaleString('fr-FR')} FCFA</span>
                            <span>•</span>
                            <span className="text-slate-600 font-medium">Rayon : {prod.categoryLabel}</span>
                          </div>
                        </div>
                      </div>

                      {/* Contrôle Rapide de l'État & Actions d'Édition */}
                      <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-center shrink-0 justify-between lg:justify-end border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
                        {/* Sélecteur Rapide d'État (1 Clic) */}
                        {hasPerm('manage_products') && (
                          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleQuickChangeStockStatus(prod, 'in_stock')}
                              title="Basculer en stock"
                              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                status === 'in_stock'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">check</span>
                              <span>En Stock</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickChangeStockStatus(prod, 'out_of_stock')}
                              title="Basculer en rupture"
                              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                status === 'out_of_stock'
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">block</span>
                              <span>Rupture</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickChangeStockStatus(prod, 'on_order')}
                              title="Basculer sur commande"
                              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                status === 'on_order'
                                  ? 'bg-amber-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">schedule</span>
                              <span>Sur Commande</span>
                            </button>
                          </div>
                        )}

                        {/* Bouton Modifier & Supprimer */}
                        <div className="flex items-center gap-1.5">
                          {hasPerm('manage_products') && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated: Product = {
                                    ...prod,
                                    isFeaturedOnHome: !prod.isFeaturedOnHome
                                  };
                                  onUpdateProduct(updated);
                                  onAddAuditLog({
                                    author: currentAdminName,
                                    date: new Date().toLocaleString('fr-FR'),
                                    actionType: 'update_featured_status',
                                    description: `${updated.isFeaturedOnHome ? 'Mise en avant' : 'Retrait de la mise en avant'} sur l'accueil : "${prod.name}"`,
                                    entityType: 'product',
                                    targetId: prod.id
                                  });
                                }}
                                title={prod.isFeaturedOnHome ? "Retirer de la vitrine d'accueil" : "Mettre en avant sur la page d'accueil"}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                                  prod.isFeaturedOnHome
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs font-extrabold'
                                    : 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-800'
                                }`}
                              >
                                <span className="material-symbols-outlined text-xs text-amber-600">
                                  {prod.isFeaturedOnHome ? 'star' : 'star_border'}
                                </span>
                                <span>{prod.isFeaturedOnHome ? 'En Vedette' : 'Vedette'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const updated: Product = {
                                    ...prod,
                                    isFlashSale: !prod.isFlashSale
                                  };
                                  onUpdateProduct(updated);
                                  onAddAuditLog({
                                    author: currentAdminName,
                                    date: new Date().toLocaleString('fr-FR'),
                                    actionType: 'update_flash_status',
                                    description: `${updated.isFlashSale ? 'Ajout à la Vente Flash' : 'Retrait de la Vente Flash'} sur l'accueil : "${prod.name}"`,
                                    entityType: 'product',
                                    targetId: prod.id
                                  });
                                }}
                                title={prod.isFlashSale ? "Retirer de la Vente Flash" : "Ajouter à la Vente Flash animée"}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                                  prod.isFlashSale
                                    ? 'bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs font-extrabold animate-pulse'
                                    : 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-800'
                                }`}
                              >
                                <span className="material-symbols-outlined text-xs text-rose-600">
                                  bolt
                                </span>
                                <span>{prod.isFlashSale ? '⚡ Flash' : 'Flash'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEditProduct(prod)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs">edit</span>
                                <span>Modifier</span>
                              </button>
                            </>
                          )}

                          {hasPerm('delete_products') && (
                            <button
                              type="button"
                              onClick={() => handleRequestDeleteProduct(prod)}
                              className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              title="Supprimer définitivement"
                            >
                              <span className="material-symbols-outlined text-xs">delete</span>
                              <span>Supprimer</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: GESTION DES FORMATIONS (3 SECTIONS : ÉLECTRONIQUE, ÉLECTROTECH, INFO)
          ========================================================================= */}
      {activeTab === 'academy' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-syne text-base sm:text-lg font-bold text-slate-900">
                Gestion des Formations Professionnelles
              </h2>
              <p className="text-xs text-slate-500">
                3 sections distinctes : Électronique, Électrotechnique et Informatique. Gratuit ou Certifiant.
              </p>
            </div>
            {hasPerm('manage_courses') && (
              <button
                type="button"
                onClick={() => setIsAddCourseOpen(!isAddCourseOpen)}
                className="py-2 px-3 rounded-xl btn-gold-prestige font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">
                  {isAddCourseOpen ? 'close' : 'add'}
                </span>
                <span>{isAddCourseOpen ? 'Fermer' : 'Nouveau Programme'}</span>
              </button>
            )}
          </div>

          {/* Formulaire Programme Formations */}
          {hasPerm('manage_courses') && isAddCourseOpen && (
            <form
              onSubmit={handleSaveCourse}
              className="p-4 sm:p-5 rounded-2xl bg-cyan-50/60 border-2 border-cyan-300 space-y-4 text-xs text-slate-800 shadow-sm"
            >
              <h3 className="font-syne text-sm font-bold text-cyan-900 flex items-center gap-1.5 border-b border-cyan-200 pb-2">
                <span className="material-symbols-outlined text-base">school</span>
                <span>Nouveau Programme de Formation</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Domaine Pédagogique *</label>
                  <select
                    value={newCourseDomain}
                    onChange={(e) => setNewCourseDomain(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-cyan-500 font-bold"
                  >
                    <option value="informatique">💻 3. Formation en Informatique</option>
                    <option value="electronique">⚡ 1. Formation en Électronique</option>
                    <option value="electrotechnique">🏭 2. Formation en Électrotechnique</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Titre de la Formation *</label>
                  <input
                    type="text"
                    required
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    placeholder="Ex: Administration Systèmes Linux, Réseaux &amp; Sécurité"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-cyan-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Modalité de Tarification</label>
                  <div className="flex items-center gap-2 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={newCourseIsFree}
                        onChange={(e) => setNewCourseIsFree(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-0"
                      />
                      <span className="text-emerald-700">🟢 100% Gratuit</span>
                    </label>
                  </div>
                </div>

                {!newCourseIsFree && (
                  <div>
                    <label className="text-[11px] text-slate-700 font-bold block mb-1">Prix de la Formation (FCFA) *</label>
                    <input
                      type="number"
                      min={0}
                      value={newCoursePrice}
                      onChange={(e) => setNewCoursePrice(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-cyan-500 font-bold"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Durée &amp; Rythme</label>
                  <input
                    type="text"
                    value={newCourseDuration}
                    onChange={(e) => setNewCourseDuration(e.target.value)}
                    placeholder="Ex: 30 Heures (4 Semaines)"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-700 font-bold block mb-1">Description &amp; Objectifs</label>
                <textarea
                  rows={2}
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  placeholder="Compétences visées, prérequis et livrables..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-cyan-500"
                />
              </div>

              {/* Document PDF et Vidéo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-white border border-slate-200">
                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Support PDF du Syllabus</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCoursePdfUrl}
                      onChange={(e) => setNewCoursePdfUrl(e.target.value)}
                      placeholder="Lien PDF ou fichier importé..."
                      className="flex-1 bg-white border border-slate-300 rounded-lg p-1.5 text-slate-900 outline-none"
                    />
                    <label className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold cursor-pointer shrink-0">
                      <span className="material-symbols-outlined text-sm">upload_file</span>
                      <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfFileUpload} />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Vidéo Pédagogique Associée</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCourseVideoUrl}
                      onChange={(e) => setNewCourseVideoUrl(e.target.value)}
                      placeholder="Lien YouTube ou MP4..."
                      className="flex-1 bg-white border border-slate-300 rounded-lg p-1.5 text-slate-900 outline-none"
                    />
                    <label className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold cursor-pointer shrink-0">
                      <span className="material-symbols-outlined text-sm">video_file</span>
                      <input type="file" accept="video/*" className="hidden" onChange={(e) => handleVideoFileUpload(e, 'course')} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-cyan-200">
                <label className="flex items-center gap-2 text-slate-800 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyCourseOnPublish}
                    onChange={(e) => setNotifyCourseOnPublish(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0"
                  />
                  <span>Notifier les utilisateurs par WhatsApp</span>
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddCourseOpen(false)}
                    className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold cursor-pointer shadow-sm"
                  >
                    Enregistrer la Formation
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* List of Courses by 3 Domains */}
          <div className="grid grid-cols-1 gap-3">
            {['electronique', 'electrotechnique', 'informatique'].map((domainKey) => {
              const domainCourses = courses.filter((c) => c.domain === domainKey);
              const domainTitle =
                domainKey === 'electronique'
                  ? '⚡ 1. Formations en Électronique'
                  : domainKey === 'electrotechnique'
                  ? '🏭 2. Formations en Électrotechnique'
                  : '💻 3. Formations en Informatique';

              return (
                <div key={domainKey} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="font-syne text-sm font-bold text-slate-900">{domainTitle}</h3>
                    <span className="text-[11px] text-slate-500 font-semibold">{domainCourses.length} formation(s)</span>
                  </div>

                  <div className="space-y-2">
                    {domainCourses.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{c.title}</span>
                            {c.isFree ? (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                🟢 Gratuit
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                                🔒 {c.price.toLocaleString('fr-FR')} FCFA
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {c.duration} • {c.syllabus?.length || 0} module(s) • {c.level}
                          </span>
                        </div>

                        {hasPerm('delete_courses') && (
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteCourse(c.id);
                              onAddAuditLog({
                                author: currentAdminName,
                                date: new Date().toLocaleString('fr-FR'),
                                actionType: 'delete_course',
                                description: `Suppression du cours "${c.title}"`,
                                entityType: 'course',
                                previousState: c
                              });
                            }}
                            className="px-2 py-1 rounded bg-red-50 text-red-600 font-bold text-[10px] hover:bg-red-100 cursor-pointer"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: GESTION DES FRAIS DE LIVRAISON SELON LOCALISATION
          ========================================================================= */}
      {activeTab === 'logistique' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-syne text-base sm:text-lg font-bold text-slate-900">
                Configuration des Frais de Livraison
              </h2>
              <p className="text-xs text-slate-500">
                Définissez les tarifs de transport selon la situation géographique du client.
              </p>
            </div>
            {hasPerm('manage_delivery') && (
              <button
                type="button"
                onClick={() => setIsAddZoneOpen(!isAddZoneOpen)}
                className="py-2 px-3 rounded-xl btn-gold-prestige font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">{isAddZoneOpen ? 'close' : 'add'}</span>
                <span>{isAddZoneOpen ? 'Fermer' : 'Nouvelle Zone'}</span>
              </button>
            )}
          </div>

          {/* Formulaire Zone de Livraison */}
          {hasPerm('manage_delivery') && isAddZoneOpen && (
            <form
              onSubmit={handleCreateDeliveryZone}
              className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-300 space-y-3 text-xs text-slate-800"
            >
              <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">local_shipping</span>
                <span>Ajouter une Zone Géographique</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Nom de la Zone *</label>
                  <input
                    type="text"
                    required
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    placeholder="Ex: Banfora &amp; Cascades"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Tarif de Livraison (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newZoneFee}
                    onChange={(e) => setNewZoneFee(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-bold block mb-1">Délai Estimé</label>
                  <input
                    type="text"
                    value={newZoneDelay}
                    onChange={(e) => setNewZoneDelay(e.target.value)}
                    placeholder="Ex: 24h à 48h"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-700 font-bold block mb-1">
                  Mots-clés de Localité Reconnus (séparés par des virgules)
                </label>
                <input
                  type="text"
                  value={newZoneKeywords}
                  onChange={(e) => setNewZoneKeywords(e.target.value)}
                  placeholder="Ex: banfora, sindou, niangoloko"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddZoneOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg btn-gold-prestige font-bold text-white cursor-pointer shadow-sm"
                >
                  Enregistrer la Zone
                </button>
              </div>
            </form>
          )}

          {/* Table des zones */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-100">
              {deliveryZones.map((zone) => (
                <div
                  key={zone.id}
                  className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{zone.name}</span>
                      <span className="font-bold text-[#b48c1e] bg-amber-50 px-2 py-0.5 rounded text-xs">
                        {(zone.fee ?? zone.tarif ?? 0) === 0 ? 'GRATUIT' : `${(zone.fee ?? zone.tarif ?? 0).toLocaleString('fr-FR')} FCFA`}
                      </span>
                      {zone.isActive ? (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                          Active
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 text-[9px] font-bold">
                          Désactivée
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Délai : {zone.delay || zone.estimatedDelay || '24h à 48h'} • Mots-clés : {zone.keywords?.join(', ') || 'Tous'}
                    </div>
                  </div>

                  {hasPerm('manage_delivery') && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = deliveryZones.map((z) =>
                            z.id === zone.id ? { ...z, isActive: !z.isActive } : z
                          );
                          if (onUpdateDeliveryZones) onUpdateDeliveryZones(updated);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] cursor-pointer"
                      >
                        {zone.isActive ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Confirmez-vous la suppression définitive de la zone "${zone.name}" ?`)) {
                            const updated = deliveryZones.filter((z) => z.id !== zone.id);
                            if (onUpdateDeliveryZones) onUpdateDeliveryZones(updated);
                            onAddAuditLog({
                              author: currentAdminName,
                              date: new Date().toLocaleString('fr-FR'),
                              actionType: 'delete_delivery_zone',
                              description: `Suppression de la zone de livraison "${zone.name}"`,
                              entityType: 'delivery'
                            });
                          }
                        }}
                        className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] cursor-pointer flex items-center gap-0.5"
                        title="Supprimer cette zone de livraison"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                        <span>Supprimer</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: GESTION DES VIDÉOS & MÉDIAS PUBLICITAIRES
          ========================================================================= */}
      {activeTab === 'content' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h2 className="font-syne text-base sm:text-lg font-bold text-slate-900">
              Vidéos &amp; Campagnes Publicitaires
            </h2>
            <p className="text-xs text-slate-500">
              Gérez indépendamment la vidéo de couverture Accueil et la vidéo promotionnelle Formations.
            </p>
          </div>

          {videoMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold">
              {videoMessage}
            </div>
          )}

          {uploadStatus.message && (
            <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              uploadStatus.isUploading
                ? 'bg-amber-50 border-amber-300 text-amber-900 animate-pulse'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}>
              <span className="material-symbols-outlined text-sm">
                {uploadStatus.isUploading ? 'cloud_upload' : 'check_circle'}
              </span>
              <span>{uploadStatus.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Drapeaux des Boutiques (Contrôle Administrateur Exclusif) */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#b48c1e] text-base">flag</span>
                  <span>Drapeaux Officiels des Boutiques</span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Exclusif Admin
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Attribuez le drapeau national correspondant à chaque boutique pour la vitrine de la marketplace.
              </p>

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {marketplaceBoutiques.map((b) => (
                  <div key={b.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xl shrink-0">{b.flag || '🇧🇫'}</span>
                      <div className="min-w-0">
                        <div className="font-syne font-bold text-xs text-slate-900 truncate">{b.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{b.country || 'Burkina Faso'} • {b.location || 'Ouagadougou'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <select
                        value={b.flag || '🇧🇫'}
                        disabled={!hasPerm('manage_delivery') && !hasPerm('manage_content')}
                        onChange={(e) => {
                          const selectedOption = e.target.selectedOptions[0];
                          const cName = selectedOption?.getAttribute('data-country') || 'Burkina Faso';
                          if (onUpdateBoutiqueFlag) {
                            onUpdateBoutiqueFlag(b.id, e.target.value, cName);
                          }
                        }}
                        className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 outline-none font-medium cursor-pointer disabled:opacity-50"
                      >
                        <option value="🇧🇫" data-country="Burkina Faso">🇧🇫 Burkina Faso</option>
                        <option value="🇨🇮" data-country="Côte d'Ivoire">🇨🇮 Côte d'Ivoire</option>
                        <option value="🇲🇱" data-country="Mali">🇲🇱 Mali</option>
                        <option value="🇸🇳" data-country="Sénégal">🇸🇳 Sénégal</option>
                        <option value="🇹🇬" data-country="Togo">🇹🇬 Togo</option>
                        <option value="🇧🇯" data-country="Bénin">🇧🇯 Bénin</option>
                        <option value="🇳🇪" data-country="Niger">🇳🇪 Niger</option>
                        <option value="🇬🇳" data-country="Guinée">🇬🇳 Guinée</option>
                        <option value="🇨🇲" data-country="Cameroun">🇨🇲 Cameroun</option>
                        <option value="🇬🇭" data-country="Ghana">🇬🇭 Ghana</option>
                        <option value="🇳🇬" data-country="Nigeria">🇳🇬 Nigeria</option>
                        <option value="🇫🇷" data-country="France">🇫🇷 France</option>
                        <option value="🇺🇸" data-country="USA">🇺🇸 USA</option>
                        <option value="🇨🇳" data-country="Chine">🇨🇳 Chine</option>
                        <option value="🇪🇺" data-country="Union Européenne">🇪🇺 Union Européenne</option>
                        <option value="🌍" data-country="International">🌍 International</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Formations Promotional Video */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-cyan-700 text-base">video_library</span>
                <span>Vidéo Promo Page Formations</span>
              </h3>

              <form onSubmit={handleSaveFormationsVideo} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formationsVideoInput}
                    onChange={(e) => setFormationsVideoInput(e.target.value)}
                    placeholder="URL vidéo publicitaire des formations..."
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 outline-none"
                  />
                  <label className="px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold cursor-pointer shrink-0" title="Importer une vidéo">
                    <span className="material-symbols-outlined text-sm">upload_file</span>
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => handleVideoFileUpload(e, 'formations')} />
                  </label>
                </div>
                <button
                  type="submit"
                  className="w-full py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-xs font-bold text-white cursor-pointer"
                >
                  Mettre à jour la Vidéo Formations
                </button>
              </form>

              <div className="aspect-video rounded-xl overflow-hidden bg-black border border-slate-200 relative group">
                {(() => {
                  const p = parseVideoSource(formationsVideoUrl);
                  if (p.isEmbed && p.embedUrl) {
                    return (
                      <iframe
                        src={p.embedUrl}
                        title="Aperçu Vidéo Formations"
                        className="w-full h-full object-cover border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    );
                  }
                  return (
                    <video
                      ref={formationsVideoRef}
                      src={p.cleanUrl}
                      muted={isFormationsMuted}
                      autoPlay
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  );
                })()}
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-white flex items-center gap-1 pointer-events-none">
                  <span className={`w-1.5 h-1.5 rounded-full ${isFormationsPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`}></span>
                  <span>{isFormationsPlaying ? 'Aperçu Actif' : 'Pause'}</span>
                </div>
              </div>

              {/* Panneau de Contrôle Administrateur (Play/Pause, Volume, Mute) */}
              <div className="p-3 rounded-xl bg-slate-900 text-white space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-400">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">tune</span>
                    <span>Contrôle Direct Administrateur (Formations)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Accès exclusif Admin</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleFormationsPlay}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      {isFormationsPlaying ? 'pause' : 'play_arrow'}
                    </span>
                    <span>{isFormationsPlaying ? 'Pause' : 'Lecture'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleFormationsMute}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                      isFormationsMuted
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {isFormationsMuted ? 'volume_off' : 'volume_up'}
                    </span>
                    <span>{isFormationsMuted ? 'Muet' : 'Actif'}</span>
                  </button>

                  <div className="flex-1 flex items-center gap-2 pl-2 border-l border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono">Vol:</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isFormationsMuted ? 0 : formationsVolume}
                      onChange={(e) => handleFormationsVolumeChange(parseFloat(e.target.value))}
                      className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                    />
                    <span className="text-[10px] font-mono text-cyan-300 w-8 text-right">
                      {isFormationsMuted ? '0%' : `${Math.round(formationsVolume * 100)}%`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: INVESTISSEURS & MODÉRATION MESSAGERIE
          ========================================================================= */}
      {activeTab === 'investors' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-syne text-base sm:text-lg font-bold text-slate-900">
                Investisseurs &amp; Messagerie Partenaire
              </h2>
              <p className="text-xs text-slate-500">
                Modérez les échanges, répondez aux actionnaires et contrôlez l'état de la messagerie.
              </p>
            </div>

            {/* Toggle Open/Closed Messaging */}
            {hasPerm('manage_content') && onToggleInvestorChat && (
              <button
                type="button"
                onClick={onToggleInvestorChat}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm ${
                  isInvestorChatOpen
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-red-100 text-red-800 border border-red-300'
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  {isInvestorChatOpen ? 'lock_open' : 'lock'}
                </span>
                <span>Messagerie : {isInvestorChatOpen ? 'Ouverte au Public' : 'Fermée temporairement'}</span>
              </button>
            )}
          </div>

          {/* Admin Chat Broadcast Box (Texte + Note Vocale WhatsApp-style) */}
          {hasPerm('manage_content') && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-base">campaign</span>
                <span>Publier un Message Officiel ou Vocal aux Investisseurs</span>
              </h3>

              {adminVoiceError && (
                <p role="alert" className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {adminVoiceError}
                </p>
              )}

              {isRecordingAdminVoice ? (
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-rose-50 border border-rose-300">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping"></span>
                    <span>Enregistrement vocal en cours… {adminRecordingSeconds}s</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => stopAdminVoiceRecording(true)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => stopAdminVoiceRecording(false)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">stop_circle</span>
                      <span>Terminer</span>
                    </button>
                  </div>
                </div>
              ) : adminVoiceDraft ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">graphic_eq</span>
                      <span>Note vocale prête ({adminVoiceDraft.audioDuration}s)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAdminVoiceDraft(null)}
                      className="text-[11px] font-bold text-red-700 hover:underline cursor-pointer"
                    >
                      Supprimer le vocal
                    </button>
                  </div>
                  <audio controls preload="metadata" src={adminVoiceDraft.audioUrl} className="w-full h-9" />
                </div>
              ) : null}

              <form onSubmit={handleSendAdminChatMessage} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  required={!adminVoiceDraft}
                  value={adminChatText}
                  onChange={(e) => setAdminChatText(e.target.value)}
                  disabled={isSendingAdminChat || isRecordingAdminVoice}
                  placeholder={adminVoiceDraft ? 'Légende optionnelle pour le message vocal...' : 'Rédigez un communiqué officiel ou une réponse collective...'}
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 outline-none focus:border-emerald-500 disabled:opacity-60"
                />
                <div className="flex items-center gap-2 shrink-0">
                  {!isRecordingAdminVoice && !adminVoiceDraft && (
                    <button
                      type="button"
                      disabled={isSendingAdminChat}
                      onClick={() => void startAdminVoiceRecording()}
                      className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Enregistrer un message vocal"
                    >
                      <span className="material-symbols-outlined text-sm text-rose-600">mic</span>
                      <span>Vocal</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSendingAdminChat || isRecordingAdminVoice || (!adminChatText.trim() && !adminVoiceDraft)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-sm">send</span>
                    <span>{isSendingAdminChat ? 'Envoi…' : adminVoiceDraft ? 'Envoyer Vocal' : 'Envoyer'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Message Thread History */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800">
                Discussions en Cours ({investorMessages.length} message(s))
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">Synchronisé en temps réel</span>
                {hasPerm('manage_content') && investorMessages.length > 0 && onClearInvestorMessages && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Vider tous les messages de la messagerie investisseurs ?")) {
                        onClearInvestorMessages();
                      }
                    }}
                    className="text-[10px] text-red-600 hover:underline font-bold cursor-pointer"
                  >
                    Vider les messages
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {investorMessages.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  Aucun message d'investisseur pour l'instant.
                </p>
              ) : (
                investorMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-xl text-xs space-y-1 ${
                      msg.isOfficial
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-950'
                        : 'bg-slate-50 border border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">{msg.senderName}</span>
                        {msg.isOfficial && (
                          <span className="text-[9px] bg-emerald-600 text-white font-extrabold px-1.5 py-0.2 rounded">
                            OFFICIEL
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</span>
                        {hasPerm('manage_content') && onDeleteInvestorMessage && (
                          <button
                            type="button"
                            onClick={() => onDeleteInvestorMessage(msg.id)}
                            className="text-red-500 hover:text-red-700 p-0.5 rounded cursor-pointer"
                            title="Supprimer ce message"
                          >
                            <span className="material-symbols-outlined text-xs">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                    {msg.text && <p className="text-slate-700">{msg.text}</p>}
                    {(msg.messageType === 'voice' || msg.audioUrl) && msg.audioUrl && (
                      <div className="pt-1 space-y-1">
                        <audio controls preload="metadata" src={msg.audioUrl} className="w-full h-8" />
                        {typeof msg.audioDuration === 'number' && msg.audioDuration > 0 && (
                          <span className="text-[10px] font-mono text-slate-500">Durée : {msg.audioDuration}s</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {hasPerm('manage_investors') && onCreateInvestor && (
            <form onSubmit={handleCreateInvestor} className="p-4 rounded-2xl bg-white border border-cyan-200 shadow-xs space-y-3">
              <div>
                <h3 className="font-syne text-sm font-bold text-slate-900">Créer ou activer un compte investisseur</h3>
                <p className="text-[11px] text-slate-500">Un dossier existant est activé avec son email d’origine sans remplacer son historique. Un nouveau dossier reprend les champs de l’inscription publique; le mot de passe est haché côté serveur.</p>
              </div>
              <select value={investorProvisioningMode} onChange={(event) => setInvestorProvisioningMode(event.target.value as 'existing' | 'new')} className="rounded-lg border border-slate-300 p-2 text-xs">
                <option value="existing">Activer un investisseur déjà enregistré</option>
                <option value="new">Créer un nouveau dossier investisseur</option>
              </select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {investorProvisioningMode === 'new' && (
                  <>
                    <input required type="text" maxLength={60} value={newInvestor.firstName} onChange={(event) => setNewInvestor({ ...newInvestor, firstName: event.target.value })} placeholder="Prénom" className="rounded-lg border border-slate-300 p-2 text-xs" />
                    <input required type="text" maxLength={60} value={newInvestor.lastName} onChange={(event) => setNewInvestor({ ...newInvestor, lastName: event.target.value })} placeholder="Nom" className="rounded-lg border border-slate-300 p-2 text-xs" />
                    <input required type="tel" value={newInvestor.phone} onChange={(event) => setNewInvestor({ ...newInvestor, phone: event.target.value })} placeholder="Téléphone" className="rounded-lg border border-slate-300 p-2 text-xs" />
                  </>
                )}
                <input required type="email" autoComplete="email" value={newInvestor.email} onChange={(event) => setNewInvestor({ ...newInvestor, email: event.target.value })} placeholder={investorProvisioningMode === 'existing' ? 'Adresse e-mail déjà enregistrée' : 'Adresse e-mail'} className="rounded-lg border border-slate-300 p-2 text-xs" />
                <div className="flex items-center gap-1.5">
                  <input required type={showNewInvestorPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} value={newInvestor.password} onChange={(event) => setNewInvestor({ ...newInvestor, password: event.target.value })} placeholder="Mot de passe provisoire (8+ caractères)" className="flex-1 rounded-lg border border-slate-300 p-2 text-xs font-mono" />
                  <button
                    type="button"
                    onClick={() => {
                      const generated = generateProvisionalPassword();
                      setNewInvestor((prev) => ({ ...prev, password: generated, passwordConfirm: generated }));
                      setShowNewInvestorPassword(true);
                    }}
                    className="px-2.5 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] shrink-0 cursor-pointer"
                    title="Générer un mot de passe fort"
                  >
                    Générer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewInvestorPassword((v) => !v)}
                    className="px-2 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold shrink-0 cursor-pointer"
                    title={showNewInvestorPassword ? 'Masquer' : 'Afficher'}
                  >
                    <span className="material-symbols-outlined text-sm">{showNewInvestorPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                  {newInvestor.password && (
                    <button
                      type="button"
                      onClick={() => handleCopyText(newInvestor.password, 'new_inv_pwd')}
                      className="px-2 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold shrink-0 cursor-pointer"
                      title="Copier le mot de passe"
                    >
                      <span className="material-symbols-outlined text-sm">{copiedKey === 'new_inv_pwd' ? 'done' : 'content_copy'}</span>
                    </button>
                  )}
                </div>
                <input required type={showNewInvestorPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} value={newInvestor.passwordConfirm} onChange={(event) => setNewInvestor({ ...newInvestor, passwordConfirm: event.target.value })} placeholder="Confirmer le mot de passe" className="rounded-lg border border-slate-300 p-2 text-xs font-mono" />
                {investorProvisioningMode === 'new' && (
                  <>
                    <label className="text-[11px] text-slate-600">Montant déjà investi (FCFA)<input type="number" min="0" step="1" value={newInvestor.totalInvested} onChange={(event) => setNewInvestor({ ...newInvestor, totalInvested: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs" /></label>
                    <label className="text-[11px] text-slate-600">Parts déjà détenues<input type="number" min="0" step="1" value={newInvestor.sharesCount} onChange={(event) => setNewInvestor({ ...newInvestor, sharesCount: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs" /></label>
                    <label className="text-[11px] text-slate-600">Dividendes déjà perçus (FCFA)<input type="number" min="0" step="1" value={newInvestor.dividendsEarned} onChange={(event) => setNewInvestor({ ...newInvestor, dividendsEarned: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs" /></label>
                  </>
                )}
              </div>
              {investorProvisioningMode === 'new' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-800">
                      Répartition détaillée des parts par Boutique &amp; Opération (optionnel)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultSector: BoutiqueSector = 'Électronique';
                        const matchingOp = projects.find((p) => (p.sector || p.category) === defaultSector) || projects[0];
                        const opSector = (matchingOp?.sector || matchingOp?.category || defaultSector) as BoutiqueSector;
                        const unitPrice = matchingOp?.sharePrice || matchingOp?.offers?.[0]?.sharePrice || 0;
                        const nextList: ShareAllocation[] = [
                          ...newInvestorAllocations,
                          {
                            id: `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            sector: ['Électronique', 'Électrotechnique', 'Informatique'].includes(opSector) ? opSector : defaultSector,
                            operationId: matchingOp?.id || '',
                            operationTitle: matchingOp?.title || '',
                            shares: 1,
                            amount: unitPrice
                          }
                        ];
                        setNewInvestorAllocations(nextList);
                        const sumShares = nextList.reduce((acc, a) => acc + Math.max(0, Number(a.shares) || 0), 0);
                        const sumAmount = nextList.reduce((acc, a) => acc + Math.max(0, Number(a.amount) || 0), 0);
                        setNewInvestor((prev) => ({ ...prev, sharesCount: String(sumShares), totalInvested: String(sumAmount) }));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-900 font-bold text-[11px] cursor-pointer"
                    >
                      + Ajouter une ligne boutique/opération
                    </button>
                  </div>
                  {newInvestorAllocations.length > 0 && (
                    <div className="space-y-2">
                      {newInvestorAllocations.map((alloc, idx) => {
                        const sectorOps = projects.filter((p) => (p.sector || p.category) === alloc.sector);
                        return (
                          <div key={alloc.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-white p-2 rounded-lg border border-slate-200">
                            <label className="sm:col-span-3 text-[10px] text-slate-600 font-semibold">
                              Boutique
                              <select
                                value={alloc.sector}
                                onChange={(e) => {
                                  const nextSector = e.target.value as BoutiqueSector;
                                  const firstOp = projects.find((p) => (p.sector || p.category) === nextSector);
                                  const unitPrice = firstOp?.sharePrice || firstOp?.offers?.[0]?.sharePrice || 0;
                                  const nextList = newInvestorAllocations.map((item, i) =>
                                    i === idx
                                      ? {
                                          ...item,
                                          sector: nextSector,
                                          operationId: firstOp?.id || '',
                                          operationTitle: firstOp?.title || '',
                                          amount: unitPrice > 0 ? unitPrice * item.shares : item.amount
                                        }
                                      : item
                                  );
                                  setNewInvestorAllocations(nextList);
                                  const sumAmount = nextList.reduce((acc, a) => acc + Math.max(0, Number(a.amount) || 0), 0);
                                  setNewInvestor((prev) => ({ ...prev, totalInvested: String(sumAmount) }));
                                }}
                                className="mt-0.5 w-full rounded border border-slate-300 p-1.5 text-xs"
                              >
                                <option value="Électronique">Électronique</option>
                                <option value="Électrotechnique">Électrotechnique</option>
                                <option value="Informatique">Informatique</option>
                              </select>
                            </label>
                            <label className="sm:col-span-4 text-[10px] text-slate-600 font-semibold">
                              Opération ciblée
                              <select
                                value={alloc.operationId}
                                onChange={(e) => {
                                  const op = projects.find((p) => p.id === e.target.value);
                                  const unitPrice = op?.sharePrice || op?.offers?.[0]?.sharePrice || 0;
                                  const nextList = newInvestorAllocations.map((item, i) =>
                                    i === idx
                                      ? {
                                          ...item,
                                          operationId: e.target.value,
                                          operationTitle: op?.title || '',
                                          amount: unitPrice > 0 ? unitPrice * item.shares : item.amount
                                        }
                                      : item
                                  );
                                  setNewInvestorAllocations(nextList);
                                  const sumAmount = nextList.reduce((acc, a) => acc + Math.max(0, Number(a.amount) || 0), 0);
                                  setNewInvestor((prev) => ({ ...prev, totalInvested: String(sumAmount) }));
                                }}
                                className="mt-0.5 w-full rounded border border-slate-300 p-1.5 text-xs"
                              >
                                <option value="">-- Choisir une opération --</option>
                                {sectorOps.map((op) => (
                                  <option key={op.id} value={op.id}>{op.title}</option>
                                ))}
                              </select>
                            </label>
                            <label className="sm:col-span-2 text-[10px] text-slate-600 font-semibold">
                              Parts
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={alloc.shares}
                                onChange={(e) => {
                                  const nextShares = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                  const op = projects.find((p) => p.id === alloc.operationId);
                                  const unitPrice = op?.sharePrice || op?.offers?.[0]?.sharePrice || 0;
                                  const nextList = newInvestorAllocations.map((item, i) =>
                                    i === idx
                                      ? { ...item, shares: nextShares, amount: unitPrice > 0 ? unitPrice * nextShares : item.amount }
                                      : item
                                  );
                                  setNewInvestorAllocations(nextList);
                                  const sumShares = nextList.reduce((acc, a) => acc + Math.max(0, Number(a.shares) || 0), 0);
                                  const sumAmount = nextList.reduce((acc, a) => acc + Math.max(0, Number(a.amount) || 0), 0);
                                  setNewInvestor((prev) => ({ ...prev, sharesCount: String(sumShares), totalInvested: String(sumAmount) }));
                                }}
                                className="mt-0.5 w-full rounded border border-slate-300 p-1.5 text-xs"
                              />
                            </label>
                            <label className="sm:col-span-2 text-[10px] text-slate-600 font-semibold">
                              Montant (FCFA)
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={alloc.amount}
                                onChange={(e) => {
                                  const nextAmount = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                  const nextList = newInvestorAllocations.map((item, i) =>
                                    i === idx ? { ...item, amount: nextAmount } : item
                                  );
                                  setNewInvestorAllocations(nextList);
                                  const sumAmount = nextList.reduce((acc, a) => acc + Math.max(0, Number(a.amount) || 0), 0);
                                  setNewInvestor((prev) => ({ ...prev, totalInvested: String(sumAmount) }));
                                }}
                                className="mt-0.5 w-full rounded border border-slate-300 p-1.5 text-xs"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const nextList = newInvestorAllocations.filter((_, i) => i !== idx);
                                setNewInvestorAllocations(nextList);
                                if (nextList.length > 0) {
                                  const sumShares = nextList.reduce((acc, a) => acc + Math.max(0, Number(a.shares) || 0), 0);
                                  const sumAmount = nextList.reduce((acc, a) => acc + Math.max(0, Number(a.amount) || 0), 0);
                                  setNewInvestor((prev) => ({ ...prev, sharesCount: String(sumShares), totalInvested: String(sumAmount) }));
                                }
                              }}
                              className="sm:col-span-1 py-1.5 px-2 rounded bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs cursor-pointer"
                              title="Retirer cette ligne"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {investorCreateError && <p role="alert" className="text-xs font-semibold text-red-700">{investorCreateError}</p>}
              {investorCreateMessage && <p role="status" className="text-xs font-semibold text-emerald-700">{investorCreateMessage}</p>}
              <button type="submit" disabled={isCreatingInvestor} className="rounded-xl bg-cyan-700 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {isCreatingInvestor ? 'Enregistrement…' : investorProvisioningMode === 'new' ? 'Créer le compte' : 'Activer l’accès'}
              </button>
            </form>
          )}

          {/* Registered Investors List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Investisseurs Enregistrés &amp; Portefeuilles ({registeredInvestors.length})</span>
              {isPrincipal && registeredInvestors.length > 0 && onPurgeTestData && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Purger tous les comptes investisseurs enregistrés ?")) {
                      onPurgeTestData('investors');
                    }
                  }}
                  className="text-[10px] text-red-600 hover:underline font-bold cursor-pointer"
                >
                  Purger tous les comptes
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {registeredInvestors.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 italic">
                  Aucun compte investisseur enregistré pour l'instant.
                </div>
              ) : (
                registeredInvestors.map((inv) => {
                  const emailKey = inv.email.trim().toLowerCase();
                  const sessionTemp = sessionTemporaryPasswords[emailKey];
                  const isTempRevealed = Boolean(revealedTempPasswordKeys[emailKey]);
                  return (
                  <div key={inv.id}>
                  <div className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">{inv.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">{inv.id}</span>
                        <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 rounded">
                          {inv.sharesCount} actions
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                            inv.status === 'approuve'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : inv.status === 'refuse'
                              ? 'bg-red-100 text-red-800 border-red-300'
                              : inv.status === 'suspendu'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : inv.status === 'bloque'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {inv.status === 'approuve'
                            ? 'Approuvé'
                            : inv.status === 'refuse'
                            ? 'Refusé'
                            : inv.status === 'suspendu'
                            ? 'Suspendu'
                            : inv.status === 'bloque'
                            ? 'Bloqué'
                            : 'En Attente'}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            inv.hasPasswordConfigured
                              ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {inv.hasPasswordConfigured ? 'Mot de passe actif' : 'Mot de passe non défini'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{inv.email} • {inv.phone}</span>
                        {inv.hasPasswordConfigured ? (
                          <span className="text-cyan-800 font-medium">
                            ({inv.passwordAlgorithm || 'scrypt'}{inv.passwordUpdatedAt ? ` · maj ${inv.passwordUpdatedAt}` : ''})
                          </span>
                        ) : (
                          <span className="text-amber-700 font-medium">(Aucun mot de passe défini)</span>
                        )}
                      </div>
                      {sessionTemp && (
                        <div className="mt-1 inline-flex flex-wrap items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-950">
                          <span className="font-bold">Provisoire (session {sessionTemp.updatedAt}) :</span>
                          <code className="font-mono font-bold">
                            {isTempRevealed ? sessionTemp.password : '••••••••••••'}
                          </code>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedTempPasswordKeys((prev) => ({ ...prev, [emailKey]: !prev[emailKey] }))
                            }
                            className="font-bold text-cyan-800 hover:underline cursor-pointer"
                          >
                            {isTempRevealed ? 'Masquer' : 'Afficher'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyText(sessionTemp.password, `tmp_row_${inv.id}`)}
                            className="font-bold text-emerald-800 hover:underline cursor-pointer"
                          >
                            {copiedKey === `tmp_row_${inv.id}` ? 'Copié' : 'Copier'}
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleToggleInvestorDetails(inv.id)}
                      className="px-2 py-1 rounded bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-bold text-[10px] cursor-pointer"
                    >
                      {expandedInvestorId === inv.id ? 'Fermer le dossier' : 'Dossier complet'}
                    </button>

                    {(hasPerm('manage_investors') || isPrincipal) && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {hasPerm('manage_investors') && inv.status !== 'approuve' && (
                          <button
                            type="button"
                            onClick={() => onUpdateInvestorStatus?.(inv.id, 'approuve')}
                            className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer shadow-2xs"
                            title="Approuver la candidature de cet investisseur"
                          >
                            Approuver
                          </button>
                        )}
                        {hasPerm('manage_investors') && inv.status !== 'refuse' && (
                          <button
                            type="button"
                            onClick={() => {
                              const reason = prompt('Motif officiel du refus (optionnel) :');
                              onUpdateInvestorStatus?.(inv.id, 'refuse', reason || undefined);
                            }}
                            className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[10px] cursor-pointer"
                            title="Refuser la candidature"
                          >
                            Refuser
                          </button>
                        )}
                        {hasPerm('manage_investors') && inv.status === 'approuve' && (
                          <button
                            type="button"
                            onClick={() => onUpdateInvestorStatus?.(inv.id, 'suspendu')}
                            className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] cursor-pointer"
                            title="Suspendre temporairement ce compte"
                          >
                            Suspendre
                          </button>
                        )}
                        {hasPerm('manage_investors') && inv.status !== 'bloque' && (
                          <button
                            type="button"
                            onClick={() => onUpdateInvestorStatus?.(inv.id, 'bloque')}
                            className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-[10px] cursor-pointer"
                            title="Bloquer pour motif de sécurité"
                          >
                            Bloquer
                          </button>
                        )}
                        {hasPerm('manage_investors') && inv.status === 'bloque' && (
                          <button
                            type="button"
                            onClick={() => onUpdateInvestorStatus?.(inv.id, 'approuve')}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] cursor-pointer"
                            title="Débloquer l'accès"
                          >
                            Débloquer
                          </button>
                        )}
                        {isPrincipal && onDeleteInvestor && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Placer le compte de ${inv.name} (${inv.id}) dans la corbeille ?`)) {
                                onDeleteInvestor(inv.id);
                                onAddAuditLog({
                                  author: currentAdminName,
                                  date: new Date().toLocaleString('fr-FR'),
                                  actionType: 'delete_investor',
                                  description: `Suppression du compte investisseur "${inv.name}" (${inv.id})`,
                                  entityType: 'investor'
                                });
                              }
                            }}
                            className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[10px] cursor-pointer flex items-center gap-0.5"
                            title="Placer ce compte dans la corbeille"
                          >
                            <span className="material-symbols-outlined text-xs">delete</span>
                            <span>Supprimer</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {expandedInvestorId === inv.id && (
                    <div className="px-4 pb-4 space-y-4">
                      {investorDetailLoading ? (
                        <p className="text-xs text-slate-500">Chargement du dossier et de l’historique…</p>
                      ) : investorDetailError ? (
                        <p role="alert" className="text-xs font-semibold text-red-700">{investorDetailError}</p>
                      ) : investorDetail && investorDetail.investor.id === inv.id ? (
                        <>
                          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-[10px]">
                            <div><span className="text-slate-500">Identifiant</span><strong className="block break-all text-slate-900">{investorDetail.investor.id}</strong></div>
                            <div><span className="text-slate-500">Profil</span><strong className="block text-slate-900">{investorDetail.investor.firstName || ''} {investorDetail.investor.lastName || ''} · {investorDetail.investor.email}</strong></div>
                            <div><span className="text-slate-500">Téléphone / création</span><strong className="block text-slate-900">{investorDetail.investor.phone} · {investorDetail.investor.createdAt}</strong></div>
                            <div><span className="text-slate-500">Statut</span><strong className="block text-slate-900">{investorDetail.investor.status} · {investorDetail.investor.statusReason || 'Aucun motif enregistré'}</strong></div>
                            <div><span className="text-slate-500">Montant investi</span><strong className="block text-slate-900">{(investorDetail.investor.totalInvested || 0).toLocaleString('fr-FR')} FCFA</strong></div>
                            <div><span className="text-slate-500">Parts détenues</span><strong className="block text-slate-900">{investorDetail.investor.sharesCount || 0}</strong></div>
                            <div><span className="text-slate-500">Dividendes perçus</span><strong className="block text-slate-900">{(investorDetail.investor.dividendsEarned || 0).toLocaleString('fr-FR')} FCFA</strong></div>
                            <div>
                              <span className="text-slate-500">Sécurité mot de passe</span>
                              <strong className="block text-slate-900">
                                {investorDetail.investor.hasPasswordConfigured
                                  ? `Configuré (${investorDetail.investor.passwordAlgorithm || 'pbkdf2-sha512-v2'}${investorDetail.investor.passwordUpdatedAt ? ` · ${investorDetail.investor.passwordUpdatedAt}` : ''})`
                                  : 'Aucun mot de passe défini'}
                              </strong>
                            </div>
                          </section>

                          {hasPerm('manage_investors_password') && (() => {
                            const dossierPwdState = investorDossierPasswords[inv.id];
                            const effectiveDossierPassword = dossierPwdState?.currentPassword ?? sessionTemp?.password ?? null;
                            const isDossierPwdRevealed = Boolean(revealedDossierPasswordIds[inv.id] ?? true);
                            return (
                              <section className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 space-y-2.5 text-xs text-amber-950">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <h4 className="font-bold text-slate-900">Mot de passe du compte investisseur</h4>
                                    <p className="text-[10px] text-amber-900">
                                      Consultez le mot de passe actuel ou définissez-en un nouveau directement enregistré en base de données.
                                    </p>
                                  </div>
                                  {effectiveDossierPassword && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setRevealedDossierPasswordIds((prev) => ({
                                            ...prev,
                                            [inv.id]: !(prev[inv.id] ?? true)
                                          }))
                                        }
                                        className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold text-[11px] cursor-pointer"
                                      >
                                        {isDossierPwdRevealed ? 'Masquer' : 'Afficher'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyText(effectiveDossierPassword, `dossier_pwd_${inv.id}`)}
                                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer"
                                      >
                                        {copiedKey === `dossier_pwd_${inv.id}` ? 'Copié !' : 'Copier'}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold text-slate-600">Mot de passe actuel :</span>
                                  {dossierPwdState?.loading ? (
                                    <span className="text-[11px] text-slate-500">Chargement…</span>
                                  ) : effectiveDossierPassword ? (
                                    <code className="font-mono text-sm font-bold text-slate-950 select-all">
                                      {isDossierPwdRevealed ? effectiveDossierPassword : '••••••••••••••••'}
                                    </code>
                                  ) : dossierPwdState?.error ? (
                                    <span className="text-[11px] font-semibold text-red-700">{dossierPwdState.error}</span>
                                  ) : investorDetail.investor.hasPasswordConfigured ? (
                                    <span className="text-[11px] text-amber-900 font-medium">
                                      Protégé par hachage irréversible (définissez un nouveau mot de passe ci-dessous pour le rendre consultable et actif).
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-500">Aucun mot de passe défini pour ce compte.</span>
                                  )}
                                </div>

                                {onResetInvestorPassword && (
                                  <form onSubmit={handleResetInvestorPassword} className="space-y-2 pt-1">
                                    <label className="block text-[11px] font-bold text-slate-800">
                                      Modifier le mot de passe
                                    </label>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <div className="flex flex-1 items-center gap-1.5">
                                        <input
                                          required
                                          type={showResetInvestorPassword ? 'text' : 'password'}
                                          autoComplete="new-password"
                                          minLength={8}
                                          maxLength={128}
                                          value={investorResetPassword}
                                          onChange={(event) => setInvestorResetPassword(event.target.value)}
                                          placeholder="Nouveau mot de passe (8+ caractères)"
                                          className="flex-1 rounded-lg border border-slate-300 bg-white p-2 text-xs font-mono text-slate-900"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setInvestorResetPassword(generateProvisionalPassword());
                                            setShowResetInvestorPassword(true);
                                          }}
                                          className="px-2.5 py-2 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-[11px] shrink-0 cursor-pointer"
                                        >
                                          Générer
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setShowResetInvestorPassword((v) => !v)}
                                          className="px-2 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-[11px] font-bold shrink-0 cursor-pointer"
                                          title={showResetInvestorPassword ? 'Masquer' : 'Afficher'}
                                        >
                                          <span className="material-symbols-outlined text-sm">{showResetInvestorPassword ? 'visibility_off' : 'visibility'}</span>
                                        </button>
                                      </div>
                                      <button
                                        type="submit"
                                        disabled={investorManagementLoading}
                                        className="rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50 cursor-pointer"
                                      >
                                        Enregistrer le mot de passe
                                      </button>
                                    </div>
                                    {investorPasswordError && <p role="alert" className="text-xs font-semibold text-red-700">{investorPasswordError}</p>}
                                    {investorPasswordMessage && <p role="status" className="text-xs font-semibold text-emerald-700">{investorPasswordMessage}</p>}
                                  </form>
                                )}
                              </section>
                            );
                          })()}

                          {Array.isArray(investorDetail.investor.shareAllocations) && investorDetail.investor.shareAllocations.length > 0 && (
                            <section className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-3 space-y-1.5 text-[11px]">
                              <h4 className="font-bold text-cyan-950">Répartition par Boutique &amp; Opération</h4>
                              <div className="flex flex-wrap gap-2">
                                {investorDetail.investor.shareAllocations.map((alloc) => (
                                  <span key={alloc.id} className="px-2.5 py-1 rounded-lg bg-white border border-cyan-200 text-slate-800 font-medium">
                                    <strong>{alloc.sector}</strong> · {alloc.operationTitle || alloc.operationId} :{' '}
                                    <strong className="text-cyan-800">{alloc.shares} parts</strong> ({(alloc.amount || 0).toLocaleString('fr-FR')} FCFA)
                                  </span>
                                ))}
                              </div>
                            </section>
                          )}

                          {hasPerm('manage_investors') && investorEdit && (
                            <form onSubmit={handleSaveInvestor} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                              <h4 className="text-xs font-bold text-slate-900">Modifier le profil et le portefeuille</h4>
                              <p className="text-[10px] text-slate-500">Les totaux de portefeuille sont conservés indépendamment des lignes d’historique; la répartition boutique/opération ci-dessous synchronise les parts par secteur.</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                <label className="text-[10px] text-slate-600">Prénom<input required value={investorEdit.firstName || ''} onChange={(event) => setInvestorEdit({ ...investorEdit, firstName: event.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                                <label className="text-[10px] text-slate-600">Nom<input required value={investorEdit.lastName || ''} onChange={(event) => setInvestorEdit({ ...investorEdit, lastName: event.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                                <label className="text-[10px] text-slate-600">Email<input required type="email" value={investorEdit.email} onChange={(event) => setInvestorEdit({ ...investorEdit, email: event.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                                <label className="text-[10px] text-slate-600">Téléphone<input required type="tel" value={investorEdit.phone} onChange={(event) => setInvestorEdit({ ...investorEdit, phone: event.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                                <label className="text-[10px] text-slate-600">Montant investi (FCFA)<input required type="number" min="0" step="1" value={investorEdit.totalInvested} onChange={(event) => setInvestorEdit({ ...investorEdit, totalInvested: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                                <label className="text-[10px] text-slate-600">Parts détenues<input required type="number" min="0" step="1" value={investorEdit.sharesCount} onChange={(event) => setInvestorEdit({ ...investorEdit, sharesCount: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                                <label className="text-[10px] text-slate-600">Dividendes (FCFA)<input required type="number" min="0" step="1" value={investorEdit.dividendsEarned} onChange={(event) => setInvestorEdit({ ...investorEdit, dividendsEarned: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                                <label className="text-[10px] text-slate-600">Statut
                                  <select value={investorEdit.status} onChange={(event) => setInvestorEdit({ ...investorEdit, status: event.target.value as RegisteredInvestor['status'] })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs">
                                    <option value="demande_non_soumise">Non soumis</option>
                                    <option value="en_attente">En attente</option>
                                    <option value="approuve">Approuvé</option>
                                    <option value="refuse">Refusé</option>
                                    <option value="suspendu">Suspendu</option>
                                    <option value="bloque">Bloqué</option>
                                  </select>
                                </label>
                                <label className="text-[10px] text-slate-600 sm:col-span-2">Motif du statut<input value={investorEdit.statusReason || ''} onChange={(event) => setInvestorEdit({ ...investorEdit, statusReason: event.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                              </div>

                              {/* Itemized shareAllocations editor */}
                              <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-slate-800">
                                    Lignes de parts par Boutique &amp; Opération ({(investorEdit.shareAllocations || []).length})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const defaultSector: BoutiqueSector = 'Électronique';
                                      const matchingOp = projects.find((p) => (p.sector || p.category) === defaultSector) || projects[0];
                                      const opSector = (matchingOp?.sector || matchingOp?.category || defaultSector) as BoutiqueSector;
                                      const unitPrice = matchingOp?.sharePrice || matchingOp?.offers?.[0]?.sharePrice || 0;
                                      const currentList = investorEdit.shareAllocations || [];
                                      const nextList: ShareAllocation[] = [
                                        ...currentList,
                                        {
                                          id: `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                          sector: ['Électronique', 'Électrotechnique', 'Informatique'].includes(opSector) ? opSector : defaultSector,
                                          operationId: matchingOp?.id || '',
                                          operationTitle: matchingOp?.title || '',
                                          shares: 1,
                                          amount: unitPrice
                                        }
                                      ];
                                      const sumShares = nextList.reduce((acc, a) => acc + Math.max(0, Number(a.shares) || 0), 0);
                                      setAllocationsTouched(true);
                                      setInvestorEdit({ ...investorEdit, shareAllocations: nextList, sharesCount: sumShares });
                                    }}
                                    className="px-2 py-1 rounded bg-cyan-100 hover:bg-cyan-200 text-cyan-900 font-bold text-[10px] cursor-pointer"
                                  >
                                    + Ajouter une ligne
                                  </button>
                                </div>

                                {(investorEdit.shareAllocations || []).map((alloc, idx) => {
                                  const sectorOps = projects.filter((p) => (p.sector || p.category) === alloc.sector);
                                  return (
                                    <div key={alloc.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-2 rounded border border-slate-100 bg-slate-50">
                                      <label className="sm:col-span-3 text-[10px] text-slate-600">
                                        Boutique
                                        <select
                                          value={alloc.sector}
                                          onChange={(e) => {
                                            const nextSector = e.target.value as BoutiqueSector;
                                            const firstOp = projects.find((p) => (p.sector || p.category) === nextSector);
                                            const unitPrice = firstOp?.sharePrice || firstOp?.offers?.[0]?.sharePrice || 0;
                                            const nextList = (investorEdit.shareAllocations || []).map((item, i) =>
                                              i === idx
                                                ? {
                                                    ...item,
                                                    sector: nextSector,
                                                    operationId: firstOp?.id || '',
                                                    operationTitle: firstOp?.title || '',
                                                    amount: unitPrice > 0 ? unitPrice * item.shares : item.amount
                                                  }
                                                : item
                                            );
                                            setAllocationsTouched(true);
                                            setInvestorEdit({ ...investorEdit, shareAllocations: nextList });
                                          }}
                                          className="mt-0.5 w-full rounded border border-slate-300 bg-white p-1.5 text-xs"
                                        >
                                          <option value="Électronique">Électronique</option>
                                          <option value="Électrotechnique">Électrotechnique</option>
                                          <option value="Informatique">Informatique</option>
                                        </select>
                                      </label>
                                      <label className="sm:col-span-4 text-[10px] text-slate-600">
                                        Opération
                                        <select
                                          value={alloc.operationId}
                                          onChange={(e) => {
                                            const op = projects.find((p) => p.id === e.target.value);
                                            const unitPrice = op?.sharePrice || op?.offers?.[0]?.sharePrice || 0;
                                            const nextList = (investorEdit.shareAllocations || []).map((item, i) =>
                                              i === idx
                                                ? {
                                                    ...item,
                                                    operationId: e.target.value,
                                                    operationTitle: op?.title || '',
                                                    amount: unitPrice > 0 ? unitPrice * item.shares : item.amount
                                                  }
                                                : item
                                            );
                                            setAllocationsTouched(true);
                                            setInvestorEdit({ ...investorEdit, shareAllocations: nextList });
                                          }}
                                          className="mt-0.5 w-full rounded border border-slate-300 bg-white p-1.5 text-xs"
                                        >
                                          <option value="">-- Choisir --</option>
                                          {sectorOps.map((op) => (
                                            <option key={op.id} value={op.id}>{op.title}</option>
                                          ))}
                                        </select>
                                      </label>
                                      <label className="sm:col-span-2 text-[10px] text-slate-600">
                                        Parts
                                        <input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={alloc.shares}
                                          onChange={(e) => {
                                            const nextShares = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                            const op = projects.find((p) => p.id === alloc.operationId);
                                            const unitPrice = op?.sharePrice || op?.offers?.[0]?.sharePrice || 0;
                                            const nextList = (investorEdit.shareAllocations || []).map((item, i) =>
                                              i === idx
                                                ? { ...item, shares: nextShares, amount: unitPrice > 0 ? unitPrice * nextShares : item.amount }
                                                : item
                                            );
                                            const sumShares = nextList.reduce((acc, a) => acc + Math.max(0, Number(a.shares) || 0), 0);
                                            setAllocationsTouched(true);
                                            setInvestorEdit({ ...investorEdit, shareAllocations: nextList, sharesCount: sumShares });
                                          }}
                                          className="mt-0.5 w-full rounded border border-slate-300 bg-white p-1.5 text-xs"
                                        />
                                      </label>
                                      <label className="sm:col-span-2 text-[10px] text-slate-600">
                                        Montant (FCFA)
                                        <input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={alloc.amount}
                                          onChange={(e) => {
                                            const nextAmount = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                            const nextList = (investorEdit.shareAllocations || []).map((item, i) =>
                                              i === idx ? { ...item, amount: nextAmount } : item
                                            );
                                            setAllocationsTouched(true);
                                            setInvestorEdit({ ...investorEdit, shareAllocations: nextList });
                                          }}
                                          className="mt-0.5 w-full rounded border border-slate-300 bg-white p-1.5 text-xs"
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextList = (investorEdit.shareAllocations || []).filter((_, i) => i !== idx);
                                          const sumShares = nextList.reduce((acc, a) => acc + Math.max(0, Number(a.shares) || 0), 0);
                                          setAllocationsTouched(true);
                                          setInvestorEdit({
                                            ...investorEdit,
                                            shareAllocations: nextList,
                                            ...(nextList.length > 0 ? { sharesCount: sumShares } : {})
                                          });
                                        }}
                                        className="sm:col-span-1 py-1.5 px-2 rounded bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs cursor-pointer"
                                        title="Retirer cette ligne"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>

                              {investorEditError && <p role="alert" className="text-xs font-semibold text-red-700">{investorEditError}</p>}
                              {investorEditMessage && <p role="status" className="text-xs font-semibold text-emerald-700">{investorEditMessage}</p>}
                              <button type="submit" disabled={investorManagementLoading} className="rounded-lg bg-cyan-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">
                                Enregistrer les modifications
                              </button>
                            </form>
                          )}


                          <section className="rounded-xl border border-slate-200 p-3 space-y-2">
                            <h4 className="text-xs font-bold text-slate-900">Historique complet des souscriptions ({investorDetail.subscriptions.length})</h4>
                            {investorDetail.subscriptions.length === 0 ? (
                              <p className="text-xs text-slate-500">Aucune souscription reliée à ce compte.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[620px] text-left text-[10px]">
                                  <thead><tr className="border-b text-slate-500"><th className="p-2">Opération / offre</th><th className="p-2">Parts</th><th className="p-2">Prix unitaire</th><th className="p-2">Montant</th><th className="p-2">Statut / paiement</th><th className="p-2">Dates</th>{hasPerm('manage_subscriptions') && onUpdateInvestorSubscription && <th className="p-2">Action</th>}</tr></thead>
                                  <tbody>{investorDetail.subscriptions.map((subscription) => (
                                    <tr key={subscription.id} className="border-b border-slate-100">
                                      <td className="p-2">{subscription.operationTitle || subscription.offerTitle || subscription.id}</td>
                                      <td className="p-2">{subscription.shares}</td>
                                      <td className="p-2">{(subscription.sharePrice || 0).toLocaleString('fr-FR')} FCFA</td>
                                      <td className="p-2">{(subscription.totalAmount || 0).toLocaleString('fr-FR')} FCFA</td>
                                      <td className="p-2">{subscription.status}{subscription.paymentMethod ? ` · ${subscription.paymentMethod}` : ''}</td>
                                      <td className="p-2">Demandée : {subscription.requestedAt}{subscription.approvedAt ? ` · Validée : ${subscription.approvedAt}` : ''}{subscription.paidAt ? ` · Payée : ${subscription.paidAt}` : ''}</td>
                                      {hasPerm('manage_subscriptions') && onUpdateInvestorSubscription && <td className="p-2"><button type="button" onClick={() => { setEditingInvestorSubscription(subscription); setSubscriptionEditError(null); setSubscriptionEditMessage(null); }} className="rounded bg-cyan-50 px-2 py-1 font-bold text-cyan-800">Modifier</button></td>}
                                    </tr>
                                  ))}</tbody>
                                </table>
                              </div>
                            )}
                            {subscriptionEditMessage && <p role="status" className="text-xs font-semibold text-emerald-700">{subscriptionEditMessage}</p>}
                            {hasPerm('manage_subscriptions') && onUpdateInvestorSubscription && editingInvestorSubscription && (
                              <form onSubmit={handleSaveInvestorSubscription} className="mt-3 rounded-lg bg-slate-50 p-3 space-y-2">
                                <h5 className="text-[11px] font-bold text-slate-800">Modifier la souscription {editingInvestorSubscription.id}</h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                  <label className="text-[10px] text-slate-600">Parts<input required type="number" min="1" step="1" value={editingInvestorSubscription.shares} onChange={(event) => setEditingInvestorSubscription({ ...editingInvestorSubscription, shares: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                                  <label className="text-[10px] text-slate-600">Prix unitaire (FCFA)<input required type="number" min="1" step="1" value={editingInvestorSubscription.sharePrice} onChange={(event) => setEditingInvestorSubscription({ ...editingInvestorSubscription, sharePrice: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                                  <label className="text-[10px] text-slate-600">Montant total (FCFA)<input required type="number" min="0" step="1" value={editingInvestorSubscription.totalAmount} onChange={(event) => setEditingInvestorSubscription({ ...editingInvestorSubscription, totalAmount: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                                  <label className="text-[10px] text-slate-600">Statut
                                    <select value={editingInvestorSubscription.status} onChange={(event) => setEditingInvestorSubscription({ ...editingInvestorSubscription, status: event.target.value as ShareSubscription['status'] })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs">
                                      <option value="pending_admin">pending_admin</option>
                                      <option value="approved_pending_payment">approved_pending_payment</option>
                                      <option value="paid_and_issued">paid_and_issued</option>
                                      <option value="rejected">rejected</option>
                                    </select>
                                  </label>
                                  <label className="text-[10px] text-slate-600">Date de validation<input value={editingInvestorSubscription.approvedAt || ''} onChange={(event) => setEditingInvestorSubscription({ ...editingInvestorSubscription, approvedAt: event.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                                  <label className="text-[10px] text-slate-600">Date de paiement<input value={editingInvestorSubscription.paidAt || ''} onChange={(event) => setEditingInvestorSubscription({ ...editingInvestorSubscription, paidAt: event.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                                  <label className="text-[10px] text-slate-600">Moyen de paiement<input value={editingInvestorSubscription.paymentMethod || ''} onChange={(event) => setEditingInvestorSubscription({ ...editingInvestorSubscription, paymentMethod: event.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs" /></label>
                                </div>
                                {subscriptionEditError && <p role="alert" className="text-xs font-semibold text-red-700">{subscriptionEditError}</p>}
                                <div className="flex gap-2">
                                  <button type="submit" disabled={investorManagementLoading} className="rounded bg-cyan-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">Enregistrer l’historique</button>
                                  <button type="button" onClick={() => setEditingInvestorSubscription(null)} className="rounded bg-slate-200 px-3 py-2 text-[10px] font-bold text-slate-800">Annuler</button>
                                </div>
                              </form>
                            )}
                          </section>
                        </>
                      ) : null}
                    </div>
                  )}
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: PROJETS D'INVESTISSEMENT, PARTS & PARTAGE DE GAIN
          ========================================================================= */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-syne text-base sm:text-lg font-bold text-slate-900">
                Projets d'Investissement &amp; Souscriptions de Parts
              </h2>
              <p className="text-xs text-slate-500">
                Publiez les opérations en cours, validez les souscriptions et procédez aux partages de bénéfices.
              </p>
            </div>

            {(hasPerm('manage_operations') || hasPerm('manage_subscriptions')) && (
              <div className="flex flex-wrap items-center gap-2">
                {hasPerm('manage_operations') && (
                  <button
                    type="button"
                    onClick={() => setIsAddProjectOpen(!isAddProjectOpen)}
                    className="py-2 px-3.5 rounded-xl btn-gold-prestige text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">{isAddProjectOpen ? 'close' : 'add_circle'}</span>
                    <span>{isAddProjectOpen ? 'Fermer le Formulaire' : 'Nouvelle Opération de Financement'}</span>
                  </button>
                )}

                {hasPerm('manage_subscriptions') && (
                  <button
                    type="button"
                    onClick={openProfitDistributionModal}
                    className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">payments</span>
                    <span>Partager les Bénéfices / Gains</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Formulaire de Saisie et Publication d'une Opération de Financement */}
          {hasPerm('manage_operations') && isAddProjectOpen && (
            <form
              onSubmit={handleCreateAndPublishOperation}
              className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border-2 border-amber-400 shadow-md space-y-4 text-xs animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-amber-300 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-700 text-xl">campaign</span>
                  <div>
                    <h3 className="font-syne text-sm font-extrabold text-slate-900">
                      Saisir une Nouvelle Opération de Financement &amp; Publier
                    </h3>
                    <span className="text-[11px] text-amber-950">
                      Définissez l'opération industrielle, le montant cible, le rendement et l'offre d'actions.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddProjectOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                >
                  ✕ Fermer
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                    Titre de l'Opération de Financement *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProjTitle}
                    onChange={(e) => setNewProjTitle(e.target.value)}
                    placeholder="Ex: Acquisition Ligne CMS & Bancs de Test IoT Industriels"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                    Secteur d'Activité *
                  </label>
                  <select
                    value={newProjCategory}
                    onChange={(e) => setNewProjCategory(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold outline-none focus:border-amber-500"
                  >
                    <option value="Électronique">Électronique &amp; IoT</option>
                    <option value="Électrotechnique">Électrotechnique &amp; Puissance</option>
                    <option value="Informatique">Informatique &amp; Réseaux</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                    Montant Cible à Mobiliser (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="50000"
                    step="50000"
                    required
                    value={newProjTarget}
                    onChange={(e) => setNewProjTarget(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                    Durée du Cycle *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProjDuration}
                    onChange={(e) => setNewProjDuration(e.target.value)}
                    placeholder="Ex: 12 Mois, 6 Mois"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                    Rendement Annuel Estimé *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProjYield}
                    onChange={(e) => setNewProjYield(e.target.value)}
                    placeholder="Ex: 15% à 18%"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-emerald-800 font-bold outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                    Distribution des Dividendes
                  </label>
                  <select
                    value={newProjDistribution}
                    onChange={(e) => setNewProjDistribution(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold outline-none focus:border-amber-500"
                  >
                    <option value="Trimestrielle">Trimestrielle (Tous les 3 mois)</option>
                    <option value="Semestrielle">Semestrielle (Tous les 6 mois)</option>
                    <option value="Annuelle">Annuelle (Clôture d'exercice)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                    Objectif Industriel &amp; Description du Projet *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={newProjObjective}
                    onChange={(e) => setNewProjObjective(e.target.value)}
                    placeholder="Décrivez l'utilisation concrète des fonds levés (achat d'équipements, constitution de stocks, contrats clients...)"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-700 block mb-1">
                    Conditions Particulières de Souscription
                  </label>
                  <textarea
                    rows={2}
                    value={newProjConditions}
                    onChange={(e) => setNewProjConditions(e.target.value)}
                    placeholder="Conditions minimales, règles d'éligibilité, etc."
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Paramètres de l'Offre de Parts Associée */}
              <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2">
                <span className="text-[11px] font-bold text-amber-900 uppercase flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-amber-600">tune</span>
                  <span>Prix et quota de parts de l'opération</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Titre de l'Offre</label>
                    <input
                      type="text"
                      value={newProjOfferTitle}
                      onChange={(e) => setNewProjOfferTitle(e.target.value)}
                      placeholder="Ex: Parts Ordinaires Standard"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Prix Unitaire par Part</label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={newProjSharePrice}
                        onChange={(e) => setNewProjSharePrice(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-amber-800 outline-none"
                      />
                      <span className="ml-2 font-mono text-xs text-slate-600 font-bold">FCFA</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Nombre total de parts *</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={newProjAvailableShares || ''}
                      onChange={(e) => setNewProjAvailableShares(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Statut Initial de Publication *</label>
                    <select
                      value={newProjStatus}
                      onChange={(e) => setNewProjStatus(e.target.value as any)}
                      className={`w-full border rounded-lg p-2 text-xs font-bold outline-none ${
                        newProjStatus === 'Ouvert'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      <option value="Ouvert">● Publier Immédiatement (Ouvert aux Investisseurs)</option>
                      <option value="Brouillon">○ Garder en Brouillon (Masqué pour le moment)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-amber-200">
                <span className="text-[11px] text-amber-950 font-medium">
                  {newProjStatus === 'Ouvert'
                    ? "✓ Cette opération sera immédiatement visible et accessible aux investisseurs approuvés."
                    : "ℹ Cette opération restera en brouillon. Vous pourrez la publier d'un clic ultérieurement."}
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsAddProjectOpen(false)}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-none px-5 py-2 rounded-xl btn-gold-prestige font-bold text-xs uppercase tracking-wider text-slate-950 shadow-md cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">publish</span>
                    <span>{newProjStatus === 'Ouvert' ? "Publier l'Opération Officielle" : "Enregistrer l'Opération"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* SECTION 1: PROJETS D'INVESTISSEMENT & GESTION DE PUBLICATION */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-600 text-base">campaign</span>
                <span>Opérations de Financement Actives ({projects.length})</span>
              </h3>
              <div className="flex items-center gap-2">
                {hasPerm('manage_operations') && (
                  <button
                    type="button"
                    onClick={() => setIsAddProjectOpen(!isAddProjectOpen)}
                    className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">add</span>
                    <span>Saisir &amp; Publier</span>
                  </button>
                )}
                <span className="text-[10px] text-slate-400">Visibilité Investisseurs</span>
              </div>
            </div>

            {projects.length === 0 ? (
              <div className="p-8 sm:p-12 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-3xl">campaign</span>
                </div>
                <h4 className="font-syne text-sm font-bold text-slate-800">
                  Aucune opération de financement n'est actuellement créée
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Cliquez sur « Nouvelle Opération de Financement » ci-dessus pour saisir et publier un projet avec ses conditions de participation.
                </p>
                {hasPerm('manage_operations') && (
                  <button
                    type="button"
                    onClick={() => setIsAddProjectOpen(true)}
                    className="px-4 py-2 rounded-xl btn-gold-prestige font-bold text-xs"
                  >
                    + Saisir et Publier la Première Opération
                  </button>
                )}
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {projects.map((proj) => {
                const isPub = proj.isPublished !== false;
                const percent = Math.min(100, Math.round((proj.collectedAmount / proj.targetAmount) * 100));
                const currentStatus = proj.offerStatus || (isPub ? 'Ouvert' : 'Brouillon');
                return (
                  <div
                    key={proj.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-cyan-800 bg-cyan-100 px-1.5 py-0.2 rounded">
                          {proj.category}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            currentStatus === 'Ouvert'
                              ? 'bg-emerald-100 text-emerald-800'
                              : currentStatus === 'Suspendu'
                              ? 'bg-amber-100 text-amber-800'
                              : currentStatus === 'Fermé'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          ● {currentStatus.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="font-syne text-xs font-bold text-slate-900 line-clamp-2">
                        {proj.title}
                      </h4>

                      {/* Données financières confidentielles (visibles uniquement par l'admin) */}
                      <div className="mt-2 p-2 bg-white rounded-lg border border-slate-200 space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-600">
                          <span>Objectif total :</span>
                          <strong className="text-slate-900">{proj.targetAmount.toLocaleString('fr-FR')} FCFA</strong>
                        </div>
                        <div className="flex justify-between text-[11px] text-emerald-700 font-bold">
                          <span>Total collecté :</span>
                          <span>{proj.collectedAmount.toLocaleString('fr-FR')} FCFA ({percent}%)</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Restant à collecter :</span>
                          <span>{Math.max(0, proj.targetAmount - proj.collectedAmount).toLocaleString('fr-FR')} FCFA</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>Prix / part :</span>
                          <strong>{(proj.sharePrice || proj.offers?.[0]?.sharePrice || 0).toLocaleString('fr-FR')} FCFA</strong>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>Parts restantes :</span>
                          <strong>{Math.max(0, (proj.availableShares || 0) - (proj.subscribedShares || 0)).toLocaleString('fr-FR')}</strong>
                        </div>
                      </div>
                    </div>

                    {hasPerm('manage_operations') && (
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        {editingOperation?.id === proj.id ? (
                          <form
                            className="grid grid-cols-2 gap-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const price = Number(editingOperation.sharePrice);
                              const availableShares = Number(editingOperation.availableShares);
                              if (!Number.isSafeInteger(price) || price < 1 || !Number.isSafeInteger(availableShares) || availableShares < 1) {
                                alert('Le prix et le nombre de parts doivent être des entiers positifs.');
                                return;
                              }
                              onUpdateProject({
                                ...proj,
                                sharePrice: price,
                                availableShares,
                                offers: proj.offers?.map((offer) => ({ ...offer, sharePrice: price }))
                              });
                              setEditingOperation(null);
                            }}
                          >
                            <label className="text-[10px] font-bold text-slate-600">
                              Prix unitaire (FCFA)
                              <input
                                type="number"
                                min="1"
                                step="1"
                                required
                                value={editingOperation.sharePrice}
                                onChange={(event) => setEditingOperation({ ...editingOperation, sharePrice: event.target.value })}
                                className="mt-1 w-full rounded border border-slate-300 p-1.5 text-xs"
                              />
                            </label>
                            <label className="text-[10px] font-bold text-slate-600">
                              Parts totales
                              <input
                                type="number"
                                min="1"
                                step="1"
                                required
                                value={editingOperation.availableShares}
                                onChange={(event) => setEditingOperation({ ...editingOperation, availableShares: event.target.value })}
                                className="mt-1 w-full rounded border border-slate-300 p-1.5 text-xs"
                              />
                            </label>
                            <button type="submit" className="rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold text-white">
                              Enregistrer
                            </button>
                            <button type="button" onClick={() => setEditingOperation(null)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-[10px] font-bold text-slate-700">
                              Annuler
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingOperation({
                              id: proj.id,
                              sharePrice: String(proj.sharePrice || proj.offers?.[0]?.sharePrice || ''),
                              availableShares: String(proj.availableShares || '')
                            })}
                            className="w-full rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-900 hover:bg-amber-100"
                          >
                            Modifier prix et quota
                          </button>
                        )}
                        <span className="text-[10px] font-bold text-slate-600 block">Changer l'état de l'offre :</span>
                        <div className="grid grid-cols-4 gap-1 text-[10px]">
                          {(['Brouillon', 'Ouvert', 'Suspendu', 'Fermé'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                if (st === 'Fermé') {
                                  if (!confirm(`Confirmez-vous la fermeture définitive de l'offre "${proj.title}" ?\nAucune nouvelle souscription ne sera acceptée.`)) {
                                    return;
                                  }
                                }
                                const updated = {
                                  ...proj,
                                  offerStatus: st,
                                  isPublished: st === 'Ouvert' || st === 'Suspendu' || st === 'Fermé'
                                };
                                onUpdateProject(updated);
                                onAddAuditLog({
                                  author: currentAdminName,
                                  date: new Date().toLocaleString('fr-FR'),
                                  actionType: 'update_offer_status',
                                  description: `Passage de l'offre "${proj.title}" au statut ${st}`,
                                  entityType: 'subscription'
                                });
                              }}
                              className={`py-1 rounded font-bold cursor-pointer transition-colors ${
                                currentStatus === st
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                        {onDeleteProject && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Confirmez-vous la suppression définitive du projet d'investissement "${proj.title}" ?`)) {
                                onDeleteProject(proj.id);
                                onAddAuditLog({
                                  author: currentAdminName,
                                  date: new Date().toLocaleString('fr-FR'),
                                  actionType: 'delete_project',
                                  description: `Suppression du projet d'investissement "${proj.title}" (${proj.id})`,
                                  entityType: 'subscription'
                                });
                              }
                            }}
                            className="w-full mt-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] cursor-pointer flex items-center justify-center gap-1 transition-colors"
                            title="Supprimer ce projet"
                          >
                            <span className="material-symbols-outlined text-xs">delete</span>
                            <span>Supprimer cette Opération</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: LISTE DES DEMANDES DE SOUSCRIPTION */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Demandes de Souscriptions Enregistrées ({subscriptions.length})</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-normal">
                  Paiement direct en agence ou sur WhatsApp validé par l'admin
                </span>
                {isPrincipal && subscriptions.length > 0 && onPurgeTestData && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Purger toutes les demandes de souscription ?")) {
                        onPurgeTestData('requests');
                      }
                    }}
                    className="text-[10px] text-red-600 hover:underline font-bold cursor-pointer"
                  >
                    Purger
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {subscriptions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Aucune souscription enregistrée pour le moment.
                </div>
              ) : (
                subscriptions.map((sub) => (
                  <div key={sub.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{sub.investorName}</span>
                        <span className="text-[10px] font-mono text-slate-500">{sub.id}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            sub.status === 'paid_and_issued' || sub.status === 'approved_pending_payment'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sub.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {sub.status === 'paid_and_issued'
                            ? 'PAYÉE & ENREGISTRÉE'
                            : sub.status === 'approved_pending_payment'
                            ? 'ACCORD MAÎTRE DONNÉ'
                            : sub.status === 'rejected'
                            ? 'REJETÉE'
                            : 'EN ATTENTE VALIDATION'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {sub.shares} actions • Total : {sub.totalAmount.toLocaleString('fr-FR')} FCFA • {sub.investorEmail} • {sub.investorPhone}
                      </div>
                    </div>

                    {hasPerm('manage_subscriptions') && (
                      <div className="flex items-center gap-2">
                        {sub.status === 'pending_admin' && (
                          <>
                            <button
                              type="button"
                              disabled={Boolean(processingSubIds[sub.id])}
                              onClick={async () => {
                                if (processingSubIds[sub.id]) return;
                                setProcessingSubIds((prev) => ({ ...prev, [sub.id]: true }));
                                try {
                                  await Promise.resolve(onApproveSubscription(sub.id));
                                } finally {
                                  setProcessingSubIds((prev) => ({ ...prev, [sub.id]: false }));
                                }
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {processingSubIds[sub.id] ? 'Traitement…' : 'Approuver'}
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(processingSubIds[sub.id])}
                              onClick={async () => {
                                if (processingSubIds[sub.id]) return;
                                setProcessingSubIds((prev) => ({ ...prev, [sub.id]: true }));
                                try {
                                  await Promise.resolve(onRejectSubscription(sub.id));
                                } finally {
                                  setProcessingSubIds((prev) => ({ ...prev, [sub.id]: false }));
                                }
                              }}
                              className="px-2 py-1 rounded bg-red-50 text-red-600 font-bold text-[11px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Rejeter
                            </button>
                          </>
                        )}
                        {sub.status === 'approved_pending_payment' && (
                          <button
                            type="button"
                            disabled={Boolean(processingSubIds[sub.id])}
                            onClick={async () => {
                              if (processingSubIds[sub.id]) return;
                              setProcessingSubIds((prev) => ({ ...prev, [sub.id]: true }));
                              try {
                                await Promise.resolve(onForceValidateSubscription(sub.id));
                              } finally {
                                setProcessingSubIds((prev) => ({ ...prev, [sub.id]: false }));
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Confirmer la réception effective des fonds et valider officiellement"
                          >
                            {processingSubIds[sub.id] ? 'Validation…' : 'Valider le Paiement Reçu'}
                          </button>
                        )}
                        {onDeleteSubscription && (
                          <button
                            type="button"
                            disabled={Boolean(processingSubIds[sub.id])}
                            onClick={async () => {
                              if (processingSubIds[sub.id]) return;
                              if (confirm(`Confirmez-vous la suppression de la souscription ${sub.id} pour ${sub.investorName} ?`)) {
                                setProcessingSubIds((prev) => ({ ...prev, [sub.id]: true }));
                                try {
                                  await Promise.resolve(onDeleteSubscription(sub.id));
                                  onAddAuditLog({
                                    author: currentAdminName,
                                    date: new Date().toLocaleString('fr-FR'),
                                    actionType: 'delete_subscription',
                                    description: `Suppression de la souscription ${sub.id} pour ${sub.investorName}`,
                                    entityType: 'subscription'
                                  });
                                } finally {
                                  setProcessingSubIds((prev) => ({ ...prev, [sub.id]: false }));
                                }
                              }
                            }}
                            className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] cursor-pointer flex items-center gap-0.5 disabled:opacity-50"
                            title="Supprimer définitivement cette demande"
                          >
                            <span className="material-symbols-outlined text-xs">delete</span>
                            <span>Supprimer</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 3: HISTORIQUE DES PARTAGES DE BÉNÉFICES */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-700 text-sm">receipt_long</span>
                <span>Historique des Partages de Bénéfices Effectués ({profitDistributions.length})</span>
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                Montants versés directement aux associés admissibles
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {profitDistributions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 italic">
                  Aucun partage de bénéfice enregistré.
                </div>
              ) : (
                profitDistributions.map((dist) => (
                  <div
                    key={dist.id}
                    className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{dist.reference}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800">
                          {dist.sector}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{dist.period}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                          {dist.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>
                          Associés :{' '}
                          <strong className="text-emerald-700">
                            {dist.investorsShareTotal.toLocaleString('fr-FR')} FCFA
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          ELECTRO-MEN :{' '}
                          <strong>{dist.companyShare.toLocaleString('fr-FR')} FCFA</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Unité ({dist.eligibleCount} associés) :{' '}
                          <strong className="text-emerald-800">
                            {dist.individualAmount.toLocaleString('fr-FR')} FCFA/personne
                          </strong>
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Publié le {dist.publishedAt} par {dist.validatedBy || 'Super-Admin'} • Note : {dist.notes}
                      </div>
                    </div>

                    {hasPerm('manage_subscriptions') && onDeleteProfitDistribution && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              `Confirmez-vous la suppression du partage de dividende ${dist.reference} (${dist.period}) ?`
                            )
                          ) {
                            onDeleteProfitDistribution(dist.id);
                            onAddAuditLog({
                              author: currentAdminName,
                              date: new Date().toLocaleString('fr-FR'),
                              actionType: 'delete_profit_distribution',
                              description: `Suppression de la distribution de dividende ${dist.reference} (${dist.period})`,
                              entityType: 'wallet'
                            });
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] cursor-pointer flex items-center gap-1 shrink-0"
                        title="Supprimer cette opération de dividende"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                        <span>Supprimer</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 4: ACTIVITÉS & RÉALISATIONS DES INVESTISSEURS */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-600">verified</span>
                  <span>Activités de l'Entreprise &amp; Photos de Réussite ({investorActivities.length})</span>
                </h3>
                <span className="text-[11px] text-slate-500">
                  Affiché dans l'onglet "Activités" de l'espace investisseur. L'administrateur gère et peut tout supprimer.
                </span>
              </div>
              {hasPerm('manage_content') && (
                <button
                  type="button"
                  onClick={() => setIsAddActivityOpen(!isAddActivityOpen)}
                  className="px-3 py-1.5 rounded-xl btn-gold-prestige font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-sm">{isAddActivityOpen ? 'close' : 'add'}</span>
                  <span>{isAddActivityOpen ? 'Fermer' : 'Nouvelle Activité'}</span>
                </button>
              )}
            </div>

            {/* Formulaire ajout activité */}
            {hasPerm('manage_content') && isAddActivityOpen && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newActivityTitle.trim() || !newActivityDesc.trim()) return;
                  if (onAddInvestorActivity) {
                    onAddInvestorActivity({
                      id: `act-${Date.now()}`,
                      title: newActivityTitle.trim(),
                      description: newActivityDesc.trim(),
                      sector: newActivitySector,
                      badge: newActivityBadge,
                      imageUrl: newActivityImage.trim() || undefined,
                      date: newActivityDate.trim() || 'Octobre 2026'
                    });
                  }
                  onAddAuditLog({
                    author: currentAdminName,
                    date: new Date().toLocaleString('fr-FR'),
                    actionType: 'create_course',
                    description: `Ajout de l'activité investisseur "${newActivityTitle.trim()}"`,
                    entityType: 'subscription'
                  });
                  setNewActivityTitle('');
                  setNewActivityDesc('');
                  setNewActivityImage('');
                  setIsAddActivityOpen(false);
                }}
                className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Titre de l'Activité *</label>
                    <input
                      type="text"
                      required
                      value={newActivityTitle}
                      onChange={(e) => setNewActivityTitle(e.target.value)}
                      placeholder="Ex: Arrivée de la nouvelle ligne CMS"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Secteur / Domaine</label>
                    <input
                      type="text"
                      value={newActivitySector}
                      onChange={(e) => setNewActivitySector(e.target.value)}
                      placeholder="Ex: Électronique & IoT"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Badge d'État</label>
                    <input
                      type="text"
                      value={newActivityBadge}
                      onChange={(e) => setNewActivityBadge(e.target.value)}
                      placeholder="Ex: Production Active"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">URL Photo / Image (Optionnel)</label>
                    <input
                      type="text"
                      value={newActivityImage}
                      onChange={(e) => setNewActivityImage(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Période / Date</label>
                    <input
                      type="text"
                      value={newActivityDate}
                      onChange={(e) => setNewActivityDate(e.target.value)}
                      placeholder="Ex: Octobre 2026"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Description Détaillée *</label>
                  <textarea
                    required
                    rows={2}
                    value={newActivityDesc}
                    onChange={(e) => setNewActivityDesc(e.target.value)}
                    placeholder="Description de l'activité, bilan opérationnel..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddActivityOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg btn-gold-prestige font-bold text-white cursor-pointer shadow-xs"
                  >
                    Publier l'Activité
                  </button>
                </div>
              </form>
            )}

            {/* Liste des activités */}
            <div className="divide-y divide-slate-100">
              {investorActivities.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 italic">
                  Aucune activité publiée. L'espace investisseur reste vierge tant que l'administrateur n'a rien ajouté.
                </div>
              ) : (
                investorActivities.map((act) => (
                  <div key={act.id} className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">{act.title}</span>
                        {act.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                            {act.badge}
                          </span>
                        )}
                        {act.sector && (
                          <span className="text-[10px] font-mono text-slate-500">
                            {act.sector}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{act.description}</p>
                    </div>

                    {hasPerm('manage_content') && onDeleteInvestorActivity && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Supprimer définitivement l'activité "${act.title}" ?`)) {
                            onDeleteInvestorActivity(act.id);
                            onAddAuditLog({
                              author: currentAdminName,
                              date: new Date().toLocaleString('fr-FR'),
                              actionType: 'delete_course',
                              description: `Suppression de l'activité investisseur "${act.title}"`,
                              entityType: 'subscription'
                            });
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                        <span>Supprimer</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 5: DOCUMENTS JURIDIQUES & FINANCIERS INVESTISSEURS */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-cyan-600">description</span>
                  <span>Documents &amp; Statuts Investisseurs ({investorDocuments.length})</span>
                </h3>
                <span className="text-[11px] text-slate-500">
                  Documents juridiques et financiers téléchargeables par les investisseurs.
                </span>
              </div>
              {hasPerm('manage_content') && (
                <button
                  type="button"
                  onClick={() => setIsAddDocOpen(!isAddDocOpen)}
                  className="px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-sm">{isAddDocOpen ? 'close' : 'add'}</span>
                  <span>{isAddDocOpen ? 'Fermer' : 'Nouveau Document'}</span>
                </button>
              )}
            </div>

            {/* Formulaire ajout document */}
            {hasPerm('manage_content') && isAddDocOpen && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newDocTitle.trim()) return;
                  if (onAddInvestorDocument) {
                    onAddInvestorDocument({
                      id: `doc-${Date.now()}`,
                      title: newDocTitle.trim(),
                      format: newDocFormat,
                      size: newDocSize.trim() || '1.0 Mo',
                      description: newDocDesc.trim() || undefined,
                      url: newDocUrl.trim() || undefined
                    });
                  }
                  onAddAuditLog({
                    author: currentAdminName,
                    date: new Date().toLocaleString('fr-FR'),
                    actionType: 'create_course',
                    description: `Ajout du document investisseur "${newDocTitle.trim()}"`,
                    entityType: 'subscription'
                  });
                  setNewDocTitle('');
                  setNewDocDesc('');
                  setNewDocUrl('');
                  setIsAddDocOpen(false);
                }}
                className="p-4 rounded-xl bg-cyan-50/60 border border-cyan-200 space-y-3 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Titre du Document *</label>
                    <input
                      type="text"
                      required
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      placeholder="Ex: Statuts Notariés RCCM ELECTRO-MEN SAS"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Format</label>
                    <input
                      type="text"
                      value={newDocFormat}
                      onChange={(e) => setNewDocFormat(e.target.value)}
                      placeholder="Ex: PDF Juridique (Certifié)"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Taille du Fichier</label>
                    <input
                      type="text"
                      value={newDocSize}
                      onChange={(e) => setNewDocSize(e.target.value)}
                      placeholder="Ex: 2.4 Mo"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Lien / URL du Fichier (Optionnel)</label>
                    <input
                      type="text"
                      value={newDocUrl}
                      onChange={(e) => setNewDocUrl(e.target.value)}
                      placeholder="https://... ou /assets/..."
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddDocOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 font-bold text-white cursor-pointer shadow-xs"
                  >
                    Enregistrer le Document
                  </button>
                </div>
              </form>
            )}

            {/* Liste des documents */}
            <div className="divide-y divide-slate-100">
              {investorDocuments.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 italic">
                  Aucun document publié pour le moment.
                </div>
              ) : (
                investorDocuments.map((doc) => (
                  <div key={doc.id} className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-700 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 text-xs">{doc.title}</span>
                        <div className="text-[10px] text-slate-500">
                          {doc.format} • {doc.size}
                        </div>
                      </div>
                    </div>

                    {hasPerm('manage_content') && onDeleteInvestorDocument && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Supprimer définitivement le document "${doc.title}" ?`)) {
                            onDeleteInvestorDocument(doc.id);
                            onAddAuditLog({
                              author: currentAdminName,
                              date: new Date().toLocaleString('fr-FR'),
                              actionType: 'delete_course',
                              description: `Suppression du document investisseur "${doc.title}"`,
                              entityType: 'subscription'
                            });
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                        <span>Supprimer</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DISTRIBUTION DIRECTE DES DIVIDENDES AUX INVESTISSEURS */}
      {isDistributeModalOpen && hasPerm('manage_subscriptions') && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border-2 border-emerald-500 overflow-hidden my-auto max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-emerald-800 to-emerald-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/60 border border-emerald-400/40 flex items-center justify-center shadow-inner">
                  <span className="material-symbols-outlined text-amber-300 text-2xl">account_balance_wallet</span>
                </div>
                <div>
                  <h3 className="font-syne font-bold text-sm sm:text-base leading-tight">
                    Distribution Directe des Dividendes aux Associés
                  </h3>
                  <span className="text-[10px] text-emerald-200">
                    Ciblage strict par Boutique &amp; Opération (vérification serveur atomique)
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={isDistributingProfit}
                onClick={() => setIsDistributeModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {(() => {
              const sectorOperations = projects.filter((p) => (p.sector || p.category) === distSector);
              const selectedOp = sectorOperations.find((p) => p.id === distOperationId) || sectorOperations[0];
              const resolvedOpId = selectedOp?.id || '';
              const resolvedOpTitle = selectedOp?.title || '';

              const confirmedSubInvestorIds = new Set<string>();
              const confirmedSubInvestorEmails = new Set<string>();
              if (resolvedOpId) {
                for (const s of subscriptions) {
                  if (
                    s.operationId === resolvedOpId &&
                    (s.status === 'paid_and_issued' || s.status === 'approved_pending_payment')
                  ) {
                    if (s.investorId) confirmedSubInvestorIds.add(s.investorId);
                    if (s.investorEmail) confirmedSubInvestorEmails.add(s.investorEmail.trim().toLowerCase());
                  }
                }
              }

              const eligibleInvestors = resolvedOpId
                ? registeredInvestors.filter((inv) => {
                    if (inv.status !== 'approuve') return false;
                    const hasMatchingAllocation =
                      Array.isArray(inv.shareAllocations) &&
                      inv.shareAllocations.some(
                        (alloc) => alloc.sector === distSector && alloc.operationId === resolvedOpId && (alloc.shares || 0) > 0
                      );
                    const hasMatchingSubscription =
                      confirmedSubInvestorIds.has(inv.id) ||
                      confirmedSubInvestorEmails.has(inv.email.trim().toLowerCase());
                    return hasMatchingAllocation || hasMatchingSubscription;
                  })
                : [];

              const investorsShareTotal = Math.max(0, distAmount || 0);
              const companyShare = Math.max(0, distCompanyAmount || 0);
              const totalOperationAmount = investorsShareTotal + companyShare;
              const eligibleCount = eligibleInvestors.length;
              const individualAmount = eligibleCount > 0 ? Math.floor(investorsShareTotal / eligibleCount) : 0;
              const isBlocked = !selectedOp || eligibleCount === 0 || investorsShareTotal <= 0 || individualAmount <= 0 || isDistributingProfit;

              return (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (isBlocked || !selectedOp || !onDistributeProfits) {
                      setProfitDistError('La distribution est bloquée : sélectionnez une boutique et une opération ayant au moins un investisseur approuvé admissible.');
                      return;
                    }
                    setIsDistributingProfit(true);
                    setProfitDistError(null);
                    try {
                      const ok = await Promise.resolve(
                        onDistributeProfits(
                          resolvedOpTitle,
                          investorsShareTotal,
                          distNotes,
                          distSector,
                          distPeriod,
                          companyShare,
                          resolvedOpId,
                          profitDistIdempotencyKey
                        )
                      );
                      if (ok !== false) {
                        setIsDistributeModalOpen(false);
                      } else {
                        setProfitDistError('La distribution n’a pas pu être validée par le serveur. Vérifiez les paramètres ou réessayez.');
                      }
                    } catch (err) {
                      setProfitDistError(err instanceof Error ? err.message : 'Erreur lors de la distribution des gains.');
                    } finally {
                      setIsDistributingProfit(false);
                    }
                  }}
                  className="p-5 space-y-4 text-xs text-slate-800 overflow-y-auto"
                >
                  {/* Notice de Saisie Directe */}
                  <div className="p-3 rounded-xl bg-slate-900 text-white border border-slate-700 space-y-1.5 shadow-sm">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px] uppercase tracking-wide">
                      <span className="material-symbols-outlined text-sm">verified_user</span>
                      <span>Ciblage Boutique &amp; Opération</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Seuls les <strong className="text-emerald-300">investisseurs approuvés</strong> détenant des parts sur l’opération sélectionnée de la boutique <strong className="text-amber-300">{distSector}</strong> reçoivent ce versement ({eligibleCount} éligible{eligibleCount > 1 ? 's' : ''}).
                    </p>
                  </div>

                  {profitDistError && (
                    <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs font-semibold">
                      {profitDistError}
                    </div>
                  )}

                  {/* Ligne 1 : Secteur et Période */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Boutique / Secteur Concerné *
                      </label>
                      <select
                        value={distSector}
                        disabled={isDistributingProfit}
                        onChange={(e) => {
                          const nextSector = e.target.value as BoutiqueSector;
                          setDistSector(nextSector);
                          const firstOp = projects.find((p) => (p.sector || p.category) === nextSector);
                          setDistOperationId(firstOp?.id || '');
                          setDistProjectName(firstOp?.title || '');
                          setProfitDistError(null);
                        }}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold outline-none focus:border-emerald-500 focus:bg-white"
                      >
                        <option value="Électronique">Électronique (Composants, IoT &amp; CMS)</option>
                        <option value="Électrotechnique">Électrotechnique (Armoires &amp; Puissance)</option>
                        <option value="Informatique">Informatique (Hardware, Postes &amp; Réseaux)</option>
                      </select>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Ligne WhatsApp : {distSector === 'Électronique' ? '+226 65 48 47 38' : distSector === 'Électrotechnique' ? '+226 07 31 57 34' : '+226 56 28 35 26'}
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Période de Référence *
                      </label>
                      <input
                        type="text"
                        required
                        disabled={isDistributingProfit}
                        value={distPeriod}
                        onChange={(e) => setDistPeriod(e.target.value)}
                        placeholder="Ex: 3ème Trimestre 2026"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                      />
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Période comptable certifiée
                      </span>
                    </div>
                  </div>

                  {/* Ligne 2 : Opération de financement appartenant à la boutique */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Opération Ciblée (Boutique {distSector}) *
                    </label>
                    {sectorOperations.length === 0 ? (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold">
                        Aucune opération de financement n’est rattachée à la boutique « {distSector} ». Créez d’abord une opération dans ce secteur.
                      </div>
                    ) : (
                      <select
                        required
                        disabled={isDistributingProfit}
                        value={resolvedOpId}
                        onChange={(e) => {
                          const op = sectorOperations.find((p) => p.id === e.target.value);
                          setDistOperationId(e.target.value);
                          setDistProjectName(op?.title || '');
                          setProfitDistError(null);
                        }}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                      >
                        {sectorOperations.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} ({p.offerStatus || p.status || 'Ouvert'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Ligne 3 : Saisie Directe des Montants */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Montant alloué aux Associés (FCFA) *
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        step={1}
                        disabled={isDistributingProfit}
                        value={distAmount}
                        onChange={(e) => setDistAmount(Math.max(0, Number(e.target.value)))}
                        placeholder="Ex: 70000"
                        className="w-full bg-emerald-50/50 border-2 border-emerald-400 rounded-xl p-2.5 text-sm font-mono font-bold text-emerald-950 outline-none focus:border-emerald-600 focus:bg-white"
                      />
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Montant total à répartir entre les associés éligibles
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Part conservée par ELECTRO-MEN (FCFA)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        disabled={isDistributingProfit}
                        value={distCompanyAmount}
                        onChange={(e) => setDistCompanyAmount(Math.max(0, Number(e.target.value)))}
                        placeholder="Ex: 30000"
                        className="w-full bg-cyan-50/50 border-2 border-cyan-400 rounded-xl p-2.5 text-sm font-mono font-bold text-cyan-950 outline-none focus:border-cyan-600 focus:bg-white"
                      />
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Trésorerie &amp; gestion interne (optionnel)
                      </span>
                    </div>
                  </div>

                  {/* Live Calculation Preview Card */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50 via-slate-50 to-amber-50 border border-emerald-300 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                      <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-emerald-700 text-sm">payments</span>
                        Récapitulatif des Dividendes
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-200/70 text-emerald-900 font-bold">
                        Total Opération : {totalOperationAmount.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-emerald-100/70 border border-emerald-300">
                        <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                          Total Associés
                        </div>
                        <div className="font-mono text-base font-extrabold text-emerald-950 mt-0.5">
                          {investorsShareTotal.toLocaleString('fr-FR')} FCFA
                        </div>
                        <div className="text-[10px] text-emerald-700 mt-0.5">
                          À répartir à parts égales
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-cyan-100/70 border border-cyan-300">
                        <div className="text-[10px] text-cyan-800 font-bold uppercase tracking-wider">
                          ELECTRO-MEN
                        </div>
                        <div className="font-mono text-base font-extrabold text-cyan-950 mt-0.5">
                          {companyShare.toLocaleString('fr-FR')} FCFA
                        </div>
                        <div className="text-[10px] text-cyan-700 mt-0.5">
                          Réserve &amp; logistique
                        </div>
                      </div>
                    </div>

                    {/* Part Individuelle par Investisseur */}
                    <div className="p-3 rounded-xl bg-white border-2 border-emerald-400 flex items-center justify-between shadow-xs">
                      <div>
                        <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                          <span>Dividende unitaire par associé éligible</span>
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-extrabold text-[10px]">
                            Égalité stricte
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {investorsShareTotal.toLocaleString('fr-FR')} FCFA ÷ {eligibleCount} associés admissibles
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-black text-emerald-700">
                          {individualAmount.toLocaleString('fr-FR')} FCFA
                        </div>
                        <div className="text-[10px] text-slate-600 font-semibold">
                          par associé admissible
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Liste des Investisseurs Éligibles */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-slate-500 text-sm">group</span>
                        Investisseurs Admissibles ({eligibleCount})
                      </label>
                      <span className="text-[10px] text-slate-500">
                        {distSector} • {resolvedOpTitle || 'Aucune opération'}
                      </span>
                    </div>

                    {eligibleCount === 0 ? (
                      <div className="p-3 rounded-xl bg-red-50 border-2 border-red-300 text-red-700 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base">block</span>
                          <span>Distribution Bloquée : 0 Investisseur Éligible</span>
                        </div>
                        <p className="text-[11px] text-red-600">
                          Aucun investisseur approuvé ne détient de part ou souscription validée sur cette opération de la boutique « {distSector} ».
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-200 p-1">
                        {eligibleInvestors.map((inv) => (
                          <div key={inv.id} className="p-2 flex items-center justify-between text-[11px] hover:bg-white rounded transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">
                                {inv.name.slice(0, 1)}
                              </span>
                              <div>
                                <div className="font-bold text-slate-800">{inv.name}</div>
                                <div className="text-[10px] text-slate-500">{inv.phone} • {inv.email}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-emerald-700">
                                +{individualAmount.toLocaleString('fr-FR')} FCFA
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Motif / Note pour les Investisseurs */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Motif / Note Officielle Destinée aux Investisseurs *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isDistributingProfit}
                      value={distNotes}
                      onChange={(e) => setDistNotes(e.target.value)}
                      placeholder="Ex: Bénéfices nets validés sur les ventes de microcontrôleurs & matériel IoT (T3)"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Cette note apparaîtra sur le relevé individuel de chaque investisseur concerné.
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isDistributingProfit}
                      onClick={() => setIsDistributeModalOpen(false)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer transition-colors disabled:opacity-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isBlocked}
                      className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-1.5 transition-all ${
                        isBlocked
                          ? 'bg-slate-400 cursor-not-allowed opacity-60'
                          : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer active:scale-98'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">publish</span>
                      <span>{isDistributingProfit ? 'Distribution en cours…' : 'Publier le Partage des Bénéfices'}</span>
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: GESTION DES DÉPÔTS ET RETRAITS D'ARGENT DES INVESTISSEURS
          Conformité stricte :
          1. Réception et consultation dans le tableau de bord
          2. Identification de l'investisseur, type d'opération et montant
          3. Contact direct sur WhatsApp
          4. Vérification de l'encaissement réel (dépôt) ou du versement (retrait)
          5. Bouton « Admettre / Confirmer l'opération » uniquement après vérification
          6. Bouton « Refuser la demande » avec motif de refus
          7. Enregistrement de l'administrateur validateur, date et heure
          8. Mise à jour de solde uniquement sur confirmation (aucune double confirmation)
          ========================================================================= */}
      {activeTab === 'funds' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-syne text-base sm:text-lg font-bold text-slate-900">
                  Gestion des Dépôts et Retraits
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold uppercase">
                  Trésorerie &amp; Règlements
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Validez les demandes d'alimentation ou de retraits d'argent uniquement après vérification de la réception réelle des fonds.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span>{fundRequests.filter((r) => r.status === 'En attente').length} En attente</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-cyan-50 border border-cyan-300 text-cyan-900 font-bold flex items-center gap-1.5">
                <span>{fundRequests.filter((r) => r.status === 'En cours de traitement').length} En traitement</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold flex items-center gap-1.5">
                <span>{fundRequests.filter((r) => r.status === 'Confirmé').length} Confirmés</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-800 font-bold flex items-center gap-1.5">
                <span>{fundRequests.filter((r) => r.status === 'Refusé').length} Refusés</span>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
            {/* Filter Status */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-bold text-slate-500 mr-1 uppercase">Statut :</span>
              {[
                { id: 'all', label: 'Toutes' },
                { id: 'En attente', label: 'En attente' },
                { id: 'En cours de traitement', label: 'En cours de traitement' },
                { id: 'Confirmé', label: 'Confirmé' },
                { id: 'Refusé', label: 'Refusé' }
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setFundFilterStatus(st.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    fundFilterStatus === st.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Filter Type */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-slate-500 mr-1 uppercase">Type :</span>
              {[
                { id: 'all', label: 'Tous flux' },
                { id: 'depot', label: 'Dépôts' },
                { id: 'retrait', label: 'Retraits' }
              ].map((tp) => (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => setFundFilterType(tp.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    fundFilterType === tp.id
                      ? 'bg-amber-500 text-slate-950 font-extrabold shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Requests List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {(() => {
              const filtered = fundRequests.filter((r) => {
                const matchStatus = fundFilterStatus === 'all' || r.status === fundFilterStatus;
                const matchType = fundFilterType === 'all' || r.type === fundFilterType;
                return matchStatus && matchType;
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-12 text-center text-slate-400 bg-white">
                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">
                      account_balance_wallet
                    </span>
                    <p className="text-xs font-bold text-slate-600">
                      Aucune demande de dépôt ou de retrait ne correspond aux filtres sélectionnés.
                    </p>
                  </div>
                );
              }

              return (
                <div className="divide-y divide-slate-100">
                  {filtered.map((req) => {
                    const cleanPhone = req.investorPhone.replace(/\D/g, '');
                    const whatsAppMsg = `Bonjour ${req.investorName}, concernant votre demande ${req.reference} de ${
                      req.type === 'depot' ? 'DÉPÔT' : 'RETRAIT'
                    } d'un montant de ${req.amount.toLocaleString(
                      'fr-FR'
                    )} FCFA sur ELECTRO-MEN. Je suis ${currentAdminName}.`;
                    const whatsAppUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                      whatsAppMsg
                    )}`;

                    return (
                      <div
                        key={req.id}
                        className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Left: Info */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                req.type === 'depot'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                              }`}
                            >
                              {req.type === 'depot' ? 'DÉPÔT' : 'RETRAIT'}
                            </span>

                            <span className="font-mono text-sm font-extrabold text-slate-900">
                              {req.reference}
                            </span>

                            {/* Status badge */}
                            {req.status === 'En attente' && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                <span>En attente de vérification</span>
                              </span>
                            )}

                            {req.status === 'En cours de traitement' && (
                              <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300 text-[10px] font-extrabold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-spin"></span>
                                <span>En cours de traitement</span>
                              </span>
                            )}

                            {req.status === 'Confirmé' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs text-emerald-600">
                                  check_circle
                                </span>
                                <span>Confirmé &amp; Solde Ajusté</span>
                              </span>
                            )}

                            {req.status === 'Refusé' && (
                              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-300 text-[10px] font-extrabold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs text-red-600">
                                  cancel
                                </span>
                                <span>Refusé (Solde Intact)</span>
                              </span>
                            )}
                          </div>

                          {/* Investor identity & details */}
                          <div className="text-xs text-slate-700 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-bold text-slate-900">
                              {req.investorName}{' '}
                              <span className="text-slate-500 font-mono text-[11px]">
                                ({req.investorId})
                              </span>
                            </span>
                            <span>•</span>
                            <span className="font-mono text-slate-600">{req.investorPhone}</span>
                            <span>•</span>
                            <span className="text-slate-500">{req.investorEmail}</span>
                            <span>•</span>
                            <span className="text-slate-500">Demande soumise le {req.requestedAt}</span>
                          </div>

                          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>
                              Moyen de paiement :{' '}
                              <strong className="text-slate-800">
                                {req.paymentMethod || 'Mobile Money'}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Ligne WhatsApp ciblée :{' '}
                              <span className="text-cyan-800 font-semibold">{req.adminWhatsApp}</span>
                            </span>
                          </div>

                          {/* Decision history */}
                          {req.status === 'Confirmé' && req.validatedBy && (
                            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-1.5 font-medium">
                              <span className="material-symbols-outlined text-sm text-emerald-600">
                                verified_user
                              </span>
                              <span>
                                Opération admise et confirmée par{' '}
                                <strong>{req.validatedBy}</strong> le{' '}
                                <strong>{req.validatedAt || req.requestedAt}</strong>.
                              </span>
                            </div>
                          )}

                          {req.status === 'Refusé' && (
                            <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-900 flex items-center gap-1.5 font-medium">
                              <span className="material-symbols-outlined text-sm text-red-600">
                                info
                              </span>
                              <span>
                                Demande refusée par <strong>{req.validatedBy || currentAdminName}</strong> le{' '}
                                <strong>{req.validatedAt || req.requestedAt}</strong>. Motif :{' '}
                                <strong className="underline">{req.rejectionReason || 'Non spécifié'}</strong>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Right: Amount & Actions */}
                        <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                          {/* Big amount */}
                          <div className="text-left lg:text-right">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">
                              Montant à {req.type === 'depot' ? 'créditer' : 'débiter'}
                            </span>
                            <div
                              className={`font-syne text-xl sm:text-2xl font-black ${
                                req.type === 'depot' ? 'text-amber-800' : 'text-cyan-800'
                              }`}
                            >
                              {req.amount.toLocaleString('fr-FR')}{' '}
                              <span className="text-xs font-bold text-slate-600">FCFA</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                            {/* 1. Contacter l'investisseur sur WhatsApp */}
                            <a
                              href={whatsAppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors"
                              title="Contacter l'investisseur sur WhatsApp"
                            >
                              <span className="material-symbols-outlined text-sm">chat</span>
                              <span>WhatsApp</span>
                            </a>

                            {/* 2. Marquer en traitement si En attente */}
                            {hasPerm('manage_funds') && req.status === 'En attente' && onSetFundRequestProcessing && (
                              <button
                                type="button"
                                disabled={Boolean(processingFundIds[req.id])}
                                onClick={async () => {
                                  if (processingFundIds[req.id]) return;
                                  setProcessingFundIds((prev) => ({ ...prev, [req.id]: true }));
                                  try {
                                    await Promise.resolve(onSetFundRequestProcessing(req.id));
                                  } finally {
                                    setProcessingFundIds((prev) => ({ ...prev, [req.id]: false }));
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-cyan-100 hover:bg-cyan-200 text-cyan-900 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Passer en cours de traitement"
                              >
                                <span className="material-symbols-outlined text-sm">pending_actions</span>
                                <span>{processingFundIds[req.id] ? 'Traitement…' : 'En traitement'}</span>
                              </button>
                            )}

                            {/* 3. Admettre / Confirmer l'opération */}
                            {hasPerm('manage_funds') &&
                              (req.status === 'En attente' || req.status === 'En cours de traitement') &&
                              onConfirmFundRequest && (
                                <button
                                  type="button"
                                  disabled={Boolean(processingFundIds[req.id])}
                                  onClick={async () => {
                                    if (processingFundIds[req.id]) return;
                                    if (
                                      confirm(
                                        `Confirmez-vous que vous avez RÉELLEMENT reçu les fonds ou effectué le virement pour la demande ${req.reference} de ${req.amount.toLocaleString(
                                          'fr-FR'
                                        )} FCFA pour ${req.investorName} ?\n\nCette action va modifier immédiatement le solde du portefeuille investisseur.`
                                      )
                                    ) {
                                      setProcessingFundIds((prev) => ({ ...prev, [req.id]: true }));
                                      try {
                                        await Promise.resolve(onConfirmFundRequest(req.id));
                                      } finally {
                                        setProcessingFundIds((prev) => ({ ...prev, [req.id]: false }));
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Admettre et créditer/débiter le solde"
                                >
                                  <span className="material-symbols-outlined text-sm">check_circle</span>
                                  <span>{processingFundIds[req.id] ? 'Confirmation…' : 'Admettre / Confirmer'}</span>
                                </button>
                              )}

                            {/* 4. Refuser la demande avec motif */}
                            {hasPerm('manage_funds') &&
                              (req.status === 'En attente' || req.status === 'En cours de traitement') &&
                              onRejectFundRequest && (
                                <button
                                  type="button"
                                  disabled={Boolean(processingFundIds[req.id])}
                                  onClick={() => {
                                    setRejectingFundReq(req);
                                    setRejectReasonInput('');
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                                  title="Refuser la demande"
                                >
                                  <span className="material-symbols-outlined text-sm">close</span>
                                  <span>Refuser</span>
                                </button>
                              )}

                            {/* Inactive badges for finalized status */}
                            {req.status === 'Confirmé' && (
                              <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-1 border border-emerald-200">
                                <span className="material-symbols-outlined text-sm text-emerald-600">
                                  done_all
                                </span>
                                <span>Opération Validée</span>
                              </span>
                            )}

                            {req.status === 'Refusé' && (
                              <span className="px-2.5 py-1 rounded-xl bg-red-50 text-red-800 text-xs font-bold flex items-center gap-1 border border-red-200">
                                <span className="material-symbols-outlined text-sm text-red-600">
                                  block
                                </span>
                                <span>Demande Rejetée</span>
                              </span>
                            )}

                            {/* 5. Supprimer définitivement la demande */}
                            {isPrincipal && onDeleteFundRequest && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Confirmez-vous la suppression définitive de la demande ${req.reference} (${req.type}) pour ${req.investorName} ?`)) {
                                    onDeleteFundRequest(req.id);
                                    onAddAuditLog({
                                      author: currentAdminName,
                                      date: new Date().toLocaleString('fr-FR'),
                                      actionType: 'delete_fund_request',
                                      description: `Suppression de la demande de trésorerie ${req.reference} (${req.type}) pour ${req.investorName}`,
                                      entityType: 'wallet'
                                    });
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Supprimer définitivement cette demande"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                                <span>Supprimer</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectingFundReq && hasPerm('manage_funds') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 space-y-4 text-xs text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-base">warning</span>
                </span>
                <div>
                  <h3 className="font-syne text-sm font-bold text-slate-900">
                    Refuser la Demande {rejectingFundReq.reference}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {rejectingFundReq.investorName} • {rejectingFundReq.amount.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectingFundReq(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <p className="text-slate-600">
              Conformément aux règles de sécurité, le rejet d'une demande ne modifie aucunement le solde du compte investisseur. Veuillez indiquer le motif officiel pour l'investisseur :
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!rejectReasonInput.trim()) {
                  alert('Veuillez spécifier le motif du refus.');
                  return;
                }
                const targetId = rejectingFundReq.id;
                if (processingFundIds[targetId]) return;
                setProcessingFundIds((prev) => ({ ...prev, [targetId]: true }));
                try {
                  if (onRejectFundRequest) {
                    await Promise.resolve(onRejectFundRequest(targetId, rejectReasonInput.trim()));
                  }
                  setRejectingFundReq(null);
                } finally {
                  setProcessingFundIds((prev) => ({ ...prev, [targetId]: false }));
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Motif du Refus *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  placeholder="Ex : Règlement non parvenu sur Orange Money après vérification des relevés..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-red-500"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingFundReq(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  <span>Confirmer le Refus</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: RÔLES & SÉCURITÉ (ADMINS SECONDAIRES & MOT DE PASSE MAÎTRE)
          ========================================================================= */}
      {activeTab === 'roles' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="font-syne text-base sm:text-lg font-bold text-slate-900">
                Rôles Administrateurs &amp; Sécurité des Accès
              </h2>
              <p className="text-xs text-slate-500">
                Déléguez les accès aux administrateurs secondaires et gérez la sécurité du compte principal.
              </p>
            </div>
            <div className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
              {adminUsers.filter((u) => u.role === 'admin_principal').length} principal ·{' '}
              {adminUsers.filter((u) => u.role === 'admin_secondaire').length} secondaire(s)
            </div>
          </div>

          {/* Feedback global permissions / création / suppression */}
          {adminPermFeedback && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-emerald-700">check_circle</span>
                <span>{adminPermFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setAdminPermFeedback(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1 rounded cursor-pointer"
                aria-label="Fermer le message"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          )}

          {secondaryAdminFeedback && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-base text-emerald-700 mt-0.5">verified_user</span>
                  <div className="space-y-1">
                    <p className="font-bold text-emerald-900">{secondaryAdminFeedback.message}</p>
                    {secondaryAdminFeedback.tempPassword && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-emerald-800">
                        <span>Mot de passe provisoire :</span>
                        <code className="px-2 py-0.5 rounded bg-white border border-emerald-200 font-mono font-bold text-slate-900 select-all">
                          {secondaryAdminFeedback.tempPassword}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            if (secondaryAdminFeedback.tempPassword && navigator.clipboard) {
                              void navigator.clipboard.writeText(secondaryAdminFeedback.tempPassword);
                              setCopiedTempPass(true);
                              setTimeout(() => setCopiedTempPass(false), 2500);
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                        >
                          {copiedTempPass ? 'Copié' : 'Copier'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSecondaryAdminFeedback(null)}
                  className="text-emerald-700 hover:text-emerald-950 p-1 rounded cursor-pointer shrink-0"
                  aria-label="Fermer la confirmation"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>
          )}

          {/* Panneau déroulant replié par défaut : Nommer un Administrateur Secondaire */}
          {isPrincipal && (
            <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
              <button
                type="button"
                aria-expanded={isAddSecondaryAdminOpen}
                aria-controls="secondary-admin-form-panel"
                onClick={() => {
                  setIsAddSecondaryAdminOpen((prev) => !prev);
                  setSecondaryAdminFormError(null);
                }}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-[#996515] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">person_add</span>
                  </span>
                  <div className="min-w-0">
                    <span className="font-syne text-sm font-bold text-slate-900 block truncate">
                      + Nommer un administrateur secondaire
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate">
                      Créer un accès délégué avec mot de passe provisoire et droits ciblés
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                    {isAddSecondaryAdminOpen ? 'Réduire' : 'Ouvrir'}
                  </span>
                  <span
                    className={`material-symbols-outlined text-slate-500 transition-transform duration-200 ${
                      isAddSecondaryAdminOpen ? 'rotate-180' : ''
                    }`}
                  >
                    expand_more
                  </span>
                </div>
              </button>

              <div
                id="secondary-admin-form-panel"
                aria-hidden={!isAddSecondaryAdminOpen}
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                  isAddSecondaryAdminOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                }`}
              >
                <div className={`overflow-hidden ${!isAddSecondaryAdminOpen ? 'invisible' : ''}`}>
                  <form
                    onSubmit={handleAddSecondaryAdminByEmail}
                    className="px-4 pb-4 pt-3 border-t border-slate-200 bg-slate-50/40 space-y-4"
                  >
                    {secondaryAdminFormError && (
                      <div
                        role="alert"
                        className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-base text-red-600 shrink-0">error</span>
                        <span>{secondaryAdminFormError}</span>
                      </div>
                    )}

                    {/* Identité & Coordonnées */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label htmlFor="sec-admin-email" className="block text-[11px] font-bold text-slate-700">
                          Adresse email professionnelle *
                        </label>
                        <input
                          id="sec-admin-email"
                          type="email"
                          required
                          disabled={!isAddSecondaryAdminOpen || isCreatingSecondaryAdmin}
                          value={secondaryAdminEmailInput}
                          onChange={(e) => {
                            setSecondaryAdminEmailInput(e.target.value);
                            if (secondaryAdminFormError) setSecondaryAdminFormError(null);
                          }}
                          placeholder="collaborateur@electromen.bf"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-amber-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="sec-admin-name" className="block text-[11px] font-bold text-slate-700">
                          Nom complet <span className="font-normal text-slate-400">(optionnel)</span>
                        </label>
                        <input
                          id="sec-admin-name"
                          type="text"
                          maxLength={80}
                          disabled={!isAddSecondaryAdminOpen || isCreatingSecondaryAdmin}
                          value={secondaryAdminNameInput}
                          onChange={(e) => setSecondaryAdminNameInput(e.target.value)}
                          placeholder="Déduit de l'email si vide"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-amber-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="sec-admin-phone" className="block text-[11px] font-bold text-slate-700">
                          Téléphone <span className="font-normal text-slate-400">(optionnel)</span>
                        </label>
                        <input
                          id="sec-admin-phone"
                          type="tel"
                          maxLength={30}
                          disabled={!isAddSecondaryAdminOpen || isCreatingSecondaryAdmin}
                          value={secondaryAdminPhoneInput}
                          onChange={(e) => setSecondaryAdminPhoneInput(e.target.value)}
                          placeholder="+226 70 00 00 00"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-amber-600 tabular-nums"
                        />
                      </div>
                    </div>

                    {/* Attribution des permissions par domaine */}
                    <div className="pt-2 border-t border-slate-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            Droits initiaux attribués{' '}
                            <span className="text-slate-500 font-semibold tabular-nums">
                              ({secondaryAdminPermissions.length} / {ALL_ADMIN_PERMISSIONS.length})
                            </span>
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Modifiables ou révocables à tout moment après création.
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!isAddSecondaryAdminOpen || isCreatingSecondaryAdmin}
                            onClick={() => setSecondaryAdminPermissions([...ALL_ADMIN_PERMISSIONS])}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Tout cocher
                          </button>
                          <button
                            type="button"
                            disabled={!isAddSecondaryAdminOpen || isCreatingSecondaryAdmin}
                            onClick={() => setSecondaryAdminPermissions([])}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Tout décocher (0)
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(
                          [
                            'Catalogue & Académie',
                            'Investisseurs & Opérations',
                            'Trésorerie & Logistique',
                            'Contenu & Supervision'
                          ] as const
                        ).map((categoryName) => {
                          const items = ADMIN_PERMISSION_DEFINITIONS.filter((p) => p.category === categoryName);
                          return (
                            <div
                              key={categoryName}
                              className="p-3 rounded-lg bg-white border border-slate-200 space-y-2"
                            >
                              <div className="text-[11px] font-bold text-slate-800 pb-1 border-b border-slate-100">
                                {categoryName}
                              </div>
                              <div className="space-y-1.5">
                                {items.map((perm) => {
                                  const checked = secondaryAdminPermissions.includes(perm.id);
                                  return (
                                    <label
                                      key={perm.id}
                                      className={`flex items-start gap-2.5 p-2 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                                        checked
                                          ? 'bg-amber-50/60 border-amber-300 text-slate-900'
                                          : 'bg-slate-50/60 border-transparent hover:border-slate-200 text-slate-600'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        disabled={!isAddSecondaryAdminOpen || isCreatingSecondaryAdmin}
                                        checked={checked}
                                        onChange={() =>
                                          setSecondaryAdminPermissions((prev) =>
                                            prev.includes(perm.id)
                                              ? prev.filter((id) => id !== perm.id)
                                              : [...prev, perm.id]
                                          )
                                        }
                                        className="mt-0.5 rounded text-amber-700 focus:ring-0"
                                      />
                                      <div className="min-w-0">
                                        <span className="font-semibold text-slate-900 block leading-tight">
                                          {perm.label}
                                        </span>
                                        <span className="text-[10px] text-slate-500 block leading-snug mt-0.5">
                                          {perm.description}
                                        </span>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Barre d'actions distincte */}
                    <div className="pt-2 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="text-[11px] text-slate-500">
                        Un mot de passe provisoire sécurisé sera généré automatiquement.
                      </span>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isCreatingSecondaryAdmin}
                          onClick={handleCancelSecondaryAdminForm}
                          className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer whitespace-nowrap"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          disabled={!isAddSecondaryAdminOpen || isCreatingSecondaryAdmin}
                          className="px-4 py-2 rounded-lg btn-gold-prestige font-bold text-xs text-white cursor-pointer whitespace-nowrap"
                        >
                          {isCreatingSecondaryAdmin ? 'Création en cours…' : 'Nommer administrateur'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Liste compacte et lisible des administrateurs */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 tabular-nums">
                Équipe d'administration active ({adminUsers.length})
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Vérification des droits appliquée côté interface et serveur PostgreSQL
              </span>
            </div>

            {adminUsers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Aucun compte administrateur chargé.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {adminUsers.map((u) => {
                  const savedPerms: AdminPermission[] =
                    u.role === 'admin_principal'
                      ? [...ALL_ADMIN_PERMISSIONS]
                      : Array.isArray(u.permissions)
                      ? u.permissions
                      : DEFAULT_SECONDARY_ADMIN_PERMISSIONS;
                  const draftPerms: AdminPermission[] = adminPermDrafts[u.id] ?? savedPerms;
                  const isDirty =
                    u.role === 'admin_secondaire' &&
                    (draftPerms.length !== savedPerms.length ||
                      draftPerms.some((p) => !savedPerms.includes(p)));
                  const isPermPanelOpen = expandedPermAdminId === u.id;

                  return (
                    <div key={u.id} className="px-4 py-3 space-y-2.5">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                              {u.name}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span
                              className={`text-[11px] font-semibold tabular-nums ${
                                u.role === 'admin_principal'
                                  ? 'text-amber-800'
                                  : savedPerms.length > 0
                                  ? 'text-cyan-800'
                                  : 'text-slate-500'
                              }`}
                            >
                              {u.role === 'admin_principal'
                                ? 'Principal (accès complet)'
                                : `Secondaire · ${savedPerms.length} / ${ALL_ADMIN_PERMISSIONS.length} droit${savedPerms.length > 1 ? 's' : ''}`}
                            </span>
                            {isDirty && (
                              <span className="text-[11px] font-semibold text-amber-700">
                                · Modifications non enregistrées
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
                            <span className="truncate">{u.email}</span>
                            {u.phone && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{u.phone}</span>
                              </>
                            )}
                            {u.addedDate && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Ajouté le {u.addedDate}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {isPrincipal && !u.isProtected && (
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {u.role === 'admin_secondaire' && (
                              <button
                                type="button"
                                aria-expanded={isPermPanelOpen}
                                onClick={() =>
                                  setExpandedPermAdminId((prev) => (prev === u.id ? null : u.id))
                                }
                                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                                  isPermPanelOpen || isDirty
                                    ? 'bg-slate-900 border-slate-900 text-white'
                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                                }`}
                              >
                                <span className="material-symbols-outlined text-sm">tune</span>
                                <span>Droits ({draftPerms.length})</span>
                                <span
                                  className={`material-symbols-outlined text-sm transition-transform duration-200 ${
                                    isPermPanelOpen ? 'rotate-180' : ''
                                  }`}
                                >
                                  expand_more
                                </span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingSecondaryAdminPass({ user: u, newPass: '' })}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                            >
                              <span className="material-symbols-outlined text-sm">key</span>
                              <span>Mot de passe</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSecondaryAdmin(u.id, u.name, u.email)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                              title="Révoquer et supprimer cet administrateur secondaire"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                              <span>Supprimer</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {isPrincipal && u.role === 'admin_secondaire' && isPermPanelOpen && (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-800 tabular-nums">
                              Permissions de {u.name} ({draftPerms.length} / {ALL_ADMIN_PERMISSIONS.length})
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              <button
                                type="button"
                                disabled={savingAdminPermId === u.id}
                                onClick={() =>
                                  setAdminPermDrafts((prev) => ({ ...prev, [u.id]: [...ALL_ADMIN_PERMISSIONS] }))
                                }
                                className="px-2.5 py-1 rounded-md bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold cursor-pointer disabled:opacity-50"
                              >
                                Tout accorder
                              </button>
                              <button
                                type="button"
                                disabled={savingAdminPermId === u.id}
                                onClick={() =>
                                  setAdminPermDrafts((prev) => ({ ...prev, [u.id]: [] }))
                                }
                                className="px-2.5 py-1 rounded-md bg-white border border-red-200 hover:bg-red-50 text-red-700 font-semibold cursor-pointer disabled:opacity-50"
                              >
                                Tout révoquer
                              </button>
                              <button
                                type="button"
                                disabled={savingAdminPermId === u.id}
                                onClick={() => {
                                  setAdminPermDrafts((prev) => {
                                    const next = { ...prev };
                                    delete next[u.id];
                                    return next;
                                  });
                                  setExpandedPermAdminId(null);
                                }}
                                className="px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold cursor-pointer"
                              >
                                Fermer
                              </button>
                              <button
                                type="button"
                                disabled={!isDirty || savingAdminPermId === u.id}
                                onClick={() => void handleUpdateAdminPermissions(u, draftPerms)}
                                className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50"
                              >
                                {savingAdminPermId === u.id ? 'Enregistrement…' : 'Enregistrer'}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {ADMIN_PERMISSION_DEFINITIONS.map((perm) => {
                              const checked = draftPerms.includes(perm.id);
                              return (
                                <label
                                  key={perm.id}
                                  className={`flex items-start gap-2 p-2 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                                    checked
                                      ? 'bg-white border-cyan-300 text-slate-900'
                                      : 'bg-slate-100/60 border-slate-200 text-slate-500'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={savingAdminPermId === u.id}
                                    checked={checked}
                                    onChange={() => {
                                      const next = checked
                                        ? draftPerms.filter((id) => id !== perm.id)
                                        : [...draftPerms, perm.id];
                                      setAdminPermDrafts((prev) => ({ ...prev, [u.id]: next }));
                                    }}
                                    className="mt-0.5 rounded text-cyan-700 focus:ring-0"
                                  />
                                  <div className="min-w-0">
                                    <span className="font-semibold block leading-tight">{perm.label}</span>
                                    <span className="text-[10px] text-slate-500 block leading-snug">
                                      {perm.category}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sécurité & accès administrateur */}
          {isPrincipal && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-red-600 text-base">password</span>
                <span>Changer le code maître administrateur</span>
              </h3>
              <p className="text-xs text-slate-600">Le code est haché et stocké dans PostgreSQL. Il prend effet immédiatement, sans redémarrage.</p>
              {masterPasswordMessage && <p role="status" className="text-xs font-semibold text-emerald-700">{masterPasswordMessage}</p>}
              {masterPasswordError && <p role="alert" className="text-xs font-semibold text-red-700">{masterPasswordError}</p>}
              <form onSubmit={handleSaveMasterPassword} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={masterPasswordInput}
                  onChange={(event) => setMasterPasswordInput(event.target.value)}
                  placeholder="Nouveau code (8 caractères min.)"
                  className="rounded-lg border border-slate-300 p-2 text-xs"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={masterPasswordConfirm}
                  onChange={(event) => setMasterPasswordConfirm(event.target.value)}
                  placeholder="Confirmer le nouveau code"
                  className="rounded-lg border border-slate-300 p-2 text-xs"
                />
                <button type="submit" disabled={isSavingMasterPassword} className="rounded-xl bg-red-700 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {isSavingMasterPassword ? 'Enregistrement…' : 'Mettre à jour le code'}
                </button>
              </form>
            </div>
          )}

          {/* Modification de l'URL Secrète de l'Administration */}
          {isPrincipal && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#b48c1e] text-base">link</span>
                  <span>Modifier l'URL d'Administration</span>
                </h3>
                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 font-bold px-2 py-0.5 rounded font-mono">
                  {adminCustomUrl}
                </span>
              </div>

              {urlMessage && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold">
                  {urlMessage}
                </div>
              )}

              <form onSubmit={handleSaveUrl} className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    value={editingUrl}
                    onChange={(e) => setEditingUrl(e.target.value)}
                    placeholder="Ex : /electromen-gestion ou /admin-prive"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg btn-gold-prestige font-bold text-xs text-white cursor-pointer shrink-0"
                  >
                    Enregistrer l'URL
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Cette route secrète vous permet d'accéder au panneau d'administration. Les moteurs de recherche sont strictement bloqués via <code>robots.txt</code> et la balise <code>noindex, nofollow</code>.
                </p>
              </form>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB: CORBEILLE / ARCHIVES
          ========================================================================= */}
      {activeTab === 'archives' && (
        <section className="space-y-4 animate-fadeIn">
          <div>
            <h2 className="font-syne text-base sm:text-lg font-bold text-slate-900">Corbeille / Archives</h2>
            <p className="text-xs text-slate-600 mt-1">Les éléments archivés sont conservés dans PostgreSQL. Restaurer les remet en ligne immédiatement.</p>
          </div>
          {archiveError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{archiveError}</p>}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            {archives.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">La corbeille est vide.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {archives.map((archive) => {
                  const entityLabels: Record<string, string> = {
                    operation: 'Opération',
                    offer: 'Offre',
                    product: 'Produit',
                    course: 'Formation',
                    'course-category': 'Catégorie de formation',
                    activity: 'Activité',
                    document: 'Document',
                    investor: 'Compte investisseur',
                    'admin-user': 'Compte administrateur',
                    subscription: 'Souscription',
                    'audit-log': 'Journal d’audit',
                    'audit-log-batch': 'Lot de journaux d’audit'
                  };
                  return (
                    <div key={archive.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {entityLabels[archive.entityType] || archive.entityType}
                          </span>
                          <span className="truncate text-xs font-bold text-slate-900">{archive.label}</span>
                        </div>
                        <span className="mt-1 block text-[10px] text-slate-500">
                          Archivé le {new Date(archive.archivedAt).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRestoreArchive(archive)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
                      >
                        <span className="material-symbols-outlined text-sm">restore</span>
                        Restaurer
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* =========================================================================
          TAB: CONFIGURATION DU DOMAINE OFFICIEL & SEO TECHNIQUE
          ========================================================================= */}
      {activeTab === 'seo' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-syne text-base sm:text-lg font-bold text-slate-900">
                  Configuration du Domaine &amp; Référencement Naturel (SEO)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold uppercase">
                  Google Search Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Définissez l'adresse officielle de votre site, contrôlez les métadonnées canoniques, le fichier robots.txt et le Sitemap XML.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadSitemap}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Télécharger sitemap.xml</span>
              </button>
            </div>
          </div>

          {seoMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
              <span>{seoMessage}</span>
            </div>
          )}

          {/* 1. DOMAINE OFFICIEL DU SITE & PROTOCOLE HTTPS */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-base">public</span>
                </div>
                <div>
                  <h3 className="font-syne text-sm font-bold text-slate-900">
                    Nom de Domaine Officiel (Base URL / HTTPS)
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Adresse racine utilisée pour les liens canoniques, réseaux sociaux et sitemaps
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                HTTPS Activé
              </span>
            </div>

            <form onSubmit={handleSaveBaseUrl} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  required
                  value={siteBaseUrlInput}
                  onChange={(e) => setSiteBaseUrlInput(e.target.value)}
                  placeholder="https://electromen.bf"
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:border-amber-500 focus:bg-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl btn-gold-prestige font-bold text-xs text-white cursor-pointer shadow-xs shrink-0 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>Enregistrer le Domaine</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Exemple : <code>https://electromen.bf</code> ou l'URL fournie par votre hébergeur. Toutes les balises <code>&lt;link rel="canonical"&gt;</code>, OpenGraph (WhatsApp, Facebook) et le sitemap se synchronisent immédiatement avec cette URL.
              </p>
            </form>
          </div>

          {/* 2. MODIFIER L'URL D'ADMINISTRATION SECRÈTE */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-base">vpn_key</span>
                </div>
                <div>
                  <h3 className="font-syne text-sm font-bold text-slate-900">
                    Modifier l'URL d'Accès Administrateur
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Chemin secret pour ouvrir la console d'administration
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold font-mono">
                {adminCustomUrl}
              </span>
            </div>

            <form onSubmit={handleSaveUrl} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  required
                  value={editingUrl}
                  onChange={(e) => setEditingUrl(e.target.value)}
                  placeholder="Ex : /electromen-gestion ou /admin-direction"
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:border-cyan-500 focus:bg-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 font-bold text-xs text-white cursor-pointer shadow-xs shrink-0 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">link</span>
                  <span>Mettre à jour l'URL Admin</span>
                </button>
              </div>

              {/* Full URL copy widget */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                <div className="truncate">
                  <span className="text-slate-500 mr-1.5 font-bold">URL complète d'administration :</span>
                  <code className="text-slate-900 font-mono font-extrabold select-all">
                    {(siteBaseUrlInput.trim() || siteBaseUrl).replace(/\/+$/, '')}{editingUrl.startsWith('/') ? editingUrl : `/${editingUrl}`}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      `${(siteBaseUrlInput.trim() || siteBaseUrl).replace(/\/+$/, '')}${editingUrl.startsWith('/') ? editingUrl : `/${editingUrl}`}`,
                      'admin_url'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">
                    {copiedKey === 'admin_url' ? 'done' : 'content_copy'}
                  </span>
                  <span>{copiedKey === 'admin_url' ? 'Copié !' : 'Copier le lien'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* 3. CARTOGRAPHIE DES URLS CANONIQUES PUBLIQUES DÉCLARÉES À GOOGLE */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-syne text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">travel_explore</span>
              <span>Pages Publiques Indexables Déclarées (URLs Canoniques)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Ces adresses sont transmises à Google via les balises canoniques et le sitemap. Les robots ont interdiction d'indexer l'espace investisseur ou l'administration.
            </p>

            {(() => {
              const cleanBase = (siteBaseUrlInput.trim() || siteBaseUrl).replace(/\/+$/, '');
              const publicPages = [
                {
                  label: "Page d'Accueil & Pôle Industriel",
                  url: `${cleanBase}/`,
                  priority: '1.0',
                  changefreq: 'Quotidien',
                  status: 'index, follow'
                },
                {
                  label: 'Formations Pratiques & Académie',
                  url: `${cleanBase}/?tab=solutions`,
                  priority: '0.85',
                  changefreq: 'Hebdomadaire',
                  status: 'index, follow'
                },
                {
                  label: 'Bourse IR & Actionnariat Participatif (Offres Publiques)',
                  url: `${cleanBase}/?tab=bourse`,
                  priority: '0.90',
                  changefreq: 'Quotidien',
                  status: 'index, follow'
                },
                {
                  label: 'Boutique Électronique & Microcontrôleurs',
                  url: `${cleanBase}/?tab=boutique_electronique`,
                  priority: '0.80',
                  changefreq: 'Hebdomadaire',
                  status: 'index, follow'
                },
                {
                  label: 'Boutique Électrotechnique & Puissance',
                  url: `${cleanBase}/?tab=boutique_electrotechnique`,
                  priority: '0.80',
                  changefreq: 'Hebdomadaire',
                  status: 'index, follow'
                },
                {
                  label: 'Boutique Informatique & Réseaux',
                  url: `${cleanBase}/?tab=boutique_informatique`,
                  priority: '0.80',
                  changefreq: 'Hebdomadaire',
                  status: 'index, follow'
                },
                {
                  label: 'Catalogue Global Composants',
                  url: `${cleanBase}/?tab=composants`,
                  priority: '0.75',
                  changefreq: 'Hebdomadaire',
                  status: 'index, follow'
                }
              ];

              return (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                      <tr>
                        <th className="p-2.5">Section Publique</th>
                        <th className="p-2.5">URL Canonique</th>
                        <th className="p-2.5 text-center">Priorité</th>
                        <th className="p-2.5 text-center">Fréquence</th>
                        <th className="p-2.5 text-center">Directive Robots</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {publicPages.map((page, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-bold text-slate-800">{page.label}</td>
                          <td className="p-2.5 font-mono text-[11px] text-cyan-800 select-all font-semibold">
                            {page.url}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-emerald-700">
                            {page.priority}
                          </td>
                          <td className="p-2.5 text-center text-slate-600">{page.changefreq}</td>
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              {page.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* 4. SITEMAP XML & FICHIER ROBOTS.TXT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Colonne 1 : Sitemap XML */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600">account_tree</span>
                    <h3 className="font-syne text-sm font-bold text-slate-900">
                      Plan du Site XML (/sitemap.xml)
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">7 URLs Publiques</span>
                </div>
                <p className="text-xs text-slate-600">
                  Fichier XML standard conforme aux spécifications Google Sitemaps. Disponible à la racine publique de votre site.
                </p>
                <div className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[10px] leading-relaxed overflow-x-auto max-h-48 border border-slate-800">
                  <pre>{`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${(siteBaseUrlInput.trim() || siteBaseUrl).replace(/\/+$/, '')}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${(siteBaseUrlInput.trim() || siteBaseUrl).replace(/\/+$/, '')}/?tab=solutions</loc>
    <priority>0.85</priority>
  </url>
  <url>
    <loc>${(siteBaseUrlInput.trim() || siteBaseUrl).replace(/\/+$/, '')}/?tab=bourse</loc>
    <priority>0.90</priority>
  </url>
  ... (7 URLs publiques au total)
</urlset>`}</pre>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleDownloadSitemap}
                  className="flex-1 py-2 px-3 rounded-xl btn-gold-prestige font-bold text-xs text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span>Télécharger sitemap.xml</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      `${(siteBaseUrlInput.trim() || siteBaseUrl).replace(/\/+$/, '')}/sitemap.xml`,
                      'sitemap_url'
                    )
                  }
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">
                    {copiedKey === 'sitemap_url' ? 'done' : 'link'}
                  </span>
                  <span>{copiedKey === 'sitemap_url' ? 'Copié !' : 'Lien Sitemap'}</span>
                </button>
              </div>
            </div>

            {/* Colonne 2 : Fichier robots.txt */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-600">shield</span>
                    <h3 className="font-syne text-sm font-bold text-slate-900">
                      Protection Robots (/robots.txt)
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">
                    Zones Privées Exclues
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Garantit que les données personnelles d'investisseurs et l'administration ne seront jamais explorées ni indexées par les robots.
                </p>
                <div className="p-3 rounded-xl bg-slate-950 text-slate-300 font-mono text-[10px] leading-relaxed overflow-x-auto max-h-48 border border-slate-800">
                  <pre>{`User-agent: *
Allow: /
Allow: /?tab=accueil
Allow: /?tab=solutions
Allow: /?tab=bourse
Allow: /assets/

# Exclusion stricte des zones sensibles
Disallow: /admin*
Disallow: /*?tab=admin*
Disallow: /*?tab=profil*
Disallow: /electromen-gestion*

Sitemap: ${(siteBaseUrlInput.trim() || siteBaseUrl).replace(/\/+$/, '')}/sitemap.xml`}</pre>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      `${(siteBaseUrlInput.trim() || siteBaseUrl).replace(/\/+$/, '')}/robots.txt`,
                      'robots_url'
                    )
                  }
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">
                    {copiedKey === 'robots_url' ? 'done' : 'content_copy'}
                  </span>
                  <span>{copiedKey === 'robots_url' ? 'Lien Copié !' : 'Copier l\'adresse de robots.txt'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 5. GUIDE PAS À PAS : GOOGLE SEARCH CONSOLE */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white shadow-sm border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400">help_center</span>
              <h3 className="font-syne text-sm font-bold text-white">
                Guide Rapide d'Indexation sur Google Search Console
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
                <span className="font-extrabold text-amber-400 font-mono text-sm">1. Propriété</span>
                <p className="text-slate-300 text-[11px]">
                  Rendez-vous sur <strong>search.google.com</strong> et ajoutez votre préfixe d'URL (ex: <code>{(siteBaseUrlInput.trim() || siteBaseUrl).replace(/\/+$/, '')}</code>).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
                <span className="font-extrabold text-cyan-400 font-mono text-sm">2. Validation</span>
                <p className="text-slate-300 text-[11px]">
                  Validez par enregistrement DNS TXT chez votre registrar ou par balise HTML meta dans <code>index.html</code>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
                <span className="font-extrabold text-emerald-400 font-mono text-sm">3. Sitemap XML</span>
                <p className="text-slate-300 text-[11px]">
                  Dans le menu "Sitemaps", saisissez simplement <code>sitemap.xml</code> et cliquez sur "Envoyer".
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
                <span className="font-extrabold text-purple-400 font-mono text-sm">4. Inspection</span>
                <p className="text-slate-300 text-[11px]">
                  Utilisez l'outil "Inspection de l'URL" pour demander une indexation prioritaire de votre page d'accueil.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: JOURNAL D'AUDIT & RELANCE PUBLIQUE
          ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-syne text-base sm:text-lg font-bold text-slate-900">
                Journal d'Audit &amp; Traçabilité
              </h2>
              <p className="text-xs text-slate-500">
                Historique des modifications. Possibilité d'annuler ou de relancer pour publication immédiate.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isPrincipal && onClearAuditLogs && auditLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Confirmez-vous la suppression intégrale de tout le journal d'audit ?\n\nToutes les traces d'actions seront définitivement effacées.")) {
                      onClearAuditLogs();
                    }
                  }}
                  className="py-1.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">delete_sweep</span>
                  <span>Vider le Journal d'Audit</span>
                </button>
              )}
              {isPrincipal && (
                <button
                  type="button"
                  onClick={() => {
                    const unReverted = auditLogs.filter((l) => !l.isReverted);
                    if (unReverted.length === 0) {
                      alert('Aucune action récente à annuler.');
                      return;
                    }
                    const last = unReverted[unReverted.length - 1];
                    setConfirmModal({
                      isOpen: true,
                      title: 'Annuler la dernière action ?',
                      message: `Voulez-vous annuler "${last.description}" ?`,
                      onConfirm: () => {
                        onRevertAuditAction(last.id);
                        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                      }
                    });
                  }}
                  className="py-1.5 px-3 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">undo</span>
                  <span>Annuler Dernière Action</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white space-y-1">
                <span className="material-symbols-outlined text-3xl text-slate-300">history</span>
                <p className="text-xs font-bold text-slate-600">Le journal d'audit est actuellement vide.</p>
                <span className="text-[11px] text-slate-400">Aucune action n'est enregistrée.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {auditLogs.slice().reverse().map((log) => (
                  <div key={log.id} className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">{log.description}</span>
                        {log.isReverted ? (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                            Annulé
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                            Actif
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Auteur : <span className="font-semibold text-slate-700">{log.author}</span> • Date : {log.date}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {log.isReverted && onRelaunchAuditAction && isPrincipal && (
                        <button
                          type="button"
                          onClick={() => onRelaunchAuditAction(log.id)}
                          className="px-2.5 py-1 rounded bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">publish</span>
                          <span>Relancer pour le Public</span>
                        </button>
                      )}

                      {isPrincipal && onDeleteAuditLog && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Supprimer cette entrée du journal d'audit ?\n\n"${log.description}"`)) {
                              onDeleteAuditLog(log.id);
                            }
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                          title="Supprimer cette ligne d'audit"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: PRÉVISUALISATION DU PRODUIT
          ========================================================================= */}
      {previewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-4 space-y-3 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-syne text-xs font-bold text-slate-900 uppercase">Aperçu Fiche Produit</span>
              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="w-6 h-6 rounded bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center p-2">
              <ProductImage
                product={previewProduct}
                alt={formatProductTitle(previewProduct.name)}
                className="w-full h-full object-contain"
                fallbackSubLabel="Photo réelle à importer par l'admin"
              />
            </div>

            <div>
              <div className="text-[10px] text-[#b48c1e] font-extrabold uppercase">{previewProduct.categoryLabel}</div>
              <h4 className="font-bold text-slate-900 text-sm">{previewProduct.name}</h4>
              <div className="font-extrabold text-[#b48c1e] text-base mt-1">
                {previewProduct.price.toLocaleString('fr-FR')} FCFA
              </div>
              <p className="text-xs text-slate-600 mt-1">{previewProduct.description}</p>
            </div>

            <button
              type="button"
              onClick={() => setPreviewProduct(null)}
              className="w-full py-2 rounded-xl bg-slate-800 text-white font-bold text-xs cursor-pointer"
            >
              Fermer l'Aperçu
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: MODIFIER MOT DE PASSE ADMIN SECONDAIRE
          ========================================================================= */}
      {editingSecondaryAdminPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-4 space-y-3 border border-slate-200">
            <h3 className="font-syne text-sm font-bold text-slate-900">
              Modifier le mot de passe de {editingSecondaryAdminPass.user.name}
            </h3>
            <form onSubmit={handleSaveSecondaryAdminPassword} className="space-y-3">
              <input
                type="text"
                required
                minLength={8}
                maxLength={128}
                placeholder="Nouveau mot de passe (8 car. min.)"
                value={editingSecondaryAdminPass.newPass}
                onChange={(e) =>
                  setEditingSecondaryAdminPass({
                    ...editingSecondaryAdminPass,
                    newPass: e.target.value
                  })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-900"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSecondaryAdminPass(null)}
                  className="flex-1 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded-lg btn-gold-prestige text-white font-bold text-xs cursor-pointer shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CONFIRMATION GÉNÉRIQUE
          ========================================================================= */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-4 space-y-3 border border-slate-200">
            <h3 className="font-syne text-sm font-bold text-slate-900">{confirmModal.title}</h3>
            <p className="text-xs text-slate-600">{confirmModal.message}</p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="flex-1 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer shadow-sm"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GESTION & SUPPRESSION DES GROUPES / FAMILLES */}
      {isAddGroupModalOpen && hasPerm('manage_products') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-5 space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-xl">category</span>
                <h3 className="font-syne text-sm font-bold text-slate-900">
                  Gestion des Groupes &amp; Familles de Composants
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddGroupModalOpen(false)}
                className="w-7 h-7 rounded bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Gérez l'ensemble des familles de produits. Vous pouvez supprimer n'importe quel groupe existant (y compris ceux d'origine) ou en créer de nouveaux.
            </p>

            {/* Sélecteur de rayon */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Sélectionner le Rayon / Domaine :
              </label>
              <select
                value={newGroupDomain}
                onChange={(e) => setNewGroupDomain(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold outline-none"
              >
                <option value="electronique">⚡ Boutique Électronique</option>
                <option value="electrotechnique">🏭 Boutique Électrotechnique</option>
                <option value="informatique">💻 Boutique Informatique</option>
              </select>
            </div>

            {/* Liste des groupes existants dans ce rayon avec bouton supprimer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Groupes existants dans ce rayon ({(domainGroups[newGroupDomain] || []).length})</span>
                <span className="text-[10px] text-slate-400">Suppression immédiate</span>
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                {(domainGroups[newGroupDomain] || []).length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 italic">
                    Aucun groupe enregistré pour ce rayon.
                  </div>
                ) : (
                  (domainGroups[newGroupDomain] || []).map((grp) => (
                    <div
                      key={grp.id}
                      className="p-2.5 px-3 flex items-center justify-between gap-2 hover:bg-white transition-colors text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{grp.label}</span>
                        <span className="text-[10px] font-mono text-slate-400 ml-2">({grp.id})</span>
                      </div>

                      {hasPerm('delete_products') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Confirmez-vous la suppression du groupe "${grp.label}" ?\n\nCe groupe ne sera plus proposé dans les filtres de la boutique.`)) {
                              if (onDeleteGroup) {
                                onDeleteGroup(newGroupDomain, grp.id);
                              }
                              onAddAuditLog({
                                author: currentAdminName,
                                date: new Date().toLocaleString('fr-FR'),
                                actionType: 'delete_custom_group',
                                description: `Suppression du groupe "${grp.label}" au rayon ${newGroupDomain}`,
                                entityType: 'product'
                              });
                            }
                          }}
                          className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] cursor-pointer flex items-center gap-1 transition-colors"
                          title="Supprimer ce groupe"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Formulaire d'ajout de nouveau groupe */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newGroupLabel.trim()) return;
                const cleanLabel = newGroupLabel.trim();
                const cleanId = cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
                if (onAddGroup) {
                  onAddGroup(newGroupDomain, { id: cleanId, label: cleanLabel, domain: newGroupDomain });
                } else if (onAddCustomGroup) {
                  onAddCustomGroup(newGroupDomain, { id: cleanId, label: cleanLabel });
                }
                onAddAuditLog({
                  author: currentAdminName,
                  date: new Date().toLocaleString('fr-FR'),
                  actionType: 'create_custom_group',
                  description: `Création du groupe "${cleanLabel}" au rayon ${newGroupDomain}`,
                  entityType: 'product'
                });
                alert(`Groupe / Famille "${cleanLabel}" créé avec succès pour le rayon ${newGroupDomain} !`);
                setNewGroupLabel('');
              }}
              className="space-y-3 text-xs pt-2 border-t border-slate-100"
            >
              <h4 className="font-bold text-slate-900 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-amber-600">add_circle</span>
                <span>Ajouter un nouveau groupe dans ce rayon</span>
              </h4>

              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newGroupLabel}
                  onChange={(e) => setNewGroupLabel(e.target.value)}
                  placeholder="Ex: Automates &amp; PLC Siemens, Modules LoRa..."
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-amber-500 font-medium"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-gold-prestige font-bold text-white text-xs cursor-pointer shadow-xs shrink-0 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Ajouter</span>
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddGroupModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: REMISE À ZÉRO TOTALE AVEC SÉCURITÉ RENFORCÉE */}
      {isTotalResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-white border-2 border-red-500 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-4 bg-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber-300 text-2xl">warning</span>
                </div>
                <div>
                  <h3 className="font-syne font-black text-sm uppercase tracking-wide">
                    Remise à Zéro Totale — Zone de Haute Sécurité
                  </h3>
                  <span className="text-[10px] text-red-100 font-medium">
                    Réservé au Super-Administrateur Principal (Franck Kaboré)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTotalResetModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto no-scrollbar space-y-4 text-xs text-slate-700">
              {resetSuccessMessage ? (
                <div className="p-6 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                  </div>
                  <h4 className="font-syne text-base font-bold text-slate-900">
                    Remise à Zéro Totale Terminée !
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Toutes les données métier ont été purgées avec succès. Une sauvegarde préalable a été enregistrée sur le serveur. Vos identifiants de Super-Administrateur sont strictement conservés.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTotalResetModalOpen(false);
                      setResetSuccessMessage(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase cursor-pointer"
                  >
                    Fermer la Fenêtre
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setResetError(null);

                    if (!resetConfirmedCheckbox) {
                      setResetError('Veuillez cocher la case d’attestation confirmant la suppression irréversible.');
                      return;
                    }

                    setResetLoading(true);

                    try {
                      const res = await fetch('/api/admin/total-reset', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                      });
                      const data = await res.json();

                      if (!res.ok || !data.success) {
                        setResetError(data.error || 'Code maître invalide ou opération refusée.');
                        setResetLoading(false);
                        return;
                      }

                      if (onTotalReset) {
                        await onTotalReset();
                      }

                      setResetSuccessMessage('Toutes les données métier de l’application ont été effacées.');
                    } catch (err: any) {
                      setResetError(err.message || 'Erreur lors de la communication avec le serveur.');
                    } finally {
                      setResetLoading(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-950 space-y-1">
                    <span className="font-bold flex items-center gap-1.5 text-xs text-red-900">
                      <span className="material-symbols-outlined text-sm">lock_reset</span>
                      <span>Action Destructive &amp; Irréversible</span>
                    </span>
                    <p className="text-[11px] leading-relaxed text-red-900">
                      Cette commande supprime <strong>l’ensemble des données sans exception</strong> : tous les comptes clients, tous les comptes investisseurs, toutes les opérations créées, toutes les souscriptions, dépôts, retraits, activités, documents, messages et le journal d’audit.
                    </p>
                    <p className="text-[11px] font-bold text-emerald-800 pt-1">
                      ✓ Protection garantie : Vos identifiants de Super-Administrateur (Franck Kaboré) ainsi que le code du serveur restent préservés.
                    </p>
                  </div>

                  {resetError && (
                    <div className="p-3 bg-red-100 border border-red-400 rounded-xl text-red-900 text-xs font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm shrink-0">error</span>
                      <span>{resetError}</span>
                    </div>
                  )}

                  {/* 1. Bouton Télécharger la Sauvegarde préalable */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">
                        1. Sauvegarde Préalable Recommandée
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Téléchargez une copie JSON complète avant d'effectuer la remise à zéro.
                      </span>
                    </div>
                    <a
                      href="/api/admin/backup"
                      download="backup-electromen-securite.json"
                      className="px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0 transition-colors shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      <span>Télécharger JSON</span>
                    </a>
                  </div>

                  <p className="text-[11px] text-slate-600">
                    Cette action est autorisée par votre session administrateur active.
                  </p>

                  {/* Case d'attestation explicite */}
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none text-[11px] text-slate-800 leading-tight">
                      <input
                        type="checkbox"
                        checked={resetConfirmedCheckbox}
                        onChange={(e) => setResetConfirmedCheckbox(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-red-600 focus:ring-red-500 border-slate-300"
                      />
                      <span className="font-semibold">
                        Je confirme vouloir exécuter la remise à zéro totale et je reconnais que toutes les données métier de l'application seront définitivement supprimées.
                      </span>
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsTotalResetModalOpen(false)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider cursor-pointer shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">restart_alt</span>
                      <span>{resetLoading ? 'Purge en cours...' : 'Exécuter la Remise à Zéro'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Exportation Produits pour Client */}
      <ExportProductsModal
        isOpen={isExportProductsOpen}
        onClose={() => setIsExportProductsOpen(false)}
        shopTitle="Catalogue Général Produits"
        domain="all"
        products={products}
        currentFilteredProducts={filteredCatalogProducts}
      />

      {/* Modal Importation CSV Produits */}
      {onImportProducts && (
        <ImportProductsCsvModal
          isOpen={isImportCsvOpen}
          onClose={() => setIsImportCsvOpen(false)}
          existingProducts={products}
          domainGroups={domainGroups}
          onConfirmImport={async (items, options) => {
            const result = await onImportProducts(items, options);
            setCsvImportFeedback(
              `Import CSV réussi (${options.filename}) : ${result.createdCount} créé(s), ${result.updatedCount} mis à jour dans PostgreSQL.`
            );
            onAddAuditLog({
              author: currentAdminName,
              date: new Date().toLocaleDateString('fr-FR'),
              actionType: 'import_products_csv',
              description: `Import CSV (${options.filename}) : ${result.createdCount} créé(s), ${result.updatedCount} mis à jour`,
              entityType: 'product'
            });
            return result;
          }}
        />
      )}
    </div>
  );
};
