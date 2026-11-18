export type ProductStockStatus = 'in_stock' | 'out_of_stock' | 'on_order';

export interface Product {
  id: string;
  ref: string;
  name: string;
  brand?: string;
  category: string;
  categoryLabel: string;
  domain: 'electronique' | 'electrotechnique' | 'informatique';
  subGroup?: string;
  subGroupLabel?: string;
  badge?: string;
  badgeStyle?: 'gold' | 'neutral' | 'cyan';
  price: number;
  oldPrice?: number;
  image?: string; // Real photograph provided by admin
  images?: string[]; // Multiple real photographs
  hasRealPhoto?: boolean; // false = Image à ajouter
  description: string;
  details?: string[]; // Specs / Technical characteristics
  specs?: string[]; // Specs alias
  stock: number;
  inStock?: boolean;
  stockStatus?: ProductStockStatus;
  videoUrl?: string; // Demo / Presentation video URL
  youtubeUrl?: string; // YouTube video link
  datasheetUrl?: string; // Datasheet PDF link
  pdfUrl?: string;
  isPublished?: boolean;
  isDraft?: boolean;
  isFeaturedOnHome?: boolean;
  homeOrder?: number;
  isPremium?: boolean;
  isPromo?: boolean;
  isNew?: boolean;
  isNewArrival?: boolean;
  isFlashSale?: boolean;
  flashSaleDiscountPercent?: number;
}

export const getProductStockStatus = (p: Product): ProductStockStatus => {
  if (p.stockStatus) return p.stockStatus;
  if (p.inStock === false) return 'out_of_stock';
  return (p.stock && p.stock > 0) ? 'in_stock' : 'out_of_stock';
};

export const getStockStatusLabel = (status: ProductStockStatus): string => {
  switch (status) {
    case 'in_stock':
      return 'En stock';
    case 'out_of_stock':
      return 'Rupture de stock';
    case 'on_order':
      return 'Disponible sur commande';
  }
};

export interface CategoryGroup {
  id: string;
  label: string;
  icon?: string;
  domain?: 'electronique' | 'electrotechnique' | 'informatique';
}

export interface CourseModule {
  id: string;
  title: string;
  duration: string;
  description?: string;
  summary?: string;
  videoUrl?: string;
  videoType?: 'url' | 'upload';
  pdfUrl?: string;
  pdfTitle?: string;
  isFree?: boolean;
  completed?: boolean;
}

export interface Course {
  id: string;
  title: string;
  category: string;
  domain: 'electrotechnique' | 'electronique' | 'informatique';
  level: string;
  duration: string;
  rating?: number;
  price: number;
  isFree?: boolean;
  badge?: string;
  description: string;
  pedagogicalObjectives?: string[];
  features?: string[];
  instructor?: string;
  hasHardwareKit?: boolean;
  modulesCount?: number;
  videoUrl?: string;
  promoVideoUrl?: string;
  pdfUrl?: string;
  pdfTitle?: string;
  syllabus: CourseModule[];
  status?: 'draft' | 'published' | 'archived';
  isPublished?: boolean;
}

export interface DeliveryZone {
  id: string;
  name: string;
  tarif: number;
  fee?: number;
  estimatedDelay?: string;
  delay?: string;
  keywords: string[];
  conditions?: string;
  isActive: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  dateFormatted?: string;
  type: 'product' | 'course' | 'promo' | 'official' | 'system';
  targetTab?: string;
  actionTab?: string;
  targetId?: string;
  actionProductId?: string;
  priority?: 'high' | 'medium' | 'low';
  isRead?: boolean;
  sender?: string;
  imageUrl?: string;
}

export interface InvestmentOffer {
  id: string;
  ref?: string;
  title: string;
  category?: string;
  sharePrice: number;
  yield?: string;
  yieldType?: string;
  duration?: string;
  risk?: string;
  description: string;
  isOpen?: boolean;
  isPublished?: boolean;
  minShares?: number;
  maxShares?: number;
  status?: string;
}

