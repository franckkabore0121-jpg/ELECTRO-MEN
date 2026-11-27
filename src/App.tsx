import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header.tsx';
import { Navigation, TabType } from './components/Navigation.tsx';
import { ScreenAccueil } from './components/ScreenAccueil.tsx';
import { ScreenBoutiqueElectronique } from './components/ScreenBoutiqueElectronique.tsx';
import { ScreenBoutiqueElectrotechnique } from './components/ScreenBoutiqueElectrotechnique.tsx';
import { ScreenBoutiqueInformatique } from './components/ScreenBoutiqueInformatique.tsx';
import { ScreenSolutions } from './components/ScreenSolutions.tsx';
import {
  ScreenBourseIR,
  RegisteredInvestor,
  InvestorMessage,
  BoutiqueSector,
  ShareAllocation
} from './components/ScreenBourseIR.tsx';
import { ScreenProfil } from './components/ScreenProfil.tsx';
import { AdminPage, AdminRole, AuditAction } from './components/AdminPage.tsx';
import { AdminPermission, resolveAdminPermissions } from './data/adminPermissions.ts';
import { CreateAccountModal } from './components/CreateAccountModal.tsx';
import { NotificationCenterModal } from './components/NotificationCenterModal.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import { SearchModal } from './components/SearchModal.tsx';
import { VideoPlayerModal } from './components/VideoPlayerModal.tsx';
import { DatasheetModal } from './components/DatasheetModal.tsx';
import { CertificateModal } from './components/CertificateModal.tsx';
import { ContractModal } from './components/ContractModal.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';
import { WalletModal } from './components/WalletModal.tsx';
import { SharePaymentModal } from './components/SharePaymentModal.tsx';
import { EmailViewerModal } from './components/EmailViewerModal.tsx';
import { BoutiquesDirectory } from './components/BoutiquesDirectory.tsx';
import { CustomOrderRecord } from './components/CustomOrderModal.tsx';
import {
  PROJECTS,
  MARKETPLACE_BOUTIQUES,
  MarketplaceBoutique,
  CartItem,
  Product,
  Course,
  CourseModule,
  InvestmentProject,
  ShareSubscription,
  WalletTransaction,
  InvestorWallet,
  EmailNotification,
  InvestorProfile,
  AppNotification,
  FundOperationRequest,
  INITIAL_FUND_REQUESTS,
  ProfitDistribution,
  INITIAL_PROFIT_DISTRIBUTIONS,
  CategoryGroup,
  InvestorActivity,
  InvestorDocument,
  INITIAL_INVESTOR_ACTIVITIES,
  INITIAL_INVESTOR_DOCUMENTS,
  ELECTRONIQUE_GROUPS,
  ELECTROTECHNIQUE_GROUPS,
  INFORMATIQUE_GROUPS
} from './data/mockData.ts';
import {
  NO_CACHE_FETCH_INIT,
  normalizeClientProduct,
  withNoCacheParam
} from './utils/productFormat.ts';
import {
  invalidateCatalogCache,
  isCatalogCacheFresh,
  loadCartItems,
  loadOfflineActivities,
  loadOfflineBoutiques,
  loadOfflineConfig,
  loadOfflineCourses,
  loadOfflineDocuments,
  loadOfflineGroups,
  loadOfflineProducts,
  loadOfflineProjects,
  markCatalogCacheUpdated,
  saveCartItems,
  saveOfflineActivities,
  saveOfflineBoutiques,
  saveOfflineConfig,
  saveOfflineCourses,
  saveOfflineDocuments,
  saveOfflineGroups,
  saveOfflineProducts,
  saveOfflineProjects
} from './utils/offlineCache.ts';
import {
  canTriggerWithCooldown,
  fetchJsonDeduplicated
} from './utils/requestGuard.ts';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';

const DEFAULT_PROFILE: InvestorProfile = {
  id: '#EM-INV-4541',
  name: 'Franck Kaboré',
  email: 'franckkabore454@gmail.com',
  phone: '+226 65 48 47 38',
  city: 'Ouagadougou',
  isVerified: true,
  registeredDate: '21 Octobre 2026'
};

const VALID_PUBLIC_TABS: ReadonlySet<TabType> = new Set<TabType>([
  'accueil',
  'boutiques',
  'boutique_electronique',
  'boutique_electrotechnique',
  'boutique_informatique',
  'solutions',
  'bourse',
  'profil',
  'composants'
]);

