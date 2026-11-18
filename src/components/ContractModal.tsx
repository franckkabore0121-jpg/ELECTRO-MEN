import React from 'react';

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  investorData?: {
    name: string;
    email?: string;
    phone: string;
    shares: number;
    total: number;
    id: string;
  };
}

export const ContractModal: React.FC<ContractModalProps> = ({
  isOpen,
  onClose,
  investorData = {
    name: 'Franck Kaboré',
    email: 'franckkabore454@gmail.com',
    phone: '+226 65 48 47 38',
    shares: 4,
    total: 10000,
    id: '#EM-INV-4541'
  }
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-[20px]">gavel</span>
            </div>
            <div>
              <h3 className="font-syne text-[15px] font-bold text-slate-900">
                Contrat de Souscription &amp; Pacte d'Investissement
              </h3>
              <span className="text-[11px] text-cyan-800 font-medium">
                Société Industrielle ELECTRO-MEN SAS • RCCM BF-OUA-2026-B
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Contract Text */}
        <div className="p-5 overflow-y-auto no-scrollbar space-y-4 text-xs text-slate-600 leading-relaxed bg-white">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 shadow-sm">
            <div className="flex justify-between items-center text-[12px] pb-1.5 border-b border-slate-200">
              <span className="text-slate-700 font-bold">Identifiant Actionnaire :</span>
              <span className="font-syne text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded">{investorData.id}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Souscripteur Légale :</span>
              <span className="text-slate-900 font-bold">{investorData.name}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Contact WhatsApp vérifié :</span>
              <span className="text-cyan-700 font-medium">{investorData.phone}</span>
            </div>
            {investorData.email && (
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Email Personnel :</span>
                <span className="text-cyan-700 font-mono font-medium">{investorData.email}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-[12px] pt-1.5 border-t border-slate-200">
              <span className="text-slate-700 font-bold">Parts souscrites :</span>
              <span className="text-amber-800 font-bold font-syne text-[14px]">
                {investorData.shares} part(s) ({investorData.total.toLocaleString('fr-FR')} FCFA)
              </span>
            </div>
          </div>

          <div className="space-y-1 text-[12px]">
            <h4 className="font-syne text-[14px] text-amber-900 font-bold">
              Article 1 : Objet de l'Investissement
            </h4>
            <p className="text-slate-600">
              Le présent contrat régit la prise de participation au capital industriel de la société
              ELECTRO-MEN SAS, pour le financement exclusif de la chaîne de gravure et montage CMS de
              cartes électroniques et du FabLab 2026.
            </p>
          </div>

          <div className="space-y-1 text-[12px]">
            <h4 className="font-syne text-[14px] text-amber-900 font-bold">
              Article 2 : Droits Financiers &amp; Dividendes
            </h4>
            <p className="text-slate-600">
              Chaque part ouvre droit à une quote-part des bénéfices nets distribuables, versée
              trimestriellement par canal monétique sécurisé. Un rendement cible annuel de 14% à 18% est
              indexé sur la production des cartes électroniques.
            </p>
          </div>

          <div className="space-y-1 text-[12px]">
            <h4 className="font-syne text-[14px] text-amber-900 font-bold">
              Article 3 : Clause de Rachat &amp; Liquidité Garantie
            </h4>
            <p className="text-slate-600">
              L'actionnaire bénéficie d'une garantie de rachat au pair après un préavis de 30 jours,
              assurée par le fonds de réserve interne de la manufacture.
            </p>
          </div>

          <div className="p-3.5 bg-cyan-50/50 rounded-xl border border-cyan-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-cyan-900 block font-bold">
                SCEAU D'AUTHENTIFICATION ÉLECTRONIQUE
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                SHA-256: 8f9b2a7e4c19d...verified
              </span>
            </div>
            <span className="material-symbols-outlined text-2xl text-cyan-600">verified</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-white flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 py-2.5 rounded-xl btn-gold-prestige font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">print</span>
            <span>Imprimer / Sauvegarder (PDF)</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