export interface InvestmentProject {
  id: string;
  ref: string;
  title: string;
  category: string;
  categoryStyle: 'gold' | 'cyan' | 'neutral';
  yield: string;
  yieldType: string;
  description: string;
  duration: string;
  risk: string;
  riskColor: string;
  targetAmount: number;
  collectedAmount: number;
  percent: number;
  distribution: string;
  investorsCount: number;
  privilege?: string;
  isPublished?: boolean;
  cycleNumber?: number;
  status?: 'draft' | 'published' | 'completed';
  offerStatus?: 'Brouillon' | 'Ouvert' | 'Suspendu' | 'Fermé';
  sector?: 'Électronique' | 'Électrotechnique' | 'Informatique';
  objective?: string;
  conditions?: string;
  sharePrice?: number;
  availableShares?: number;
  subscribedShares?: number;
  openDate?: string;
  closeDate?: string;
  boutiqueWhatsApp?: string;
  offers?: InvestmentOffer[];
}

export interface InvestorActivity {
  id: string;
  title: string;
  desc?: string;
  description?: string;
  icon?: string;
  badge?: string;
  sector?: string;
  photoUrl?: string;
  imageUrl?: string;
  date?: string;
}

export interface InvestorDocument {
  id: string;
  title: string;
  desc?: string;
  description?: string;
  fileUrl?: string;
  url?: string;
  format?: string;
  size?: string;
  date?: string;
}

export const INITIAL_INVESTOR_ACTIVITIES: InvestorActivity[] = [];
export const INITIAL_INVESTOR_DOCUMENTS: InvestorDocument[] = [
  {
    id: 'doc-note-regles',
    title: "Règles & Statuts du Groupe d'Investissement ELECTRO-MEN (11 Pages)",
    desc: 'Document officiel signé par M. PARE Badra Aliyou Haidara, Technicien Supérieur.',
    fileUrl: '/assets/aistudio/Note_Regle_f4d3053f.pdf',
    format: 'PDF',
    size: '1.4 Mo',
    date: '20 août 2026'
  }
];

export const HEADQUARTERS = {
  siegeSocial: 'Ouagadougou / Burkina Faso',
  antenneTechnique: 'Bobo-Dioulasso, Burkina Faso',
  pays: 'Burkina Faso',
  noteReglesAuteur: 'PARE Badra Aliyou Haidara (Technicien Supérieur)',
  noteReglesContact: '+226 67 31 46 05 / badrapare@gmail.com',
  noteReglesDate: '20 août 2026',
  repartitionNet: {
    gestionBoutique: 'Trésorerie & Opérations',
    investisseurs: 'Dividendes directs',
    primeDynamisme: 'Réserve technique'
  },
  pdfUrl: '/assets/aistudio/Note_Regle_f4d3053f.pdf',
  shopUrl: 'https://electro-men.vercel.app/'
};

export const WHATSAPP_CONTACTS = {
  electronique: {
    number: '+22665484738',
    display: '+226 65 48 47 38',
    rawNumber: '65484738',
    service: 'Ligne Directe Électronique & IoT'
  },
  electrotechnique: {
    number: '+22607315734',
    display: '+226 07 31 57 34',
    rawNumber: '07315734',
    service: 'Ligne Directe Électrotechnique & Puissance'
  },
  informatique: {
    number: '+22656283526',
    display: '+226 56 28 35 26',
    rawNumber: '56283526',
    service: 'Ligne Directe Équipements Informatiques & Réseaux'
  },
  general: {
    number: '+22667314605',
    display: '+226 67 31 46 05 / +226 65 48 47 38',
    rawNumber: '67314605',
    service: 'Burkina Faso'
  }
};

export const SOCIAL_LINKS = {
  facebook: 'https://www.facebook.com/profile.php?id=61589339606976&mibextid=ZbWKwL',
  tiktok: 'https://www.tiktok.com/@electromen42?_r=1&_t=ZS-9AUllYkOrH3',
  youtube: 'https://www.youtube.com/@electromen-bf'
};

export const ELECTRONIQUE_GROUPS = [
  { id: 'all', label: 'Tous les composants', icon: 'grid_view' },
  { id: 'kits', label: 'Microcontrôleurs & Cartes Dev', icon: 'memory' },
  { id: 'ic', label: 'Circuits Intégrés & Régulateurs', icon: 'developer_board' },
  { id: 'sensors', label: 'Capteurs & Modules IoT', icon: 'sensors' },
  { id: 'passifs', label: 'Composants Passifs & Discrets', icon: 'electric_bolt' },
  { id: 'tools', label: 'Outillage & Soudure', icon: 'build' }
];

