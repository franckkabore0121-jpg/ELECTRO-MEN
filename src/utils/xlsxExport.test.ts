import { describe, expect, it } from 'vitest';
import { buildProductsXlsxBytes } from './xlsxExport.ts';
import type { Product } from '../data/mockData.ts';

describe('buildProductsXlsxBytes', () => {
  it('generates a valid PKZIP OOXML .xlsx workbook with product headers, columns, and values', () => {
    const sampleProducts: Product[] = [
      {
        id: 'p-1',
        ref: 'EM-ESP32',
        name: 'Kit ESP32 Wi-Fi & BLE',
        brand: 'Espressif',
        category: 'kits',
        categoryLabel: 'Microcontrôleurs',
        domain: 'electronique',
        subGroupLabel: 'Cartes de développement',
        price: 16000,
        stock: 12,
        stockStatus: 'in_stock',
        inStock: true,
        description: 'Carte Wi-Fi + Bluetooth Dual Core',
        specs: ['240 MHz', '38 broches GPIO']
      },
      {
        id: 'p-2',
        ref: 'EM-DISJ-32A',
        name: 'Disjoncteur Modulaire 32A',
        category: 'protection',
        categoryLabel: 'Protection',
        domain: 'electrotechnique',
        price: 8500,
        stock: 0,
        stockStatus: 'on_order',
        inStock: false,
        description: 'Protection courbe C 400V <script>test</script>'
      }
    ];

    const bytes = buildProductsXlsxBytes(sampleProducts, { sheetName: 'Catalogue Client' });
    // PKZIP local file header signature "PK\x03\x04"
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);

    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).toContain('[Content_Types].xml');
    expect(decoded).toContain('xl/worksheets/sheet1.xml');
    expect(decoded).toContain('Nom du produit');
    expect(decoded).toContain('Prix (FCFA)');
    expect(decoded).toContain('Disponibilité');
    expect(decoded).toContain('Kit ESP32 Wi-Fi &amp; BLE');
    expect(decoded).toContain('Boutique Composants Électroniques');
    expect(decoded).toContain('<v>16000</v>');
    expect(decoded).toContain('Disponible sur commande');
    expect(decoded).toContain('&lt;script&gt;test&lt;/script&gt;');
    expect(decoded).toContain('<autoFilter ref="A1:K3"/>');
  });
});
