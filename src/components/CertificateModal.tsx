import React from 'react';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  investorName?: string;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  isOpen,
  onClose,
  investorName = 'Investisseur Certifié'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-amber-300 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600 fill">workspace_premium</span>
            <span className="font-syne text-[15px] text-slate-900 font-bold">
              Certificat Numérique Officiel
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Certificate Body (Diploma Style) */}
        <div className="p-6 text-center space-y-4 bg-gradient-to-b from-amber-50/40 via-white to-amber-50/30 relative overflow-hidden">
          {/* Subtle gold watermarks */}
          <div className="absolute inset-0 border-4 border-double border-amber-200 pointer-events-none m-2 rounded-xl"></div>

          {/* Logo & Institution Header */}
          <div className="space-y-1 relative z-10 pt-2">
            <div className="w-14 h-14 mx-auto rounded-xl overflow-hidden border border-amber-300 bg-white p-1 shadow-sm flex items-center justify-center">
              <img
                src="/assets/aistudio/Image_1_397aca35.jpeg"
                alt="ELECTRO-MEN"
                className="w-full h-full object-cover rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://lh3.googleusercontent.com/aida-public/AB6AXuCYQK9PHK1gxPYmsjSpM_WzArRpu3_NpauDk6vI_qVevEsnKANKxumB_VZQl8HRRqW4P8Od5XOJ4Fux7G9O8CMLXh1671NfdLfV5pZ-qOYBY6-qkri1HLIefnkxFKYsWA06s6Xix5hj26MVCs-Cl28xSDEgbcuWJCnF6dni86E2RzGgdv6JgPzsJp8LN3x78yez4MqF6EOf5-k0VknrCJB_xjbzW43R2NnrApiO3dc1z8mWQ5vQDcc50XM16IymZEbat4M';
                }}
              />
            </div>
            <h3 className="font-syne text-[18px] tracking-wider text-amber-900 uppercase font-bold">
              ELECTRO-MEN ACADEMY
            </h3>
            <p className="text-[10px] text-slate-500 tracking-widest uppercase font-semibold">
              Centre d'Excellence &amp; FabLab Industriel
            </p>
          </div>

          <div className="py-2 space-y-1.5 relative z-10">
            <span className="text-[11px] text-cyan-800 uppercase font-bold tracking-wider">
              ATTESTATION DE MAÎTRISE TECHNIQUE
            </span>
            <p className="text-xs text-slate-500">Ce titre d'ingénierie certifie que</p>
            <h2 className="font-syne text-[22px] font-extrabold text-slate-900 underline decoration-amber-400 decoration-2">
              {investorName}
            </h2>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed pt-1">
              A validé avec succès l'ensemble des épreuves théoriques et travaux pratiques du cursus :
            </p>
            <div className="font-syne text-[15px] font-bold text-amber-900 bg-amber-100/70 py-2 px-3 rounded-xl border border-amber-300 max-w-md mx-auto shadow-sm">
              Maîtriser l'IoT &amp; l'ESP32 par la Pratique
            </div>
          </div>

          {/* Cryptographic Proof & QR Code Representation */}
          <div className="pt-3 border-t border-amber-200 flex items-center justify-between text-left text-[10px] relative z-10">
            <div className="space-y-0.5 font-mono">
              <div className="text-slate-900 font-bold">
                N° Certificat : <span className="text-cyan-700">#EM-CERT-2026-9812</span>
              </div>
              <div className="text-slate-500">Date d'émission : 21 Octobre 2026</div>
              <div className="text-amber-800 flex items-center gap-1 font-semibold">
                <span className="material-symbols-outlined text-[14px] text-amber-600">verified</span>
                <span>Signature cryptographique vérifiée</span>
              </div>
            </div>

            {/* QR Code graphic container */}
            <div className="w-16 h-16 bg-white p-1 rounded-xl shadow-md border border-slate-200 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-900 p-0.5 rounded flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-3.5 h-3.5 bg-white rounded-xs"></div>
                  <div className="w-3.5 h-3.5 bg-white rounded-xs"></div>
                </div>
                <div className="w-2.5 h-2.5 bg-amber-400 mx-auto rounded-full"></div>
                <div className="flex justify-between">
                  <div className="w-3.5 h-3.5 bg-white rounded-xs"></div>
                  <div className="w-2.5 h-2.5 bg-white rounded-xs"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="p-3.5 border-t border-slate-100 bg-white flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 py-2.5 rounded-xl btn-gold-prestige font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span>Télécharger le Diplôme (PDF)</span>
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
