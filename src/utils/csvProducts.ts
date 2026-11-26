import {
  CategoryGroup,
  ELECTRONIQUE_GROUPS,
  ELECTROTECHNIQUE_GROUPS,
  INFORMATIQUE_GROUPS,
  Product,
  ProductStockStatus,
  getProductStockStatus
} from '../data/mockData.ts';

export const PRODUCT_CSV_HEADERS = [
  'ref',
  'nom',
  'marque',
  'description',
  'prix',
  'ancien_prix',
  'categorie',
  'sous_categorie',
  'boutique',
  'stock',
  'statut_stock',
  'image_url',
  'video_url',
  'caracteristiques',
  'publie',
  'promo',
  'nouveaute',
  'vente_flash',
  'accueil'
] as const;

export type ProductCsvHeader = (typeof PRODUCT_CSV_HEADERS)[number];

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const needsQuotes = /[;"\r\n]/.test(raw) || raw.startsWith(' ') || raw.endsWith(' ');
  const escaped = raw.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function formatBooleanOuiNon(value: boolean | undefined): string {
  return value ? 'oui' : 'non';
}

function formatCharacteristics(product: Product): string {
  const specs = Array.isArray(product.specs)
    ? product.specs.map((item) => item.trim()).filter(Boolean)
    : [];
  const details = Array.isArray(product.details)
    ? product.details.map((item) => item.trim()).filter(Boolean)
    : [];
  return Array.from(new Set([...specs, ...details])).join(' | ');
}

export function buildProductsCsvContent(productsToExport: Product[]): string {
  const lines: string[] = [];
  lines.push(PRODUCT_CSV_HEADERS.map((h) => escapeCsvCell(h)).join(';'));

  for (const product of productsToExport) {
    const stockStatus = getProductStockStatus(product);
    const price = Number.isFinite(Number(product.price)) ? Math.max(0, Math.round(Number(product.price))) : 0;
    const oldPrice =
      typeof product.oldPrice === 'number' && Number.isFinite(product.oldPrice) && product.oldPrice > 0
        ? Math.round(product.oldPrice)
        : '';
    const stockQty =
      stockStatus === 'out_of_stock'
        ? 0
        : Number.isFinite(Number(product.stock))
        ? Math.max(0, Math.round(Number(product.stock)))
        : 0;
    const subCategory = product.subGroupLabel || product.subGroup || '';
    const category = product.categoryLabel || product.category || '';
    const isPublished = product.isPublished !== false && !product.isDraft;

    const row: Array<string | number> = [
      product.ref || '',
      product.name || '',
      product.brand || '',
      product.description || '',
      price,
      oldPrice,
      category,
      subCategory,
      product.domain || 'electronique',
      stockQty,
      stockStatus,
      product.image || '',
      product.videoUrl || product.youtubeUrl || '',
      formatCharacteristics(product),
      formatBooleanOuiNon(isPublished),
      formatBooleanOuiNon(Boolean(product.isPromo || (typeof product.oldPrice === 'number' && product.oldPrice > product.price))),
      formatBooleanOuiNon(Boolean(product.isNew || product.isNewArrival)),
      formatBooleanOuiNon(Boolean(product.isFlashSale)),
      formatBooleanOuiNon(Boolean(product.isFeaturedOnHome))
    ];
    lines.push(row.map((cell) => escapeCsvCell(cell)).join(';'));
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function exportProductsToCsv(productsToExport: Product[], filename?: string): void {
  const csvContent = buildProductsCsvContent(productsToExport);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', filename || `ELECTRO-MEN_Catalogue_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildProductsCsvTemplateContent(): string {
  const sampleRow = [
    'ELM-ESP32-S3',
    'Module ESP32-S3 Wi-Fi & Bluetooth',
    'Espressif',
    'Microcontrôleur dual-core 240 MHz pour projets IoT;\nLivré avec connecteur USB-C.',
    '7500',
    '9000',
    'Microcontrôleurs & Cartes Dev',
    'kits',
    'electronique',
    '25',
    'in_stock',
    'https://exemple.electromen.bf/images/esp32-s3.jpg',
    '',
    'Wi-Fi 2.4 GHz | Bluetooth 5 LE | USB-C natif',
    'oui',
    'oui',
    'oui',
    'non',
    'oui'
  ];

  const headerLine = PRODUCT_CSV_HEADERS.map((h) => escapeCsvCell(h)).join(';');
  const sampleLine = sampleRow.map((cell) => escapeCsvCell(cell)).join(';');
  return `\uFEFF${headerLine}\r\n${sampleLine}\r\n`;
}

export function downloadProductsCsvTemplate(): void {
  const content = buildProductsCsvTemplateContent();
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'ELECTRO-MEN_Modele_Import_Produits.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type DetectedCsvEncoding = 'UTF-8 BOM' | 'UTF-8' | 'Windows-1252 (converti)';

export function decodeCsvBuffer(buffer: ArrayBuffer): {
  text: string;
  encoding: DetectedCsvEncoding;
} {
  const bytes = new Uint8Array(buffer);
  const hasUtf8Bom =
    bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;

  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let text = decoder.decode(hasUtf8Bom ? bytes.subarray(3) : bytes);
    if (text.startsWith('\uFEFF')) text = text.slice(1);
    return {
      text,
      encoding: hasUtf8Bom ? 'UTF-8 BOM' : 'UTF-8'
    };
  } catch {
    const fallbackDecoder = new TextDecoder('windows-1252');
    let text = fallbackDecoder.decode(bytes);
    if (text.startsWith('\uFEFF')) text = text.slice(1);
    return {
      text,
      encoding: 'Windows-1252 (converti)'
    };
  }
}

export function detectCsvDelimiter(rawText: string): ';' | ',' {
  const text = rawText.replace(/^\uFEFF/, '');
  let inQuotes = false;
  let semicolonCount = 0;
  let commaCount = 0;
  let seenNonWhitespace = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      seenNonWhitespace = true;
      continue;
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (seenNonWhitespace) break;
      continue;
    }
    if (!inQuotes) {
      if (ch === ';') semicolonCount++;
      else if (ch === ',') commaCount++;
      if (!/\s/.test(ch)) seenNonWhitespace = true;
    }
  }

  if (commaCount > semicolonCount) return ',';
  return ';';
}

export function parseCsvRows(rawText: string, delimiter: ';' | ','): string[][] {
  const text = rawText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }
    if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      continue;
    }
    if (ch === '\n') {
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      continue;
    }
    currentCell += ch;
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

