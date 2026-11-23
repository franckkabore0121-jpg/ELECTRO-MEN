export type AdminRole = 'admin_principal' | 'admin_secondaire' | 'utilisateur';

export type AdminPermission =
  | 'manage_products'
  | 'delete_products'
  | 'manage_courses'
  | 'delete_courses'
  | 'manage_operations'
  | 'manage_subscriptions'
  | 'manage_investors'
  | 'manage_investors_password'
  | 'manage_funds'
  | 'manage_wallet_adjust'
  | 'manage_delivery'
  | 'manage_content'
  | 'view_realtime'
  | 'view_audit';

export interface AdminPermissionDefinition {
  id: AdminPermission;
  label: string;
  description: string;
  category: 'Catalogue & Académie' | 'Investisseurs & Opérations' | 'Trésorerie & Logistique' | 'Contenu & Supervision';
}

export const ADMIN_PERMISSION_DEFINITIONS: AdminPermissionDefinition[] = [
  {
    id: 'manage_products',
    label: 'Produits & Stocks',
    description: 'Ajouter, modifier produits, tarifs, stocks, statuts et catégories.',
    category: 'Catalogue & Académie'
  },
  {
    id: 'delete_products',
    label: 'Suppression produits',
    description: 'Archiver ou supprimer des produits et sous-groupes du catalogue.',
    category: 'Catalogue & Académie'
  },
  {
    id: 'manage_courses',
    label: 'Académie & Formations',
    description: 'Créer, modifier, publier ou suspendre des formations et catégories de cours.',
    category: 'Catalogue & Académie'
  },
  {
    id: 'delete_courses',
    label: 'Suppression formations',
    description: 'Archiver ou supprimer des formations et catégories de cours.',
    category: 'Catalogue & Académie'
  },
  {
    id: 'manage_operations',
    label: 'Opérations & Offres',
    description: 'Créer, modifier, ouvrir ou fermer des opérations de financement et offres.',
    category: 'Investisseurs & Opérations'
  },
  {
    id: 'manage_subscriptions',
    label: 'Souscriptions & Dividendes',
    description: 'Approuver, valider, refuser des souscriptions et distribuer les gains.',
    category: 'Investisseurs & Opérations'
  },
  {
    id: 'manage_investors',
    label: 'Dossiers Investisseurs',
    description: 'Consulter les dossiers complets, modifier les parts/boutiques et statuts.',
    category: 'Investisseurs & Opérations'
  },
  {
    id: 'manage_investors_password',
    label: 'Mots de passe Investisseurs',
    description: 'Définir ou réinitialiser les mots de passe d’accès investisseur.',
    category: 'Investisseurs & Opérations'
  },
  {
    id: 'manage_funds',
    label: 'Dépôts & Retraits',
    description: 'Traiter, admettre/confirmer ou refuser les demandes de trésorerie.',
    category: 'Trésorerie & Logistique'
  },
  {
    id: 'manage_wallet_adjust',
    label: 'Ajustements portefeuille',
    description: 'Effectuer des régularisations manuelles de solde investisseur.',
    category: 'Trésorerie & Logistique'
  },
  {
    id: 'manage_delivery',
    label: 'Logistique & Boutiques',
    description: 'Gérer les zones/tarifs de livraison et les pays/drapeaux des boutiques.',
    category: 'Trésorerie & Logistique'
  },
  {
    id: 'manage_content',
    label: 'Contenu, Vidéos & Messagerie',
    description: 'Gérer vidéos, activités, documents, notifications et messagerie investisseurs.',
    category: 'Contenu & Supervision'
  },
  {
    id: 'view_realtime',
    label: 'Utilisateurs Temps Réel',
    description: 'Consulter le flux des sessions connectées en direct.',
    category: 'Contenu & Supervision'
  },
  {
    id: 'view_audit',
    label: 'Journal d’audit & Corbeille',
    description: 'Consulter le journal d’audit, restaurer ou purger les archives.',
    category: 'Contenu & Supervision'
  }
];

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = ADMIN_PERMISSION_DEFINITIONS.map((item) => item.id);

export const DEFAULT_SECONDARY_ADMIN_PERMISSIONS: AdminPermission[] = [
  'manage_products',
  'manage_content'
];

const VALID_PERMISSION_SET = new Set<string>(ALL_ADMIN_PERMISSIONS);

export function sanitizeAdminPermissions(input: unknown): AdminPermission[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const deduped: AdminPermission[] = [];
  for (const item of input) {
    if (typeof item === 'string' && VALID_PERMISSION_SET.has(item) && !deduped.includes(item as AdminPermission)) {
      deduped.push(item as AdminPermission);
    }
  }
  return deduped;
}

export function resolveAdminPermissions(
  role: AdminRole | string | undefined,
  permissions?: unknown
): AdminPermission[] {
  if (role === 'admin_principal') {
    return [...ALL_ADMIN_PERMISSIONS];
  }
  if (role !== 'admin_secondaire') {
    return [];
  }
  const sanitized = sanitizeAdminPermissions(permissions);
  if (sanitized !== undefined) {
    return sanitized;
  }
  return [...DEFAULT_SECONDARY_ADMIN_PERMISSIONS];
}

export function hasAdminPermissionFromList(
  role: AdminRole | string | undefined,
  permissions: unknown,
  required: AdminPermission
): boolean {
  if (role === 'admin_principal') return true;
  if (role !== 'admin_secondaire') return false;
  return resolveAdminPermissions(role, permissions).includes(required);
}
