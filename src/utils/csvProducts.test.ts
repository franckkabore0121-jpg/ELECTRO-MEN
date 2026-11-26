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

  it('accepts Supabase export headers and normalizes shop categories automatically', () => {
    const supabaseCsv = [
      'id,Product Name,Unit Price,Catégorie,stock_quantity,in_stock,picture_url,created_at',
      'uuid-1,"Fer à souder 60W","4,500",Électronique,12,true,https://cdn.supabase.co/fer.jpg,2026-01-01',
      'uuid-2,"Mixeur Pro 800W",32000,Électroménager,5,true,https://cdn.supabase.co/mixeur.jpg,2026-01-02',
      'uuid-3,"Switch 24 Ports",85000,Informatique,0,false,,2026-01-03',
      'uuid-4,"Variateur ABB 5kW",190000,Électrotechnique,3,true,,2026-01-04',
      'uuid-5,"Article sans prix","",Électronique,2,true,,2026-01-05'
    ].join('\n');

    const result = parseAndValidateProductsCsv(supabaseCsv);
    expect(result.fileError).toBeUndefined();
    expect(result.validCount).toBe(4);
    expect(result.errorCount).toBe(1);

    expect(result.columnMappings).toEqual([
      { index: 0, sourceHeader: 'id', mappedField: null, matchType: 'ignored' },
      { index: 1, sourceHeader: 'Product Name', mappedField: 'nom', matchType: 'alias' },
      { index: 2, sourceHeader: 'Unit Price', mappedField: 'prix', matchType: 'alias' },
      {
        index: 3,
        sourceHeader: 'Catégorie',
        mappedField: 'boutique',
        secondaryMappedField: 'categorie',
        matchType: 'deduced_fallback'
      },
      { index: 4, sourceHeader: 'stock_quantity', mappedField: 'stock', matchType: 'alias' },
      { index: 5, sourceHeader: 'in_stock', mappedField: 'statut_stock', matchType: 'alias' },
      { index: 6, sourceHeader: 'picture_url', mappedField: 'image_url', matchType: 'alias' },
      { index: 7, sourceHeader: 'created_at', mappedField: null, matchType: 'ignored' }
    ]);

    expect(result.validProducts[0].domain).toBe('electronique');
    expect(result.validProducts[0].price).toBe(4500);
    expect(result.validProducts[1].domain).toBe('electronique');
    expect(result.validProducts[1].categoryLabel).toBe('Électroménager');
    expect(result.validProducts[2].domain).toBe('informatique');
    expect(result.validProducts[2].stockStatus).toBe('out_of_stock');
    expect(result.validProducts[3].domain).toBe('electrotechnique');

    expect(result.rows[4].isValid).toBe(false);
    expect(result.rows[4].mappedRaw.nom).toBe('Article sans prix');
    expect(result.rows[4].errors).toContain('Champ obligatoire manquant : prix');
  });

  it('supports boutique_id, title, montant, and deduces boutique from sub-category or defaultDomain', () => {
    const csvWithBoutiqueId = [
      'titre;montant;boutique_id;category;specs',
      'Oscilloscope 100MHz;145000;electroniques;Mesure;"[""100MHz"",""2 canaux""]"'
    ].join('\n');

    const res1 = parseAndValidateProductsCsv(csvWithBoutiqueId);
    expect(res1.fileError).toBeUndefined();
    expect(res1.validCount).toBe(1);
    expect(res1.validProducts[0].domain).toBe('electronique');
    expect(res1.validProducts[0].categoryLabel).toBe('Mesure');
    expect(res1.validProducts[0].specs).toEqual(['100MHz', '2 canaux']);

    const csvWithoutBoutiqueCol = [
      'nom_produit;prix_unitaire;sous_categorie',
      'Routeur MikroTik;55000;reseau',
      'Produit générique;12000;'
    ].join('\n');

    const resDeduced = parseAndValidateProductsCsv(csvWithoutBoutiqueCol);
    expect(resDeduced.fileError).toBeUndefined();
    expect(resDeduced.validCount).toBe(1);
    expect(resDeduced.errorCount).toBe(1);
    expect(resDeduced.validProducts[0].domain).toBe('informatique');

    const resWithDefault = parseAndValidateProductsCsv(csvWithoutBoutiqueCol, [], undefined, {
      defaultDomain: 'electrotechnique'
    });
    expect(resWithDefault.validCount).toBe(2);
    expect(resWithDefault.validProducts[1].domain).toBe('electrotechnique');
  });

  it('extracts products automatically from Supabase singleton_id,payload,updated_at JSON CSV exports', () => {
    const payloadArray = [
      {
        id: 'prod-sb-1',
        ref: 'ELM-SB-01',
        name: 'Module LoRa SX1278',
        price: 6500,
        domain: 'electronique',
        categoryLabel: 'Capteurs & Modules IoT',
        stock: 14,
        stockStatus: 'in_stock',
        specs: ['433 MHz', 'SPI']
      },
      {
        id: 'prod-sb-2',
        ref: 'ELM-SB-02',
        title: 'Disjoncteur C32',
        unit_price: 9500,
        category: 'Électrotechnique',
        stock_quantity: 8
      }
    ];
    const escapedJson = JSON.stringify(payloadArray).replace(/"/g, '""');
    const supabaseSingletonCsv = [
      'singleton_id,payload,updated_at',
      `1,"${escapedJson}",2026-11-26T10:00:00Z`
    ].join('\n');

    const parsed = parseAndValidateProductsCsv(supabaseSingletonCsv);
    expect(parsed.fileError).toBeUndefined();
    expect(parsed.boutiqueSource).toBe('payload_json');
    expect(parsed.validCount).toBe(2);
    expect(parsed.errorCount).toBe(0);
    expect(parsed.columnMappings[1].mappedField).toBe('payload_json');
    expect(parsed.validProducts[0].id).toBe('prod-sb-1');
    expect(parsed.validProducts[0].domain).toBe('electronique');
    expect(parsed.validProducts[0].specs).toEqual(['433 MHz', 'SPI']);
    expect(parsed.validProducts[1].name).toBe('Disjoncteur C32');
    expect(parsed.validProducts[1].price).toBe(9500);
    expect(parsed.validProducts[1].domain).toBe('electrotechnique');
  });
});