export const ELECTROTECHNIQUE_GROUPS = [
  { id: 'all', label: 'Tous les matériels', icon: 'grid_view' },
  { id: 'protection', label: 'Protection & Disjoncteurs', icon: 'shield' },
  { id: 'commande', label: 'Commande & Contacteurs', icon: 'power' },
  { id: 'variateurs', label: 'Variateurs de Fréquence & Moteurs', icon: 'settings_suggest' },
  { id: 'alimentation', label: 'Alimentations & Transformateurs', icon: 'bolt' },
  { id: 'cablage', label: 'Câblage, Borniers & Coffrets', icon: 'cable' },
  { id: 'mesure', label: 'Mesure & Diagnostic', icon: 'speed' }
];

export const INFORMATIQUE_GROUPS = [
  { id: 'all', label: 'Tous les équipements', icon: 'grid_view' },
  { id: 'ordinateurs', label: 'Ordinateurs & Postes', icon: 'laptop_mac' },
  { id: 'composants_pc', label: 'Composants PC (RAM, SSD)', icon: 'memory' },
  { id: 'peripheriques', label: 'Périphériques & Écrans', icon: 'desktop_windows' },
  { id: 'reseau', label: 'Réseaux & Câblage RJ45', icon: 'lan' },
  { id: 'energie_pc', label: 'Onduleurs & Alimentation', icon: 'battery_charging_full' }
];

export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: 'zone-ouaga',
    name: 'Ouagadougou (Centre-ville & Quartiers)',
    tarif: 1000,
    estimatedDelay: '2h à 4h (Livraison Express Moto)',
    keywords: ['ouaga', 'ouagadougou', 'kadiogo', 'gounghin', 'karpala', 'tampouy', 'patte d’oie', 'pissy', 'somgande', 'ouaga 2000', 'cissin', 'dassasgho'],
    conditions: 'Livraison sécurisée au pas de porte ou au bureau',
    isActive: true
  },
  {
    id: 'zone-bobo',
    name: 'Bobo-Dioulasso (Liaison Quotidienne)',
    tarif: 2500,
    estimatedDelay: '24h ouvrées (Colis car express)',
    keywords: ['bobo', 'bobo-dioulasso', 'houet', 'accart-ville', 'bolomakote', 'sarfalao', 'lafia'],
    conditions: 'Retrait en agence partenaire ou livraison livreur',
    isActive: true
  },
  {
    id: 'zone-secondaire',
    name: 'Autres Villes (Koudougou, Fada, Ouahigouya, Banfora)',
    tarif: 3500,
    estimatedDelay: '24h à 48h ouvrées',
    keywords: ['koudougou', 'fada', 'ouahigouya', 'banfora', 'kaya', 'dédougou', 'koupela', 'tenkodogo', 'ziniare', 'manga'],
    conditions: 'Expédition par compagnie de transport fiable avec suivi SMS',
    isActive: true
  },
  {
    id: 'zone-fablab',
    name: 'Retrait Gratuit au Hub / FabLab ELECTRO-MEN',
    tarif: 0,
    estimatedDelay: 'Immédiat pendant les heures d’ouverture',
    keywords: ['fablab', 'hub', 'retrait', 'magasin', 'sur place'],
    conditions: 'Du lundi au samedi de 08h à 18h30 sans frais',
    isActive: true
  }
];

export const INITIAL_APP_NOTIFICATIONS: AppNotification[] = [];

export const PRODUCTS: Product[] = [];

export const COURSES: Course[] = [];

export const PROJECTS: InvestmentProject[] = [];

export interface CartItem {
  product: Product;
  quantity: number;
}

export type SubscriptionStatus =
  | 'pending_admin'
  | 'approved_pending_payment'
  | 'paid_and_issued'
  | 'rejected';

export interface ShareSubscription {
  id: string;
  investorName: string;
  investorEmail: string;
  investorPhone: string;
  shares: number;
  sharePrice: number;
  totalAmount: number;
  status: SubscriptionStatus;
  adminPasswordCode?: string;
  requestedAt: string;
  approvedAt?: string;
  paidAt?: string;
  paymentMethod?: string;
}

