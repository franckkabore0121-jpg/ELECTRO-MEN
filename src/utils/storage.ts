import {
  Product,
  PRODUCTS,
  ShareSubscription,
  WalletTransaction,
  InvestorWallet,
  EmailNotification
} from '../data/mockData.ts';

const PRODUCTS_KEY = 'electromen_products_v1';
const SUBSCRIPTIONS_KEY = 'electromen_subscriptions_v1';
const WALLET_KEY = 'electromen_wallet_v1';
const TRANSACTIONS_KEY = 'electromen_transactions_v1';
const EMAILS_KEY = 'electromen_emails_v1';

// Initial default subscriptions for demonstration
const INITIAL_SUBSCRIPTIONS: ShareSubscription[] = [
  {
    id: '#EM-SUB-8492',
    investorName: 'Ouedraogo Moussa',
    investorEmail: 'moussa.ouedraogo@fasomail.bf',
    investorPhone: '+226 65 48 47 38',
    shares: 40,
    sharePrice: 2500,
    totalAmount: 100000,
    status: 'paid_and_issued',
    adminPasswordCode: 'EM-SEC-9241',
    requestedAt: '2026-10-15 10:30',
    approvedAt: '2026-10-15 11:15',
    paidAt: '2026-10-15 11:45',
    paymentMethod: 'Orange Money (+226 65 48 47 38)'
  },
  {
    id: '#EM-SUB-9104',
    investorName: 'Kabore Aminata',
    investorEmail: 'aminata.kabore@techbf.org',
    investorPhone: '+226 70 12 34 56',
    shares: 10,
    sharePrice: 2500,
    totalAmount: 25000,
    status: 'pending_admin',
    requestedAt: '2026-10-21 04:12'
  }
];

const INITIAL_WALLET: InvestorWallet = {
  balance: 45000, // 45 000 FCFA in wallet
  sharesCount: 40, // 40 shares = 100 000 FCFA
  dividendsEarned: 14500 // 14 500 FCFA
};

const INITIAL_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'tx-001',
    type: 'depot',
    amount: 50000,
    date: '2026-10-18 14:22',
    method: 'Orange Money (+226)',
    phone: '+226 65 48 47 38',
    status: 'completed',
    reference: 'OM-DEP-849210',
    note: 'Approvisionnement compte investisseur'
  },
  {
    id: 'tx-002',
    type: 'dividende',
    amount: 14500,
    date: '2026-10-20 09:00',
    method: 'Distribution Trimestrielle FabLab',
    status: 'completed',
    reference: 'DIV-T3-2026-EM',
    note: 'Dividendes 40 parts indexés production'
  }
];

const INITIAL_EMAILS: EmailNotification[] = [
  {
    id: 'mail-001',
    recipientEmail: 'moussa.ouedraogo@fasomail.bf',
    recipientName: 'Ouedraogo Moussa',
    subject: 'Accord Administrateur - Mot de passe pour paiement de vos parts ELECTRO-MEN',
    date: '2026-10-15 11:15',
    code: 'EM-SEC-9241',
    subscriptionId: '#EM-SUB-8492',
    shares: 40,
    amount: 100000
  }
];

export const getStoredProducts = (): Product[] => {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (!raw) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(PRODUCTS));
      return PRODUCTS;
    }
    return JSON.parse(raw);
  } catch {
    return PRODUCTS;
  }
};

export const saveStoredProducts = (products: Product[]) => {
  try {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  } catch (e) {
    console.error('Failed to save products:', e);
  }
};

export const getStoredSubscriptions = (): ShareSubscription[] => {
  try {
    const raw = localStorage.getItem(SUBSCRIPTIONS_KEY);
    if (!raw) {
      localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(INITIAL_SUBSCRIPTIONS));
      return INITIAL_SUBSCRIPTIONS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_SUBSCRIPTIONS;
  }
};

export const saveStoredSubscriptions = (subs: ShareSubscription[]) => {
  try {
    localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subs));
  } catch (e) {
    console.error('Failed to save subscriptions:', e);
  }
};

export const getStoredWallet = (): InvestorWallet => {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (!raw) {
      localStorage.setItem(WALLET_KEY, JSON.stringify(INITIAL_WALLET));
      return INITIAL_WALLET;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_WALLET;
  }
};

export const saveStoredWallet = (wallet: InvestorWallet) => {
  try {
    localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
  } catch (e) {
    console.error('Failed to save wallet:', e);
  }
};

export const getStoredTransactions = (): WalletTransaction[] => {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (!raw) {
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(INITIAL_TRANSACTIONS));
      return INITIAL_TRANSACTIONS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_TRANSACTIONS;
  }
};

export const saveStoredTransactions = (txs: WalletTransaction[]) => {
  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txs));
  } catch (e) {
    console.error('Failed to save transactions:', e);
  }
};

export const getStoredEmails = (): EmailNotification[] => {
  try {
    const raw = localStorage.getItem(EMAILS_KEY);
    if (!raw) {
      localStorage.setItem(EMAILS_KEY, JSON.stringify(INITIAL_EMAILS));
      return INITIAL_EMAILS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_EMAILS;
  }
};

export const saveStoredEmails = (emails: EmailNotification[]) => {
  try {
    localStorage.setItem(EMAILS_KEY, JSON.stringify(emails));
  } catch (e) {
    console.error('Failed to save emails:', e);
  }
};
