import { describe, expect, it } from 'vitest';
import {
  PRODUCT_CSV_HEADERS,
  buildProductsCsvContent,
  buildProductsCsvTemplateContent,
  decodeCsvBuffer,
  detectCsvDelimiter,
  parseAndValidateProductsCsv
} from './csvProducts.ts';
import type { Product } from '../data/mockData.ts';

describe('csvProducts utility', () => {
  const sampleProduct: Product = {
    id: 'prod-1',
    ref: 'ELM-101',
    name: 'Capteur DHT22 "Pro"',
    brand: 'ELECTRO-MEN',
    category: 'sensors',
    categoryLabel: 'Capteurs & Modules IoT',
    domain: 'electronique',
    subGroup: 'sensors',
    subGroupLabel: 'Capteurs & Modules IoT',
    price: 4500,
    oldPrice: 6000,
    image: 'https://exemple.bf/dht22.jpg',
    hasRealPhoto: true,
    description: 'Mesure température;\nHygrométrie "haute précision"',
    specs: ['3.3V - 5V', 'Précision ±0.5°C'],
    stock: 18,
    stockStatus: 'in_stock',
    inStock: true,
    isPublished: true,
    isPromo: true,
    isNew: true
  };

  it('exports UTF-8 BOM with semicolon separator and preserves quotes, semicolons, and newlines', () => {
    const csv = buildProductsCsvContent([sampleProduct]);
    expect(csv.startsWith('\uFEFF')).toBe(true);

    expect(detectCsvDelimiter(csv)).toBe(';');
    const parsed = parseAndValidateProductsCsv(csv);
    expect(parsed.fileError).toBeUndefined();
    expect(parsed.detectedEncoding).toBe('UTF-8 BOM');
    expect(parsed.detectedDelimiter).toBe(';');
    expect(parsed.validCount).toBe(1);
    expect(parsed.errorCount).toBe(0);
    expect(parsed.headers).toEqual([...PRODUCT_CSV_HEADERS]);

    const imported = parsed.validProducts[0];
    expect(imported.ref).toBe('ELM-101');
    expect(imported.name).toBe('Capteur DHT22 "Pro"');
    expect(imported.description).toBe('Mesure température;\nHygrométrie "haute précision"');
    expect(imported.price).toBe(4500);
    expect(imported.oldPrice).toBe(6000);
    expect(imported.domain).toBe('electronique');
    expect(imported.stock).toBe(18);
    expect(imported.image).toBe('https://exemple.bf/dht22.jpg');
    expect(imported.isPromo).toBe(true);
  });

  it('auto-detects comma delimiter and validates invalid rows cleanly', () => {
    const commaCsv = [
      'nom,description,prix,categorie,sous_categorie,boutique,stock,image_url',
      '"Multimètre Fluke","Tension AC/DC, continuité",42000,Mesure & Diagnostic,mesure,electrotechnique,7,https://exemple.bf/fluke.png',
      '"Produit sans prix","Description courte",abc,Kits,,electronique,4,',
      '"","Manque le nom",1500,PC,,informatique,2,'
    ].join('\n');

    expect(detectCsvDelimiter(commaCsv)).toBe(',');
    const result = parseAndValidateProductsCsv(commaCsv);

    expect(result.detectedDelimiter).toBe(',');
    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(2);
    expect(result.rows[0].isValid).toBe(true);
    expect(result.rows[0].product?.domain).toBe('electrotechnique');
    expect(result.rows[0].product?.price).toBe(42000);
    expect(result.rows[1].isValid).toBe(false);
    expect(result.rows[1].errors[0]).toContain('Prix invalide');
    expect(result.rows[2].isValid).toBe(false);
    expect(result.rows[2].errors[0]).toContain('nom');
  });

  it('generates an importable CSV template with BOM and valid sample row', () => {
    const template = buildProductsCsvTemplateContent();
    expect(template.startsWith('\uFEFF')).toBe(true);
    const result = parseAndValidateProductsCsv(template);
    expect(result.fileError).toBeUndefined();
    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(0);
  });

  it('decodes UTF-8 BOM ArrayBuffers accurately', () => {
    const content = '\uFEFFnom;prix;boutique\nÉcran Dell;95000;informatique';
    const utf8 = new TextEncoder().encode(content);
    const decoded = decodeCsvBuffer(utf8.buffer);
    expect(decoded.encoding).toBe('UTF-8 BOM');
    expect(decoded.text.startsWith('nom;prix;boutique')).toBe(true);
  });
});
