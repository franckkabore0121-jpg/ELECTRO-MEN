import React, { useMemo, useRef, useState } from 'react';
import { CategoryGroup, Product } from '../data/mockData.ts';
import {
  CsvImportParseResult,
  downloadProductsCsvTemplate,
  parseAndValidateProductsCsv
} from '../utils/csvProducts.ts';

export interface ImportProductsCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
  domainGroups?: Record<'electronique' | 'electrotechnique' | 'informatique', CategoryGroup[]>;
  onConfirmImport: (
    productsToImport: Product[],
    options: { upsertByRef: boolean; filename: string }
  ) => Promise<{ createdCount: number; updatedCount: number }>;
}

const DOMAIN_LABELS: Record<'electronique' | 'electrotechnique' | 'informatique', string> = {
  electronique: 'Électronique',
  electrotechnique: 'Électrotechnique',
  informatique: 'Informatique'
};

export const ImportProductsCsvModal: React.FC<ImportProductsCsvModalProps> = ({
  isOpen,
  onClose,
  existingProducts,
  domainGroups,
  onConfirmImport
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);
  const [parseResult, setParseResult] = useState<CsvImportParseResult | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const [upsertByRef, setUpsertByRef] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const filteredPreviewRows = useMemo(() => {
    if (!parseResult) return [];
    if (previewFilter === 'valid') return parseResult.rows.filter((r) => r.isValid);
    if (previewFilter === 'errors') return parseResult.rows.filter((r) => !r.isValid);
    return parseResult.rows;
  }, [parseResult, previewFilter]);

  if (!isOpen) return null;

  const resetState = () => {
    setSelectedFileName('');
    setRawBuffer(null);
    setParseResult(null);
    setPreviewFilter('all');
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (isImporting) return;
    resetState();
    onClose();
  };

  const processFile = async (file: File) => {
    setImportError(null);
    if (!file.name.toLowerCase().endsWith('.csv') && file.type && !file.type.includes('csv') && !file.type.includes('text')) {
      setImportError('Format non supporté. Veuillez sélectionner un fichier .csv.');
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseAndValidateProductsCsv(buffer, existingProducts, domainGroups);
      setSelectedFileName(file.name);
      setRawBuffer(buffer);
      setParseResult(parsed);
      setPreviewFilter(parsed.errorCount > 0 && parsed.validCount === 0 ? 'errors' : 'all');
    } catch {
      setImportError('Impossible de lire ce fichier CSV.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleConfirm = async () => {
    if (!parseResult || parseResult.validProducts.length === 0 || isImporting) return;
    setIsImporting(true);
    setImportError(null);
    try {
      await onConfirmImport(parseResult.validProducts, {
        upsertByRef,
        filename: selectedFileName || 'import.csv'
      });
      resetState();
      onClose();
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : 'Erreur lors de l’enregistrement des produits CSV dans PostgreSQL.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* En-tête */}
        <div className="px-4 py-3.5 sm:px-5 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">upload_file</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-syne text-sm sm:text-base font-bold text-white truncate">
                Importer des produits via CSV
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                Détection automatique UTF-8 et séparateur (, ou ;) · Aperçu et validation avant insertion PostgreSQL
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isImporting}
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Fermer la fenêtre d'import CSV"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Barre modèle + sélection fichier */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs text-slate-600">
              Colonnes obligatoires :{' '}
              <span className="font-mono font-bold text-slate-900">nom</span>,{' '}
              <span className="font-mono font-bold text-slate-900">prix</span>,{' '}
              <span className="font-mono font-bold text-slate-900">boutique</span>{' '}
              <span className="text-slate-500">(electronique, electrotechnique, informatique)</span>.
            </div>
            <button
              type="button"
              onClick={() => downloadProductsCsvTemplate()}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="material-symbols-outlined text-base text-cyan-700">download</span>
              <span>Télécharger un modèle CSV</span>
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
              isDragOver
                ? 'border-cyan-500 bg-cyan-50/70'
                : 'border-slate-300 bg-white hover:border-slate-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileInputChange}
              className="hidden"
              id="csv-products-file-input"
            />
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <span className="material-symbols-outlined text-3xl text-cyan-700">csv</span>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900">
                  {selectedFileName
                    ? `Fichier sélectionné : ${selectedFileName}`
                    : 'Glissez-déposez un fichier .csv ici ou choisissez-le depuis votre appareil'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Séparateurs acceptés : point-virgule (;) ou virgule (,) · Encodage UTF-8 avec ou sans BOM
                </p>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <label
                  htmlFor="csv-products-file-input"
                  className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  {selectedFileName ? 'Changer de fichier' : 'Choisir un fichier .csv'}
                </label>
                {rawBuffer && (
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={resetState}
                    className="px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>
          </div>

          {importError && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base text-rose-600 shrink-0">error</span>
              <span>{importError}</span>
            </div>
          )}
        </div>

        {/* Aperçu & validation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!parseResult ? (
            <div className="py-10 text-center text-xs text-slate-500 space-y-2">
              <span className="material-symbols-outlined text-4xl text-slate-300">fact_check</span>
              <p className="font-semibold text-slate-700">
                Sélectionnez un fichier CSV pour afficher l’aperçu et vérifier les données avant l’import.
              </p>
            </div>
          ) : parseResult.fileError ? (
            <div
              role="alert"
              className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1"
            >
              <p className="font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-rose-600">warning</span>
                <span>Fichier CSV invalide</span>
              </p>
              <p>{parseResult.fileError}</p>
            </div>
          ) : (
            <>
              {/* Résumé détection & validation */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
                  <span className="font-bold text-slate-900">
                    {parseResult.rows.length} ligne{parseResult.rows.length > 1 ? 's' : ''} détectée{parseResult.rows.length > 1 ? 's' : ''}
                  </span>
                  <span className="font-bold text-emerald-700">
                    {parseResult.validCount} valide{parseResult.validCount > 1 ? 's' : ''}
                  </span>
                  <span className={`font-bold ${parseResult.errorCount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                    {parseResult.errorCount} erreur{parseResult.errorCount > 1 ? 's' : ''}
                  </span>
                  <span className="text-slate-600">
                    Séparateur : <code className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono font-bold">{parseResult.detectedDelimiter}</code>
                  </span>
                  <span className="text-slate-600">
                    Encodage : <span className="font-semibold text-slate-800">{parseResult.detectedEncoding}</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                      previewFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    Toutes ({parseResult.rows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('valid')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                      previewFilter === 'valid' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-emerald-700'
                    }`}
                  >
                    Valides ({parseResult.validCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('errors')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                      previewFilter === 'errors' ? 'bg-rose-600 text-white' : 'bg-white border border-slate-200 text-rose-700'
                    }`}
                  >
                    Erreurs ({parseResult.errorCount})
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none px-1">
                <input
                  type="checkbox"
                  checked={upsertByRef}
                  onChange={(e) => setUpsertByRef(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-0"
                />
                <span>
                  Mettre à jour automatiquement les produits existants si la référence (<code className="font-mono">ref</code>) correspond déjà dans PostgreSQL
                </span>
              </label>

              {/* Tableau d'aperçu */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-700">
                      <th className="py-2 px-2.5 font-bold whitespace-nowrap">Ligne</th>
                      <th className="py-2 px-2.5 font-bold whitespace-nowrap">Statut</th>
                      <th className="py-2 px-2.5 font-bold whitespace-nowrap">Réf.</th>
                      <th className="py-2 px-2.5 font-bold">Nom du produit</th>
                      <th className="py-2 px-2.5 font-bold whitespace-nowrap">Boutique</th>
                      <th className="py-2 px-2.5 font-bold">Catégorie</th>
                      <th className="py-2 px-2.5 font-bold text-right whitespace-nowrap">Prix (FCFA)</th>
                      <th className="py-2 px-2.5 font-bold text-right whitespace-nowrap">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreviewRows.map((row) => {
                      const prod = row.product;
                      return (
                        <tr
                          key={row.lineNumber}
                          className={row.isValid ? 'bg-white hover:bg-slate-50' : 'bg-rose-50/70'}
                        >
                          <td className="py-2 px-2.5 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                            #{row.lineNumber}
                          </td>
                          <td className="py-2 px-2.5 min-w-[170px]">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                <span>
                                  {row.matchedExistingId && upsertByRef ? 'Mise à jour' : 'Nouveau'}
                                </span>
                              </span>
                            ) : (
                              <div className="text-[11px] font-semibold text-rose-700 space-y-0.5">
                                {row.errors.map((err, idx) => (
                                  <div key={idx} className="flex items-start gap-1">
                                    <span className="material-symbols-outlined text-xs mt-0.5 shrink-0">error</span>
                                    <span>{err}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {prod?.ref || row.raw.ref || row.raw.reference || '—'}
                          </td>
                          <td className="py-2 px-2.5 max-w-[220px]">
                            <div className="font-semibold text-slate-900 truncate">
                              {prod?.name || row.raw.nom || row.raw.name || '—'}
                            </div>
                            {(prod?.description || row.raw.description) && (
                              <div className="text-[10px] text-slate-500 truncate">
                                {prod?.description || row.raw.description}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-[11px] text-slate-700 whitespace-nowrap">
                            {prod ? DOMAIN_LABELS[prod.domain] : row.raw.boutique || row.raw.domain || '—'}
                          </td>
                          <td className="py-2 px-2.5 text-[11px] text-slate-600 max-w-[160px] truncate">
                            {prod?.categoryLabel || row.raw.categorie || row.raw.category || '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                            {prod
                              ? `${prod.price.toLocaleString('fr-FR')}`
                              : row.raw.prix || row.raw.price || '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-[11px] text-slate-700 tabular-nums whitespace-nowrap">
                            {prod ? prod.stock : row.raw.stock || '0'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Pied de modale */}
        <div className="px-4 py-3 sm:px-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500">
            {parseResult && !parseResult.fileError && parseResult.errorCount > 0 && parseResult.validCount > 0 && (
              <span className="text-amber-700 font-semibold">
                Seules les {parseResult.validCount} ligne(s) valide(s) seront enregistrées dans PostgreSQL ; les {parseResult.errorCount} ligne(s) en erreur seront ignorées.
              </span>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isImporting}
              onClick={handleClose}
              className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={
                isImporting ||
                !parseResult ||
                Boolean(parseResult.fileError) ||
                parseResult.validCount === 0
              }
              onClick={() => void handleConfirm()}
              className="px-4 py-2 rounded-lg btn-gold-prestige text-white text-xs font-bold cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {isImporting
                ? 'Importation dans PostgreSQL…'
                : parseResult && parseResult.validCount > 0
                ? `Confirmer l'import (${parseResult.validCount} produit${parseResult.validCount > 1 ? 's' : ''})`
                : 'Confirmer l’import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