export default function App() {
  // Flagship Accueil is the default landing tab (or ?tab= deep link)
  const [currentTab, setCurrentTab] = useState<TabType>(() => {
    try {
      const tabParam = new URLSearchParams(window.location.search).get('tab') as TabType | null;
      if (tabParam && VALID_PUBLIC_TABS.has(tabParam)) {
        return tabParam;
      }
    } catch {
      // ignore
    }
    return 'accueil';
  });
  const [currentAdminRole, setCurrentAdminRole] = useState<AdminRole | null>(null);
  const [currentAdminName, setCurrentAdminName] = useState<string>('');
  const [currentAdminPermissions, setCurrentAdminPermissions] = useState<AdminPermission[]>([]);

  const hasAdminPermission = (permission: AdminPermission): boolean => {
    if (!currentAdminRole) return false;
    if (currentAdminRole === 'admin_principal') return true;
    return currentAdminPermissions.includes(permission);
  };

  // Personal profile with local persistence: null by default for unauthenticated users
  const [currentProfile, setCurrentProfile] = useState<InvestorProfile | null>(() => {
    try {
      const saved = localStorage.getItem('electromen_current_profile');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return null;
  });

  useEffect(() => {
    try {
      if (currentProfile) {
        localStorage.setItem('electromen_current_profile', JSON.stringify(currentProfile));
      } else {
        localStorage.removeItem('electromen_current_profile');
      }
    } catch {
      // ignore
    }
  }, [currentProfile]);

  // Catalog Products state loaded from 10-min local cache first, then PostgreSQL Neon with degraded fallback
  const [products, setProducts] = useState<Product[]>(() => loadOfflineProducts());
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    return !isCatalogCacheFresh();
  });
  const [productsLoadError, setProductsLoadError] = useState<string | null>(null);
  const [isUsingOfflineData, setIsUsingOfflineData] = useState<boolean>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? loadOfflineProducts().length > 0 : false
  );

  const applyServerGroups = useCallback(
    (
      rawGroups:
        | Partial<Record<'electronique' | 'electrotechnique' | 'informatique', CategoryGroup[]>>
        | null
        | undefined,
      persistOffline = true
    ) => {
      if (!rawGroups || typeof rawGroups !== 'object' || Array.isArray(rawGroups)) return;
      const nextGroups = {
        electronique: Array.isArray(rawGroups.electronique) && rawGroups.electronique.length > 0
          ? rawGroups.electronique
          : ELECTRONIQUE_GROUPS,
        electrotechnique: Array.isArray(rawGroups.electrotechnique) && rawGroups.electrotechnique.length > 0
          ? rawGroups.electrotechnique
          : ELECTROTECHNIQUE_GROUPS,
        informatique: Array.isArray(rawGroups.informatique) && rawGroups.informatique.length > 0
          ? rawGroups.informatique
          : INFORMATIQUE_GROUPS
      };
      setDomainGroups(nextGroups);
      if (persistOffline) {
        saveOfflineGroups(nextGroups);
      }
    },
    []
  );

  const hydrateFromOfflineCache = useCallback((): boolean => {
    const cachedGroups = loadOfflineGroups();
    if (cachedGroups) {
      applyServerGroups(cachedGroups, false);
    }
    const cachedBoutiques = loadOfflineBoutiques();
    if (cachedBoutiques.length > 0) {
      setMarketplaceBoutiques(cachedBoutiques);
    }
    const cachedCourses = loadOfflineCourses();
    if (cachedCourses) setCourses(cachedCourses);
    const cachedProjects = loadOfflineProjects();
    if (cachedProjects && cachedProjects.length > 0) setProjects(cachedProjects);
    const cachedActivities = loadOfflineActivities();
    if (cachedActivities) setInvestorActivities(cachedActivities);
    const cachedDocuments = loadOfflineDocuments();
    if (cachedDocuments) setInvestorDocuments(cachedDocuments);
    const cachedConfig = loadOfflineConfig();
    if (cachedConfig) {
      if (cachedConfig.heroVideoUrl) setHeroVideoUrl(cachedConfig.heroVideoUrl);
      if (cachedConfig.formationsVideoUrl) setFormationsVideoUrl(cachedConfig.formationsVideoUrl);
      if (cachedConfig.customAdminUrl) setAdminCustomUrl(cachedConfig.customAdminUrl);
      if (typeof cachedConfig.isMaintenanceMode === 'boolean') setIsMaintenanceMode(cachedConfig.isMaintenanceMode);
      if (typeof cachedConfig.isInvestorChatOpen === 'boolean') setIsInvestorChatOpen(cachedConfig.isInvestorChatOpen);
    }

    const cachedProducts = loadOfflineProducts();
    if (cachedProducts.length > 0) {
      setProducts(cachedProducts);
      setProductsLoadError(null);
      setIsUsingOfflineData(true);
      return true;
    }
    setIsUsingOfflineData(true);
    return false;
  }, [applyServerGroups]);

  const catalogMountedRef = useRef<boolean>(true);
  useEffect(() => {
    catalogMountedRef.current = true;
    return () => {
      catalogMountedRef.current = false;
    };
  }, []);

  const applyBootstrapConfig = useCallback(
    (configData: {
      heroVideoUrl?: string;
      formationsVideoUrl?: string;
      customAdminUrl?: string;
      isMaintenanceMode?: boolean;
      isInvestorChatOpen?: boolean;
      boutiques?: MarketplaceBoutique[];
      needsAdminSetup?: boolean;
    }) => {
      if (
        configData.heroVideoUrl &&
        !configData.heroVideoUrl.includes('BigBuckBunny') &&
        !configData.heroVideoUrl.includes('commondatastorage')
      ) {
        setHeroVideoUrl(configData.heroVideoUrl);
      }
      if (
        configData.formationsVideoUrl &&
        !configData.formationsVideoUrl.includes('BigBuckBunny') &&
        !configData.formationsVideoUrl.includes('commondatastorage')
      ) {
        setFormationsVideoUrl(configData.formationsVideoUrl);
      }
      if (configData.customAdminUrl) setAdminCustomUrl(configData.customAdminUrl);
      if (typeof configData.isMaintenanceMode === 'boolean') {
        setIsMaintenanceMode(configData.isMaintenanceMode);
      }
      if (typeof configData.isInvestorChatOpen === 'boolean') {
        setIsInvestorChatOpen(configData.isInvestorChatOpen);
      }
      if (Array.isArray(configData.boutiques) && configData.boutiques.length > 0) {
        const normalizedBoutiques = configData.boutiques.map((b) => ({
          ...b,
          name: String(b.name || '').replace(/^ELECTRO-MEN\s*/i, '').trim()
        }));
        setMarketplaceBoutiques(normalizedBoutiques);
        saveOfflineBoutiques(normalizedBoutiques);
      }
      saveOfflineConfig({
        heroVideoUrl: configData.heroVideoUrl,
        formationsVideoUrl: configData.formationsVideoUrl,
        customAdminUrl: configData.customAdminUrl,
        isMaintenanceMode: configData.isMaintenanceMode,
        isInvestorChatOpen: configData.isInvestorChatOpen
      });
      if (typeof configData.needsAdminSetup === 'boolean') {
        setNeedsAdminSetup(configData.needsAdminSetup);
      }
    },
    []
  );

  const fetchProductsNow = useCallback(
    async (showSpinner = false, forceRefresh = false): Promise<void> => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const hasCached = hydrateFromOfflineCache();
        setIsLoadingProducts(false);
        if (!hasCached) {
          setProductsLoadError(
            'Mode hors ligne : aucun catalogue local enregistré pour le moment.'
          );
        }
        return;
      }

      if (!forceRefresh && isCatalogCacheFresh()) {
        const cached = loadOfflineProducts();
        if (cached.length > 0) {
          setProducts(cached);
          const cachedGroups = loadOfflineGroups();
          if (cachedGroups) applyServerGroups(cachedGroups, false);
          const cachedBoutiques = loadOfflineBoutiques();
          if (cachedBoutiques.length > 0) setMarketplaceBoutiques(cachedBoutiques);
          setProductsLoadError(null);
          setIsUsingOfflineData(false);
          setIsLoadingProducts(false);
          return;
        }
      }

      if (showSpinner) setIsLoadingProducts(true);
      setProductsLoadError(null);

      try {
        const data = await fetchJsonDeduplicated<{
          products?: Product[];
          groups?: Partial<Record<'electronique' | 'electrotechnique' | 'informatique', CategoryGroup[]>>;
          operations?: InvestmentProject[];
          courses?: Course[];
          activities?: InvestorActivity[];
          documents?: InvestorDocument[];
          config?: {
            heroVideoUrl?: string;
            formationsVideoUrl?: string;
            customAdminUrl?: string;
            isMaintenanceMode?: boolean;
            isInvestorChatOpen?: boolean;
            boutiques?: MarketplaceBoutique[];
            needsAdminSetup?: boolean;
          };
        }>(
          'catalog-bootstrap',
          withNoCacheParam('/api/catalog-bootstrap'),
          {
            ...NO_CACHE_FETCH_INIT,
            timeoutMs: 7500
          }
        );

        if (!catalogMountedRef.current) return;

        if (data && Array.isArray(data.products)) {
          const normalizedList = data.products.map(normalizeClientProduct);
          setProducts(normalizedList);
          saveOfflineProducts(normalizedList);
          setProductsLoadError(null);
          setIsUsingOfflineData(false);
          applyServerGroups(data.groups);

          if (Array.isArray(data.operations)) {
            setProjects(data.operations);
            saveOfflineProjects(data.operations);
          }
          if (Array.isArray(data.courses)) {
            setCourses(data.courses);
            saveOfflineCourses(data.courses);
          }
          if (Array.isArray(data.activities)) {
            setInvestorActivities(data.activities);
            saveOfflineActivities(data.activities);
          }
          if (Array.isArray(data.documents)) {
            setInvestorDocuments(data.documents);
            saveOfflineDocuments(data.documents);
          }
          if (data.config) {
            applyBootstrapConfig(data.config);
          }
          markCatalogCacheUpdated();

          const byId = new Map(normalizedList.map((item) => [item.id, item]));
          setSelectedProduct((prev) => (prev ? byId.get(prev.id) || prev : null));
          setCartItems((prev) =>
            prev.map((entry) => {
              const latest = byId.get(entry.product.id);
              return latest ? { ...entry, product: latest } : entry;
            })
          );
        }
      } catch (error) {
        if (!catalogMountedRef.current) return;
        console.warn('Unable to load live catalog from PostgreSQL — using cached snapshot:', error);
        const restored = hydrateFromOfflineCache();
        if (!restored) {
          setProductsLoadError(
            'Connexion au serveur catalogue interrompue. Mode secours local activé.'
          );
        }
      } finally {
        if (catalogMountedRef.current) {
          setIsLoadingProducts(false);
        }
      }
    },
    [applyBootstrapConfig, applyServerGroups, hydrateFromOfflineCache]
  );

  const handleManualCatalogRefresh = useCallback(() => {
    if (!canTriggerWithCooldown('manual-catalog-refresh', 3000)) {
      return;
    }
    invalidateCatalogCache();
    void fetchProductsNow(true, true);
  }, [fetchProductsNow]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      hydrateFromOfflineCache();
      setIsLoadingProducts(false);
      return;
    }
    void fetchProductsNow(!isCatalogCacheFresh(), false);
  }, [fetchProductsNow, hydrateFromOfflineCache]);

  // Courses state with Admin mutability + offline snapshot persistence
  const [courses, setCourses] = useState<Course[]>(() => {
    const cached = loadOfflineCourses();
    if (cached) return cached;
    try {
      const saved = localStorage.getItem('electromen_courses');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return [];
  });

  useEffect(() => {
    saveOfflineCourses(courses);
    try {
      localStorage.setItem('electromen_courses', JSON.stringify(courses));
    } catch {
      // ignore
    }
  }, [courses]);

  // Investment Projects state with Admin mutability
  const [projects, setProjects] = useState<InvestmentProject[]>(() => {
    const cached = loadOfflineProjects();
    if (cached && cached.length > 0) return cached;
    try {
      const saved = localStorage.getItem('electromen_projects');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return PROJECTS;
  });

  useEffect(() => {
    saveOfflineProjects(projects);
    try {
      localStorage.setItem('electromen_projects', JSON.stringify(projects));
    } catch {
      // ignore
    }
  }, [projects]);

  // Marketplace Boutiques state synced from PostgreSQL config with offline cache fallback
  const [marketplaceBoutiques, setMarketplaceBoutiques] = useState<MarketplaceBoutique[]>(() => {
    const cached = loadOfflineBoutiques();
    if (cached.length > 0) return cached;
    return MARKETPLACE_BOUTIQUES;
  });

  const handleUpdateBoutiqueFlag = (boutiqueId: string, newFlag: string, countryName?: string) => {
    setMarketplaceBoutiques((prev) => {
      const next = prev.map((b) =>
        b.id === boutiqueId
          ? { ...b, flag: newFlag, country: countryName || b.country }
          : b
      );
      saveOfflineBoutiques(next);
      markCatalogCacheUpdated();
      void fetch(withNoCacheParam('/api/admin/boutiques'), {
        method: 'PUT',
        ...NO_CACHE_FETCH_INIT,
        headers: {
          ...NO_CACHE_FETCH_INIT.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ boutiques: next })
      }).catch((err) => {
        console.error('Unable to persist boutique configuration to PostgreSQL:', err);
      });
      return next;
    });
  };

  const handleUpdateBoutiqueLogo = (boutiqueId: string, logoUrl: string) => {
    setMarketplaceBoutiques((prev) => {
      const next = prev.map((b) =>
        b.id === boutiqueId ? { ...b, logoUrl } : b
      );
      saveOfflineBoutiques(next);
      markCatalogCacheUpdated();
      void fetch(withNoCacheParam('/api/admin/boutiques'), {
        method: 'PUT',
        ...NO_CACHE_FETCH_INIT,
        headers: {
          ...NO_CACHE_FETCH_INIT.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ boutiques: next })
      })
        .then((res) => res.json().catch(() => null))
        .then((data) => {
          if (data?.success && Array.isArray(data.boutiques)) {
            setMarketplaceBoutiques(data.boutiques);
            saveOfflineBoutiques(data.boutiques);
            markCatalogCacheUpdated();
          }
        })
        .catch((err) => {
          console.error('Unable to persist boutique logo to PostgreSQL:', err);
        });
      return next;
    });
  };

  // Wallets isolated per investor email
  const [walletsByEmail, setWalletsByEmail] = useState<Record<string, InvestorWallet>>(() => {
    try {
      const saved = localStorage.getItem('electromen_wallets_by_email');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_wallets_by_email', JSON.stringify(walletsByEmail));
    } catch {
      // ignore
    }
  }, [walletsByEmail]);

  const currentEmailKey = currentProfile ? currentProfile.email.toLowerCase().trim() : '';
  const currentWallet = (currentEmailKey && walletsByEmail[currentEmailKey]) || {
    balance: 0,
    sharesCount: 0,
    dividendsEarned: 0
  };

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<ShareSubscription[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_subscriptions');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_subscriptions', JSON.stringify(subscriptions));
    } catch {
      // ignore
    }
  }, [subscriptions]);

  // Wallet transactions history
  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_transactions');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_transactions', JSON.stringify(transactions));
    } catch {
      // ignore
    }
  }, [transactions]);

  // Fund Operation Requests (Deposits & Withdrawals)
  const [fundRequests, setFundRequests] = useState<FundOperationRequest[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_fund_requests');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_FUND_REQUESTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_fund_requests', JSON.stringify(fundRequests));
    } catch {
      // ignore
    }
  }, [fundRequests]);

  // Profit Distributions state (Direct distribution to Investors & Company)
  const [profitDistributions, setProfitDistributions] = useState<ProfitDistribution[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_profit_distributions');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_PROFIT_DISTRIBUTIONS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_profit_distributions', JSON.stringify(profitDistributions));
    } catch {
      // ignore
    }
  }, [profitDistributions]);

  // Simulated email notifications per investor
  const [emails, setEmails] = useState<EmailNotification[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_emails');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_emails', JSON.stringify(emails));
    } catch {
      // ignore
    }
  }, [emails]);

  // Emails strictly filtered for the active personal investor
  const personalEmails = emails.filter(
    (e) => e.recipientEmail.toLowerCase().trim() === currentEmailKey
  );

  // Admin custom URL with persistent storage
  const [adminCustomUrl, setAdminCustomUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('electromen_admin_url') || '/electromen-gestion';
    } catch {
      return '/electromen-gestion';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_admin_url', adminCustomUrl);
    } catch {
      // ignore
    }
  }, [adminCustomUrl]);

  // Site Official Base URL with persistent storage for SEO, Canonical & Sitemaps
  const [siteBaseUrl, setSiteBaseUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('electromen_base_url') || 'https://electromen.bf';
    } catch {
      return 'https://electromen.bf';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_base_url', siteBaseUrl);
    } catch {
      // ignore
    }
  }, [siteBaseUrl]);

  // Formations promotional video
  const [formationsVideoUrl, setFormationsVideoUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('electromen_formations_video');
      if (saved && !saved.includes('BigBuckBunny') && !saved.includes('commondatastorage') && !saved.includes('mixkit.co')) {
        return saved;
      }
      return '/assets/videos/electromen-hero.mp4';
    } catch {
      return '/assets/videos/electromen-hero.mp4';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_formations_video', formationsVideoUrl);
    } catch {
      // ignore
    }
  }, [formationsVideoUrl]);

  // Custom Written Orders state (Admin) & Investor Portfolio Snapshot
  const [customOrders, setCustomOrders] = useState<CustomOrderRecord[]>([]);
  const [investorPortfolio, setInvestorPortfolio] = useState<{
    totalInvested: number;
    sharesCount: number;
    dividendsEarned: number;
    shareAllocations: ShareAllocation[];
  } | null>(null);

  // App Notifications (WhatsApp-style)
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_app_notifications');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_app_notifications', JSON.stringify(appNotifications));
    } catch {
      // ignore
    }
  }, [appNotifications]);

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Investor Messaging state
  const [isInvestorChatOpen, setIsInvestorChatOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('electromen_investor_chat_open') !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_investor_chat_open', isInvestorChatOpen ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, [isInvestorChatOpen]);

  const [investorMessages, setInvestorMessages] = useState<InvestorMessage[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_investor_messages');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: 'msg-init-1',
        senderName: 'Franck Kaboré (Direction)',
        text: 'Bienvenue aux actionnaires partenaires ELECTRO-MEN. Les règles de gouvernance sont consultables ci-dessus.',
        timestamp: '22/10/2026 14:30',
        isOfficial: true
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_investor_messages', JSON.stringify(investorMessages));
    } catch {
      // ignore
    }
  }, [investorMessages]);

  const unreadNotificationsCount = appNotifications.filter((n) => !n.isRead).length;

  const handleAddNotification = (notif: Omit<AppNotification, 'id' | 'timestamp'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      isRead: false
    };
    setAppNotifications((prev) => [newNotif, ...prev]);
  };

  const handleMarkNotificationAsRead = (id: string) => {
    setAppNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllNotificationsAsRead = () => {
    setAppNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const normalizeServerMessage = (raw: any): InvestorMessage => ({
    id: String(raw?.id || `msg-${Date.now()}`),
    senderName: String(raw?.senderName || 'Participant'),
    senderPhone: typeof raw?.senderPhone === 'string' ? raw.senderPhone : undefined,
    senderRole: raw?.senderRole === 'admin' ? 'admin' : 'investor',
    text: String(raw?.text || ''),
    timestamp: String(raw?.timestamp || raw?.time || ''),
    isOfficial: typeof raw?.isOfficial === 'boolean' ? raw.isOfficial : raw?.senderRole === 'admin',
    replyToId: typeof raw?.replyToId === 'string' ? raw.replyToId : undefined
  });

  const normalizeServerDistribution = (raw: any): ProfitDistribution => ({
    id: String(raw?.id || `dist-${Date.now()}`),
    reference: String(raw?.reference || raw?.id || 'DIST').toUpperCase(),
    sector: (raw?.sector === 'Électrotechnique' || raw?.sector === 'Informatique' ? raw.sector : 'Électronique') as BoutiqueSector,
    operationId: typeof raw?.operationId === 'string' ? raw.operationId : undefined,
    operationTitle: typeof raw?.operationTitle === 'string' ? raw.operationTitle : undefined,
    projectName: typeof raw?.projectName === 'string' ? raw.projectName : undefined,
    period: String(raw?.period || 'Cycle en cours'),
    netProfit: Number(raw?.netProfit ?? raw?.totalProfit ?? 0),
    investorsShareTotal: Number(raw?.investorsShareTotal ?? raw?.investorsAmount ?? 0),
    companyShare: Number(raw?.companyShare ?? raw?.companyAmount ?? 0),
    eligibleCount: Number(raw?.eligibleCount ?? 0),
    individualAmount: Number(raw?.individualAmount ?? 0),
    notes: String(raw?.notes || ''),
    publishedAt: String(raw?.publishedAt || raw?.distributedAt || ''),
    status: raw?.status === 'Payé' ? 'Payé' : 'Publié',
    validatedBy: String(raw?.validatedBy || raw?.distributedBy || 'Direction Générale')
  });

  const handleSendInvestorMessage = async (
    text: string,
    _senderName: string,
    _isOfficial = false
  ) => {
    const response = await fetch('/api/messages', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        senderRole: 'investor'
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success || !data.message) {
      throw new Error(data.error || 'Envoi du message refusé par le serveur.');
    }
    const normalized = normalizeServerMessage(data.message);
    setInvestorMessages((prev) => [...prev.filter((m) => m.id !== normalized.id), normalized]);
  };

  const handleSendAdminMessage = async (text: string) => {
    const response = await fetch('/api/messages', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        senderRole: 'admin'
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success || !data.message) {
      throw new Error(data.error || 'Envoi du message administrateur refusé par le serveur.');
    }
    const normalized = normalizeServerMessage(data.message);
    setInvestorMessages((prev) => [...prev.filter((m) => m.id !== normalized.id), normalized]);
  };

  const handleUpdateCustomOrderStatus = async (
    id: string,
    status: CustomOrderRecord['status'],
    adminNote?: string
  ) => {
    const response = await fetch(`/api/admin/custom-orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...(adminNote !== undefined ? { adminNote } : {}) })
    });
    const data = await response.json();
    if (!response.ok || !data.success || !data.order) {
      alert(data.error || 'Mise à jour du statut impossible.');
      return;
    }
    setCustomOrders((prev) => prev.map((item) => (item.id === id ? data.order : item)));
  };

  const handleDeleteCustomOrder = async (id: string) => {
    const response = await fetch(`/api/admin/custom-orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      alert(data.error || 'Suppression impossible.');
      return;
    }
    setCustomOrders((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleInvestorChat = async () => {
    const nextState = !isInvestorChatOpen;
    try {
      const response = await fetch('/api/admin/messages/status', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isInvestorChatOpen: nextState })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        alert(data.error || 'Modification du statut de la messagerie refusée.');
        return;
      }
      setIsInvestorChatOpen(Boolean(data.isInvestorChatOpen));
    } catch {
      alert('Impossible de joindre le serveur pour modifier l’état de la messagerie.');
    }
  };

  // Deep Link handling: automatically open product if ?prod=<id> or ?product=<id> is in query string
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const prodId = params.get('prod') || params.get('product');
      if (prodId) {
        const found = products.find((p) => p.id === prodId);
        if (found) {
          setSelectedProduct(found);
        }
      }
    } catch {
      // ignore
    }
  }, [products]);

  // Sync custom URL & /electromenG from browser location on mount & route changes
  useEffect(() => {
    const normalizeRoutePath = (p: string) => (p.replace(/\/+$/, '') || '/').toLowerCase();
    const isSecretAdminLocation = () => {
      const currentPath = normalizeRoutePath(window.location.pathname);
      const currentHash = normalizeRoutePath(window.location.hash.replace(/^#/, ''));
      const normalizedCustom = normalizeRoutePath(adminCustomUrl || '/electromen-gestion');
      return (
        currentPath === normalizedCustom ||
        currentPath === '/electromeng' ||
        currentHash === normalizedCustom ||
        currentHash === '/electromeng'
      );
    };

    const checkPath = () => {
      if (isSecretAdminLocation()) {
        if (currentAdminRole) {
          setCurrentTab('admin');
          setIsAdminAuthModalOpen(false);
        } else {
          setIsAdminAuthModalOpen(true);
        }
      }
    };
    checkPath();
    window.addEventListener('popstate', checkPath);
    window.addEventListener('hashchange', checkPath);
    return () => {
      window.removeEventListener('popstate', checkPath);
      window.removeEventListener('hashchange', checkPath);
    };
  }, [adminCustomUrl, currentAdminRole]);

  useEffect(() => {
    let active = true;
    const normalizeRoutePath = (p: string) => (p.replace(/\/+$/, '') || '/').toLowerCase();
    fetch('/api/auth/verify', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache'
      },
      body: JSON.stringify({})
    })
      .then(async (response) => {
        const data = await response.json();
        if (!active) return;
        if (!response.ok || !data.valid || !data.user) {
          setCurrentAdminRole(null);
          setCurrentAdminName('');
          setCurrentAdminPermissions([]);
          return;
        }
        setCurrentAdminRole(data.user.role);
        setCurrentAdminName(data.user.name);
        setCurrentAdminPermissions(resolveAdminPermissions(data.user.role, data.user.permissions));
        const currentPath = normalizeRoutePath(window.location.pathname);
        const normalizedCustom = normalizeRoutePath(adminCustomUrl || '/electromen-gestion');
        const pathMatchesAdmin = currentPath === normalizedCustom || currentPath === '/electromeng';
        if (pathMatchesAdmin) {
          setCurrentTab('admin');
          setIsAdminAuthModalOpen(false);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [adminCustomUrl]);

  // Real-Time User Presence Heartbeat (Server Authoritative Tracking)
  useEffect(() => {
    let sessionId = '';
    try {
      sessionId = sessionStorage.getItem('electromen_session_id') || '';
      if (!sessionId) {
        sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        sessionStorage.setItem('electromen_session_id', sessionId);
      }
    } catch {
      sessionId = `sess-${Date.now()}`;
    }

    const sendHeartbeat = () => {
      const payload = {
        sessionId,
        userId: currentProfile?.id || (currentAdminRole ? 'adm-1' : undefined),
        userName: currentAdminRole ? `${currentAdminName || 'Franck Kaboré'} (Admin)` : (currentProfile?.name || 'Visiteur En Ligne'),
        userEmail: currentProfile?.email || (currentAdminRole ? 'franckkabore454@gmail.com' : undefined),
        userPhone: currentProfile?.phone,
        userRole: currentAdminRole ? 'admin' : (currentProfile ? 'investor' : 'visitor'),
        investorStatus: currentProfile ? (currentProfile as any).status : undefined,
        currentTab,
        pageTitle: document.title
      };

      fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    };

    // Immediate ping only when visible; slow 60s cadence to minimize serverless bandwidth
    if (document.visibilityState === 'visible') {
      sendHeartbeat();
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    }, 60000);

    const handleUnload = () => {
      try {
        const blob = new Blob([JSON.stringify({ sessionId })], { type: 'application/json' });
        navigator.sendBeacon('/api/presence/leave', blob);
      } catch {}
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [currentTab, currentProfile, currentAdminRole, currentAdminName]);

  // Dynamic SEO Technical Management (Title, Meta Description, Robots NoIndex, Canonical Link, OpenGraph)
  useEffect(() => {
    const cleanBase = siteBaseUrl.replace(/\/+$/, '');
    let pageTitle = 'ELECTRO-MEN | Haute Ingénierie Électronique, Systèmes Industriels & Bourse IR - Ouagadougou';
    let metaDesc = 'ELECTRO-MEN à Ouagadougou (Burkina Faso) : composants électroniques certifiés, équipements informatiques et électrotechniques, académie pratique et actionnariat participatif.';
    let isPrivate = false;
    let canonicalUrl = `${cleanBase}/`;

    switch (currentTab) {
      case 'accueil':
        pageTitle = 'ELECTRO-MEN | Haute Ingénierie Électronique, Systèmes Industriels & Bourse IR - Ouagadougou';
        metaDesc = 'Portail officiel ELECTRO-MEN à Ouagadougou : pôle d\'ingénierie, 3 catalogues d\'équipements de pointe, académie pratique et actionnariat industriel.';
        canonicalUrl = `${cleanBase}/`;
        break;
      case 'solutions':
        pageTitle = 'Formations Pratiques & Académie Industrielle | IoT, Électronique & Maintenance - ELECTRO-MEN';
        metaDesc = 'Découvrez les formations certifiantes et programmes pratiques de l\'Académie ELECTRO-MEN à Ouagadougou en microélectronique, programmation de cartes et puissance.';
        canonicalUrl = `${cleanBase}/?tab=solutions`;
        break;
      case 'bourse':
        pageTitle = 'Bourse IR & Projets Industriels | Investissement Participatif - ELECTRO-MEN';
        metaDesc = 'Consultez les opérations d’investissement ELECTRO-MEN, leurs prix unitaires et quotas de parts définis individuellement.';
        canonicalUrl = `${cleanBase}/?tab=bourse`;
        break;
      case 'boutiques':
        pageTitle = 'Les Boutiques Spécialisées | Électronique, Électrotechnique & Informatique - ELECTRO-MEN';
        metaDesc = 'Explorez les boutiques officielles ELECTRO-MEN à Ouagadougou : microélectronique, puissance industrielle et matériel informatique.';
        canonicalUrl = `${cleanBase}/?tab=boutiques`;
        break;
      case 'boutique_electronique':
        pageTitle = 'Boutique Électronique & Microcontrôleurs | Composants Haute Précision - ELECTRO-MEN';
        metaDesc = 'Composants électroniques certifiés à Ouagadougou : modules ESP32, microcontrôleurs STM32, capteurs IoT, circuits intégrés et kits de prototypage.';
        canonicalUrl = `${cleanBase}/?tab=boutique_electronique`;
        break;
      case 'boutique_electrotechnique':
        pageTitle = 'Boutique Électrotechnique Industrielle | Armoires, Puissance & Variateurs - ELECTRO-MEN';
        metaDesc = 'Matériel électrotechnique haute fiabilité : disjoncteurs magnétothermiques, variateurs de vitesse, contacteurs industriels et équipements de distribution électrique.';
        canonicalUrl = `${cleanBase}/?tab=boutique_electrotechnique`;
        break;
      case 'boutique_informatique':
        pageTitle = 'Boutique Informatique & Réseaux | Postes de Travail & Composants PC - ELECTRO-MEN';
        metaDesc = 'Équipements informatiques professionnels à Ouagadougou : ordinateurs portables, postes de bureau haute puissance, serveurs, switches et routeurs réseau.';
        canonicalUrl = `${cleanBase}/?tab=boutique_informatique`;
        break;
      case 'composants':
        pageTitle = 'Catalogue Général Composants & Équipements Industriels - ELECTRO-MEN';
        metaDesc = 'Explorez l\'ensemble des références en stock immédiat ou sur commande chez ELECTRO-MEN Burkina Faso.';
        canonicalUrl = `${cleanBase}/?tab=composants`;
        break;
      case 'profil':
        pageTitle = 'Espace Personnel Investisseur (Sécurisé & Confidentiel) - ELECTRO-MEN';
        metaDesc = 'Espace privé réservé aux investisseurs partenaires ELECTRO-MEN. Gestion de portefeuille, relevés de dividendes et souscriptions.';
        isPrivate = true;
        canonicalUrl = `${cleanBase}/?tab=profil`;
        break;
      case 'admin':
        pageTitle = 'Console d\'Administration & Gestion Centrale (Accès Restreint) - ELECTRO-MEN';
        metaDesc = 'Zone technique réservée aux administrateurs autorisés ELECTRO-MEN.';
        isPrivate = true;
        canonicalUrl = `${cleanBase}${adminCustomUrl}`;
        break;
      default:
        break;
    }

    // 1. Update Document Title
    document.title = pageTitle;

    // 2. Update Meta Description
    let metaDescriptionEl = document.querySelector('meta[name="description"]');
    if (metaDescriptionEl) {
      metaDescriptionEl.setAttribute('content', metaDesc);
    }

    // 3. Update Robots Meta (Protection stricte des pages privées noindex/nofollow)
    let robotsEl = document.querySelector('meta[name="robots"]');
    if (!robotsEl) {
      robotsEl = document.createElement('meta');
      robotsEl.setAttribute('name', 'robots');
      document.head.appendChild(robotsEl);
    }
    if (isPrivate) {
      robotsEl.setAttribute('content', 'noindex, nofollow, noarchive, nosnippet');
    } else {
      robotsEl.setAttribute('content', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
    }

    // 4. Update Canonical Link
    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalUrl);

    // 5. Update OpenGraph URL & Title
    let ogUrlEl = document.querySelector('meta[property="og:url"]');
    if (ogUrlEl) ogUrlEl.setAttribute('content', canonicalUrl);
    let ogTitleEl = document.querySelector('meta[property="og:title"]');
    if (ogTitleEl) ogTitleEl.setAttribute('content', pageTitle);
    let ogDescEl = document.querySelector('meta[property="og:description"]');
    if (ogDescEl) ogDescEl.setAttribute('content', metaDesc);
  }, [currentTab, siteBaseUrl, adminCustomUrl]);

  // Hero Video URL state with persistence and admin management
  const [heroVideoUrl, setHeroVideoUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('electromen_hero_video');
      if (saved && !saved.includes('BigBuckBunny') && !saved.includes('commondatastorage') && !saved.includes('mixkit.co')) {
        return saved;
      }
      return '/assets/videos/electromen-hero.mp4';
    } catch {
      return '/assets/videos/electromen-hero.mp4';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_hero_video', heroVideoUrl);
    } catch {
      // ignore
    }
  }, [heroVideoUrl]);

  // Registered Investors state synchronized with server in real-time
  const [registeredInvestors, setRegisteredInvestors] = useState<RegisteredInvestor[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_registered_investors');
      if (saved) {
        const parsed = JSON.parse(saved) as Array<RegisteredInvestor & { assignedPassword?: string }>;
        return parsed.map(({ assignedPassword: _assignedPassword, ...investor }) => investor);
      }
    } catch {
      // fallback
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_registered_investors', JSON.stringify(registeredInvestors));
    } catch {
      // ignore
    }
  }, [registeredInvestors]);

  // Real-time synchronization of registered investors with server database (admin with permission only)
  useEffect(() => {
    const canViewInvestors = Boolean(
      currentAdminRole &&
        (currentAdminRole === 'admin_principal' ||
          currentAdminPermissions.includes('manage_investors') ||
          currentAdminPermissions.includes('manage_investors_password') ||
          currentAdminPermissions.includes('manage_funds') ||
          currentAdminPermissions.includes('manage_wallet_adjust') ||
          currentAdminPermissions.includes('manage_subscriptions'))
    );
    if (!canViewInvestors) return;
    let isMounted = true;
    const fetchServerInvestors = async () => {
      try {
        const res = await fetch('/api/admin/investors', { credentials: 'same-origin' });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.investors) && isMounted) {
            setRegisteredInvestors(() => {
              const serverList = data.investors;
              const formatted: RegisteredInvestor[] = serverList.map((si: any) => ({
                id: si.id,
                name: si.name || `${si.firstName || ''} ${si.lastName || ''}`.trim(),
                firstName: si.firstName,
                lastName: si.lastName,
                email: si.email,
                phone: si.phone,
                status: si.status || 'en_attente',
                statusReason: si.statusReason,
                statusUpdatedAt: si.statusUpdatedAt,
                createdAt: si.createdAt,
                totalInvested: si.totalInvested || 0,
                sharesCount: si.sharesCount || 0,
                dividendsEarned: si.dividendsEarned || 0,
                hasPasswordConfigured: Boolean(si.hasPasswordConfigured),
                passwordAlgorithm: typeof si.passwordAlgorithm === 'string' ? si.passwordAlgorithm : undefined,
                passwordUpdatedAt: typeof si.passwordUpdatedAt === 'string' ? si.passwordUpdatedAt : undefined,
                shareAllocations: Array.isArray(si.shareAllocations) ? si.shareAllocations : undefined
              }));
              return formatted;
            });
          }
        }
      } catch {
        // Fallback to local
      }
    };

    if (currentTab !== 'admin') return;
    fetchServerInvestors();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchServerInvestors();
      }
    }, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentAdminRole, currentAdminPermissions, currentTab]);

  // Audit Logs & Rollback System
  const [auditLogs, setAuditLogs] = useState<AuditAction[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_audit_logs');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_audit_logs', JSON.stringify(auditLogs));
    } catch {
      // ignore
    }
  }, [auditLogs]);

  const handleAddAuditLog = (action: Omit<AuditAction, 'id'>) => {
    const newLog: AuditAction = {
      ...action,
      id: `aud-${Date.now()}`
    };
    setAuditLogs((prev) => [...prev, newLog]);
  };

  const handleRevertAuditAction = (actionId: string) => {
    const targetLog = auditLogs.find((l) => l.id === actionId);
    if (!targetLog) return;

    if (targetLog.entityType === 'product') {
      if (targetLog.actionType === 'create_product' && targetLog.newState?.id) {
        setProducts((prev) => prev.filter((p) => p.id !== targetLog.newState.id));
      } else if (targetLog.actionType === 'delete_product' && targetLog.previousState) {
        setProducts((prev) => [targetLog.previousState, ...prev]);
      } else if (targetLog.previousState) {
        setProducts((prev) => prev.map((p) => (p.id === targetLog.previousState.id ? targetLog.previousState : p)));
      }
    } else if (targetLog.entityType === 'course') {
      if (targetLog.actionType === 'create_course' && targetLog.newState?.id) {
        setCourses((prev) => prev.filter((c) => c.id !== targetLog.newState.id));
      } else if (targetLog.previousState) {
        setCourses((prev) => [targetLog.previousState, ...prev.filter((c) => c.id !== targetLog.previousState.id)]);
      }
    } else if (targetLog.entityType === 'video' && targetLog.previousState) {
      setHeroVideoUrl(targetLog.previousState);
    } else if (targetLog.actionType === 'update_admin_url' && targetLog.previousState) {
      setAdminCustomUrl(targetLog.previousState);
    }

    setAuditLogs((prev) =>
      prev.map((l) => (l.id === actionId ? { ...l, isReverted: true } : l))
    );

    const actorLabel = currentAdminName
      ? `${currentAdminName} (${currentAdminRole === 'admin_principal' ? 'Admin Principal' : 'Admin'})`
      : 'Administrateur Principal';

    const revertLog: AuditAction = {
      id: `aud-rev-${Date.now()}`,
      author: actorLabel,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'revert_action',
      description: `Annulation de l'action : ${targetLog.description}`,
      entityType: targetLog.entityType
    };
    setAuditLogs((prev) => [...prev, revertLog]);
  };

  // Re-publish / Relaunch an action after correction so the public sees it live
  const handleRelaunchAuditAction = (actionId: string, updatedStateOverride?: any) => {
    const targetLog = auditLogs.find((l) => l.id === actionId);
    if (!targetLog) return;

    const stateToApply = updatedStateOverride !== undefined ? updatedStateOverride : targetLog.newState;

    if (targetLog.entityType === 'product') {
      if (targetLog.actionType === 'create_product' && stateToApply) {
        setProducts((prev) => [stateToApply, ...prev.filter((p) => p.id !== stateToApply.id)]);
      } else if (targetLog.actionType === 'delete_product') {
        if (targetLog.targetId) {
          setProducts((prev) => prev.filter((p) => p.id !== targetLog.targetId));
        }
      } else if (stateToApply && stateToApply.id) {
        setProducts((prev) => prev.map((p) => (p.id === stateToApply.id ? stateToApply : p)));
      }
    } else if (targetLog.entityType === 'course') {
      if (targetLog.actionType === 'create_course' && stateToApply) {
        setCourses((prev) => [stateToApply, ...prev.filter((c) => c.id !== stateToApply.id)]);
      } else if (stateToApply && stateToApply.id) {
        setCourses((prev) => prev.map((c) => (c.id === stateToApply.id ? stateToApply : c)));
      }
    } else if (targetLog.entityType === 'video' && stateToApply) {
      setHeroVideoUrl(stateToApply);
    } else if (targetLog.actionType === 'update_admin_url' && stateToApply) {
      setAdminCustomUrl(stateToApply);
    }

    setAuditLogs((prev) =>
      prev.map((l) =>
        l.id === actionId ? { ...l, isReverted: false, newState: stateToApply } : l
      )
    );

    const actorLabel = currentAdminName
      ? `${currentAdminName} (${currentAdminRole === 'admin_principal' ? 'Admin Principal' : 'Admin'})`
      : 'Administrateur Principal';

    const publishLog: AuditAction = {
      id: `aud-pub-${Date.now()}`,
      author: actorLabel,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'relaunch_public',
      description: `Relance et publication publique réussie de : "${targetLog.description}"`,
      entityType: targetLog.entityType,
      targetId: targetLog.targetId,
      newState: stateToApply
    };
    setAuditLogs((prev) => [...prev, publishLog]);
  };

  // Cart with local offline persistence
  const [cartItems, setCartItems] = useState<CartItem[]>(() => loadCartItems());

  useEffect(() => {
    saveCartItems(cartItems);
  }, [cartItems]);

  // Modals state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [marketplaceSearchQuery, setMarketplaceSearchQuery] = useState('');
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [activeVideoModal, setActiveVideoModal] = useState<{
    videoUrl?: string;
    courseTitle?: string;
    moduleTitle?: string;
    duration?: string;
    syllabus?: CourseModule[];
    pdfUrl?: string;
  }>({
    videoUrl: '/assets/videos/electromen-hero.mp4',
    courseTitle: 'Académie Technique & Métiers ELECTRO-MEN',
    moduleTitle: 'Présentation Vidéo'
  });

  const handleOpenVideoModal = (
    videoUrl?: string,
    courseTitle?: string,
    moduleTitle?: string,
    duration?: string,
    syllabus?: CourseModule[],
    pdfUrl?: string
  ) => {
    setActiveVideoModal({
      videoUrl: videoUrl || formationsVideoUrl || '/assets/videos/electromen-hero.mp4',
      courseTitle: courseTitle || 'Académie Technique & Métiers ELECTRO-MEN',
      moduleTitle: moduleTitle || 'Vidéo de Démonstration',
      duration: duration || 'Session Active',
      syllabus,
      pdfUrl
    });
    setIsVideoOpen(true);
  };
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [isCertOpen, setIsCertOpen] = useState(false);
  const [isContractOpen, setIsContractOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [walletDefaultAction, setWalletDefaultAction] = useState<'depot' | 'retrait' | 'history'>('depot');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [activePaymentSubId, setActivePaymentSubId] = useState<string | null>(null);
  const [isEmailsOpen, setIsEmailsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);

  // Hidden Admin Gate state (Supports both Email/Password for secondary admins and Master PIN)
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [adminLoginMode, setAdminLoginMode] = useState<'credentials' | 'pin'>('credentials');
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [needsAdminSetup, setNeedsAdminSetup] = useState(false);
  const [adminSetupConfirmPass, setAdminSetupConfirmPass] = useState('');

  // Maintenance Mode (Site en veille)
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('electromen_maintenance_mode') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleMaintenanceMode = async (active: boolean) => {
    const previous = isMaintenanceMode;
    setIsMaintenanceMode(active);
    try {
      localStorage.setItem('electromen_maintenance_mode', active ? 'true' : 'false');
    } catch {}
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMaintenanceMode: active })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setIsMaintenanceMode(previous);
        alert(data.error || 'Modification du mode maintenance refusée par le serveur.');
      }
    } catch {
      setIsMaintenanceMode(previous);
      alert('Impossible de contacter le serveur pour modifier le mode maintenance.');
    }
  };

  // Custom Product Categories / Families created by Admin
  const [customGroups, setCustomGroups] = useState<Record<string, { id: string; label: string }[]>>({
    electronique: [],
    electrotechnique: [],
    informatique: []
  });

  const handleAddCustomGroup = (domain: 'electronique' | 'electrotechnique' | 'informatique', group: { id: string; label: string }) => {
    setCustomGroups((prev) => ({
      ...prev,
      [domain]: [...(prev[domain] || []), group]
    }));
  };

  // Dynamic Domain Groups state hydrated from offline cache and synced with PostgreSQL
  const [domainGroups, setDomainGroups] = useState<{
    electronique: CategoryGroup[];
    electrotechnique: CategoryGroup[];
    informatique: CategoryGroup[];
  }>(() => {
    const cached = loadOfflineGroups();
    if (cached) {
      return {
        electronique: Array.isArray(cached.electronique) && cached.electronique.length > 0 ? cached.electronique : ELECTRONIQUE_GROUPS,
        electrotechnique: Array.isArray(cached.electrotechnique) && cached.electrotechnique.length > 0 ? cached.electrotechnique : ELECTROTECHNIQUE_GROUPS,
        informatique: Array.isArray(cached.informatique) && cached.informatique.length > 0 ? cached.informatique : INFORMATIQUE_GROUPS
      };
    }
    return {
      electronique: ELECTRONIQUE_GROUPS,
      electrotechnique: ELECTROTECHNIQUE_GROUPS,
      informatique: INFORMATIQUE_GROUPS
    };
  });

  // Investor Activities & Documents hydrated from offline snapshot
  const [investorActivities, setInvestorActivities] = useState<InvestorActivity[]>(() => {
    const cached = loadOfflineActivities();
    if (cached) return cached;
    try {
      const saved = localStorage.getItem('electromen_investor_activities');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_INVESTOR_ACTIVITIES;
  });

  useEffect(() => {
    saveOfflineActivities(investorActivities);
    try {
      localStorage.setItem('electromen_investor_activities', JSON.stringify(investorActivities));
    } catch {}
  }, [investorActivities]);

  const [investorDocuments, setInvestorDocuments] = useState<InvestorDocument[]>(() => {
    const cached = loadOfflineDocuments();
    if (cached) return cached;
    try {
      const saved = localStorage.getItem('electromen_investor_documents');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_INVESTOR_DOCUMENTS;
  });

  useEffect(() => {
    saveOfflineDocuments(investorDocuments);
    try {
      localStorage.setItem('electromen_investor_documents', JSON.stringify(investorDocuments));
    } catch {}
  }, [investorDocuments]);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | undefined;
    let activeRequest: AbortController | null = null;
    let hadPublicFallbackError = false;

    const fetchSnapshot = async <T,>(url: string, signal: AbortSignal): Promise<T | null> => {
      try {
        return await fetchJsonDeduplicated<T>(
          `snapshot:${url}`,
          withNoCacheParam(url),
          {
            ...NO_CACHE_FETCH_INIT,
            signal,
            timeoutMs: 7500
          }
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          hadPublicFallbackError = true;
        }
        return null;
      }
    };

    const refreshAdminSessionPermissions = async () => {
      if (!currentAdminRole) return;
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache'
          },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (!active) return;
        if (!res.ok || !data.valid || !data.user) {
          setCurrentAdminRole(null);
          setCurrentAdminName('');
          setCurrentAdminPermissions([]);
          setCurrentTab('accueil');
          return;
        }
        setCurrentAdminRole(data.user.role);
        setCurrentAdminName(data.user.name);
        setCurrentAdminPermissions(resolveAdminPermissions(data.user.role, data.user.permissions));
      } catch {
        // Ignore transient network failures
      }
    };

    const refreshContent = async (forcePublicRefresh = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        hydrateFromOfflineCache();
        return;
      }
      activeRequest?.abort();
      const controller = new AbortController();
      activeRequest = controller;
      hadPublicFallbackError = false;

      const canReadAdminOperations =
        currentAdminRole === 'admin_principal' ||
        currentAdminPermissions.includes('manage_operations') ||
        currentAdminPermissions.includes('manage_subscriptions') ||
        currentAdminPermissions.includes('manage_investors');
      const canReadAdminFunds =
        currentAdminRole === 'admin_principal' ||
        currentAdminPermissions.includes('manage_funds') ||
        currentAdminPermissions.includes('manage_wallet_adjust');
      const canReadAdminAudit =
        currentAdminRole === 'admin_principal' || currentAdminPermissions.includes('view_audit');
      const canReadAdminSubscriptions =
        currentAdminRole === 'admin_principal' ||
        currentAdminPermissions.includes('manage_subscriptions') ||
        currentAdminPermissions.includes('manage_investors') ||
        currentAdminPermissions.includes('manage_operations');
      const canReadMessagesAndProfits = Boolean(currentAdminRole || currentProfile?.email);
      const canReadCustomOrders =
        currentAdminRole === 'admin_principal' ||
        currentAdminPermissions.includes('manage_content') ||
        currentAdminPermissions.includes('manage_products') ||
        currentAdminPermissions.includes('manage_investors');

      const shouldFetchPublic = forcePublicRefresh || !isCatalogCacheFresh() || Boolean(currentAdminRole);

      const [
        ,
        adminOperationData,
        adminFundData,
        adminAuditData,
        adminSubscriptionsData,
        investorWalletData,
        investorMeData,
        adminCustomOrdersData,
        messagesData,
        profitDistributionsData
      ] = await Promise.all([
        shouldFetchPublic
          ? fetchProductsNow(false, forcePublicRefresh)
          : Promise.resolve(),
        canReadAdminOperations
          ? fetchSnapshot<{ operations: InvestmentProject[] }>('/api/admin/operations', controller.signal)
          : Promise.resolve(null),
        canReadAdminFunds
          ? fetchSnapshot<{ fundRequests?: FundOperationRequest[]; transactions?: WalletTransaction[] }>('/api/admin/fund-requests', controller.signal)
          : Promise.resolve(null),
        canReadAdminAudit
          ? fetchSnapshot<{ auditLogs?: AuditAction[] }>('/api/admin/audit-logs', controller.signal)
          : Promise.resolve(null),
        canReadAdminSubscriptions
          ? fetchSnapshot<{ subscriptions?: ShareSubscription[] }>('/api/admin/subscriptions', controller.signal)
          : Promise.resolve(null),
        currentProfile?.email
          ? fetchSnapshot<{
              wallet?: {
                balance: number;
                availableWithdrawalBalance?: number;
                pendingWithdrawalsTotal?: number;
                sharesCount: number;
                dividendsEarned: number;
              };
              fundRequests?: FundOperationRequest[];
              transactions?: WalletTransaction[];
            }>('/api/investor/wallet', controller.signal)
          : Promise.resolve(null),
        currentProfile?.email
          ? fetchSnapshot<{ success?: boolean; investor?: RegisteredInvestor }>('/api/investor/me', controller.signal)
          : Promise.resolve(null),
        canReadCustomOrders
          ? fetchSnapshot<{ success?: boolean; orders?: CustomOrderRecord[] }>('/api/admin/custom-orders', controller.signal)
          : Promise.resolve(null),
        canReadMessagesAndProfits
          ? fetchSnapshot<{ messages?: any[]; isInvestorChatOpen?: boolean }>('/api/messages', controller.signal)
          : Promise.resolve(null),
        canReadMessagesAndProfits
          ? fetchSnapshot<{ distributions?: any[] }>('/api/profit-distributions', controller.signal)
          : Promise.resolve(null)
      ]);

      if (!active || controller.signal.aborted) return;
      if (hadPublicFallbackError && shouldFetchPublic) {
        hydrateFromOfflineCache();
      }
      if (adminOperationData && Array.isArray(adminOperationData.operations)) {
        setProjects(adminOperationData.operations);
        saveOfflineProjects(adminOperationData.operations);
      }

      if (adminAuditData && Array.isArray(adminAuditData.auditLogs)) {
        setAuditLogs(adminAuditData.auditLogs);
      }
      if (adminSubscriptionsData && Array.isArray(adminSubscriptionsData.subscriptions)) {
        setSubscriptions(adminSubscriptionsData.subscriptions);
      }
      if (adminCustomOrdersData && Array.isArray(adminCustomOrdersData.orders)) {
        setCustomOrders(adminCustomOrdersData.orders);
      }
      if (investorMeData?.success && investorMeData.investor) {
        const me = investorMeData.investor;
        setInvestorPortfolio({
          totalInvested: Number(me.totalInvested || 0),
          sharesCount: Number(me.sharesCount || 0),
          dividendsEarned: Number(me.dividendsEarned || 0),
          shareAllocations: Array.isArray(me.shareAllocations) ? me.shareAllocations : []
        });
      } else if (!currentProfile?.email) {
        setInvestorPortfolio(null);
      }

      if (messagesData) {
        if (Array.isArray(messagesData.messages)) {
          setInvestorMessages(messagesData.messages.map(normalizeServerMessage));
        }
        if (typeof messagesData.isInvestorChatOpen === 'boolean') {
          setIsInvestorChatOpen(messagesData.isInvestorChatOpen);
        }
      }

      if (profitDistributionsData && Array.isArray(profitDistributionsData.distributions)) {
        setProfitDistributions(profitDistributionsData.distributions.map(normalizeServerDistribution));
      }

      if (adminFundData) {
        if (Array.isArray(adminFundData.fundRequests)) setFundRequests(adminFundData.fundRequests);
        if (Array.isArray(adminFundData.transactions)) setTransactions(adminFundData.transactions);
      } else if (investorWalletData) {
        if (investorWalletData.wallet && currentProfile?.email) {
          const emailKey = currentProfile.email.toLowerCase().trim();
          setWalletsByEmail((prev) => ({
            ...prev,
            [emailKey]: {
              balance: investorWalletData.wallet!.balance,
              availableWithdrawalBalance: investorWalletData.wallet!.availableWithdrawalBalance,
              pendingWithdrawalsTotal: investorWalletData.wallet!.pendingWithdrawalsTotal,
              sharesCount: investorWalletData.wallet!.sharesCount,
              dividendsEarned: investorWalletData.wallet!.dividendsEarned
            }
          }));
        }
        if (Array.isArray(investorWalletData.fundRequests)) setFundRequests(investorWalletData.fundRequests);
        if (Array.isArray(investorWalletData.transactions)) setTransactions(investorWalletData.transactions);
      }
    };

    const scheduleAdminEventRefresh = (event?: Event) => {
      if (event && 'data' in event && typeof (event as MessageEvent).data === 'string') {
        try {
          const parsed = JSON.parse((event as MessageEvent).data);
          if (parsed?.resource === 'admins' && currentAdminRole) {
            void refreshAdminSessionPermissions();
          }
        } catch {
          // Ignore non-JSON SSE payloads
        }
      }
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        void fetchProductsNow(false, true);
        void refreshContent(true);
      }, 150);
    };

    // Only attach SSE for authenticated admin sessions outside serverless Vercel, and never listen to SYNC_REQUIRED storms
    const isVercelHost =
      typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');
    let eventSource: EventSource | null = null;
    if (currentAdminRole && !isVercelHost && typeof EventSource !== 'undefined') {
      eventSource = new EventSource(withNoCacheParam('/api/events/stream'));
      eventSource.addEventListener('DATA_CHANGED', scheduleAdminEventRefresh);
    }

    const handleBackOnline = () => {
      if (!isCatalogCacheFresh()) {
        void fetchProductsNow(false, true);
        void refreshContent(true);
      }
    };
    window.addEventListener('online', handleBackOnline);

    void refreshContent(false);

    return () => {
      active = false;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      activeRequest?.abort();
      eventSource?.close();
      window.removeEventListener('online', handleBackOnline);
    };
  }, [currentAdminRole, currentAdminPermissions, currentProfile?.email, fetchProductsNow, applyServerGroups, hydrateFromOfflineCache]);

  const cartCount = cartItems.reduce((acc, it) => acc + it.quantity, 0);

  // Profile Management Handler (Strictly Personal)
  const handleUpdateProfile = (updated: Partial<InvestorProfile>) => {
    if (!currentProfile) return;
    const oldEmail = currentProfile.email.toLowerCase().trim();
    const newEmail = (updated.email || currentProfile.email).toLowerCase().trim();

    setCurrentProfile((prev) => (prev ? { ...prev, ...updated } : null));

    if (oldEmail !== newEmail && walletsByEmail[oldEmail]) {
      setWalletsByEmail((prev) => {
        const next = { ...prev };
        next[newEmail] = next[oldEmail];
        delete next[oldEmail];
        return next;
      });
    }
  };

  // Cart Handlers
  const handleAddToCart = (product: Product, quantity = 1) => {
    setCartItems((prev) => {
      const existing = prev.find((it) => it.product.id === product.id);
      if (existing) {
        return prev.map((it) =>
          it.product.id === product.id ? { ...it, quantity: it.quantity + quantity } : it
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((it) => {
          if (it.product.id === id) {
            const newQty = it.quantity + delta;
            return newQty > 0 ? { ...it, quantity: newQty } : null;
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveItem = (id: string) => {
    setCartItems((prev) => prev.filter((it) => it.product.id !== id));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  // Subscriptions Handlers - Sync with server-created subscription
  const handleRequestSubscription = (data: {
    id?: string;
    name: string;
    email: string;
    phone: string;
    shares: number;
    total: number;
    operationId?: string;
    operationTitle?: string;
  }) => {
    const subId = data.id || `#EM-SUB-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    const newSub: ShareSubscription = {
      id: subId,
      investorName: data.name,
      investorEmail: data.email,
      investorPhone: data.phone,
      operationId: data.operationId,
      operationTitle: data.operationTitle,
      shares: data.shares,
      sharePrice: data.shares > 0 ? Math.round(data.total / data.shares) : 0,
      totalAmount: data.total,
      status: 'pending_admin',
      requestedAt: formattedDate
    };

    setSubscriptions((prev) => [newSub, ...prev.filter((s) => s.id !== subId)]);
    return subId;
  };

  // SERVER-BACKED ADMIN HANDLERS
  const handleAdminApproveSubscription = async (subId: string, customCode?: string) => {
    const generatedPass = customCode || `ELM-ACT-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(subId)}/approve`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPasswordCode: generatedPass })
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.subscription) {
        alert(data.error || 'Approbation de la souscription refusée par le serveur.');
        return;
      }

      const approvedSub: ShareSubscription = data.subscription;
      setSubscriptions((prev) => prev.map((s) => (s.id === subId ? approvedSub : s)));

      const now = new Date();
      const formattedTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const emailNotif: EmailNotification = {
        id: `email-${Date.now()}`,
        recipientEmail: approvedSub.investorEmail || currentProfile?.email || 'investisseur@electromen.bf',
        recipientName: approvedSub.investorName || currentProfile?.name || 'Investisseur',
        subject: `ELECTRO-MEN | Accord Accordé pour vos ${approvedSub.shares || 1} Actions (Mot de passe d'accès au paiement)`,
        date: `${now.toLocaleDateString('fr-FR')} ${formattedTime}`,
        code: approvedSub.adminPasswordCode || generatedPass,
        subscriptionId: subId,
        shares: approvedSub.shares || 1,
        amount: approvedSub.totalAmount || 0
      };
      setEmails((prev) => [emailNotif, ...prev]);
    } catch {
      alert('Erreur réseau lors de l’approbation de la souscription.');
    }
  };

  const handleAdminForceValidateSubscription = async (subId: string) => {
    try {
      const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(subId)}/validate`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: 'Validation Directe Administration' })
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.subscription) {
        alert(data.error || 'Validation de paiement refusée par le serveur.');
        return;
      }

      const validatedSub: ShareSubscription = data.subscription;
      setSubscriptions((prev) => prev.map((s) => (s.id === subId ? validatedSub : s)));

      setWalletsByEmail((prev) => {
        const targetEmailKey = validatedSub.investorEmail.toLowerCase().trim();
        const existing = prev[targetEmailKey] || { balance: 0, sharesCount: 0, dividendsEarned: 0 };
        return {
          ...prev,
          [targetEmailKey]: {
            ...existing,
            sharesCount: existing.sharesCount + validatedSub.shares
          }
        };
      });

      const tx: WalletTransaction = {
        id: `tx-admin-share-${Date.now()}`,
        type: 'achat_parts',
        amount: validatedSub.totalAmount,
        date: validatedSub.paidAt || new Date().toLocaleDateString('fr-FR'),
        method: validatedSub.paymentMethod || 'Agrément Direction Générale',
        status: 'completed',
        reference: `ADM-${validatedSub.id.replace('#', '')}`,
        note: `Actions émises par la Direction pour ${validatedSub.investorName}`
      };
      setTransactions((prev) => [tx, ...prev]);
    } catch {
      alert('Erreur réseau lors de la validation de la souscription.');
    }
  };

  const handleAdminRejectSubscription = async (subId: string) => {
    try {
      const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(subId)}/reject`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.subscription) {
        alert(data.error || 'Rejet de la souscription refusé par le serveur.');
        return;
      }
      setSubscriptions((prev) => prev.map((s) => (s.id === subId ? data.subscription : s)));
    } catch {
      alert('Erreur réseau lors du rejet de la souscription.');
    }
  };

  const handleAdminUpdateProduct = async (updated: Product) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('Connexion Internet requise : impossible de modifier un produit en mode hors ligne.');
      return;
    }
    const cleanUpdated = normalizeClientProduct(updated);
    const previous = products;
    setProducts((prev) => prev.map((p) => (p.id === cleanUpdated.id ? cleanUpdated : p)));
    try {
      const res = await fetch(withNoCacheParam(`/api/admin/products/${encodeURIComponent(cleanUpdated.id)}`), {
        method: 'PUT',
        ...NO_CACHE_FETCH_INIT,
        headers: {
          ...NO_CACHE_FETCH_INIT.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanUpdated)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setProducts(previous);
        alert(data.error || 'La mise à jour du produit a été refusée par le serveur.');
        return;
      }
      if (data.product) {
        const normalizedServer = normalizeClientProduct(data.product);
        setProducts((prev) => {
          const next = prev.map((p) => (p.id === cleanUpdated.id ? normalizedServer : p));
          saveOfflineProducts(next);
          markCatalogCacheUpdated();
          return next;
        });
      }
    } catch {
      setProducts(previous);
      alert('Impossible de contacter le serveur pour mettre à jour le produit.');
    }
  };

  const handleAdminAddProduct = async (newProd: Product) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('Connexion Internet requise : impossible d’ajouter un produit en mode hors ligne.');
      return;
    }
    const cleanNewProd = normalizeClientProduct(newProd);
    const previous = products;
    setProducts((prev) => [cleanNewProd, ...prev]);
    try {
      const res = await fetch(withNoCacheParam('/api/admin/products'), {
        method: 'POST',
        ...NO_CACHE_FETCH_INIT,
        headers: {
          ...NO_CACHE_FETCH_INIT.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanNewProd)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setProducts(previous);
        alert(data.error || 'L’ajout du produit a été refusé par le serveur.');
        return;
      }
      if (data.product) {
        const normalizedServer = normalizeClientProduct(data.product);
        setProducts((prev) => {
          const next = [
            normalizedServer,
            ...prev.filter((p) => p.id !== cleanNewProd.id && p.id !== normalizedServer.id)
          ];
          saveOfflineProducts(next);
          markCatalogCacheUpdated();
          return next;
        });
      }
    } catch {
      setProducts(previous);
      alert('Impossible de contacter le serveur pour enregistrer le produit.');
    }
  };

  const handleAdminDeleteProduct = async (id: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('Connexion Internet requise : impossible de supprimer un produit en mode hors ligne.');
      return;
    }
    const previous = products;
    const optimisticNext = products.filter((p) => p.id !== id);
    setProducts(optimisticNext);
    try {
      const res = await fetch(withNoCacheParam(`/api/admin/products/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        ...NO_CACHE_FETCH_INIT
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setProducts(previous);
        alert(data.error || 'Suppression du produit refusée par le serveur.');
      } else {
        saveOfflineProducts(optimisticNext);
        markCatalogCacheUpdated();
      }
    } catch {
      setProducts(previous);
      alert('Erreur réseau lors de la suppression du produit.');
    }
  };

  const handleAdminImportProducts = async (
    items: Product[],
    options: { upsertByRef: boolean; filename: string }
  ): Promise<{ createdCount: number; updatedCount: number }> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error(
        "Connexion Internet requise : l'importation CSV vers PostgreSQL est impossible en mode hors ligne."
      );
    }
    const normalizedItems = items.map(normalizeClientProduct);
    const res = await fetch(withNoCacheParam('/api/admin/products/bulk-csv'), {
      method: 'POST',
      ...NO_CACHE_FETCH_INIT,
      headers: {
        ...NO_CACHE_FETCH_INIT.headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        products: normalizedItems,
        upsertByRef: options.upsertByRef,
        filename: options.filename
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'L’importation CSV des produits a été refusée par le serveur.');
    }
    if (Array.isArray(data.products)) {
      const normalizedAll = data.products.map(normalizeClientProduct);
      setProducts(normalizedAll);
      saveOfflineProducts(normalizedAll);
      markCatalogCacheUpdated();
    }
    return {
      createdCount: Number(data.createdCount || 0),
      updatedCount: Number(data.updatedCount || 0)
    };
  };

  const handleAdminOptimizeImages = async (payload: {
    updates: Array<{ id: string; image: string }>;
    boutiques?: Array<{ id: string; logoUrl?: string }>;
  }): Promise<{ updatedProductsCount: number; updatedBoutiquesCount: number }> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error("Connexion Internet requise pour enregistrer les images optimisées.");
    }
    const res = await fetch(withNoCacheParam('/api/admin/products/optimize-images'), {
      method: 'POST',
      ...NO_CACHE_FETCH_INIT,
      headers: {
        ...NO_CACHE_FETCH_INIT.headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || "L'optimisation des images a été refusée par le serveur.");
    }
    if (Array.isArray(data.products)) {
      const normalizedAll = data.products.map(normalizeClientProduct);
      setProducts(normalizedAll);
      saveOfflineProducts(normalizedAll);
    }
    if (Array.isArray(data.boutiques) && data.boutiques.length > 0) {
      setMarketplaceBoutiques(data.boutiques);
      saveOfflineBoutiques(data.boutiques);
    }
    markCatalogCacheUpdated();
    return {
      updatedProductsCount: Number(data.updatedProductsCount || 0),
      updatedBoutiquesCount: Number(data.updatedBoutiquesCount || 0)
    };
  };

  const handleAdminUpdateCourse = async (updated: Course) => {
    const previous = courses;
    setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    try {
      const res = await fetch(`/api/admin/courses/${encodeURIComponent(updated.id)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setCourses(previous);
        alert(data.error || 'Mise à jour de la formation refusée par le serveur.');
      }
    } catch {
      setCourses(previous);
      alert('Erreur réseau lors de la mise à jour de la formation.');
    }
  };

  const handleAdminAddCourse = async (newCourse: Course) => {
    const previous = courses;
    setCourses((prev) => [newCourse, ...prev]);
    try {
      const res = await fetch('/api/admin/courses', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCourse)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setCourses(previous);
        alert(data.error || 'Création de la formation refusée par le serveur.');
        return;
      }
      if (data.course) {
        setCourses((prev) => [data.course, ...prev.filter((c) => c.id !== newCourse.id && c.id !== data.course.id)]);
      }
    } catch {
      setCourses(previous);
      alert('Erreur réseau lors de l’ajout de la formation.');
    }
  };

  const handleAdminDeleteCourse = async (id: string) => {
    const previous = courses;
    setCourses((prev) => prev.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/admin/courses/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCourses(previous);
        alert(data.error || 'Suppression de la formation refusée par le serveur.');
      }
    } catch {
      setCourses(previous);
      alert('Erreur réseau lors de la suppression de la formation.');
    }
  };

  const handleAdminUpdateProject = async (updated: InvestmentProject) => {
    const previous = projects;
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    try {
      const res = await fetch(`/api/admin/operations/${encodeURIComponent(updated.id)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setProjects(previous);
        alert(data.error || 'Mise à jour de l’opération refusée par le serveur.');
      }
    } catch {
      setProjects(previous);
      alert('Erreur réseau lors de la mise à jour de l’opération.');
    }
  };

  const handleAdminAddProject = async (newProj: InvestmentProject) => {
    const previous = projects;
    setProjects((prev) => [newProj, ...prev]);
    try {
      const res = await fetch('/api/admin/operations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProj)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setProjects(previous);
        alert(data.error || 'Création de l’opération refusée par le serveur.');
        return;
      }
      if (data.operation) {
        setProjects((prev) => [data.operation, ...prev.filter((p) => p.id !== newProj.id && p.id !== data.operation.id)]);
      }
    } catch {
      setProjects(previous);
      alert('Erreur réseau lors de la création de l’opération.');
    }
  };

  const handleAdminAdjustWallet = async (email: string, deltaBalance: number, reason: string) => {
    const key = email.toLowerCase().trim();
    const res = await fetch('/api/admin/wallet/adjust', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: key, deltaBalance, reason })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Ajustement du solde refusé par le serveur.');
      return;
    }

    setWalletsByEmail((prev) => {
      const existing = prev[key] || { balance: 0, sharesCount: 0, dividendsEarned: 0 };
      return {
        ...prev,
        [key]: {
          ...existing,
          balance: typeof data.walletBalance === 'number' ? data.walletBalance : Math.max(0, existing.balance + deltaBalance)
        }
      };
    });

    if (data.transaction) {
      setTransactions((prev) => [data.transaction, ...prev]);
    }
  };

  // =========================================================================
  // GESTION SÉCURISÉE DES DÉPÔTS ET RETRAITS DES INVESTISSEURS
  // Règles strictes :
  // 1. Soumission par l'investisseur vérifiée côté serveur (solde réel, limites, anti-spam)
  // 2. Règlement avec l'admin sur WhatsApp
  // 3. Admission et confirmation par l'administrateur UNIQUEMENT après réception effective
  // 4. Débit/Crédit réel du solde UNIQUEMENT après validation admin côté serveur
  // 5. Rejet sans altération du solde
  // =========================================================================

  const handleSubmitFundRequest = async (
    data: Omit<FundOperationRequest, 'id' | 'requestedAt' | 'status'>
  ): Promise<FundOperationRequest> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (data.idempotencyKey) {
      headers['X-Idempotency-Key'] = data.idempotencyKey;
    }

    const res = await fetch('/api/investor/fund-requests', {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok || !result.success || !result.request) {
      throw new Error(result.error || 'Demande refusée par le serveur.');
    }

    const newReq: FundOperationRequest = result.request;
    setFundRequests((prev) => [newReq, ...prev.filter((r) => r.id !== newReq.id)]);

    if (newReq.type === 'retrait' && !result.duplicate && currentProfile?.email) {
      const emailKey = currentProfile.email.toLowerCase().trim();
      setWalletsByEmail((prev) => {
        const existing = prev[emailKey] || { balance: 0, sharesCount: 0, dividendsEarned: 0 };
        const nextPending = (existing.pendingWithdrawalsTotal || 0) + newReq.amount;
        return {
          ...prev,
          [emailKey]: {
            ...existing,
            pendingWithdrawalsTotal: nextPending,
            availableWithdrawalBalance: Math.max(0, existing.balance - nextPending)
          }
        };
      });
    }

    handleAddAuditLog({
      author: newReq.investorName,
      date: newReq.requestedAt,
      actionType: 'request_fund_operation',
      description: `Demande de ${newReq.type === 'depot' ? 'dépôt' : 'retrait'} de ${newReq.amount.toLocaleString(
        'fr-FR'
      )} FCFA soumise par ${newReq.investorName} (${newReq.reference})`,
      entityType: 'wallet',
      targetId: newReq.id,
      newState: newReq
    });

    return newReq;
  };

  const handleConfirmFundRequest = async (reqId: string) => {
    const target = fundRequests.find((r) => r.id === reqId);
    if (!target || target.status === 'Confirmé') return;

    const res = await fetch(`/api/admin/fund-requests/${encodeURIComponent(reqId)}/confirm`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok || !data.success || !data.request) {
      alert(data.error || 'La confirmation de cette opération a été refusée par le serveur.');
      return;
    }

    const targetEmailKey = target.investorEmail.toLowerCase().trim();
    setWalletsByEmail((prev) => {
      const existing = prev[targetEmailKey] || { balance: 0, sharesCount: 0, dividendsEarned: 0 };
      return {
        ...prev,
        [targetEmailKey]: {
          ...existing,
          balance: typeof data.walletBalance === 'number'
            ? data.walletBalance
            : target.type === 'depot'
              ? existing.balance + target.amount
              : Math.max(0, existing.balance - target.amount)
        }
      };
    });

    setFundRequests((prev) =>
      prev.map((r) => (r.id === reqId ? data.request : r))
    );

    if (data.transaction) {
      setTransactions((prev) => [data.transaction, ...prev]);
    }
  };

  const handleRejectFundRequest = async (reqId: string, reason: string) => {
    const target = fundRequests.find((r) => r.id === reqId);
    if (!target || target.status === 'Confirmé' || target.status === 'Refusé') return;

    const res = await fetch(`/api/admin/fund-requests/${encodeURIComponent(reqId)}/reject`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok || !data.success || !data.request) {
      alert(data.error || 'Le rejet de cette demande a échoué.');
      return;
    }

    setFundRequests((prev) =>
      prev.map((r) => (r.id === reqId ? data.request : r))
    );
  };

  const handleSetFundRequestProcessing = async (reqId: string) => {
    const res = await fetch(`/api/admin/fund-requests/${encodeURIComponent(reqId)}/processing`, {
      method: 'PATCH',
      credentials: 'same-origin'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.request) {
        setFundRequests((prev) => prev.map((r) => (r.id === reqId ? data.request : r)));
        return;
      }
    }
    setFundRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: 'En cours de traitement' } : r))
    );
  };

  // Payment Execution (Unlocks shares for the active personal investor)
  const handleExecutePayment = (
    subId: string,
    paymentMethod: string,
    useWalletBalance: boolean
  ) => {
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    const sub = subscriptions.find((s) => s.id === subId);
    if (!sub) return;

    setWalletsByEmail((prev) => {
      const targetEmailKey = sub.investorEmail.toLowerCase().trim();
      const existing = prev[targetEmailKey] || { balance: 0, sharesCount: 0, dividendsEarned: 0 };
      return {
        ...prev,
        [targetEmailKey]: {
          ...existing,
          balance: useWalletBalance ? Math.max(0, existing.balance - sub.totalAmount) : existing.balance,
          sharesCount: existing.sharesCount + sub.shares
        }
      };
    });

    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === subId
          ? {
              ...s,
              status: 'paid_and_issued',
              paidAt: formattedDate,
              paymentMethod
            }
          : s
      )
    );

    const tx: WalletTransaction = {
      id: `tx-share-${Date.now()}`,
      type: 'achat_parts',
      amount: sub.totalAmount,
      date: formattedDate,
      method: paymentMethod,
      status: 'completed',
      reference: `ACT-${sub.id.replace('#', '')}`,
      note: `Souscription de ${sub.shares} parts (${sub.investorName})`
    };

    setTransactions((prev) => [tx, ...prev]);

    setIsPaymentOpen(false);
    setActivePaymentSubId(null);
    setIsContractOpen(true);
  };

  const handleOpenPayment = (subId: string) => {
    setActivePaymentSubId(subId);
    setIsPaymentOpen(true);
  };

  const handleOpenPdfContract = () => {
    setIsContractOpen(true);
  };

  const handleSelectCourse = (_course: Course) => {
    setCurrentTab('solutions');
    setIsVideoOpen(true);
  };

  const handleSelectProject = (_project: InvestmentProject) => {
    setCurrentTab('bourse');
  };

  const handleAdminUpdateInvestorStatus = async (investorId: string, status: any, reason?: string) => {
    const previous = registeredInvestors;
    setRegisteredInvestors((prev) =>
      prev.map((inv) =>
        inv.id === investorId
          ? {
              ...inv,
              status,
              statusReason: reason,
              statusUpdatedAt: new Date().toLocaleDateString('fr-FR')
            }
          : inv
      )
    );
    try {
      const res = await fetch(`/api/admin/investors/${encodeURIComponent(investorId)}/status`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRegisteredInvestors(previous);
        alert(data.error || 'Mise à jour du statut refusée par le serveur.');
        return;
      }
      handleAddAuditLog({
        author: currentAdminName,
        date: new Date().toLocaleString('fr-FR'),
        actionType: 'update_investor_status',
        description: `Mise à jour statut investisseur ID ${investorId} -> ${status}${reason ? ` (${reason})` : ''}`,
        entityType: 'investor',
        targetId: investorId
      });
    } catch {
      setRegisteredInvestors(previous);
      alert('Erreur réseau lors de la mise à jour du statut.');
    }
  };

  const handleAdminDeleteInvestor = async (investorId: string) => {
    const previous = registeredInvestors;
    setRegisteredInvestors((prev) => prev.filter((inv) => inv.id !== investorId));
    try {
      const res = await fetch(`/api/admin/investors/${encodeURIComponent(investorId)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRegisteredInvestors(previous);
        alert(data.error || 'Suppression de l’investisseur refusée par le serveur.');
      }
    } catch {
      setRegisteredInvestors(previous);
      alert('Erreur réseau lors de la suppression de l’investisseur.');
    }
  };

  const handleAdminCreateInvestor = async (data: {
    email: string;
    password: string;
    lastName?: string;
    firstName?: string;
    phone?: string;
    totalInvested?: number;
    sharesCount?: number;
    dividendsEarned?: number;
    shareAllocations?: ShareAllocation[];
  }) => {
    const response = await fetch('/api/admin/investors', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok || !result.success || !result.investor) {
      throw new Error(result.error || 'La création du compte investisseur a échoué.');
    }
    const investor = result.investor;
    setRegisteredInvestors((previous) => [
      {
        id: investor.id,
        name: investor.name,
        firstName: investor.firstName,
        lastName: investor.lastName,
        email: investor.email,
        phone: investor.phone,
        status: investor.status,
        statusReason: investor.statusReason,
        statusUpdatedAt: investor.statusUpdatedAt,
        createdAt: investor.createdAt,
        totalInvested: investor.totalInvested || 0,
        sharesCount: investor.sharesCount || 0,
        dividendsEarned: investor.dividendsEarned || 0,
        hasPasswordConfigured: Boolean(investor.hasPasswordConfigured),
        passwordAlgorithm: investor.passwordAlgorithm,
        passwordUpdatedAt: investor.passwordUpdatedAt,
        shareAllocations: Array.isArray(investor.shareAllocations) ? investor.shareAllocations : undefined
      },
      ...previous.filter((item) => item.id !== investor.id)
    ]);
  };

  const handleAdminUpdateInvestor = async (investorId: string, data: Partial<RegisteredInvestor>) => {
    const response = await fetch(`/api/admin/investors/${encodeURIComponent(investorId)}`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        status: data.status,
        statusReason: data.statusReason,
        totalInvested: data.totalInvested,
        sharesCount: data.sharesCount,
        dividendsEarned: data.dividendsEarned,
        ...(data.shareAllocations !== undefined ? { shareAllocations: data.shareAllocations } : {})
      })
    });
    const result = await response.json();
    if (!response.ok || !result.success || !result.investor) {
      throw new Error(result.error || 'La mise à jour du dossier investisseur a échoué.');
    }
    const investor = result.investor;
    setRegisteredInvestors((previous) => previous.map((item) => item.id === investor.id ? {
      ...item,
      ...investor,
      totalInvested: investor.totalInvested || 0,
      sharesCount: investor.sharesCount || 0,
      dividendsEarned: investor.dividendsEarned || 0,
      hasPasswordConfigured: Boolean(investor.hasPasswordConfigured),
      passwordAlgorithm: investor.passwordAlgorithm,
      passwordUpdatedAt: investor.passwordUpdatedAt,
      shareAllocations: Array.isArray(investor.shareAllocations) ? investor.shareAllocations : undefined
    } : item));
  };

  const handleAdminResetInvestorPassword = async (investorId: string, password: string) => {
    const response = await fetch(`/api/admin/investors/${encodeURIComponent(investorId)}/password`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'La réinitialisation du mot de passe a échoué.');
    }
    if (result.investor) {
      setRegisteredInvestors((previous) =>
        previous.map((item) =>
          item.id === investorId
            ? {
                ...item,
                hasPasswordConfigured: Boolean(result.investor.hasPasswordConfigured),
                passwordAlgorithm: result.investor.passwordAlgorithm,
                passwordUpdatedAt: result.investor.passwordUpdatedAt
              }
            : item
        )
      );
    }
  };

  const handleAdminUpdateInvestorSubscription = async (
    investorId: string,
    subscriptionId: string,
    data: Partial<ShareSubscription>
  ) => {
    const response = await fetch(
      `/api/admin/investors/${encodeURIComponent(investorId)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shares: data.shares,
          sharePrice: data.sharePrice,
          totalAmount: data.totalAmount,
          status: data.status,
          approvedAt: data.approvedAt,
          paidAt: data.paidAt,
          paymentMethod: data.paymentMethod
        })
      }
    );
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'La mise à jour de la souscription a échoué.');
    }
  };

  const handleAdminDeleteSubscription = async (subId: string) => {
    const previous = subscriptions;
    setSubscriptions((prev) => prev.filter((s) => s.id !== subId));
    try {
      const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(subId)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubscriptions(previous);
        alert(data.error || 'Suppression de la souscription refusée.');
      }
    } catch {
      setSubscriptions(previous);
      alert('Erreur réseau lors de la suppression de la souscription.');
    }
  };

  const handleAdminDeleteFundRequest = async (reqId: string) => {
    const previous = fundRequests;
    setFundRequests((prev) => prev.filter((r) => r.id !== reqId));
    try {
      const res = await fetch(`/api/admin/fund-requests/${encodeURIComponent(reqId)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFundRequests(previous);
        alert(data.error || 'Suppression de la demande refusée.');
      }
    } catch {
      setFundRequests(previous);
      alert('Erreur réseau lors de la suppression de la demande.');
    }
  };

  const handleAdminDeleteProject = async (projectId: string) => {
    const previous = projects;
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    try {
      const res = await fetch(`/api/admin/operations/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setProjects(previous);
        alert(data.error || 'Suppression de l’opération refusée.');
      }
    } catch {
      setProjects(previous);
      alert('Erreur réseau lors de la suppression de l’opération.');
    }
  };

  const handleAdminDeleteProfitDistribution = async (distId: string) => {
    const previous = profitDistributions;
    setProfitDistributions((prev) => prev.filter((d) => d.id !== distId));
    try {
      const res = await fetch(`/api/admin/profit-distributions/${encodeURIComponent(distId)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setProfitDistributions(previous);
        alert(data.error || 'Suppression de la distribution refusée.');
      }
    } catch {
      setProfitDistributions(previous);
      alert('Erreur réseau lors de la suppression de la distribution.');
    }
  };

  const handleAdminDeleteInvestorMessage = async (msgId: string) => {
    const previous = investorMessages;
    setInvestorMessages((prev) => prev.filter((m) => m.id !== msgId));
    try {
      const res = await fetch(`/api/admin/messages/${encodeURIComponent(msgId)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setInvestorMessages(previous);
        alert(data.error || 'Suppression du message refusée.');
      }
    } catch {
      setInvestorMessages(previous);
      alert('Erreur réseau lors de la suppression du message.');
    }
  };

  const handleAdminClearInvestorMessages = async () => {
    const previous = investorMessages;
    setInvestorMessages([]);
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setInvestorMessages(previous);
        alert(data.error || 'Suppression du fil de discussion refusée.');
      }
    } catch {
      setInvestorMessages(previous);
      alert('Erreur réseau lors de la suppression des messages.');
    }
  };

  const handleAdminPurgeTestData = (target: 'all' | 'requests' | 'investors' | 'wallets') => {
    if (target === 'requests' || target === 'all') {
      setSubscriptions([]);
      setFundRequests([]);
      setEmails([]);
      setCartItems([]);
      try {
        localStorage.removeItem('electromen_subscriptions');
        localStorage.removeItem('electromen_fund_requests');
        localStorage.removeItem('electromen_emails');
      } catch {}
    }
    if (target === 'investors' || target === 'all') {
      setRegisteredInvestors([]);
      try {
        localStorage.removeItem('electromen_registered_investors');
      } catch {}
    }
    if (target === 'wallets' || target === 'all') {
      setWalletsByEmail({});
      setTransactions([]);
      try {
        localStorage.removeItem('electromen_wallets_by_email');
        localStorage.removeItem('electromen_transactions');
      } catch {}
    }
    if (target === 'all') {
      setProfitDistributions([]);
      setInvestorMessages([]);
      setInvestorActivities([]);
      setInvestorDocuments([]);
      try {
        localStorage.removeItem('electromen_profit_distributions');
        localStorage.removeItem('electromen_investor_messages');
        localStorage.removeItem('electromen_investor_activities');
        localStorage.removeItem('electromen_investor_documents');
      } catch {}
    }
  };

  // Group Management Handlers (Admin can add & delete any group including defaults)
  const persistDomainGroups = (nextGroups: typeof domainGroups) => {
    saveOfflineGroups(nextGroups);
    markCatalogCacheUpdated();
    void fetch(withNoCacheParam('/api/admin/groups'), {
      ...NO_CACHE_FETCH_INIT,
      method: 'PUT',
      headers: {
        ...NO_CACHE_FETCH_INIT.headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ groups: nextGroups })
    }).catch((err) => {
      console.error('Unable to persist groups to PostgreSQL:', err);
    });
  };

  const handleAdminAddGroup = (domain: 'electronique' | 'electrotechnique' | 'informatique', group: CategoryGroup) => {
    setDomainGroups((prev) => {
      const next = {
        ...prev,
        [domain]: [...prev[domain], group]
      };
      persistDomainGroups(next);
      return next;
    });
    handleAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'add_group',
      description: `Ajout du groupe "${group.label}" (ID: ${group.id}) dans le domaine ${domain}`,
      entityType: 'system'
    });
  };

  const handleAdminDeleteGroup = (domain: 'electronique' | 'electrotechnique' | 'informatique', groupId: string) => {
    setDomainGroups((prev) => {
      const next = {
        ...prev,
        [domain]: prev[domain].filter((g) => g.id !== groupId)
      };
      persistDomainGroups(next);
      return next;
    });
    handleAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'delete_group',
      description: `Suppression du groupe ID "${groupId}" dans le domaine ${domain}`,
      entityType: 'system'
    });
  };

  // Audit Logs Deletion Handlers
  const handleAdminDeleteAuditLog = async (logId: string) => {
    const previous = auditLogs;
    setAuditLogs((prev) => prev.filter((l) => l.id !== logId));
    try {
      const res = await fetch(`/api/admin/audit-logs/${encodeURIComponent(logId)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAuditLogs(previous);
        alert(data.error || 'Suppression de la ligne d’audit refusée.');
      }
    } catch {
      setAuditLogs(previous);
      alert('Erreur réseau lors de la suppression de l’audit.');
    }
  };

  const handleAdminClearAuditLogs = async () => {
    const previous = auditLogs;
    setAuditLogs([]);
    try {
      const res = await fetch('/api/admin/audit-logs', {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAuditLogs(previous);
        alert(data.error || 'Suppression du journal d’audit refusée.');
        return;
      }
      try {
        localStorage.removeItem('electromen_audit_logs');
      } catch {}
    } catch {
      setAuditLogs(previous);
      alert('Erreur réseau lors de la purge de l’audit.');
    }
  };

  // Investor Activities & Documents Handlers
  const handleAdminAddActivity = async (act: InvestorActivity) => {
    const previous = investorActivities;
    setInvestorActivities((prev) => [act, ...prev]);
    try {
      const res = await fetch('/api/admin/activities', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(act)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setInvestorActivities(previous);
        alert(data.error || 'Publication de l’activité refusée par le serveur.');
        return;
      }
      if (data.activity) {
        setInvestorActivities((prev) => [data.activity, ...prev.filter((a) => a.id !== act.id && a.id !== data.activity.id)]);
      }
    } catch {
      setInvestorActivities(previous);
      alert('Erreur réseau lors de la publication de l’activité.');
    }
  };

  const handleAdminDeleteActivity = async (actId: string) => {
    const previous = investorActivities;
    setInvestorActivities((prev) => prev.filter((a) => a.id !== actId));
    try {
      const res = await fetch(`/api/admin/activities/${encodeURIComponent(actId)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setInvestorActivities(previous);
        alert(data.error || 'Suppression de l’activité refusée.');
      }
    } catch {
      setInvestorActivities(previous);
      alert('Erreur réseau lors de la suppression de l’activité.');
    }
  };

  const handleAdminAddDocument = async (doc: InvestorDocument) => {
    const previous = investorDocuments;
    setInvestorDocuments((prev) => [doc, ...prev]);
    try {
      const res = await fetch('/api/admin/documents', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setInvestorDocuments(previous);
        alert(data.error || 'Publication du document refusée par le serveur.');
        return;
      }
      if (data.document) {
        setInvestorDocuments((prev) => [data.document, ...prev.filter((d) => d.id !== doc.id && d.id !== data.document.id)]);
      }
    } catch {
      setInvestorDocuments(previous);
      alert('Erreur réseau lors de l’ajout du document.');
    }
  };

  const handleAdminDeleteDocument = async (docId: string) => {
    const previous = investorDocuments;
    setInvestorDocuments((prev) => prev.filter((d) => d.id !== docId));
    try {
      const res = await fetch(`/api/admin/documents/${encodeURIComponent(docId)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setInvestorDocuments(previous);
        alert(data.error || 'Suppression du document refusée.');
      }
    } catch {
      setInvestorDocuments(previous);
      alert('Erreur réseau lors de la suppression du document.');
    }
  };

  // Total Reset Handler (Remise à zéro Totale)
  const handleAdminTotalReset = () => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('electromen_')) {
          localStorage.removeItem(key);
        }
      });
    } catch {}

    setCurrentProfile(null);
    setSubscriptions([]);
    setFundRequests([]);
    setRegisteredInvestors([]);
    setProjects([]);
    setCourses([]);
    setProducts([]);
    setProfitDistributions([]);
    setWalletsByEmail({});
    setTransactions([]);
    setInvestorMessages([]);
    setAuditLogs([]);
    setAppNotifications([]);
    setCartItems([]);
    setEmails([]);
    setInvestorActivities([]);
    setInvestorDocuments([]);
    setDomainGroups({
      electronique: ELECTRONIQUE_GROUPS,
      electrotechnique: ELECTROTECHNIQUE_GROUPS,
      informatique: INFORMATIQUE_GROUPS
    });
  };

  const handleAdminLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('Déconnexion refusée');
      setCurrentAdminRole(null);
      setCurrentAdminName('');
      setCurrentAdminPermissions([]);
      setCurrentTab('accueil');
      window.history.pushState({}, '', '/');
    } catch {
      alert('La déconnexion administrateur n’a pas pu être confirmée. Veuillez réessayer.');
    }
  };

  // Targeted Profit Distribution strictly by Boutique (sector) AND Operation (operationId)
  const handleDistributeProfits = async (
    projectName: string,
    investorsAmount: number,
    notes?: string,
    sector?: BoutiqueSector,
    period?: string,
    companyAmount?: number,
    operationId?: string,
    idempotencyKey?: string
  ): Promise<boolean> => {
    const sec: BoutiqueSector = sector || 'Électronique';
    const per = period || '3ème Trimestre 2026';

    const totalInvestorsShare = Math.round(Number(investorsAmount) || 0);
    const companyShare = Math.round(Number(companyAmount) || 0);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    try {
      const res = await fetch('/api/admin/profits/distribute', {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({
          projectName,
          investorsAmount: totalInvestorsShare,
          companyAmount: companyShare,
          notes,
          sector: sec,
          operationId,
          period: per,
          idempotencyKey
        })
      });
      const serverRes = await res.json();
      if (!res.ok || !serverRes.success) {
        alert(serverRes.error || 'Distribution bloquée par le serveur.');
        return false;
      }

      const recipientIdSet = new Set<string>(
        Array.isArray(serverRes.distribution?.recipientIds) ? serverRes.distribution.recipientIds : []
      );
      const individualAmount = Number(serverRes.individualAmount || 0);
      const eligibleCount = Number(serverRes.eligibleCount || recipientIdSet.size || 0);
      const normalizedDist = serverRes.distribution
        ? normalizeServerDistribution(serverRes.distribution)
        : normalizeServerDistribution({
            id: `dist-${Date.now()}`,
            reference: `DIST-${sec.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`,
            sector: sec,
            operationId,
            operationTitle: projectName,
            projectName,
            period: per,
            totalProfit: totalInvestorsShare + companyShare,
            investorsAmount: totalInvestorsShare,
            companyAmount: companyShare,
            eligibleCount,
            individualAmount,
            notes: notes || 'Distribution directe des dividendes',
            distributedAt: new Date().toLocaleDateString('fr-FR'),
            distributedBy: currentAdminName || 'Admin'
          });

      setProfitDistributions((prev) => [normalizedDist, ...prev.filter((d) => d.id !== normalizedDist.id)]);

      if (recipientIdSet.size > 0 && individualAmount > 0) {
        setWalletsByEmail((prev) => {
          const next = { ...prev };
          registeredInvestors.forEach((inv) => {
            if (!recipientIdSet.has(inv.id)) return;
            const emailKey = inv.email.toLowerCase().trim();
            const existing = next[emailKey] || {
              balance: 0,
              sharesCount: inv.sharesCount || 0,
              dividendsEarned: 0
            };
            next[emailKey] = {
              ...existing,
              balance: existing.balance + individualAmount,
              dividendsEarned: existing.dividendsEarned + individualAmount
            };
          });
          return next;
        });

        setRegisteredInvestors((prev) =>
          prev.map((inv) =>
            recipientIdSet.has(inv.id)
              ? { ...inv, dividendsEarned: (inv.dividendsEarned || 0) + individualAmount }
              : inv
          )
        );
      }

      alert(
        `Distribution des dividendes publiée avec succès !\n\n• Boutique : ${sec}\n• Opération : ${normalizedDist.operationTitle || projectName}\n• Montant alloué aux associés : ${totalInvestorsShare.toLocaleString(
          'fr-FR'
        )} FCFA\n• Part ELECTRO-MEN : ${companyShare.toLocaleString(
          'fr-FR'
        )} FCFA\n• Montant individuel (${eligibleCount} associés éligibles) : ${individualAmount.toLocaleString(
          'fr-FR'
        )} FCFA\n• Période : ${per}`
      );
      return true;
    } catch {
      alert('Erreur réseau lors de la distribution des gains.');
      return false;
    }
  };

  // Secret Admin Authentication Handler (Dual Mode: Email/Password for secondary admins & Master PIN)
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);
    setAdminLoginLoading(true);

    try {
      const payload =
        adminLoginMode === 'credentials'
          ? { email: adminEmailInput.trim(), password: adminPassInput.trim() }
          : { masterPin: adminPinInput.trim() };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const rawText = await res.text().catch(() => '');
      let data: { success?: boolean; user?: any; error?: string } | null = null;
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }
      }
      if (!res.ok || !data?.success || !data?.user) {
        setAdminAuthError(
          data?.error ||
            (res.status >= 500
              ? `Erreur technique serveur (HTTP ${res.status}). Vérifiez /api/health et les logs Vercel (DATABASE_URL).`
              : res.status === 404
                ? 'Route d’authentification introuvable (HTTP 404). Vérifiez le routage Vercel (/api/auth/login).'
                : 'Identifiants administrateur incorrects.')
        );
        return;
      }
      setCurrentAdminRole(data.user.role);
      setCurrentAdminName(data.user.name);
      setCurrentAdminPermissions(resolveAdminPermissions(data.user.role, data.user.permissions));
      setIsAdminAuthModalOpen(false);
      setAdminPassInput('');
      setAdminPinInput('');
      setCurrentTab('admin');
      const targetUrl = window.location.pathname === '/electromenG' ? '/electromenG' : adminCustomUrl;
      window.history.pushState({}, '', targetUrl);
    } catch {
      setAdminAuthError('Impossible de joindre l’API d’authentification (/api/auth/login). Vérifiez votre connexion réseau ou /api/health.');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  const handleInitialAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);
    const cleanEmail = adminEmailInput.trim().toLowerCase();
    const cleanPass = adminPassInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAdminAuthError('Veuillez saisir une adresse email administrateur valide.');
      return;
    }
    if (cleanPass.length < 8 || cleanPass.length > 128) {
      setAdminAuthError('Le mot de passe administrateur doit comporter entre 8 et 128 caractères.');
      return;
    }
    if (cleanPass !== adminSetupConfirmPass.trim()) {
      setAdminAuthError('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    setAdminLoginLoading(true);
    try {
      const res = await fetch('/api/auth/setup-admin', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass })
      });
      const rawText = await res.text().catch(() => '');
      let data: { success?: boolean; user?: any; error?: string } | null = null;
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }
      }
      if (!res.ok || !data?.success || !data?.user) {
        if (res.status === 403) {
          setNeedsAdminSetup(false);
        }
        setAdminAuthError(
          data?.error ||
            (res.status >= 500
              ? `Erreur technique serveur (HTTP ${res.status}). Vérifiez /api/health et les logs Vercel.`
              : 'La configuration du compte administrateur a échoué.')
        );
        return;
      }
      setNeedsAdminSetup(false);
      setCurrentAdminRole(data.user.role);
      setCurrentAdminName(data.user.name);
      setCurrentAdminPermissions(resolveAdminPermissions(data.user.role, data.user.permissions));
      setIsAdminAuthModalOpen(false);
      setAdminPassInput('');
      setAdminSetupConfirmPass('');
      setCurrentTab('admin');
      const targetUrl = window.location.pathname === '/electromenG' ? '/electromenG' : adminCustomUrl;
      window.history.pushState({}, '', targetUrl);
    } catch {
      setAdminAuthError('Impossible de joindre l’API d’authentification (/api/auth/setup-admin). Vérifiez votre connexion réseau ou /api/health.');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  return (
    <div className="bg-white text-slate-900 min-h-screen font-jakarta selection:bg-[#d4af37] selection:text-slate-950 relative pb-24">
      {/* Top Header & Ticker */}
      <Header
        currentTab={currentTab}
        cartCount={cartCount}
        emailsCount={personalEmails.length}
        notificationsCount={unreadNotificationsCount}
        isAdminMode={currentTab === 'admin'}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenEmails={() => setIsEmailsOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenWallet={() => {
          setWalletDefaultAction('depot');
          setIsWalletOpen(true);
        }}
        onOpenAccount={() => setCurrentTab('profil')}
        onGoTab={(tab) => setCurrentTab(tab)}
        onExitAdmin={handleAdminLogout}
        searchQuery={marketplaceSearchQuery}
        onSearchChange={setMarketplaceSearchQuery}
      />

      {/* Main Content Viewport */}
      {isMaintenanceMode && currentTab !== 'admin' ? (
        <main className="max-w-xl mx-auto px-4 py-20 text-center space-y-6 animate-fadeIn">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-900 border-2 border-amber-400 p-2 flex items-center justify-center shadow-2xl">
            <img
              src="/assets/aistudio/Image_1_397aca35.jpeg"
              alt="ELECTRO-MEN"
              className="w-full h-full object-contain rounded-xl"
            />
          </div>

          <div className="space-y-3">
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold uppercase tracking-wider">
              Opérations Techniques en Cours
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-syne">
              Plateforme en Maintenance Technique
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              Notre portail procède actuellement à des opérations d'inventaire et de maintenance périodique afin de garantir une fiabilité maximale de nos services.
            </p>
            <p className="text-xs text-slate-500">
              Les accès aux catalogues et aux transactions reprendront très prochainement. Merci de votre patience et de votre confiance.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-mono">
            <span>ELECTRO-MEN • Pôle Industriel Ouagadougou</span>
          </div>
        </main>
      ) : (
        <main className={
          currentTab === 'accueil' ||
          currentTab === 'boutique_electronique' ||
          currentTab === 'composants' ||
          currentTab === 'boutique_electrotechnique' ||
          currentTab === 'boutique_informatique'
            ? "max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-2"
            : "max-w-4xl mx-auto px-3 sm:px-4 pt-4"
        }>
          {/* PAGE D'ACCUEIL FLAGSHIP : ÉLECTROTECHNIQUE & ÉLECTRONIQUE */}
          {currentTab === 'accueil' && (
          <ScreenAccueil
            products={products}
            isLoadingProducts={isLoadingProducts}
            productsLoadError={productsLoadError}
            onRetryLoadProducts={handleManualCatalogRefresh}
            courses={courses}
            projects={projects}
            heroVideoUrl={heroVideoUrl}
            onGoTab={(tab) => setCurrentTab(tab)}
            onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
            onOpenSearchModal={() => setIsSearchOpen(true)}
            onSelectProduct={(prod) => setSelectedProduct(prod)}
            onAddToCart={(prod) => handleAddToCart(prod, 1)}
            onOpenVideo={() => setIsVideoOpen(true)}
            onOpenWallet={() => {
              setWalletDefaultAction('depot');
              setIsWalletOpen(true);
            }}
            onUpdateProduct={handleAdminUpdateProduct}
            searchQuery={marketplaceSearchQuery}
            onSearchChange={setMarketplaceSearchQuery}
          />
        )}

        {/* PAGE DES BOUTIQUES : UNIQUEMENT LES CARTES CLIQUABLES DIRIGEANT VERS LA BOUTIQUE CORRESPONDANTE */}
        {currentTab === 'boutiques' && (
          <BoutiquesDirectory
            boutiques={marketplaceBoutiques}
            onSelectBoutique={(tabId) => setCurrentTab(tabId as TabType)}
            onRefresh={handleManualCatalogRefresh}
            isRefreshing={isLoadingProducts}
            isAdmin={false}
          />
        )}

        {/* BOUTIQUE 1 : COMPOSANTS ÉLECTRONIQUES */}
        {(currentTab === 'boutique_electronique' || currentTab === 'composants') && (() => {
          const shopMeta = marketplaceBoutiques.find((b) => b.category === 'electronique');
          return (
            <ScreenBoutiqueElectronique
              products={products}
              isLoadingProducts={isLoadingProducts}
              productsLoadError={productsLoadError}
              onRetryLoadProducts={handleManualCatalogRefresh}
              cartCount={cartCount}
              logoUrl={shopMeta?.logoUrl}
              locationLabel={shopMeta?.location}
              flag={shopMeta?.flag}
              country={shopMeta?.country}
              defaultCustomerName={currentProfile?.name}
              defaultCustomerPhone={currentProfile?.phone}
              defaultCustomerEmail={currentProfile?.email}
              groups={domainGroups.electronique}
              onAddToCart={(prod) => handleAddToCart(prod, 1)}
              onSelectProduct={(prod) => setSelectedProduct(prod)}
              onOpenCart={() => setIsCartOpen(true)}
              onGoTab={(tab) => setCurrentTab(tab)}
            />
          );
        })()}

        {/* BOUTIQUE 2 : COMPOSANTS ÉLECTROTECHNIQUES & PUISSANCE */}
        {currentTab === 'boutique_electrotechnique' && (() => {
          const shopMeta = marketplaceBoutiques.find((b) => b.category === 'electrotechnique');
          return (
            <ScreenBoutiqueElectrotechnique
              products={products}
              isLoadingProducts={isLoadingProducts}
              productsLoadError={productsLoadError}
              onRetryLoadProducts={handleManualCatalogRefresh}
              cartCount={cartCount}
              logoUrl={shopMeta?.logoUrl}
              locationLabel={shopMeta?.location}
              flag={shopMeta?.flag}
              country={shopMeta?.country}
              defaultCustomerName={currentProfile?.name}
              defaultCustomerPhone={currentProfile?.phone}
              defaultCustomerEmail={currentProfile?.email}
              groups={domainGroups.electrotechnique}
              onAddToCart={(prod) => handleAddToCart(prod, 1)}
              onSelectProduct={(prod) => setSelectedProduct(prod)}
              onOpenCart={() => setIsCartOpen(true)}
              onGoTab={(tab) => setCurrentTab(tab)}
            />
          );
        })()}

        {/* BOUTIQUE 3 : ÉQUIPEMENTS INFORMATIQUES */}
        {currentTab === 'boutique_informatique' && (() => {
          const shopMeta = marketplaceBoutiques.find((b) => b.category === 'informatique');
          return (
            <ScreenBoutiqueInformatique
              products={products}
              isLoadingProducts={isLoadingProducts}
              productsLoadError={productsLoadError}
              onRetryLoadProducts={handleManualCatalogRefresh}
              cartCount={cartCount}
              logoUrl={shopMeta?.logoUrl}
              locationLabel={shopMeta?.location}
              flag={shopMeta?.flag}
              country={shopMeta?.country}
              defaultCustomerName={currentProfile?.name}
              defaultCustomerPhone={currentProfile?.phone}
              defaultCustomerEmail={currentProfile?.email}
              groups={domainGroups.informatique}
              onAddToCart={(prod) => handleAddToCart(prod, 1)}
              onSelectProduct={(prod) => setSelectedProduct(prod)}
              onOpenCart={() => setIsCartOpen(true)}
              onGoTab={(tab) => setCurrentTab(tab)}
            />
          );
        })()}

        {/* PAGE 2 : SOLUTIONS & ACADÉMIE (3 SECTIONS : ÉLECTRONIQUE, ÉLECTROTECH, INFORMATIQUE) */}
        {currentTab === 'solutions' && (
          <ScreenSolutions
            courses={courses}
            formationsVideoUrl={formationsVideoUrl}
            onOpenVideo={handleOpenVideoModal}
            onOpenPdf={() => setIsPdfOpen(true)}
            onOpenCertificate={() => setIsCertOpen(true)}
            onAddToCart={(prod) => handleAddToCart(prod, 1)}
            onSelectCourse={handleSelectCourse}
          />
        )}

        {/* PAGE 3 : BOURSE IR & ACTIONNARIAT (ESPACE INVESTISSEURS) */}
        {currentTab === 'bourse' && (
          <ScreenBourseIR
            currentProfile={currentProfile}
            onInvestorSessionChange={setCurrentProfile}
            onOpenPdfContract={handleOpenPdfContract}
            onGoTab={(tab) => setCurrentTab(tab)}
            onRequestSubscription={handleRequestSubscription}
            onOpenPayment={handleOpenPayment}
            onOpenWallet={(action = 'depot') => {
              setWalletDefaultAction(action);
              setIsWalletOpen(true);
            }}
            onOpenEmailInbox={() => setIsEmailsOpen(true)}
            messages={investorMessages}
            onSendMessage={handleSendInvestorMessage}
            isMessagingOpen={isInvestorChatOpen}
            projects={projects}
            activities={investorActivities}
            documents={investorDocuments}
          />
        )}

        {/* PAGE 4 : PROFIL PERSONNEL ET CONFIDENTIEL */}
        {currentTab === 'profil' && (() => {
          const matchedAdminInvestor = currentProfile
            ? registeredInvestors.find(
                (inv) =>
                  inv.id === currentProfile.id ||
                  inv.email.trim().toLowerCase() === currentProfile.email.trim().toLowerCase()
              )
            : undefined;
          const resolvedTotalInvested =
            investorPortfolio?.totalInvested ?? matchedAdminInvestor?.totalInvested ?? 0;
          const resolvedAllocations =
            investorPortfolio?.shareAllocations ?? matchedAdminInvestor?.shareAllocations ?? [];
          const resolvedWallet = {
            ...currentWallet,
            sharesCount:
              investorPortfolio?.sharesCount ??
              matchedAdminInvestor?.sharesCount ??
              currentWallet.sharesCount,
            dividendsEarned:
              investorPortfolio?.dividendsEarned ??
              matchedAdminInvestor?.dividendsEarned ??
              currentWallet.dividendsEarned
          };
          return (
            <ScreenProfil
              currentProfile={currentProfile}
              onUpdateProfile={handleUpdateProfile}
              wallet={resolvedWallet}
              totalInvested={resolvedTotalInvested}
              shareAllocations={resolvedAllocations}
              projects={projects}
              profitDistributions={profitDistributions}
              onOpenWallet={(action = 'depot') => {
                setWalletDefaultAction(action);
                setIsWalletOpen(true);
              }}
              onOpenCertificate={() => setIsCertOpen(true)}
              onOpenPdf={() => setIsPdfOpen(true)}
              onOpenVideo={() => setIsVideoOpen(true)}
              onGoTab={(tab) => setCurrentTab(tab)}
              onLogout={() => setCurrentTab('bourse')}
            />
          );
        })()}

        {/* PAGE ADMINISTRATEUR DANS UN FICHIER DISTINCT : ADMINPAGE */}
        {currentTab === 'admin' && currentAdminRole && (
          <AdminPage
            currentAdminRole={currentAdminRole}
            currentAdminName={currentAdminName}
            currentAdminPermissions={currentAdminPermissions}
            adminCustomUrl={adminCustomUrl}
            onChangeAdminCustomUrl={async (newUrl) => {
              const response = await fetch('/api/admin/change-url', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newUrl })
              });
              const result = await response.json();
              if (!response.ok || !result.success) {
                throw new Error(result.error || "La mise à jour de l'URL a échoué.");
              }
              setAdminCustomUrl(newUrl);
              window.history.replaceState(null, '', newUrl);
            }}
            onChangeAdminMasterPassword={async (newPassword) => {
              const response = await fetch('/api/admin/change-master-password', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword })
              });
              const result = await response.json();
              if (!response.ok || !result.success) throw new Error(result.error || 'La mise à jour du code maître a échoué.');
            }}
            siteBaseUrl={siteBaseUrl}
            onChangeSiteBaseUrl={(newBaseUrl) => {
              setSiteBaseUrl(newBaseUrl);
            }}
            heroVideoUrl={heroVideoUrl}
            onChangeHeroVideoUrl={setHeroVideoUrl}
            formationsVideoUrl={formationsVideoUrl}
            onChangeFormationsVideoUrl={setFormationsVideoUrl}
            products={products}
            isLoadingProducts={isLoadingProducts}
            onRefreshProducts={handleManualCatalogRefresh}
            onUpdateProduct={handleAdminUpdateProduct}
            onAddProduct={handleAdminAddProduct}
            onDeleteProduct={handleAdminDeleteProduct}
            onImportProducts={handleAdminImportProducts}
            onOptimizeImages={handleAdminOptimizeImages}
            courses={courses}
            onUpdateCourse={handleAdminUpdateCourse}
            onAddCourse={handleAdminAddCourse}
            onDeleteCourse={handleAdminDeleteCourse}
            subscriptions={subscriptions}
            onApproveSubscription={handleAdminApproveSubscription}
            onForceValidateSubscription={handleAdminForceValidateSubscription}
            onRejectSubscription={handleAdminRejectSubscription}
            projects={projects}
            onUpdateProject={handleAdminUpdateProject}
            onAddProject={handleAdminAddProject}
            registeredInvestors={registeredInvestors}
            onUpdateInvestorStatus={handleAdminUpdateInvestorStatus}
            walletsByEmail={walletsByEmail}
            onAdjustWallet={handleAdminAdjustWallet}
            transactions={transactions}
            emails={emails}
            customOrders={customOrders}
            onUpdateCustomOrderStatus={handleUpdateCustomOrderStatus}
            onDeleteCustomOrder={handleDeleteCustomOrder}
            appNotifications={appNotifications}
            onAddNotification={handleAddNotification}
            isInvestorChatOpen={isInvestorChatOpen}
            onToggleInvestorChat={handleToggleInvestorChat}
            investorMessages={investorMessages}
            onSendAdminMessage={handleSendAdminMessage}
            auditLogs={auditLogs}
            onAddAuditLog={handleAddAuditLog}
            onRevertAuditAction={handleRevertAuditAction}
            onRelaunchAuditAction={handleRelaunchAuditAction}
            isMaintenanceMode={isMaintenanceMode}
            onToggleMaintenanceMode={handleToggleMaintenanceMode}
            onDistributeProfits={handleDistributeProfits}
            customGroups={customGroups}
            onAddCustomGroup={handleAddCustomGroup}
            domainGroups={domainGroups}
            onAddGroup={handleAdminAddGroup}
            onDeleteGroup={handleAdminDeleteGroup}
            onDeleteAuditLog={handleAdminDeleteAuditLog}
            onClearAuditLogs={handleAdminClearAuditLogs}
            onTotalReset={handleAdminTotalReset}
            investorActivities={investorActivities}
            onAddInvestorActivity={handleAdminAddActivity}
            onDeleteInvestorActivity={handleAdminDeleteActivity}
            investorDocuments={investorDocuments}
            onAddInvestorDocument={handleAdminAddDocument}
            onDeleteInvestorDocument={handleAdminDeleteDocument}
            fundRequests={fundRequests}
            onConfirmFundRequest={handleConfirmFundRequest}
            onRejectFundRequest={handleRejectFundRequest}
            onSetFundRequestProcessing={handleSetFundRequestProcessing}
            profitDistributions={profitDistributions}
            onDeleteInvestor={handleAdminDeleteInvestor}
            onCreateInvestor={handleAdminCreateInvestor}
            onUpdateInvestor={handleAdminUpdateInvestor}
            onResetInvestorPassword={handleAdminResetInvestorPassword}
            onUpdateInvestorSubscription={handleAdminUpdateInvestorSubscription}
            onDeleteSubscription={handleAdminDeleteSubscription}
            onDeleteFundRequest={handleAdminDeleteFundRequest}
            onDeleteProject={handleAdminDeleteProject}
            onDeleteProfitDistribution={handleAdminDeleteProfitDistribution}
            onDeleteInvestorMessage={handleAdminDeleteInvestorMessage}
            onClearInvestorMessages={handleAdminClearInvestorMessages}
            onPurgeTestData={handleAdminPurgeTestData}
            marketplaceBoutiques={marketplaceBoutiques}
            onUpdateBoutiqueFlag={handleUpdateBoutiqueFlag}
            onUpdateBoutiqueLogo={handleUpdateBoutiqueLogo}
            onExitAdmin={handleAdminLogout}
          />
        )}

        {/* FOOTER PUBLIC ENTIÈREMENT DÉNUÉ DE TOUT INDICE ADMINISTRATEUR */}
        <footer className="mt-12 pt-6 border-t border-slate-200 text-center space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
            <span>© 2026 ELECTRO-MEN • Écosystème Industriel &amp; Finance Panafricaine</span>
            <span>•</span>
            <span>Ouagadougou, Burkina Faso</span>
          </div>

          {currentTab === 'admin' && (
            <div className="pt-2 flex items-center justify-center">
              <button
                type="button"
                onClick={handleAdminLogout}
                className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded transition-colors"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Quitter l'Admin et revenir à la Vue Publique</span>
              </button>
            </div>
          )}
        </footer>
      </main>
      )}

      {/* Bottom Sticky Navigation for Users (Hidden during Maintenance for normal users) */}
      {(!isMaintenanceMode || currentTab === 'admin') && (
        <Navigation currentTab={currentTab} onChangeTab={setCurrentTab} />
      )}

      {/* Slide-in & Modal Dialogs */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        activeCatalog={
          currentTab === 'boutique_informatique'
            ? 'informatique'
            : currentTab === 'boutique_electrotechnique'
            ? 'electrotechnique'
            : currentTab === 'boutique_electronique'
            ? 'electronique'
            : 'global'
        }
        clientDefaultName={currentProfile?.name || ''}
        clientDefaultPhone={currentProfile?.phone || ''}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
      />

      <CreateAccountModal
        isOpen={isCreateAccountOpen}
        onClose={() => setIsCreateAccountOpen(false)}
        onAccountCreated={(newProfile) => {
          setCurrentProfile(newProfile);
          setIsCreateAccountOpen(false);
        }}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        products={products}
        courses={courses}
        onSelectProduct={(prod) => setSelectedProduct(prod)}
        onSelectCourse={handleSelectCourse}
        onSelectProject={handleSelectProject}
        onNavigateToShop={(domain) => {
          setIsSearchOpen(false);
          setCurrentTab(domain === 'electrotechnique' ? 'boutique_electrotechnique' : 'boutique_electronique');
        }}
      />


      <VideoPlayerModal
        isOpen={isVideoOpen}
        onClose={() => setIsVideoOpen(false)}
        onOpenPdf={() => setIsPdfOpen(true)}
        videoUrl={activeVideoModal.videoUrl}
        courseTitle={activeVideoModal.courseTitle}
        moduleTitle={activeVideoModal.moduleTitle}
        duration={activeVideoModal.duration}
        syllabus={activeVideoModal.syllabus}
        pdfUrl={activeVideoModal.pdfUrl}
      />

      <DatasheetModal isOpen={isPdfOpen} onClose={() => setIsPdfOpen(false)} />

      <CertificateModal
        isOpen={isCertOpen}
        onClose={() => setIsCertOpen(false)}
        investorName={currentProfile?.name || 'Investisseur ELECTRO-MEN'}
      />

      {/* Legal Contract Personalized to current investor */}
      <ContractModal
        isOpen={isContractOpen}
        onClose={() => setIsContractOpen(false)}
        investorData={{
          name: currentProfile?.name || '',
          email: currentProfile?.email || '',
          phone: currentProfile?.phone || '',
          shares: currentWallet.sharesCount || 4,
          total: subscriptions
            .filter((subscription) => subscription.investorEmail.toLowerCase() === (currentProfile?.email || '').toLowerCase())
            .reduce((total, subscription) => total + subscription.totalAmount, 0),
          id: currentProfile?.id || ''
        }}
      />

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
        onOpenPdf={() => {
          setSelectedProduct(null);
          setIsPdfOpen(true);
        }}
      />

      {/* Investor Cash Wallet: Deposit & Withdrawal (Strictly Personal) */}
      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        wallet={currentWallet}
        transactions={transactions}
        fundRequests={fundRequests}
        projects={projects}
        onSubmitFundRequest={handleSubmitFundRequest}
        defaultAction={walletDefaultAction}
        investorName={currentProfile?.name || ''}
        investorPhone={currentProfile?.phone || ''}
        investorEmail={currentProfile?.email || ''}
        investorId={currentProfile?.id || ''}
      />

      {/* Share Subscription Password Verification & Payment Modal */}
      <SharePaymentModal
        isOpen={isPaymentOpen}
        onClose={() => {
          setIsPaymentOpen(false);
          setActivePaymentSubId(null);
        }}
        subscription={subscriptions.find((s) => s.id === activePaymentSubId) || null}
        wallet={currentWallet}
        onExecutePayment={handleExecutePayment}
        onOpenEmailInbox={() => {
          setIsPaymentOpen(false);
          setIsEmailsOpen(true);
        }}
      />

      {/* Simulated Email Inbox for Password Credentials - Personal to Current Investor */}
      <EmailViewerModal
        isOpen={isEmailsOpen}
        onClose={() => setIsEmailsOpen(false)}
        emails={personalEmails}
        currentInvestorEmail={currentProfile?.email || ''}
        onOpenPaymentForSubscription={(subId) => {
          setIsEmailsOpen(false);
          handleOpenPayment(subId);
        }}
      />

      {/* ÉCRAN DE MAINTENANCE TECHNIQUE (SI ACTIVÉ PAR L'ADMINISTRATEUR) */}
      {isMaintenanceMode && currentTab !== 'admin' && (
        <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
          <div className="max-w-md w-full bg-slate-950 p-6 sm:p-8 rounded-3xl border-2 border-amber-500 shadow-2xl space-y-5">
            <div
              className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center border border-amber-400/40 shadow-inner select-none cursor-default"
              onDoubleClick={() => setIsAdminAuthModalOpen(true)}
              title=""
            >
              <span className="material-symbols-outlined text-4xl animate-spin">build</span>
            </div>

            <div className="space-y-2 select-none">
              <h1
                className="font-syne text-2xl font-black uppercase text-white tracking-wide cursor-default"
                onDoubleClick={() => setIsAdminAuthModalOpen(true)}
              >
                ELECTRO-MEN
              </h1>
              <div className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs uppercase tracking-wider border border-amber-400/30">
                Site en Maintenance Technique
              </div>
              <p className="text-xs text-slate-300 pt-2 leading-relaxed">
                Notre plateforme est momentanément en veille pour des travaux d'optimisation et de calibrage des systèmes industriels.
                Nous serons de retour très prochainement.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2 text-xs">
              <div className="text-[11px] font-bold text-amber-400 uppercase">
                Lignes Directes d'Assistance :
              </div>
              <div className="flex items-center justify-between text-slate-200">
                <span>Siège Social :</span>
                <span className="font-bold">Ouagadougou, Burkina Faso</span>
              </div>
              <div className="flex items-center justify-between text-slate-200">
                <span>Composants Électroniques :</span>
                <span className="font-bold text-[#25D366]">+226 65 48 47 38</span>
              </div>
              <div className="flex items-center justify-between text-slate-200">
                <span>Électrotechnique &amp; Puissance :</span>
                <span className="font-bold text-[#25D366]">+226 07 31 57 34</span>
              </div>
            </div>

            <a
              href="https://wa.me/22665484738?text=Bonjour%20ELECTRO-MEN%2C%20je%20souhaite%20contacter%20le%20service%20technique%20pendant%20la%20maintenance."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              <span>Contacter la Direction sur WhatsApp</span>
            </a>
          </div>
        </div>
      )}

      {/* MODAL AUTHENTIFICATION ADMINISTRATEUR MULTI-UTILISATEURS */}
      {isAdminAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white border-2 border-red-500 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-red-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-xl">admin_panel_settings</span>
                <h3 className="font-syne text-[15px] font-bold text-red-600 uppercase">
                  Accès Console Administrateur
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAdminAuthModalOpen(false);
                  setAdminAuthError(null);
                }}
                className="w-7 h-7 rounded bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Console sécurisée réservée au propriétaire et aux collaborateurs administrateurs autorisés.
            </p>

            {needsAdminSetup ? (
              <form onSubmit={handleInitialAdminSetup} className="space-y-3 text-xs">
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium">
                  Aucun compte Super-Administrateur n’est encore configuré sur ce serveur. Définissez votre accès principal ci-dessous (verrouillé après création).
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-700 font-bold block">
                    Email du Super-Administrateur :
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="votre-email@exemple.com"
                    value={adminEmailInput}
                    onChange={(e) => setAdminEmailInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:border-red-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-700 font-bold block">
                    Mot de Passe Super-Administrateur (8 car. min.) :
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      maxLength={128}
                      placeholder="Choisissez un mot de passe solide..."
                      value={adminPassInput}
                      onChange={(e) => setAdminPassInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 pr-10 text-xs text-slate-900 focus:border-red-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword((visible) => !visible)}
                      aria-label={showAdminPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      aria-pressed={showAdminPassword}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-800"
                    >
                      <span className="material-symbols-outlined text-base">
                        {showAdminPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-700 font-bold block">
                    Confirmer le Mot de Passe :
                  </label>
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    maxLength={128}
                    placeholder="Confirmez le mot de passe..."
                    value={adminSetupConfirmPass}
                    onChange={(e) => setAdminSetupConfirmPass(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:border-red-500 outline-none"
                  />
                </div>

                {adminAuthError && (
                  <div className="p-2 rounded bg-red-50 border border-red-300 text-red-700 text-[11px] text-center font-semibold animate-shake">
                    {adminAuthError}
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminAuthModalOpen(false);
                      setAdminAuthError(null);
                    }}
                    className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-200"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={adminLoginLoading}
                    className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                    <span>{adminLoginLoading ? 'Enregistrement...' : 'Activer Console'}</span>
                  </button>
                </div>
              </form>
            ) : (
            <>
            {/* Onglets de Connexion */}
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold gap-1">
              <button
                type="button"
                onClick={() => {
                  setAdminLoginMode('credentials');
                  setAdminAuthError(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-center transition-colors cursor-pointer ${
                  adminLoginMode === 'credentials'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Identifiants Administrateur
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminLoginMode('pin');
                  setAdminAuthError(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-center transition-colors cursor-pointer ${
                  adminLoginMode === 'pin'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Code Maître
              </button>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-3 text-xs">
              {adminLoginMode === 'credentials' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-700 font-bold block">
                      Adresse Email Administrateur :
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="email-administrateur@exemple.com"
                      value={adminEmailInput}
                      onChange={(e) => setAdminEmailInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:border-red-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-700 font-bold block">
                      Mot de Passe Personnel Administrateur :
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        required
                        placeholder="Votre mot de passe confidentiel..."
                        value={adminPassInput}
                        onChange={(e) => setAdminPassInput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 pr-10 text-xs text-slate-900 focus:border-red-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword((visible) => !visible)}
                        aria-label={showAdminPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        aria-pressed={showAdminPassword}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-800"
                      >
                        <span className="material-symbols-outlined text-base">
                          {showAdminPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <label className="text-[11px] text-[#b48c1e] font-bold uppercase block">
                    Code Secret Super-Administrateur :
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminPin ? 'text' : 'password'}
                      autoFocus
                      required
                      placeholder="Code maître secret..."
                      value={adminPinInput}
                      onChange={(e) => setAdminPinInput(e.target.value)}
                      className="w-full bg-slate-50 border border-red-300 rounded-lg p-2.5 px-10 text-center font-mono text-base tracking-widest text-slate-900 focus:border-red-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPin((visible) => !visible)}
                      aria-label={showAdminPin ? 'Masquer le code maître' : 'Afficher le code maître'}
                      aria-pressed={showAdminPin}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-800"
                    >
                      <span className="material-symbols-outlined text-base">
                        {showAdminPin ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {adminAuthError && (
                <div className="p-2 rounded bg-red-50 border border-red-300 text-red-700 text-[11px] text-center font-semibold animate-shake">
                  {adminAuthError}
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminAuthModalOpen(false);
                    setAdminAuthError(null);
                  }}
                  className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={adminLoginLoading}
                  className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">lock_open</span>
                  <span>{adminLoginLoading ? 'Vérification...' : 'Débloquer Console'}</span>
                </button>
              </div>
            </form>
            </>
            )}
          </div>
        </div>
      )}

      {/* Notification Center Modal (WhatsApp-style) */}
      <NotificationCenterModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={appNotifications}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onSelectNotification={(notif) => {
          setIsNotificationsOpen(false);
          if (notif.actionTab) {
            setCurrentTab(notif.actionTab as TabType);
          }
          if (notif.actionProductId) {
            const found = products.find((p) => p.id === notif.actionProductId);
            if (found) setSelectedProduct(found);
          }
        }}
      />
      <OfflineIndicator
        isUsingOfflineData={isUsingOfflineData}
        onRetrySync={handleManualCatalogRefresh}
      />
    </div>
  );
}
