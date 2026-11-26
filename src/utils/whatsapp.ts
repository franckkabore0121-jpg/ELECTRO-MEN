import { Product, WHATSAPP_CONTACTS, getProductStockStatus } from '../data/mockData.ts';
import { formatProductTitle } from './productFormat.ts';

export interface BoutiqueContactInfo {
  number: string;
  cleanNumber: string;
  display: string;
  service: string;
  boutiqueName: string;
}

/**
 * Returns the exact WhatsApp contact details for a given shop domain.
 * - Électronique : +226 65 48 47 38
 * - Électrotechnique : +226 07 31 57 34
 * - Informatique : +226 56 28 35 26
 */
export function getBoutiqueContact(domain?: string): BoutiqueContactInfo {
  if (domain === 'informatique') {
    return {
      number: WHATSAPP_CONTACTS.informatique.number,
      cleanNumber: '22656283526',
      display: WHATSAPP_CONTACTS.informatique.display,
      service: WHATSAPP_CONTACTS.informatique.service,
      boutiqueName: 'Boutique Informatique & Réseaux'
    };
  }

  if (domain === 'electrotechnique') {
    return {
      number: WHATSAPP_CONTACTS.electrotechnique.number,
      cleanNumber: '22607315734',
      display: WHATSAPP_CONTACTS.electrotechnique.display,
      service: WHATSAPP_CONTACTS.electrotechnique.service,
      boutiqueName: 'Boutique Électrotechnique & Puissance'
    };
  }

  // Default to Électronique
  return {
    number: WHATSAPP_CONTACTS.electronique.number,
    cleanNumber: '22665484738',
    display: WHATSAPP_CONTACTS.electronique.display,
    service: WHATSAPP_CONTACTS.electronique.service,
    boutiqueName: 'Boutique Composants Électroniques'
  };
}

/**
 * Generates the pre-filled WhatsApp direct chat link with the product reference,
 * name, price, quantity, and the specific boutique's WhatsApp number.
 */
export function buildBoutiqueWhatsAppUrl(product: Product, quantity = 1): string {
  const contact = getBoutiqueContact(product.domain);
  const stockStatus = getProductStockStatus(product);
  const totalPrice = (product.price * quantity).toLocaleString('fr-FR');
  const unitPrice = product.price.toLocaleString('fr-FR');

  const actionHeader =
    stockStatus === 'on_order'
      ? 'COMMANDE SUR APPROVISIONNEMENT'
      : stockStatus === 'out_of_stock'
      ? 'DEMANDE DE RÉAPPROVISIONNEMENT'
      : 'ACHAT DIRECT PRODUIT';

  const lines = [
    `*ELECTRO-MEN • ${contact.boutiqueName.toUpperCase()}*`,
    `Demande : *${actionHeader}*`,
    ``,
    `Bonjour ${contact.service}, je souhaite acquérir l'article suivant :`,
    `• *Produit :* ${formatProductTitle(product.name)}`,
    `• *Réf :* ${product.ref}`,
    product.brand ? `• *Marque :* ${product.brand}` : null,
    product.categoryLabel ? `• *Catégorie :* ${product.categoryLabel}` : null,
    `• *Quantité souhaitée :* ${quantity}`,
    `• *Prix unitaire :* ${unitPrice} FCFA`,
    quantity > 1 ? `• *Montant total :* ${totalPrice} FCFA` : null,
    stockStatus === 'on_order'
      ? `• *Disponibilité :* Sur commande (délai à confirmer)`
      : stockStatus === 'out_of_stock'
      ? `• *Disponibilité :* Actuellement en rupture de stock`
      : `• *Disponibilité :* En stock immédiat`,
    ``,
    `Merci de bien vouloir me confirmer la disponibilité et les modalités de paiement / livraison à Ouagadougou.`
  ].filter((l): l is string => Boolean(l));

  const text = lines.join('\n');
  return `https://wa.me/${contact.cleanNumber}?text=${encodeURIComponent(text)}`;
}

/**
 * Directly opens the WhatsApp chat of the corresponding boutique with the pre-filled purchase message.
 */
export function openBoutiqueWhatsAppBuy(product: Product, quantity = 1): void {
  const url = buildBoutiqueWhatsAppUrl(product, quantity);
  window.open(url, '_blank', 'noopener,noreferrer');
}