export interface WalletTransaction {
  id: string;
  type: 'depot' | 'retrait' | 'achat_parts' | 'dividende';
  amount: number;
  date: string;
  method: string;
  phone?: string;
  status: 'completed' | 'pending' | 'failed';
  reference: string;
  note?: string;
}

export interface InvestorWallet {
  balance: number;
  sharesCount: number;
  dividendsEarned: number;
}

export interface EmailNotification {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  date: string;
  code: string;
  subscriptionId: string;
  shares: number;
  amount: number;
}

export interface InvestorProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  city?: string;
  accountType?: string;
  isVerified: boolean;
  registeredDate: string;
}

export type FundOperationStatus = 'En attente' | 'En cours de traitement' | 'Confirmé' | 'Refusé';

export interface FundOperationRequest {
  id: string;
  reference: string;
  type: 'depot' | 'retrait';
  amount: number;
  investorId: string;
  investorName: string;
  investorEmail: string;
  investorPhone: string;
  requestedAt: string;
  status: FundOperationStatus;
  adminWhatsApp: string;
  sector?: 'Électronique' | 'Électrotechnique' | 'Informatique';
  paymentMethod?: string;
  validatedBy?: string;
  validatedAt?: string;
  rejectionReason?: string;
  notes?: string;
}

export const INITIAL_FUND_REQUESTS: FundOperationRequest[] = [];

export interface ProfitDistribution {
  id: string;
  reference: string;
  sector: 'Électronique' | 'Électrotechnique' | 'Informatique';
  period: string;
  netProfit: number;
  investorsShareTotal: number; // Montant alloué aux associés
  companyShare: number; // Part ELECTRO-MEN
  eligibleCount: number;
  individualAmount: number; // investorsShareTotal / eligibleCount
  notes: string;
  publishedAt: string;
  status: 'Publié' | 'Payé';
  validatedBy: string;
}

export const INITIAL_PROFIT_DISTRIBUTIONS: ProfitDistribution[] = [];

export interface MarketplaceBoutique {
  id: string;
  name: string;
  category: 'electronique' | 'electrotechnique' | 'informatique';
  categoryLabel: 'Électronique' | 'Électrotechnique' | 'Informatique';
  location: string;
  country: string;
  countryCode: string;
  flag: string;
  activities: string;
  tabId: 'boutique_electronique' | 'boutique_electrotechnique' | 'boutique_informatique';
  status: 'Actif' | 'Inactif';
  logoUrl?: string;
  phone?: string;
}

export const MARKETPLACE_BOUTIQUES: MarketplaceBoutique[] = [
  {
    id: 'boutique-electronique',
    name: 'Électronique',
    category: 'electronique',
    categoryLabel: 'Électronique',
    location: 'Ouagadougou',
    country: '',
    countryCode: '',
    flag: '',
    activities: 'Composants, IoT, Prototypage & Capteurs',
    tabId: 'boutique_electronique',
    status: 'Actif',
    logoUrl: '/assets/aistudio/Image_1_397aca35.jpeg',
    phone: '+226 65 48 47 38'
  },
  {
    id: 'boutique-electrotechnique',
    name: 'Électrotechnique',
    category: 'electrotechnique',
    categoryLabel: 'Électrotechnique',
    location: 'Ouagadougou',
    country: '',
    countryCode: '',
    flag: '',
    activities: 'Appareillage Industriel, Puissance & Variateurs',
    tabId: 'boutique_electrotechnique',
    status: 'Actif',
    logoUrl: '/assets/aistudio/Image_1_397aca35.jpeg',
    phone: '+226 07 31 57 34'
  },
  {
    id: 'boutique-informatique',
    name: 'Informatique',
    category: 'informatique',
    categoryLabel: 'Informatique',
    location: 'Ouagadougou',
    country: '',
    countryCode: '',
    flag: '',
    activities: 'Matériels & Réseaux, Serveurs & Périphériques',
    tabId: 'boutique_informatique',
    status: 'Actif',
    logoUrl: '/assets/aistudio/Image_1_397aca35.jpeg',
    phone: '+226 56 28 35 26'
  }
];