const HEADER_ALIAS_MAP: Record<string, ProductCsvHeader> = {
  ref: 'ref',
  reference: 'ref',
  code: 'ref',
  code_produit: 'ref',
  product_code: 'ref',
  product_ref: 'ref',
  ref_produit: 'ref',
  sku: 'ref',
  part_number: 'ref',
  numero_piece: 'ref',

  nom: 'nom',
  name: 'nom',
  title: 'nom',
  titre: 'nom',
  product_name: 'nom',
  nom_produit: 'nom',
  nom_du_produit: 'nom',
  produit: 'nom',
  product: 'nom',
  product_title: 'nom',
  titre_produit: 'nom',
  libelle: 'nom',
  designation: 'nom',
  item_name: 'nom',

  marque: 'marque',
  brand: 'marque',
  brand_name: 'marque',
  nom_marque: 'marque',
  fabricant: 'marque',
  manufacturer: 'marque',
  maker: 'marque',
  vendor: 'marque',
  fournisseur: 'marque',

  description: 'description',
  desc: 'description',
  product_description: 'description',
  description_produit: 'description',
  short_description: 'description',
  description_courte: 'description',
  details_description: 'description',
  summary: 'description',
  resume: 'description',
  body: 'description',
  content: 'description',
  contenu: 'description',

  prix: 'prix',
  price: 'prix',
  montant: 'prix',
  unit_price: 'prix',
  prix_unitaire: 'prix',
  amount: 'prix',
  prix_fcfa: 'prix',
  prix_vente: 'prix',
  selling_price: 'prix',
  sale_price: 'prix',
  tarif: 'prix',
  cost: 'prix',
  cout: 'prix',

  ancien_prix: 'ancien_prix',
  old_price: 'ancien_prix',
  oldprice: 'ancien_prix',
  prix_barre: 'ancien_prix',
  original_price: 'ancien_prix',
  prix_original: 'ancien_prix',
  compare_at_price: 'ancien_prix',
  prix_avant_promo: 'ancien_prix',
  regular_price: 'ancien_prix',
  prix_normal: 'ancien_prix',
  list_price: 'ancien_prix',

  categorie: 'categorie',
  category: 'categorie',
  category_name: 'categorie',
  categorie_name: 'categorie',
  categorylabel: 'categorie',
  categorie_label: 'categorie',
  category_label: 'categorie',
  category_id: 'categorie',
  famille: 'categorie',
  family: 'categorie',
  groupe: 'categorie',
  group: 'categorie',
  group_label: 'categorie',

  sous_categorie: 'sous_categorie',
  souscategorie: 'sous_categorie',
  sub_category: 'sous_categorie',
  subcategory: 'sous_categorie',
  subgroup: 'sous_categorie',
  sub_group: 'sous_categorie',
  sous_groupe: 'sous_categorie',
  sub_category_name: 'sous_categorie',
  sous_categorie_label: 'sous_categorie',
  sub_group_label: 'sous_categorie',
  type: 'sous_categorie',
  product_type: 'sous_categorie',

  boutique: 'boutique',
  boutique_id: 'boutique',
  boutique_name: 'boutique',
  nom_boutique: 'boutique',
  shop: 'boutique',
  shop_id: 'boutique',
  shop_name: 'boutique',
  store: 'boutique',
  store_id: 'boutique',
  store_name: 'boutique',
  domain: 'boutique',
  domaine: 'boutique',
  rayon: 'boutique',
  secteur: 'boutique',
  sector: 'boutique',
  department: 'boutique',
  departement: 'boutique',

  stock: 'stock',
  stock_quantity: 'stock',
  stock_qty: 'stock',
  quantite: 'stock',
  quantite_en_stock: 'stock',
  quantite_stock: 'stock',
  qty: 'stock',
  quantity: 'stock',
  inventory: 'stock',
  inventaire: 'stock',
  available_quantity: 'stock',
  nb_stock: 'stock',
  count: 'stock',

  statut_stock: 'statut_stock',
  stock_status: 'statut_stock',
  stockstatus: 'statut_stock',
  disponibilite: 'statut_stock',
  availability: 'statut_stock',
  status: 'statut_stock',
  statut: 'statut_stock',
  etat_stock: 'statut_stock',
  in_stock: 'statut_stock',
  instock: 'statut_stock',
  en_stock: 'statut_stock',
  available: 'statut_stock',
  disponible: 'statut_stock',

  image_url: 'image_url',
  image: 'image_url',
  imageurl: 'image_url',
  images: 'image_url',
  img: 'image_url',
  img_url: 'image_url',
  photo_url: 'image_url',
  photo: 'image_url',
  photos: 'image_url',
  picture: 'image_url',
  picture_url: 'image_url',
  thumbnail: 'image_url',
  thumbnail_url: 'image_url',
  cover: 'image_url',
  cover_url: 'image_url',
  media_url: 'image_url',
  url_image: 'image_url',
  image_link: 'image_url',

  video_url: 'video_url',
  video: 'video_url',
  videourl: 'video_url',
  youtube_url: 'video_url',
  youtube: 'video_url',
  url_video: 'video_url',
  video_link: 'video_url',

  caracteristiques: 'caracteristiques',
  caracteristiques_techniques: 'caracteristiques',
  specs: 'caracteristiques',
  specifications: 'caracteristiques',
  details: 'caracteristiques',
  features: 'caracteristiques',
  attributs: 'caracteristiques',
  attributes: 'caracteristiques',
  proprietes: 'caracteristiques',
  properties: 'caracteristiques',
  technical_specs: 'caracteristiques',
  fiche_technique: 'caracteristiques',

  publie: 'publie',
  published: 'publie',
  is_published: 'publie',
  ispublished: 'publie',
  active: 'publie',
  is_active: 'publie',
  actif: 'publie',
  visible: 'publie',
  is_visible: 'publie',
  en_ligne: 'publie',
  online: 'publie',

  promo: 'promo',
  is_promo: 'promo',
  ispromo: 'promo',
  promotion: 'promo',
  on_sale: 'promo',
  en_promo: 'promo',
  discount: 'promo',
  is_discounted: 'promo',

  nouveaute: 'nouveaute',
  nouveau: 'nouveaute',
  is_new: 'nouveaute',
  isnew: 'nouveaute',
  is_new_arrival: 'nouveaute',
  new_arrival: 'nouveaute',
  new: 'nouveaute',

  vente_flash: 'vente_flash',
  flash_sale: 'vente_flash',
  is_flash_sale: 'vente_flash',
  isflashsale: 'vente_flash',
  flash: 'vente_flash',

  accueil: 'accueil',
  featured: 'accueil',
  is_featured: 'accueil',
  is_featured_on_home: 'accueil',
  isfeatured: 'accueil',
  home: 'accueil',
  en_vedette: 'accueil',
  vedette: 'accueil',
  highlight: 'accueil'
};

