import React, { useState } from 'react';
import {
  Product,
  Course,
  InvestmentProject,
  ShareSubscription,
  WalletTransaction,
  InvestorWallet,
  EmailNotification,
  InvestorProfile
} from '../data/mockData.ts';

interface ScreenAdminProps {
  products: Product[];
  onUpdateProduct: (product: Product) => void;
  onAddProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;

  courses: Course[];
  onUpdateCourse: (course: Course) => void;
  onAddCourse: (course: Course) => void;
  onDeleteCourse: (id: string) => void;

  subscriptions: ShareSubscription[];
  onApproveSubscription: (subId: string, customCode?: string) => void;
  onForceValidateSubscription: (subId: string) => void;
  onRejectSubscription: (subId: string) => void;

  projects: InvestmentProject[];
  onUpdateProject: (proj: InvestmentProject) => void;
  onAddProject: (proj: InvestmentProject) => void;

  walletsByEmail: Record<string, InvestorWallet>;
  onAdjustWallet: (email: string, deltaBalance: number, reason: string) => void;

  transactions: WalletTransaction[];
  onApproveTransaction?: (txId: string) => void;

  currentProfile: InvestorProfile;
  emails: EmailNotification[];
  onSendManualEmail?: (recipientEmail: string, subject: string, code: string, message: string) => void;

  onExitAdmin: () => void;
}

