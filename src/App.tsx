import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { Navigation, TabType } from './components/Navigation.tsx';
import { ScreenAccueil } from './components/ScreenAccueil.tsx';
import { ScreenBoutiqueElectronique } from './components/ScreenBoutiqueElectronique.tsx';
import { ScreenBoutiqueElectrotechnique } from './components/ScreenBoutiqueElectrotechnique.tsx';
import { ScreenBoutiqueInformatique } from './components/ScreenBoutiqueInformatique.tsx';
import { ScreenComposants } from './components/ScreenComposants.tsx';
import { ScreenSolutions } from './components/ScreenSolutions.tsx';
import { ScreenBourseIR, RegisteredInvestor, InvestorMessage } from './components/ScreenBourseIR.tsx';
import { ScreenProfil } from './components/ScreenProfil.tsx';
import { ScreenAdmin } from './components/ScreenAdmin.tsx';
import { AdminPage, AdminRole, AuditAction } from './components/AdminPage.tsx';
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
import {
  PROJECTS,
  DELIVERY_ZONES,
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
  DeliveryZone,
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

const DEFAULT_PROFILE: InvestorProfile = {
  id: '#EM-INV-4541',
  name: 'Franck Kaboré',
  email: 'franckkabore454@gmail.com',
  phone: '+226 65 48 47 38',
  city: 'Ouagadougou',
  isVerified: true,
  registeredDate: '21 Octobre 2026'
};

export default function App() {
  // Flagship Accueil is the default landing tab
  const [currentTab, setCurrentTab] = useState<TabType>('accueil');
  const [currentAdminRole, setCurrentAdminRole] = useState<AdminRole | null>(null);
  const [currentAdminName, setCurrentAdminName] = useState<string>('');

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

  // Catalog Products state with Admin mutability (empty by default; controlled entirely by administrator)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_products');
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
    try {
      localStorage.setItem('electromen_products', JSON.stringify(products));
    } catch {
      // ignore
    }
  }, [products]);

  // Courses state with Admin mutability (empty by default; controlled entirely by administrator)
  const [courses, setCourses] = useState<Course[]>(() => {
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
    try {
      localStorage.setItem('electromen_courses', JSON.stringify(courses));
    } catch {
      // ignore
    }
  }, [courses]);

  // Investment Projects state with Admin mutability
  const [projects, setProjects] = useState<InvestmentProject[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_projects');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return PROJECTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_projects', JSON.stringify(projects));
    } catch {
      // ignore
    }
  }, [projects]);

  // Marketplace Boutiques state with Admin mutability for Flags and details
  const [marketplaceBoutiques, setMarketplaceBoutiques] = useState<MarketplaceBoutique[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_marketplace_boutiques');
      if (saved) {
        const parsed: MarketplaceBoutique[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((b) => ({
            ...b,
            name: b.name.replace(/^ELECTRO-MEN\s*/i, '').trim()
          }));
        }
      }
    } catch {
      // fallback
    }
    return MARKETPLACE_BOUTIQUES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_marketplace_boutiques', JSON.stringify(marketplaceBoutiques));
    } catch {
      // ignore
    }
  }, [marketplaceBoutiques]);

  const handleUpdateBoutiqueFlag = (boutiqueId: string, newFlag: string, countryName?: string) => {
    setMarketplaceBoutiques((prev) =>
      prev.map((b) =>
        b.id === boutiqueId
          ? { ...b, flag: newFlag, country: countryName || b.country }
          : b
      )
    );
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

  // Delivery Zones state
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_delivery_zones');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DELIVERY_ZONES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_delivery_zones', JSON.stringify(deliveryZones));
    } catch {
      // ignore
    }
  }, [deliveryZones]);

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

  const handleSendInvestorMessage = (text: string, senderName: string, isOfficial = false) => {
    const newMsg: InvestorMessage = {
      id: `msg-${Date.now()}`,
      senderName,
      text,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      isOfficial
    };
    setInvestorMessages((prev) => [...prev, newMsg]);
  };

  const handleSendAdminMessage = (text: string) => {
    handleSendInvestorMessage(text, 'Direction Générale (Admin)', true);
  };

  // Deep Link handling: automatically open product if ?prod=<id> is in query string
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const prodId = params.get('prod');
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

  // Sync custom URL from browser location on mount & route changes
  useEffect(() => {
    const checkPath = () => {
      const currentPath = window.location.pathname;
      const currentHash = window.location.hash;

      const isMatch =
        currentPath === adminCustomUrl ||
        currentHash === `#${adminCustomUrl}` ||
        currentHash === `#${adminCustomUrl}`;

      if (isMatch) {
        setIsAdminAuthModalOpen(true);
      }
    };
    checkPath();
    window.addEventListener('popstate', checkPath);
    window.addEventListener('hashchange', checkPath);
    return () => {
      window.removeEventListener('popstate', checkPath);
      window.removeEventListener('hashchange', checkPath);
    };
  }, [adminCustomUrl]);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/verify', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
      .then(async (response) => {
        const data = await response.json();
        if (!active || !response.ok || !data.valid || !data.user) return;
        setCurrentAdminRole(data.user.role);
        setCurrentAdminName(data.user.name);
        const pathMatchesAdmin = window.location.pathname === adminCustomUrl;
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

    // Immediate ping
    sendHeartbeat();

    // Regular 10s ping
    const interval = setInterval(sendHeartbeat, 10000);

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

  // Real-time synchronization of registered investors with server database
  useEffect(() => {
    let isMounted = true;
    const fetchServerInvestors = async () => {
      try {
        const res = await fetch('/api/admin/investors');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.investors) && isMounted) {
            setRegisteredInvestors((prev) => {
              const serverList = data.investors;
              // Map server fields to RegisteredInvestor format
              const formatted: RegisteredInvestor[] = serverList.map((si: any) => ({
                id: si.id,
                name: si.name || `${si.firstName || ''} ${si.lastName || ''}`.trim(),
                email: si.email,
                phone: si.phone,
                status: si.status || 'en_attente',
                statusReason: si.statusReason,
                statusUpdatedAt: si.statusUpdatedAt,
                createdAt: si.createdAt,
                totalInvested: si.totalInvested || 0,
                sharesCount: si.sharesCount || 0,
                dividendsEarned: si.dividendsEarned || 0
              }));
              return formatted;
            });
          }
        }
      } catch {
        // Fallback to local
      }
    };

    fetchServerInvestors();
    const interval = setInterval(fetchServerInvestors, 3500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

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

    const revertLog: AuditAction = {
      id: `aud-rev-${Date.now()}`,
      author: 'Franck Kaboré (Admin Principal)',
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

    const publishLog: AuditAction = {
      id: `aud-pub-${Date.now()}`,
      author: 'Franck Kaboré (Admin Principal)',
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'relaunch_public',
      description: `Relance et publication publique réussie de : "${targetLog.description}"`,
      entityType: targetLog.entityType,
      targetId: targetLog.targetId,
      newState: stateToApply
    };
    setAuditLogs((prev) => [...prev, publishLog]);
  };

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

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

  // Maintenance Mode (Site en veille)
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('electromen_maintenance_mode') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleMaintenanceMode = (active: boolean) => {
    setIsMaintenanceMode(active);
    try {
      localStorage.setItem('electromen_maintenance_mode', active ? 'true' : 'false');
    } catch {}
    fetch('/api/admin/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isMaintenanceMode: active })
    }).catch(() => {});
  };

  // Custom Product Categories / Families created by Admin
  const [customGroups, setCustomGroups] = useState<Record<string, { id: string; label: string }[]>>(() => {
    try {
      const saved = localStorage.getItem('electromen_custom_groups');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      electronique: [],
      electrotechnique: [],
      informatique: []
    };
  });

  const handleAddCustomGroup = (domain: 'electronique' | 'electrotechnique' | 'informatique', group: { id: string; label: string }) => {
    setCustomGroups((prev) => {
      const next = {
        ...prev,
        [domain]: [...(prev[domain] || []), group]
      };
      try {
        localStorage.setItem('electromen_custom_groups', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Dynamic Domain Groups state with localStorage persistence
  const [domainGroups, setDomainGroups] = useState<{
    electronique: CategoryGroup[];
    electrotechnique: CategoryGroup[];
    informatique: CategoryGroup[];
  }>(() => {
    try {
      const saved = localStorage.getItem('electromen_domain_groups');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      electronique: ELECTRONIQUE_GROUPS,
      electrotechnique: ELECTROTECHNIQUE_GROUPS,
      informatique: INFORMATIQUE_GROUPS
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_domain_groups', JSON.stringify(domainGroups));
    } catch {}
  }, [domainGroups]);

  // Investor Activities & Documents (Empty by default, admin manages)
  const [investorActivities, setInvestorActivities] = useState<InvestorActivity[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_investor_activities');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_INVESTOR_ACTIVITIES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_investor_activities', JSON.stringify(investorActivities));
    } catch {}
  }, [investorActivities]);

  const [investorDocuments, setInvestorDocuments] = useState<InvestorDocument[]>(() => {
    try {
      const saved = localStorage.getItem('electromen_investor_documents');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_INVESTOR_DOCUMENTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('electromen_investor_documents', JSON.stringify(investorDocuments));
    } catch {}
  }, [investorDocuments]);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | undefined;
    let activeRequest: AbortController | null = null;

    const fetchSnapshot = async <T,>(url: string, signal: AbortSignal): Promise<T | null> => {
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal
        });
        if (!response.ok) return null;
        return await response.json() as T;
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error(`Unable to refresh live content from ${url}:`, error);
        }
        return null;
      }
    };

    const refreshContent = async () => {
      activeRequest?.abort();
      const controller = new AbortController();
      activeRequest = controller;

      const operationUrl = currentAdminRole ? '/api/admin/operations' : '/api/operations';
      const [operationData, productData, courseData, activityData, documentData, configData] = await Promise.all([
        fetchSnapshot<{ operations: InvestmentProject[] }>(operationUrl, controller.signal),
        fetchSnapshot<{ products: Product[] }>('/api/products', controller.signal),
        fetchSnapshot<{ courses: Course[] }>('/api/courses', controller.signal),
        fetchSnapshot<{ activities: InvestorActivity[] }>('/api/activities', controller.signal),
        fetchSnapshot<{ documents: InvestorDocument[] }>('/api/documents', controller.signal),
        fetchSnapshot<{
          heroVideoUrl?: string;
          formationsVideoUrl?: string;
          customAdminUrl?: string;
          isMaintenanceMode?: boolean;
        }>('/api/admin/config', controller.signal)
      ]);

      if (!active || controller.signal.aborted) return;
      if (operationData && Array.isArray(operationData.operations)) setProjects(operationData.operations);
      if (productData && Array.isArray(productData.products)) setProducts(productData.products);
      if (courseData && Array.isArray(courseData.courses)) setCourses(courseData.courses);
      if (activityData && Array.isArray(activityData.activities)) setInvestorActivities(activityData.activities);
      if (documentData && Array.isArray(documentData.documents)) setInvestorDocuments(documentData.documents);

      if (configData) {
        if (configData.heroVideoUrl && !configData.heroVideoUrl.includes('BigBuckBunny') && !configData.heroVideoUrl.includes('commondatastorage')) {
          setHeroVideoUrl(configData.heroVideoUrl);
        }
        if (configData.formationsVideoUrl && !configData.formationsVideoUrl.includes('BigBuckBunny') && !configData.formationsVideoUrl.includes('commondatastorage')) {
          setFormationsVideoUrl(configData.formationsVideoUrl);
        }
        if (configData.customAdminUrl) setAdminCustomUrl(configData.customAdminUrl);
        if (typeof configData.isMaintenanceMode === 'boolean') setIsMaintenanceMode(configData.isMaintenanceMode);
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        void refreshContent();
      }, 100);
    };

    const eventSource = new EventSource('/api/events/stream');
    eventSource.addEventListener('DATA_CHANGED', scheduleRefresh);
    eventSource.addEventListener('SYNC_REQUIRED', scheduleRefresh);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void refreshContent();

    return () => {
      active = false;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      activeRequest?.abort();
      eventSource.close();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentAdminRole]);

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

  // Subscriptions Handlers - Creates request for the admin to approve
  const handleRequestSubscription = (data: {
    name: string;
    email: string;
    phone: string;
    shares: number;
    total: number;
  }) => {
    const subId = `#EM-SUB-${Math.floor(1000 + Math.random() * 9000)}`;
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
      shares: data.shares,
      sharePrice: data.shares > 0 ? Math.round(data.total / data.shares) : 0,
      totalAmount: data.total,
      status: 'pending_admin',
      requestedAt: formattedDate
    };

    setSubscriptions((prev) => [newSub, ...prev]);
    return subId;
  };

  // SUPER-ADMIN HANDLERS (TOTAL UNLIMITED CONTROL)
  const handleAdminApproveSubscription = (subId: string, customCode?: string) => {
    const generatedPass = customCode || `ELM-ACT-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let targetSub: ShareSubscription | undefined;

    setSubscriptions((prev) =>
      prev.map((s) => {
        if (s.id === subId) {
          targetSub = s;
          return {
            ...s,
            status: 'approved_pending_payment',
            adminPasswordCode: generatedPass,
            approvedAt: formattedTime
          };
        }
        return s;
      })
    );

    // Dispatch official email containing secret password to the investor's inbox
    setTimeout(() => {
      const emailNotif: EmailNotification = {
        id: `email-${Date.now()}`,
        recipientEmail: targetSub?.investorEmail || currentProfile?.email || 'investisseur@electromen.bf',
        recipientName: targetSub?.investorName || currentProfile?.name || 'Investisseur',
        subject: `ELECTRO-MEN | Accord Accordé pour vos ${targetSub?.shares || 1} Actions (Mot de passe d'accès au paiement)`,
        date: `${now.toLocaleDateString('fr-FR')} ${formattedTime}`,
        code: generatedPass,
        subscriptionId: subId,
        shares: targetSub?.shares || 1,
        amount: targetSub?.totalAmount || 0
      };

      setEmails((prev) => [emailNotif, ...prev]);
    }, 500);
  };

  const handleAdminForceValidateSubscription = (subId: string) => {
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    const sub = subscriptions.find((s) => s.id === subId);
    if (!sub) return;

    // Credit shares to user wallet
    setWalletsByEmail((prev) => {
      const targetEmailKey = sub.investorEmail.toLowerCase().trim();
      const existing = prev[targetEmailKey] || { balance: 0, sharesCount: 0, dividendsEarned: 0 };
      return {
        ...prev,
        [targetEmailKey]: {
          ...existing,
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
              paymentMethod: 'Validation Directe Super-Admin'
            }
          : s
      )
    );

    const tx: WalletTransaction = {
      id: `tx-admin-share-${Date.now()}`,
      type: 'achat_parts',
      amount: sub.totalAmount,
      date: formattedDate,
      method: 'Agrément Direction Générale',
      status: 'completed',
      reference: `ADM-${sub.id.replace('#', '')}`,
      note: `Actions émises par la Direction pour ${sub.investorName}`
    };

    setTransactions((prev) => [tx, ...prev]);
  };

  const handleAdminRejectSubscription = (subId: string) => {
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, status: 'rejected' } : s))
    );
  };

  const handleAdminUpdateProduct = (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    fetch(`/api/admin/products/${encodeURIComponent(updated.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch(() => {});
  };

  const handleAdminAddProduct = (newProd: Product) => {
    setProducts((prev) => [newProd, ...prev]);
    fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProd)
    }).catch(() => {});
  };

  const handleAdminDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }).catch(() => {});
  };

  const handleAdminUpdateCourse = (updated: Course) => {
    setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    fetch(`/api/admin/courses/${encodeURIComponent(updated.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch(() => {});
  };

  const handleAdminAddCourse = (newCourse: Course) => {
    setCourses((prev) => [newCourse, ...prev]);
    fetch('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCourse)
    }).catch(() => {});
  };

  const handleAdminDeleteCourse = (id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
    fetch(`/api/admin/courses/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }).catch(() => {});
  };

  const handleAdminUpdateProject = (updated: InvestmentProject) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    fetch(`/api/admin/operations/${encodeURIComponent(updated.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch(() => {});
  };

  const handleAdminAddProject = (newProj: InvestmentProject) => {
    setProjects((prev) => [newProj, ...prev]);
    fetch('/api/admin/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProj)
    }).catch(() => {});
  };

  const handleAdminAdjustWallet = (email: string, deltaBalance: number, reason: string) => {
    const key = email.toLowerCase().trim();
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    setWalletsByEmail((prev) => {
      const existing = prev[key] || { balance: 0, sharesCount: 0, dividendsEarned: 0 };
      return {
        ...prev,
        [key]: {
          ...existing,
          balance: Math.max(0, existing.balance + deltaBalance)
        }
      };
    });

    const newTx: WalletTransaction = {
      id: `tx-adm-adj-${Date.now()}`,
      type: deltaBalance >= 0 ? 'depot' : 'retrait',
      amount: Math.abs(deltaBalance),
      date: formattedDate,
      method: 'Ajustement Super-Admin',
      status: 'completed',
      reference: `ADM-ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
      note: reason || 'Régularisation administrative'
    };

    setTransactions((prev) => [newTx, ...prev]);
  };

  // =========================================================================
  // GESTION SÉCURISÉE DES DÉPÔTS ET RETRAITS DES INVESTISSEURS
  // Règles strictes :
  // 1. Soumission par l'investisseur (statut 'En attente', AUCUNE modification de solde)
  // 2. Règlement avec l'admin sur WhatsApp
  // 3. Admission et confirmation par l'administrateur UNIQUEMENT après réception effective
  // 4. Débit/Crédit réel du solde UNIQUEMENT après validation admin
  // 5. Rejet sans altération du solde
  // =========================================================================

  const handleSubmitFundRequest = (
    data: Omit<FundOperationRequest, 'id' | 'requestedAt' | 'status'>
  ): FundOperationRequest => {
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    const newReq: FundOperationRequest = {
      ...data,
      id: `req-fund-${Date.now()}`,
      requestedAt: formattedDate,
      status: 'En attente'
    };

    setFundRequests((prev) => [newReq, ...prev]);

    // Audit log
    handleAddAuditLog({
      author: data.investorName,
      date: formattedDate,
      actionType: 'request_fund_operation',
      description: `Demande de ${data.type === 'depot' ? 'dépôt' : 'retrait'} de ${data.amount.toLocaleString(
        'fr-FR'
      )} FCFA soumise par ${data.investorName} (${data.reference})`,
      entityType: 'wallet',
      targetId: newReq.id,
      newState: newReq
    });

    return newReq;
  };

  const handleConfirmFundRequest = (reqId: string) => {
    const target = fundRequests.find((r) => r.id === reqId);
    if (!target) return;
    // Strict security: prevent double confirmation or duplicate balance movement
    if (target.status === 'Confirmé') return;

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    const targetEmailKey = target.investorEmail.toLowerCase().trim();

    // 1. Update wallet balance ONLY AFTER confirmation
    setWalletsByEmail((prev) => {
      const existing = prev[targetEmailKey] || { balance: 0, sharesCount: 0, dividendsEarned: 0 };
      const nextBalance =
        target.type === 'depot'
          ? existing.balance + target.amount
          : Math.max(0, existing.balance - target.amount);

      return {
        ...prev,
        [targetEmailKey]: {
          ...existing,
          balance: nextBalance
        }
      };
    });

    // 2. Mark request as Confirmé with admin identity and timestamp
    setFundRequests((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: 'Confirmé',
              validatedBy: `${currentAdminName} (${
                currentAdminRole === 'admin_principal' ? 'Super-Admin' : 'Admin Secondaire'
              })`,
              validatedAt: formattedDate
            }
          : r
      )
    );

    // 3. Record official WalletTransaction
    const newTx: WalletTransaction = {
      id: `tx-fund-${Date.now()}`,
      type: target.type === 'depot' ? 'depot' : 'retrait',
      amount: target.amount,
      date: formattedDate,
      method: target.paymentMethod || 'Mobile Money (+226)',
      phone: target.investorPhone,
      status: 'completed',
      reference: target.reference,
      note: `${target.type === 'depot' ? 'Dépôt' : 'Retrait'} admis par ${currentAdminName}`
    };
    setTransactions((prev) => [newTx, ...prev]);

    // 4. Audit log
    handleAddAuditLog({
      author: currentAdminName,
      date: formattedDate,
      actionType: 'confirm_fund_operation',
      description: `Admission et confirmation effective ${
        target.type === 'depot' ? 'du dépôt' : 'du retrait'
      } de ${target.amount.toLocaleString('fr-FR')} FCFA pour ${target.investorName} (${
        target.reference
      })`,
      entityType: 'wallet',
      targetId: reqId
    });
  };

  const handleRejectFundRequest = (reqId: string, reason: string) => {
    const target = fundRequests.find((r) => r.id === reqId);
    if (!target) return;
    if (target.status === 'Confirmé' || target.status === 'Refusé') return;

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    // Mark as Refusé - Solde intact
    setFundRequests((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: 'Refusé',
              rejectionReason: reason,
              validatedBy: currentAdminName,
              validatedAt: formattedDate
            }
          : r
      )
    );

    handleAddAuditLog({
      author: currentAdminName,
      date: formattedDate,
      actionType: 'reject_fund_operation',
      description: `Rejet de la demande ${target.reference} (${target.amount.toLocaleString(
        'fr-FR'
      )} FCFA) pour ${target.investorName}. Motif : ${reason}`,
      entityType: 'wallet',
      targetId: reqId
    });
  };

  const handleSetFundRequestProcessing = (reqId: string) => {
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

  const handleAdminUpdateInvestorStatus = (investorId: string, status: any, reason?: string) => {
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
    fetch(`/api/admin/investors/${encodeURIComponent(investorId)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason })
    }).catch(() => {});
    handleAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'update_investor_status',
      description: `Mise à jour statut investisseur ID ${investorId} -> ${status}${reason ? ` (${reason})` : ''}`,
      entityType: 'investor',
      targetId: investorId
    });
  };

  const handleAdminDeleteInvestor = (investorId: string) => {
    setRegisteredInvestors((prev) => prev.filter((inv) => inv.id !== investorId));
    fetch(`/api/admin/investors/${encodeURIComponent(investorId)}`, {
      method: 'DELETE'
    }).catch(() => {});
  };

  const handleAdminCreateInvestor = async (data: {
    email: string;
    password: string;
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
        email: investor.email,
        phone: investor.phone,
        status: investor.status,
        statusReason: investor.statusReason,
        statusUpdatedAt: investor.statusUpdatedAt,
        createdAt: investor.createdAt,
        totalInvested: investor.totalInvested || 0,
        sharesCount: investor.sharesCount || 0,
        dividendsEarned: investor.dividendsEarned || 0
      },
      ...previous.filter((item) => item.id !== investor.id)
    ]);
  };

  const handleAdminDeleteSubscription = (subId: string) => {
    setSubscriptions((prev) => prev.filter((s) => s.id !== subId));
    fetch(`/api/admin/subscriptions/${encodeURIComponent(subId)}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleAdminDeleteFundRequest = (reqId: string) => {
    setFundRequests((prev) => prev.filter((r) => r.id !== reqId));
  };

  const handleAdminDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    fetch(`/api/admin/operations/${encodeURIComponent(projectId)}`, {
      method: 'DELETE'
    }).catch(() => {});
  };

  const handleAdminDeleteProfitDistribution = (distId: string) => {
    setProfitDistributions((prev) => prev.filter((d) => d.id !== distId));
  };

  const handleAdminDeleteInvestorMessage = (msgId: string) => {
    setInvestorMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  const handleAdminClearInvestorMessages = () => {
    setInvestorMessages([]);
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
  const handleAdminAddGroup = (domain: 'electronique' | 'electrotechnique' | 'informatique', group: CategoryGroup) => {
    setDomainGroups((prev) => ({
      ...prev,
      [domain]: [...prev[domain], group]
    }));
    handleAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'add_group',
      description: `Ajout du groupe "${group.label}" (ID: ${group.id}) dans le domaine ${domain}`,
      entityType: 'system'
    });
  };

  const handleAdminDeleteGroup = (domain: 'electronique' | 'electrotechnique' | 'informatique', groupId: string) => {
    setDomainGroups((prev) => ({
      ...prev,
      [domain]: prev[domain].filter((g) => g.id !== groupId)
    }));
    handleAddAuditLog({
      author: currentAdminName,
      date: new Date().toLocaleString('fr-FR'),
      actionType: 'delete_group',
      description: `Suppression du groupe ID "${groupId}" dans le domaine ${domain}`,
      entityType: 'system'
    });
  };

  // Audit Logs Deletion Handlers
  const handleAdminDeleteAuditLog = (logId: string) => {
    setAuditLogs((prev) => prev.filter((l) => l.id !== logId));
    fetch(`/api/admin/audit-logs/${encodeURIComponent(logId)}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleAdminClearAuditLogs = () => {
    setAuditLogs([]);
    fetch('/api/admin/audit-logs', { method: 'DELETE' }).catch(() => {});
    try {
      localStorage.removeItem('electromen_audit_logs');
    } catch {}
  };

  // Investor Activities & Documents Handlers
  const handleAdminAddActivity = (act: InvestorActivity) => {
    setInvestorActivities((prev) => [act, ...prev]);
  };

  const handleAdminDeleteActivity = (actId: string) => {
    setInvestorActivities((prev) => prev.filter((a) => a.id !== actId));
    fetch(`/api/admin/activities/${encodeURIComponent(actId)}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleAdminAddDocument = (doc: InvestorDocument) => {
    setInvestorDocuments((prev) => [doc, ...prev]);
  };

  const handleAdminDeleteDocument = (docId: string) => {
    setInvestorDocuments((prev) => prev.filter((d) => d.id !== docId));
    fetch(`/api/admin/documents/${encodeURIComponent(docId)}`, { method: 'DELETE' }).catch(() => {});
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
      setCurrentTab('accueil');
      window.history.pushState({}, '', '/');
    } catch {
      alert('La déconnexion administrateur n’a pas pu être confirmée. Veuillez réessayer.');
    }
  };

  // Profit Distribution to all eligible investors (Direct amount input without 70%/30% forced formula)
  const handleDistributeProfits = (
    projectName: string,
    investorsAmount: number,
    notes?: string,
    sector?: 'Électronique' | 'Électrotechnique' | 'Informatique',
    period?: string,
    companyAmount?: number
  ) => {
    const sec = sector || 'Électronique';
    const per = period || '3ème Trimestre 2026';

    // Montant saisi directement par l'administrateur
    const totalInvestorsShare = Math.round(Number(investorsAmount) || 0);
    const companyShare = Math.round(Number(companyAmount) || 0);
    const totalAmount = totalInvestorsShare + companyShare;

    // Investisseurs éligibles
    const eligibleInvestors = registeredInvestors.filter((inv) => {
      return (
        (inv.sharesCount || 0) > 0 ||
        inv.totalInvested > 0 ||
        subscriptions.some((s) => s.investorEmail.toLowerCase() === inv.email.toLowerCase())
      );
    });

    if (eligibleInvestors.length === 0) {
      alert('Distribution bloquée : Aucun investisseur éligible détecté.');
      return;
    }

    // Répartition à parts égales entre tous les investisseurs admissibles
    const individualAmount = Math.floor(totalInvestorsShare / eligibleInvestors.length);

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    const newDist: ProfitDistribution = {
      id: `dist-${Date.now()}`,
      reference: `DIST-${sec.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      sector: sec,
      period: per,
      netProfit: totalAmount > 0 ? totalAmount : totalInvestorsShare,
      investorsShareTotal: totalInvestorsShare,
      companyShare: companyShare,
      eligibleCount: eligibleInvestors.length,
      individualAmount: individualAmount,
      notes: notes || 'Distribution directe des dividendes',
      publishedAt: formattedDate,
      status: 'Publié',
      validatedBy: `${currentAdminName} (${
        currentAdminRole === 'admin_principal' ? 'Super-Admin' : 'Admin Secondaire'
      })`
    };

    setProfitDistributions((prev) => [newDist, ...prev]);

    // Créditer le solde cash personnel de chaque investisseur éligible
    setWalletsByEmail((prev) => {
      const next = { ...prev };
      eligibleInvestors.forEach((inv) => {
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

    // Mettre à jour les dividendes dans la liste des investisseurs enregistrés
    setRegisteredInvestors((prev) =>
      prev.map((inv) =>
        eligibleInvestors.some((e) => e.id === inv.id)
          ? { ...inv, dividendsEarned: (inv.dividendsEarned || 0) + individualAmount }
          : inv
      )
    );

    // Enregistrer la transaction officielle
    const newTx: WalletTransaction = {
      id: `tx-dist-${Date.now()}`,
      type: 'dividende',
      amount: totalInvestorsShare,
      date: formattedDate,
      method: `Distribution Dividendes (${sec})`,
      status: 'completed',
      reference: newDist.reference,
      note: `${individualAmount.toLocaleString('fr-FR')} FCFA par investisseur éligible (${
        eligibleInvestors.length
      } associés). ${notes || ''}`
    };
    setTransactions((prev) => [newTx, ...prev]);

    handleAddAuditLog({
      author: currentAdminName,
      date: formattedDate,
      actionType: 'profit_distribution',
      description: `Distribution directe : ${totalInvestorsShare.toLocaleString(
        'fr-FR'
      )} FCFA alloués aux associés (${individualAmount.toLocaleString(
        'fr-FR'
      )} FCFA/personne ; part ELECTRO-MEN : ${companyShare.toLocaleString(
        'fr-FR'
      )} FCFA) pour "${projectName}"`,
      entityType: 'wallet',
      targetId: newDist.id
    });

    alert(
      `Distribution des dividendes publiée avec succès !\n\n• Montant alloué aux associés : ${totalInvestorsShare.toLocaleString(
        'fr-FR'
      )} FCFA\n• Part ELECTRO-MEN : ${companyShare.toLocaleString(
        'fr-FR'
      )} FCFA\n• Montant individuel (${
        eligibleInvestors.length
      } associés éligibles) : ${individualAmount.toLocaleString('fr-FR')} FCFA\n• Secteur : ${sec} (${per})`
    );
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.user) {
        setAdminAuthError(data.error || 'Identifiants administrateur incorrects.');
        return;
      }
      setCurrentAdminRole(data.user.role);
      setCurrentAdminName(data.user.name);
      setIsAdminAuthModalOpen(false);
      setAdminPassInput('');
      setAdminPinInput('');
      setCurrentTab('admin');
      window.history.pushState({}, '', adminCustomUrl);
    } catch {
      setAdminAuthError('Le serveur d’authentification est indisponible. Veuillez réessayer.');
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
        <main className={currentTab === 'accueil' ? "max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-2" : "max-w-4xl mx-auto px-3 sm:px-4 pt-4"}>
          {/* PAGE D'ACCUEIL FLAGSHIP : ÉLECTROTECHNIQUE & ÉLECTRONIQUE */}
          {currentTab === 'accueil' && (
          <ScreenAccueil
            products={products}
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
            isAdmin={false}
          />
        )}

        {/* BOUTIQUE 1 : COMPOSANTS ÉLECTRONIQUES */}
        {(currentTab === 'boutique_electronique' || currentTab === 'composants') && (
          <ScreenBoutiqueElectronique
            products={products}
            groups={domainGroups.electronique}
            onAddToCart={(prod) => handleAddToCart(prod, 1)}
            onSelectProduct={(prod) => setSelectedProduct(prod)}
            onOpenCart={() => setIsCartOpen(true)}
            onGoTab={(tab) => setCurrentTab(tab)}
          />
        )}

        {/* BOUTIQUE 2 : COMPOSANTS ÉLECTROTECHNIQUES & PUISSANCE */}
        {currentTab === 'boutique_electrotechnique' && (
          <ScreenBoutiqueElectrotechnique
            products={products}
            groups={domainGroups.electrotechnique}
            onAddToCart={(prod) => handleAddToCart(prod, 1)}
            onSelectProduct={(prod) => setSelectedProduct(prod)}
            onOpenCart={() => setIsCartOpen(true)}
            onGoTab={(tab) => setCurrentTab(tab)}
          />
        )}

        {/* BOUTIQUE 3 : ÉQUIPEMENTS INFORMATIQUES */}
        {currentTab === 'boutique_informatique' && (
          <ScreenBoutiqueInformatique
            products={products}
            groups={domainGroups.informatique}
            onAddToCart={(prod) => handleAddToCart(prod, 1)}
            onSelectProduct={(prod) => setSelectedProduct(prod)}
            onOpenCart={() => setIsCartOpen(true)}
            onGoTab={(tab) => setCurrentTab(tab)}
          />
        )}

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
        {currentTab === 'profil' && (
          <ScreenProfil
            currentProfile={currentProfile}
            onUpdateProfile={handleUpdateProfile}
            wallet={currentWallet}
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
        )}

        {/* PAGE ADMINISTRATEUR DANS UN FICHIER DISTINCT : ADMINPAGE */}
        {currentTab === 'admin' && currentAdminRole && (
          <AdminPage
            currentAdminRole={currentAdminRole}
            currentAdminName={currentAdminName}
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
            onUpdateProduct={handleAdminUpdateProduct}
            onAddProduct={handleAdminAddProduct}
            onDeleteProduct={handleAdminDeleteProduct}
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
            deliveryZones={deliveryZones}
            onUpdateDeliveryZones={setDeliveryZones}
            appNotifications={appNotifications}
            onAddNotification={handleAddNotification}
            isInvestorChatOpen={isInvestorChatOpen}
            onToggleInvestorChat={() => setIsInvestorChatOpen((prev) => !prev)}
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
            onDeleteSubscription={handleAdminDeleteSubscription}
            onDeleteFundRequest={handleAdminDeleteFundRequest}
            onDeleteProject={handleAdminDeleteProject}
            onDeleteProfitDistribution={handleAdminDeleteProfitDistribution}
            onDeleteInvestorMessage={handleAdminDeleteInvestorMessage}
            onClearInvestorMessages={handleAdminClearInvestorMessages}
            onPurgeTestData={handleAdminPurgeTestData}
            marketplaceBoutiques={marketplaceBoutiques}
            onUpdateBoutiqueFlag={handleUpdateBoutiqueFlag}
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
        deliveryZones={deliveryZones}
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
                      placeholder="ex: badrapare@gmail.com"
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
                    <span className="text-[10px] text-slate-400 block">
                      Deuxième admin pré-autorisé : <code>badrapare@gmail.com</code>
                    </span>
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
    </div>
  );
}