function canonicalizeHeader(rawHeader: string): {
  canonical: ProductCsvHeader | null;
  cleanedKey: string;
} {
  const camelSplit = rawHeader.replace(/([a-z0-9\u00C0-\u024F])([A-Z])/g, '$1_$2');
  const cleanedKey = normalizeToken(camelSplit)
    .replace(/[\s.\-()/]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return {
    canonical: HEADER_ALIAS_MAP[cleanedKey] || null,
    cleanedKey
  };
}

export function parseShopDomain(
  rawValue: string
): 'electronique' | 'electrotechnique' | 'informatique' | null {
  const norm = normalizeToken(rawValue).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return null;

  if (
    norm === 'electrotechnique' ||
    norm === 'electrotechniques' ||
    norm.includes('electrotech') ||
    norm.includes('electro tech') ||
    norm.includes('puissance') ||
    norm.includes('appareillage') ||
    norm.includes('haute tension') ||
    norm.includes('basse tension') ||
    norm === 'industrial' ||
    norm === 'industriel'
  ) {
    return 'electrotechnique';
  }

  if (
    norm === 'informatique' ||
    norm === 'informatiques' ||
    norm === 'info' ||
    norm === 'it' ||
    norm.includes('informatique') ||
    norm.includes('reseau') ||
    norm.includes('ordinateur') ||
    norm.includes('serveur') ||
    norm.includes('peripherique') ||
    norm.includes('computer') ||
    norm.includes('network') ||
    norm.includes('hardware') ||
    norm.includes('bureautique')
  ) {
    return 'informatique';
  }

  if (
    norm === 'electronique' ||
    norm === 'electroniques' ||
    norm === 'electro' ||
    norm.includes('electroniq') ||
    norm.includes('electronic') ||
    norm.includes('electromenager') ||
    norm.includes('electro menager') ||
    norm.includes('appliance') ||
    norm.includes('composant') ||
    norm.includes('component') ||
    norm.includes('microcontroleur') ||
    norm.includes('capteur') ||
    norm === 'iot'
  ) {
    return 'electronique';
  }

  return null;
}

function deduceDomainFromGroupValue(
  rawValue: string,
  domainGroups?: Record<'electronique' | 'electrotechnique' | 'informatique', CategoryGroup[]>
): 'electronique' | 'electrotechnique' | 'informatique' | null {
  const norm = normalizeToken(rawValue);
  if (!norm) return null;

  const sets: Array<{
    domain: 'electronique' | 'electrotechnique' | 'informatique';
    groups: CategoryGroup[];
  }> = [
    { domain: 'informatique', groups: domainGroups?.informatique || INFORMATIQUE_GROUPS },
    { domain: 'electrotechnique', groups: domainGroups?.electrotechnique || ELECTROTECHNIQUE_GROUPS },
    { domain: 'electronique', groups: domainGroups?.electronique || ELECTRONIQUE_GROUPS }
  ];

  for (const entry of sets) {
    for (const group of entry.groups) {
      if (group.id === 'all') continue;
      if (normalizeToken(group.id) === norm || normalizeToken(group.label) === norm) {
        return entry.domain;
      }
    }
  }
  return null;
}

function parseNumericInteger(rawValue: string): number | null {
  let cleaned = rawValue
    .trim()
    .replace(/fcfa|xof|cfa|eur|€|\$/gi, '')
    .replace(/[\s\u00A0\u202F]/g, '');
  if (!cleaned) return null;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(',') < cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
  } else if (hasDot) {
    if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

function parseCsvBoolean(rawValue: string, fallback: boolean): boolean {
  const norm = normalizeToken(rawValue);
  if (!norm) return fallback;
  if (['oui', 'yes', 'true', '1', 'vrai', 'actif', 'active', 'o'].includes(norm)) return true;
  if (['non', 'no', 'false', '0', 'faux', 'inactif', 'n'].includes(norm)) return false;
  return fallback;
}

function parseCsvStockStatus(rawValue: string): ProductStockStatus | null {
  const norm = normalizeToken(rawValue).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return null;
  if (
    norm === 'in stock' ||
    norm.includes('en stock') ||
    ['disponible', 'available', 'stock', 'true', 'oui', 'yes', '1', 'vrai'].includes(norm)
  ) {
    return 'in_stock';
  }
  if (
    norm === 'out of stock' ||
    norm.includes('rupture') ||
    norm.includes('sold out') ||
    ['epuise', 'indisponible', 'unavailable', 'false', 'non', 'no', '0', 'faux'].includes(norm)
  ) {
    return 'out_of_stock';
  }
  if (
    norm === 'on order' ||
    norm.includes('commande') ||
    ['preorder', 'pre order', 'backorder'].includes(norm)
  ) {
    return 'on_order';
  }
  return null;
}

function extractFirstImageUrl(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const first = parsed.find((item) => typeof item === 'string' && item.trim());
        if (typeof first === 'string') return first.trim();
      }
    } catch {
      // Fallback to raw string validation
    }
  }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.slice(1, -1).split(',')[0]?.replace(/^"+|"+$/g, '').trim();
    if (inner) return inner;
  }
  return trimmed;
}