export const ScreenAdmin: React.FC<ScreenAdminProps> = ({
  products,
  onUpdateProduct,
  onAddProduct,
  onDeleteProduct,
  courses,
  onUpdateCourse,
  subscriptions,
  onApproveSubscription,
  onForceValidateSubscription,
  onRejectSubscription,
  projects,
  walletsByEmail: _walletsByEmail,
  onAdjustWallet,
  transactions,
  currentProfile,
  emails,
  onExitAdmin
}) => {
  // Admin Tabs
  const [activeAdminTab, setActiveAdminTab] = useState<
    'bourse' | 'produits' | 'formations' | 'finances' | 'audit'
  >('bourse');

  // Notification message
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const showNotice = (msg: string) => {
    setAdminNotice(msg);
    setTimeout(() => setAdminNotice(null), 3000);
  };

  // State for editing a product inline or modal
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdRef, setNewProdRef] = useState('EM-MAT-');
  const [newProdDomain, setNewProdDomain] = useState<'electrotechnique' | 'electronique'>('electronique');
  const [newProdCategory, setNewProdCategory] = useState<'kit' | 'tool' | 'ic' | 'module' | 'electrotech'>('kit');
  const [newProdPrice, setNewProdPrice] = useState(16000);
  const [newProdOldPrice, setNewProdOldPrice] = useState(20000);
  const [newProdStock, setNewProdStock] = useState(20);
  const [newProdDesc, setNewProdDesc] = useState('');

  // State for Course Editing / Adding
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterDuration, setNewChapterDuration] = useState('30 min');

  // State for manual wallet credit
  const [creditEmail, setCreditEmail] = useState(currentProfile.email);
  const [creditAmount, setCreditAmount] = useState(25000);
  const [creditReason, setCreditReason] = useState('Ajustement administratif accordé');

  // Stats calculation
  const pendingSubs = subscriptions.filter((s) => s.status === 'pending_admin');
  const paidSubs = subscriptions.filter((s) => s.status === 'paid_and_issued');
  const totalCapitalCollected = paidSubs.reduce((total, subscription) => total + subscription.totalAmount, 0);
  const totalProductsCount = products.length;

  return (
    <div className="space-y-5 pb-16 animate-fadeIn">
      {/* =========================================================================
          BARRE DE COMMANDEMENT SUPRÊME ADMINISTRATEUR
          ========================================================================= */}
      <section className="p-5 rounded-2xl bg-white border-2 border-red-500 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-300 flex items-center justify-center text-red-600 font-black animate-pulse">
              <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-syne text-base sm:text-lg font-extrabold text-red-700 uppercase tracking-wider">
                  Direction Générale • Super-Admin Sans Limite
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-red-100 border border-red-300 text-red-800 text-[10px] font-extrabold">
                  MODE CONTRÔLE TOTAL
                </span>
              </div>
              <p className="text-[12px] text-slate-500">
                Accès administrateur exclusif non visible des utilisateurs ordinaires.
              </p>
            </div>
          </div>

          {/* Bouton pour repasser en vue client */}
          <button
            type="button"
            onClick={onExitAdmin}
            className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-sm text-cyan-600">visibility</span>
            <span>Retourner à la Vue Utilisateur</span>
          </button>
        </div>

        {/* Notice toast */}
        {adminNotice && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold text-center animate-fadeIn flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span>{adminNotice}</span>
          </div>
        )}

        {/* KPI Strip Super Admin */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Demandes en Attente</span>
            <span className="font-syne text-base font-extrabold text-amber-700">
              {pendingSubs.length} à approuver
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Capital Total Souscrit</span>
            <span className="font-syne text-base font-extrabold text-slate-900">
              {totalCapitalCollected.toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Composants au Catalogue</span>
            <span className="font-syne text-base font-extrabold text-cyan-700">
              {totalProductsCount} références
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Prix par opération</span>
            <span className="font-syne text-base font-extrabold text-emerald-700">
              {projects.length} opération(s)
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          NAVIGATION INTERNE DE LA PAGE ADMINISTRATEUR
          ========================================================================= */}
      <div className="flex flex-wrap gap-1.5 p-1.5 bg-white rounded-2xl border border-slate-200 text-xs shadow-sm">
        {[
          { id: 'bourse', label: "Accords Actions & Bourse", icon: 'gavel', badge: pendingSubs.length },
          { id: 'produits', label: 'Composants & Prix Stocks', icon: 'memory', badge: products.length },
          { id: 'formations', label: 'Formations & Chapitres', icon: 'school', badge: courses.length },
          { id: 'finances', label: 'Trésorerie & Dépôts/Retraits', icon: 'payments' },
          { id: 'audit', label: 'Journal & Configuration', icon: 'terminal' }
        ].map((tab) => {
          const isActive = activeAdminTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveAdminTab(tab.id as any)}
              className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                isActive
                  ? 'btn-gold-prestige shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  isActive ? 'bg-slate-950 text-amber-300' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          ONGLET 1 : GESTION DES DEMANDES D'ACTIONS & ACCORD ADMINISTRATEUR
          ========================================================================= */}
      {activeAdminTab === 'bourse' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950">
            <div>
              Le prix unitaire et le quota de parts sont gérés individuellement dans chaque opération de financement.
            </div>
          </div>

          {/* Liste des demandes en attente de l'accord Admin */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-syne text-[16px] font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">pending_actions</span>
                <span>Demandes de Souscription à Traiter ({subscriptions.length})</span>
              </h3>
              <span className="text-[12px] text-slate-500">
                L'administrateur délivre le mot de passe confidentiel par email.
              </span>
            </div>

            {subscriptions.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                Aucune demande de souscription pour le moment.
              </div>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((sub) => {
                  const isPending = sub.status === 'pending_admin';
                  const isApproved = sub.status === 'approved_pending_payment';
                  const isPaid = sub.status === 'paid_and_issued';

                  return (
                    <div
                      key={sub.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isPending
                          ? 'bg-amber-50/50 border-amber-400 shadow-sm'
                          : isApproved
                          ? 'bg-cyan-50/40 border-cyan-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-syne font-bold text-slate-900 text-[15px]">
                              {sub.investorName}
                            </span>
                            <span className="font-mono text-[11px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 font-bold">
                              {sub.id}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isPending
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : isApproved
                                ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}>
                              {isPending ? 'EN ATTENTE D’ACCORD' : isApproved ? 'ACCORD DONNÉ • EN ATTENTE PAIEMENT' : 'ACTIONS DÉTENUES & PAYÉES'}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                            <span className="text-cyan-800 font-medium">
                              Email : <strong>{sub.investorEmail}</strong>
                            </span>
                            <span>Tél : {sub.investorPhone}</span>
                            <span>Demande faite le : {sub.requestedAt}</span>
                          </div>

                          <div className="text-xs pt-1">
                            <span className="text-slate-800 font-semibold">
                              Volume :{' '}
                              <strong className="text-amber-800 text-sm">
                                {sub.shares} parts
                              </strong>{' '}
                              × {sub.sharePrice} FCFA ={' '}
                              <strong className="text-amber-800 text-sm">
                                {sub.totalAmount.toLocaleString('fr-FR')} FCFA
                              </strong>
                            </span>
                          </div>

                          {sub.adminPasswordCode && (
                            <div className="p-2.5 rounded-xl bg-white border border-amber-300 text-xs font-mono text-amber-900 flex items-center gap-2 mt-1 shadow-sm">
                              <span className="material-symbols-outlined text-sm text-amber-600">vpn_key</span>
                              <span>
                                Code / Mot de passe généré pour l'investisseur :{' '}
                                <strong className="text-slate-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                                  {sub.adminPasswordCode}
                                </strong>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Actions Administrateur Sans Limite */}
                        <div className="flex flex-col sm:flex-row gap-2 shrink-0 pt-2 sm:pt-0">
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => {
                                onApproveSubscription(sub.id);
                                showNotice(`Accord accordé à ${sub.investorName} ! Mot de passe envoyé par email.`);
                              }}
                              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                            >
                              <span className="material-symbols-outlined text-base">task_alt</span>
                              <span>Donner mon Accord &amp; Envoyer le Mot de Passe</span>
                            </button>
                          )}

                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => {
                                onForceValidateSubscription(sub.id);
                                showNotice(`Actions émises immédiatement pour ${sub.investorName} !`);
                              }}
                              className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-sm text-amber-600">verified</span>
                              <span>Forcer Paiement &amp; Émettre Actions</span>
                            </button>
                          )}

                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => {
                                onRejectSubscription(sub.id);
                                showNotice(`Souscription ${sub.id} rejetée.`);
                              }}
                              className="py-2 px-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                              title="Rejeter cette souscription"
                            >
                              <span className="material-symbols-outlined text-sm">cancel</span>
                              <span>Rejeter</span>
                            </button>
                          )}
                        </div>
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
          ONGLET 2 : GESTION DES PRODUITS & PRIX DE STOCK (ESP32 Starter Kit, etc.)
          ========================================================================= */}
      {activeAdminTab === 'produits' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-syne text-[16px] font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">inventory</span>
                <span>Catalogue Matériel &amp; Gestion des Prix (Total : {products.length})</span>
              </h3>
              <p className="text-[12px] text-slate-500">
                Fixez les prix officiels et les stocks. Le prix du Starter Kit ESP32 est actuellement de 16 000 FCFA.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddProductOpen(!isAddProductOpen)}
              className="py-2 px-3.5 rounded-xl btn-gold-prestige font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-base">
                {isAddProductOpen ? 'close' : 'add_box'}
              </span>
              <span>{isAddProductOpen ? 'Fermer le formulaire' : '+ Ajouter un Produit'}</span>
            </button>
          </div>

          {/* Formulaire d'ajout d'un nouveau produit */}
          {isAddProductOpen && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newProdName.trim()) return;

                const newId = `prod-admin-${Date.now()}`;
                const newProduct: Product = {
                  id: newId,
                  ref: newProdRef.trim(),
                  name: newProdName.trim(),
                  category: newProdCategory,
                  categoryLabel: newProdDomain === 'electrotechnique' ? 'Électrotechnique & Puissance' : 'Microélectronique',
                  domain: newProdDomain,
                  subGroup: newProdDomain === 'electrotechnique' ? 'armoires' : 'microcontroleurs',
                  subGroupLabel: newProdDomain === 'electrotechnique' ? 'Armoires & Puissance' : 'Microcontrôleurs & Dev',
                  badge: 'Nouveau Produit Certifié',
                  badgeStyle: 'gold',
                  price: newProdPrice,
                  oldPrice: newProdOldPrice > newProdPrice ? newProdOldPrice : undefined,
                  image: newProdDomain === 'electrotechnique'
                    ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuBuaVkPKGw5b2ruBk5udC5gn5sOiMj7xE9CLBC8SKT8nBNAEo4WqH9SOClx1Ytxg1DuYmMU2hYEK0JMrd_OZR1MFcFJ0MSYzjiQdmASMUT9Ne6SLpH8Hio5QCBLnBznO2RVP9qGBIgqo5OgF0emaFcugjDASaqfe5yoOuGnpKPqVg7J1veh5LEIsdMCIXctjqGh2bQoHJ6Hu8ZSTZcC8pVtd2WNgI4eczkCtlkKjQ1VW4KrOkds3-1sSk2bkffDWwv2yRA'
                    : 'https://lh3.googleusercontent.com/aida-public/AB6AXuDO3XEmVyI9r_p_BK_VFWtvqYC6Ake0HolRpBnElH-sGAP8TVO8HvOxAOpWMp9p2vsOzEgeYhbGH23Ve6Ud-69gatcUspMmqT0JXbYqCEk8xbfGdwLut9Lnn5YtOqz8PofUgg5BIJgUBV9MR5qJx6EX79wmC81VFpTeD2WlHydn2FuKL1Y_qPm5uE-Ja7bMcTc-kAxq5iGf4Ls8-sVC-YMKhXZhpjkWLf9AUbaYqP_97RPmU9q5u9yPMHuVtOOACuRiuoM',
                  description: newProdDesc.trim() || 'Matériel d’ingénierie certifié conforme aux normes industrielles.',
                  details: [
                    'Contrôle qualité strict en laboratoire ELECTRO-MEN',
                    'Livraison express Ouagadougou, Bobo-Dioulasso et toute la zone UEMOA',
                    'Support technique garanti par nos ingénieurs'
                  ],
                  stock: newProdStock,
                  inStock: newProdStock > 0
                };

                onAddProduct(newProduct);
                setIsAddProductOpen(false);
                setNewProdName('');
                setNewProdDesc('');
                showNotice(`Produit "${newProduct.name}" ajouté avec succès au catalogue !`);
              }}
              className="p-5 rounded-2xl bg-white border-2 border-amber-400 shadow-sm space-y-3 text-xs"
            >
              <h4 className="font-syne text-sm font-bold text-amber-800 uppercase">
                Ajouter un Nouveau Composant au Stock ELECTRO-MEN
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold">Nom du Produit *</label>
                  <input
                    type="text"
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder="Ex: Variateur de Vitesse 4kW"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold">Référence Officielle *</label>
                  <input
                    type="text"
                    required
                    value={newProdRef}
                    onChange={(e) => setNewProdRef(e.target.value)}
                    placeholder="EM-MAT-VFD-40"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold">Domaine d'appartenance</label>
                  <select
                    value={newProdDomain}
                    onChange={(e) => setNewProdDomain(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                  >
                    <option value="electrotechnique">Électrotechnique (Puissance &amp; Réseaux)</option>
                    <option value="electronique">Électronique (Embarqué &amp; IoT)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold">Prix de Vente (FCFA) *</label>
                  <input
                    type="number"
                    required
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-amber-700 font-bold focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold">Prix Barré / Promo (FCFA)</label>
                  <input
                    type="number"
                    value={newProdOldPrice}
                    onChange={(e) => setNewProdOldPrice(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-500 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold">Quantité en Stock</label>
                  <input
                    type="number"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-semibold">Description Technique</label>
                <textarea
                  rows={2}
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  placeholder="Spécifications de tension, puissance et caractéristiques d'utilisation..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl btn-gold-prestige font-bold text-xs uppercase"
                >
                  Enregistrer &amp; Publier au Stock
                </button>
              </div>
            </form>
          )}

          {/* Table des produits avec modification rapide des prix */}
          <div className="space-y-2">
            {products.map((prod) => (
              <div
                key={prod.id}
                className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 p-1 border border-slate-200 flex items-center justify-center shrink-0">
                    <img src={prod.image} alt={prod.name} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-syne text-[14px] font-bold text-slate-900">
                        {prod.name}
                      </h4>
                      <span className="text-[10px] text-cyan-700 font-mono font-bold bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200">
                        {prod.ref}
                      </span>
                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                        prod.domain === 'electrotechnique' ? 'bg-cyan-50 text-cyan-800 border border-cyan-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {prod.domain === 'electrotechnique' ? 'Électrotechnique' : 'Électronique'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Stock : <strong className={prod.stock > 0 ? 'text-emerald-700' : 'text-red-600'}>{prod.stock} unités</strong> ({prod.inStock ? 'Disponible' : 'Rupture'})
                    </span>
                  </div>
                </div>

                {/* Commandes rapides : Prix, Stock, Suppression */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 pl-1.5 font-bold">Prix :</span>
                    <input
                      type="number"
                      step={500}
                      value={prod.price}
                      onChange={(e) => {
                        const newPrice = parseInt(e.target.value, 10) || 0;
                        onUpdateProduct({ ...prod, price: newPrice });
                      }}
                      className="w-20 bg-transparent text-right font-syne font-bold text-amber-700 text-xs outline-none"
                    />
                    <span className="text-[11px] text-slate-700 font-bold pr-1.5">FCFA</span>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 pl-1.5 font-bold">Stock :</span>
                    <input
                      type="number"
                      value={prod.stock}
                      onChange={(e) => {
                        const newStock = parseInt(e.target.value, 10) || 0;
                        onUpdateProduct({ ...prod, stock: newStock, inStock: newStock > 0 });
                      }}
                      className="w-12 bg-transparent text-center font-bold text-xs text-slate-900 outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Supprimer ${prod.name} du catalogue ?`)) {
                        onDeleteProduct(prod.id);
                        showNotice(`Produit ${prod.name} supprimé.`);
                      }
                    }}
                    className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center justify-center cursor-pointer"
                    title="Supprimer du catalogue"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          ONGLET 3 : GESTION DES FORMATIONS, VIDÉOS & CHAPITRES
          ========================================================================= */}
      {activeAdminTab === 'formations' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-syne text-[16px] font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-600">school</span>
              <span>Académie ELECTRO-MEN • Vidéos, Chapitres &amp; Tarifs</span>
            </h3>
            <p className="text-[12px] text-slate-500">
              L'administrateur fixe les prix des cours, configure les chapitres de vidéos et le syllabus.
            </p>
          </div>

          <div className="space-y-4">
            {courses.map((course) => (
              <div
                key={course.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-cyan-700 font-bold uppercase">
                      {course.category} • {course.domain || 'Multi-domaines'}
                    </span>
                    <h4 className="font-syne text-[15px] font-bold text-slate-900">
                      {course.title}
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Formateur : {course.instructor} • Durée totale : {course.duration}
                    </span>
                  </div>

                  {/* Modification du Prix de la formation */}
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-600 font-medium">Tarif du Cours :</span>
                    <input
                      type="number"
                      step={1000}
                      value={course.price}
                      onChange={(e) => {
                        const newPrice = parseInt(e.target.value, 10) || 0;
                        onUpdateCourse({ ...course, price: newPrice });
                      }}
                      className="w-24 bg-transparent text-right font-syne font-bold text-amber-700 text-sm outline-none"
                    />
                    <span className="text-xs text-slate-800 font-bold">FCFA</span>
                  </div>
                </div>

                {/* Gestion des Chapitres / Modules de cours */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 uppercase">
                      Chapitres &amp; Modules Vidéo ({course.syllabus.length} chapitres)
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                    {course.syllabus.map((chap, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-900"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="material-symbols-outlined text-cyan-600 text-sm">play_circle</span>
                          <span className="truncate font-medium">{chap.title}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-500 font-mono">{chap.duration}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedSyllabus = course.syllabus.filter((_, i) => i !== idx);
                              onUpdateCourse({
                                ...course,
                                syllabus: updatedSyllabus,
                                modulesCount: updatedSyllabus.length
                              });
                              showNotice('Chapitre supprimé.');
                            }}
                            className="text-red-500 hover:text-red-700 material-symbols-outlined text-sm cursor-pointer"
                            title="Supprimer ce chapitre"
                          >
                            close
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ajouter un chapitre directement */}
                  <div className="pt-2 flex flex-wrap gap-2">
                    <input
                      type="text"
                      placeholder="Titre du nouveau chapitre vidéo..."
                      value={editingCourse?.id === course.id ? newChapterTitle : ''}
                      onFocus={() => setEditingCourse(course)}
                      onChange={(e) => setNewChapterTitle(e.target.value)}
                      className="flex-1 min-w-[200px] bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-cyan-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Durée (ex: 45 min)"
                      value={editingCourse?.id === course.id ? newChapterDuration : '30 min'}
                      onFocus={() => setEditingCourse(course)}
                      onChange={(e) => setNewChapterDuration(e.target.value)}
                      className="w-28 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-cyan-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newChapterTitle.trim()) return;
                        const updatedSyllabus = [
                          ...course.syllabus,
                          { id: `mod-${Date.now()}`, title: newChapterTitle.trim(), duration: newChapterDuration.trim() || '30 min', completed: false }
                        ];
                        onUpdateCourse({
                          ...course,
                          syllabus: updatedSyllabus,
                          modulesCount: updatedSyllabus.length
                        });
                        setNewChapterTitle('');
                        showNotice(`Nouveau chapitre ajouté au cours "${course.title}" !`);
                      }}
                      className="py-2 px-3.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 text-cyan-800 text-xs font-bold cursor-pointer"
                    >
                      + Ajouter Chapitre
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          ONGLET 4 : GESTION FINANCIÈRE & TRÉSORERIE (DÉPÔTS & RETRAITS)
          ========================================================================= */}
      {activeAdminTab === 'finances' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-syne text-[16px] font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">payments</span>
              <span>Gestion des Flux Financiers, Dépôts &amp; Retraits Mobile Money</span>
            </h3>
            <p className="text-[12px] text-slate-500">
              Créditez manuellement des portefeuilles, ajustez la trésorerie et auditez les règlements Orange Money, Moov Money et Wave.
            </p>
          </div>

          {/* Outil de crédit direct d'un compte */}
          <div className="p-5 rounded-2xl bg-white border border-emerald-400 shadow-sm space-y-3">
            <h4 className="font-syne text-sm font-bold text-emerald-700 uppercase">
              Ajustement Direct de Trésorerie Portefeuille
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-600 font-semibold block">Email Investisseur</label>
                <input
                  type="email"
                  value={creditEmail}
                  onChange={(e) => setCreditEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 font-semibold block">Montant à Ajouter (FCFA)</label>
                <input
                  type="number"
                  step={5000}
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-emerald-700 focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 font-semibold block">Motif Administratif</label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  onAdjustWallet(creditEmail, creditAmount, creditReason);
                  showNotice(`Portefeuille de ${creditEmail} crédité de ${creditAmount.toLocaleString('fr-FR')} FCFA`);
                }}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase cursor-pointer shadow-sm"
              >
                Créditer le Solde Cash
              </button>
            </div>
          </div>

          {/* Historique des transactions */}
          <div className="space-y-2">
            <h4 className="font-syne text-xs font-bold text-slate-800 uppercase">
              Dernières Transactions Enregistrées ({transactions.length})
            </h4>

            <div className="space-y-1.5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`material-symbols-outlined text-base ${
                      tx.type === 'depot' ? 'text-emerald-600' : tx.type === 'retrait' ? 'text-amber-600' : 'text-amber-700'
                    }`}>
                      {tx.type === 'depot' ? 'arrow_downward' : tx.type === 'retrait' ? 'arrow_upward' : 'paid'}
                    </span>
                    <div>
                      <strong className="text-slate-900 uppercase font-bold">{tx.type} • {tx.method}</strong>
                      <span className="text-[10px] text-slate-500 block">Réf: {tx.reference} • {tx.date}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`font-syne font-extrabold ${
                      tx.type === 'depot' ? 'text-emerald-700' : 'text-amber-800'
                    }`}>
                      {tx.type === 'depot' ? '+' : '-'}{tx.amount.toLocaleString('fr-FR')} FCFA
                    </span>
                    <span className="text-[10px] text-emerald-700 block font-bold">{tx.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ONGLET 5 : JOURNAL D'AUDIT & SÉCURITÉ SYSTÈME
          ========================================================================= */}
      {activeAdminTab === 'audit' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-syne text-[16px] font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">terminal</span>
              <span>Journal d'Audit Système &amp; Notifications Emails Expédiées</span>
            </h3>
            <p className="text-[12px] text-slate-500">
              Traçabilité intégrale des mots de passe générés et envoyés aux investisseurs.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <span className="text-xs font-bold text-amber-800 uppercase block">
              Historique des Emails Envoyés ({emails.length})
            </span>

            <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar font-mono text-[11px]">
              {emails.map((m) => (
                <div key={m.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span className="text-cyan-700 font-bold">À: {m.recipientEmail} ({m.recipientName})</span>
                    <span className="text-slate-400">{m.date}</span>
                  </div>
                  <div className="text-slate-900 font-bold">{m.subject}</div>
                  <div className="text-amber-800">
                    Mot de passe confidentiel transmis : <strong className="text-slate-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">{m.code}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