function extractSpecsList(rawValue: string): string[] {
  const trimmed = rawValue.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
          .filter(Boolean);
      }
    } catch {
      // Fallback to delimiter split
    }
  }
  return trimmed
    .split(/\s*\|\s*|\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isValidImageOrVideoUrl(url: string, allowDataImage: boolean): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  if (allowDataImage && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export interface CsvColumnMapping {
  index: number;
  sourceHeader: string;
  mappedField: ProductCsvHeader | null;
  secondaryMappedField?: ProductCsvHeader;
  matchType: 'exact' | 'alias' | 'deduced_fallback' | 'ignored';
}

export interface CsvPreviewRow {
  lineNumber: number;
  raw: Record<string, string>;
  mappedRaw: Partial<Record<ProductCsvHeader, string>>;
  errors: string[];
  isValid: boolean;
  matchedExistingId?: string;
  product?: Product;
}

export interface CsvImportParseResult {
  detectedEncoding: DetectedCsvEncoding;
  detectedDelimiter: ';' | ',';
  headers: string[];
  columnMappings: CsvColumnMapping[];
  boutiqueSource: 'explicit_column' | 'category_fallback' | 'deduced_or_default' | 'none';
  rows: CsvPreviewRow[];
  validProducts: Product[];
  validCount: number;
  errorCount: number;
  fileError?: string;
}

export function parseAndValidateProductsCsv(
  input: string | ArrayBuffer,
  existingProducts: Product[] = [],
  domainGroups?: Record<'electronique' | 'electrotechnique' | 'informatique', CategoryGroup[]>,
  options?: {
    defaultDomain?: 'electronique' | 'electrotechnique' | 'informatique';
  }
): CsvImportParseResult {
  const decoded =
    typeof input === 'string'
      ? {
          text: input.replace(/^\uFEFF/, ''),
          encoding: (input.startsWith('\uFEFF') ? 'UTF-8 BOM' : 'UTF-8') as DetectedCsvEncoding
        }
      : decodeCsvBuffer(input);

  const detectedDelimiter = detectCsvDelimiter(decoded.text);
  const matrix = parseCsvRows(decoded.text, detectedDelimiter);

  if (matrix.length === 0) {
    return {
      detectedEncoding: decoded.encoding,
      detectedDelimiter,
      headers: [],
      columnMappings: [],
      boutiqueSource: 'none',
      rows: [],
      validProducts: [],
      validCount: 0,
      errorCount: 0,
      fileError: 'Le fichier CSV est vide.'
    };
  }

  const rawHeaders = matrix[0].map((h) => h.trim());
  const parsedHeaders = rawHeaders.map(canonicalizeHeader);
  const hasExplicitBoutiqueCol = parsedHeaders.some((h) => h.canonical === 'boutique');
  const hasCategorieCol = parsedHeaders.some((h) => h.canonical === 'categorie');
  const hasSubCategorieCol = parsedHeaders.some((h) => h.canonical === 'sous_categorie');

  let usedCategoryFallbackForBoutique = false;
  const columnMappings: CsvColumnMapping[] = rawHeaders.map((sourceHeader, index) => {
    const { canonical, cleanedKey } = parsedHeaders[index];
    if (!canonical) {
      return {
        index,
        sourceHeader,
        mappedField: null,
        matchType: 'ignored'
      };
    }

    if (!hasExplicitBoutiqueCol && canonical === 'categorie' && !usedCategoryFallbackForBoutique) {
      usedCategoryFallbackForBoutique = true;
      return {
        index,
        sourceHeader,
        mappedField: 'boutique',
        secondaryMappedField: 'categorie',
        matchType: 'deduced_fallback'
      };
    }

    return {
      index,
      sourceHeader,
      mappedField: canonical,
      matchType: cleanedKey === canonical ? 'exact' : 'alias'
    };
  });

  const boutiqueSource: CsvImportParseResult['boutiqueSource'] = hasExplicitBoutiqueCol
    ? 'explicit_column'
    : usedCategoryFallbackForBoutique
    ? 'category_fallback'
    : hasSubCategorieCol || options?.defaultDomain
    ? 'deduced_or_default'
    : 'none';

  const hasNomCol = columnMappings.some((m) => m.mappedField === 'nom');
  const hasPrixCol = columnMappings.some((m) => m.mappedField === 'prix');

  if (!hasNomCol || !hasPrixCol) {
    const missing: string[] = [];
    if (!hasNomCol) missing.push('nom (ou name / title / product_name)');
    if (!hasPrixCol) missing.push('prix (ou price / montant / unit_price)');
    return {
      detectedEncoding: decoded.encoding,
      detectedDelimiter,
      headers: rawHeaders,
      columnMappings,
      boutiqueSource,
      rows: [],
      validProducts: [],
      validCount: 0,
      errorCount: 0,
      fileError: `Colonnes obligatoires manquantes dans l'en-tête CSV : ${missing.join(', ')}.`
    };
  }

  if (matrix.length < 2) {
    return {
      detectedEncoding: decoded.encoding,
      detectedDelimiter,
      headers: rawHeaders,
      columnMappings,
      boutiqueSource,
      rows: [],
      validProducts: [],
      validCount: 0,
      errorCount: 0,
      fileError: 'Aucune ligne de produit trouvée sous la ligne d’en-tête.'
    };
  }

  const existingByRef = new Map<string, Product>();
  for (const prod of existingProducts) {
    if (prod.ref) {
      existingByRef.set(prod.ref.trim().toLowerCase(), prod);
    }
  }

  const seenRefsInCsv = new Set<string>();
  const previewRows: CsvPreviewRow[] = [];
  const validProducts: Product[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const rawCells = matrix[i];
    const lineNumber = i + 1;
    const mapped: Partial<Record<ProductCsvHeader, string>> = {};
    const rawDisplay: Record<string, string> = {};

    for (let colIdx = 0; colIdx < rawHeaders.length; colIdx++) {
      const cellValue = (rawCells[colIdx] ?? '').trim();
      const rawKey = rawHeaders[colIdx] || `col_${colIdx + 1}`;
      rawDisplay[rawKey] = cellValue;
      const mapping = columnMappings[colIdx];
      if (mapping?.mappedField && (!mapped[mapping.mappedField] || mapped[mapping.mappedField] === '')) {
        mapped[mapping.mappedField] = cellValue;
      }
      if (
        mapping?.secondaryMappedField &&
        (!mapped[mapping.secondaryMappedField] || mapped[mapping.secondaryMappedField] === '')
      ) {
        mapped[mapping.secondaryMappedField] = cellValue;
      }
    }

    const errors: string[] = [];
    const name = (mapped.nom || '').trim();
    if (!name) {
      errors.push('Champ obligatoire manquant : nom');
    } else if (name.length > 160) {
      errors.push('Nom trop long (160 caractères max)');
    }

    const rawPrice = (mapped.prix || '').trim();
    const parsedPrice = rawPrice ? parseNumericInteger(rawPrice) : null;
    if (!rawPrice) {
      errors.push('Champ obligatoire manquant : prix');
    } else if (parsedPrice === null || parsedPrice > 500_000_000) {
      errors.push(`Prix invalide ("${rawPrice}")`);
    }

    const rawOldPrice = (mapped.ancien_prix || '').trim();
    let parsedOldPrice: number | undefined;
    if (rawOldPrice) {
      const candidate = parseNumericInteger(rawOldPrice);
      if (candidate === null || candidate > 500_000_000) {
        errors.push(`Ancien prix invalide ("${rawOldPrice}")`);
      } else if (candidate > 0) {
        parsedOldPrice = candidate;
      }
    }

    const rawBoutique = (mapped.boutique || '').trim();
    const rawCategory = (mapped.categorie || '').trim();
    const rawSubCategory = (mapped.sous_categorie || '').trim();

    let parsedDomain: 'electronique' | 'electrotechnique' | 'informatique' | null = null;
    if (rawBoutique) {
      parsedDomain = parseShopDomain(rawBoutique);
      if (!parsedDomain && usedCategoryFallbackForBoutique) {
        parsedDomain = deduceDomainFromGroupValue(rawBoutique, domainGroups);
      }
      if (!parsedDomain) {
        errors.push(
          `Boutique inconnue ("${rawBoutique}"). Attendu : electronique, electrotechnique ou informatique`
        );
      }
    } else {
      parsedDomain =
        parseShopDomain(rawCategory) ||
        parseShopDomain(rawSubCategory) ||
        deduceDomainFromGroupValue(rawCategory, domainGroups) ||
        deduceDomainFromGroupValue(rawSubCategory, domainGroups) ||
        options?.defaultDomain ||
        null;
      if (!parsedDomain) {
        errors.push(
          hasCategorieCol || hasExplicitBoutiqueCol
            ? 'Champ obligatoire manquant : boutique'
            : 'Boutique manquante ou non déductible (ajoutez une colonne boutique/category ou choisissez une boutique par défaut)'
        );
      }
    }

    const rawStock = (mapped.stock || '').trim();
    let parsedStock = 0;
    if (rawStock) {
      const candidateStock = parseNumericInteger(rawStock);
      if (candidateStock === null || candidateStock > 1_000_000) {
        errors.push(`Quantité en stock invalide ("${rawStock}")`);
      } else {
        parsedStock = candidateStock;
      }
    }

    const rawStockStatus = (mapped.statut_stock || '').trim();
    const explicitStockStatus = parseCsvStockStatus(rawStockStatus);
    if (rawStockStatus && !explicitStockStatus) {
      errors.push(`Statut de stock invalide ("${rawStockStatus}")`);
    }

    const imageUrl = extractFirstImageUrl(mapped.image_url || '');
    if (imageUrl && !isValidImageOrVideoUrl(imageUrl, true)) {
      errors.push('URL image invalide (https://, http:// ou /chemin requis)');
    }

    const videoUrl = (mapped.video_url || '').trim();
    if (videoUrl && !isValidImageOrVideoUrl(videoUrl, false)) {
      errors.push('URL vidéo invalide');
    }

    const rawRef = (mapped.ref || '').trim();
    if (rawRef) {
      const refKey = rawRef.toLowerCase();
      if (seenRefsInCsv.has(refKey)) {
        errors.push(`Référence en doublon dans le fichier CSV ("${rawRef}")`);
      } else {
        seenRefsInCsv.add(refKey);
      }
    }

    const matchedExisting = rawRef ? existingByRef.get(rawRef.toLowerCase()) : undefined;

    if (errors.length > 0 || !parsedDomain || parsedPrice === null) {
      previewRows.push({
        lineNumber,
        raw: rawDisplay,
        mappedRaw: mapped,
        errors,
        isValid: false,
        matchedExistingId: matchedExisting?.id
      });
      continue;
    }

    const defaultGroups =
      parsedDomain === 'informatique'
        ? domainGroups?.informatique || INFORMATIQUE_GROUPS
        : parsedDomain === 'electrotechnique'
        ? domainGroups?.electrotechnique || ELECTROTECHNIQUE_GROUPS
        : domainGroups?.electronique || ELECTRONIQUE_GROUPS;
    const selectableGroups = defaultGroups.filter((g) => g.id !== 'all');

    const matchedGroup =
      selectableGroups.find(
        (g) =>
          normalizeToken(g.id) === normalizeToken(rawSubCategory) ||
          normalizeToken(g.label) === normalizeToken(rawSubCategory)
      ) ||
      selectableGroups.find(
        (g) =>
          normalizeToken(g.id) === normalizeToken(rawCategory) ||
          normalizeToken(g.label) === normalizeToken(rawCategory)
      );

    const effectiveSubGroup = matchedGroup?.id || rawSubCategory || selectableGroups[0]?.id || 'general';
    const effectiveCategoryLabel =
      rawCategory ||
      matchedGroup?.label ||
      (parsedDomain === 'informatique'
        ? 'Informatique'
        : parsedDomain === 'electrotechnique'
        ? 'Électrotechnique'
        : 'Électronique');
    const effectiveCategoryId =
      parsedDomain === 'informatique' ? 'informatique' : matchedGroup?.id || rawCategory || 'general';

    let effectiveStockStatus: ProductStockStatus =
      explicitStockStatus || (parsedStock > 0 ? 'in_stock' : 'out_of_stock');
    let effectiveStock = parsedStock;
    if (effectiveStockStatus === 'in_stock' && effectiveStock <= 0) {
      effectiveStock = rawStock === '' ? 5 : 0;
      if (effectiveStock <= 0) effectiveStockStatus = 'out_of_stock';
    } else if (effectiveStockStatus === 'out_of_stock') {
      effectiveStock = 0;
    }

    const parsedSpecs = extractSpecsList(mapped.caracteristiques || '');
    const specs =
      parsedSpecs.length > 0
        ? parsedSpecs
        : ['Conforme normes industrielles', 'Garantie officielle ELECTRO-MEN'];

    const isPublished = parseCsvBoolean(mapped.publie || '', true);
    const isPromo =
      parseCsvBoolean(mapped.promo || '', false) ||
      Boolean(parsedOldPrice && parsedOldPrice > parsedPrice);
    const isNew = parseCsvBoolean(mapped.nouveaute || '', false);
    const isFlashSale = parseCsvBoolean(mapped.vente_flash || '', false);
    const isFeaturedOnHome = parseCsvBoolean(mapped.accueil || '', false);

    const generatedId =
      matchedExisting?.id || `prod-${Date.now()}-${i}-${Math.floor(100 + Math.random() * 900)}`;
    const effectiveRef =
      rawRef ||
      matchedExisting?.ref ||
      `ELM-${Date.now().toString().slice(-5)}-${String(i).padStart(2, '0')}`;

    const product: Product = {
      id: generatedId,
      ref: effectiveRef,
      name,
      brand: (mapped.marque || '').trim() || undefined,
      domain: parsedDomain,
      category: effectiveCategoryId,
      categoryLabel: effectiveCategoryLabel,
      subGroup: effectiveSubGroup,
      subGroupLabel: matchedGroup?.label || rawSubCategory || undefined,
      price: parsedPrice,
      oldPrice: parsedOldPrice,
      stock: effectiveStock,
      stockStatus: effectiveStockStatus,
      inStock: effectiveStockStatus === 'in_stock' && effectiveStock > 0,
      description: (mapped.description || '').trim() || 'Produit haute précision certifié ELECTRO-MEN.',
      details: specs,
      specs,
      image: imageUrl || undefined,
      hasRealPhoto: Boolean(imageUrl),
      videoUrl: videoUrl || undefined,
      isPublished,
      isDraft: !isPublished,
      isPromo,
      isNew,
      isNewArrival: isNew,
      isFlashSale,
      isFeaturedOnHome,
      isPremium: isFeaturedOnHome
    };

    validProducts.push(product);
    previewRows.push({
      lineNumber,
      raw: rawDisplay,
      mappedRaw: mapped,
      errors: [],
      isValid: true,
      matchedExistingId: matchedExisting?.id,
      product
    });
  }

  return {
    detectedEncoding: decoded.encoding,
    detectedDelimiter,
    headers: rawHeaders,
    columnMappings,
    boutiqueSource,
    rows: previewRows,
    validProducts,
    validCount: validProducts.length,
    errorCount: previewRows.length - validProducts.length
  };
}
