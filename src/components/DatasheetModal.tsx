import React from 'react';

interface DatasheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatasheetModal: React.FC<DatasheetModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-[20px]">schema</span>
            </div>
            <div>
              <h3 className="font-syne text-[15px] font-bold text-slate-900">
                Schémathèque &amp; Brochage Officiel (PDF)
              </h3>
              <span className="text-[11px] text-cyan-800 font-medium">
                ELECTRO-MEN LAB DOC • Réf: EM-DOC-ESP32-V2
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

        {/* Technical Schematic Canvas */}
        <div className="p-5 overflow-y-auto no-scrollbar space-y-4 text-xs text-slate-600">
          {/* Visual Pinout Header */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 relative overflow-hidden space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="font-syne text-[14px] text-amber-900 font-bold">
                Brochage GPIO / Pinout ESP32-WROOM-32
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 text-[10px] font-mono font-bold">
                REV 2026
              </span>
            </div>

            {/* Pinout Graphic Diagram Representation */}
            <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
              <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <span className="text-cyan-800 font-bold block mb-1">Côté Gauche (Alim &amp; I2C)</span>
                <div>3V3 : Alimentation régulée 3.3V</div>
                <div>EN  : Réinitialisation / Reset</div>
                <div>VP  : GPIO36 (ADC1_CH0)</div>
                <div>VN  : GPIO39 (ADC1_CH3)</div>
                <div>D34 : Entrée analogique seule</div>
                <div>D35 : Entrée analogique seule</div>
                <div>D32 : Touch sensor / ADC</div>
                <div>D33 : Touch sensor / ADC</div>
                <div>D25 : DAC1 (Sortie analogique)</div>
                <div>D26 : DAC2 (Sortie analogique)</div>
              </div>

              <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <span className="text-amber-800 font-bold block mb-1">Côté Droit (Bus Séries &amp; Relais)</span>
                <div>GND : Masse électrique 0V</div>
                <div>D23 : SPI MOSI (Master Out)</div>
                <div>D22 : I2C SCL (Horloge Bus)</div>
                <div>TX0 : Série UART0 Transmit</div>
                <div>RX0 : Série UART0 Receive</div>
                <div>D21 : I2C SDA (Données Bus)</div>
                <div>D19 : SPI MISO (Master In)</div>
                <div>D18 : SPI SCK (Horloge)</div>
                <div>D5  : SPI SS / Chip Select</div>
                <div>VIN : Entrée 5V USB Direct</div>
              </div>
            </div>

            {/* Electrical specs */}
            <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-500 block">Tension nominale</span>
                <span className="text-amber-800 font-bold">3.3V DC (VIN: 5V)</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-500 block">Courant par GPIO</span>
                <span className="text-cyan-800 font-bold">12 mA max</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-500 block">Horloge CPU</span>
                <span className="text-slate-900 font-bold">240 MHz Dual</span>
              </div>
            </div>
          </div>

          {/* Recommended Connection Diagram */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-syne text-[13px] text-slate-900 font-bold">
              Schéma de Câblage Didactique du Kit
            </h4>
            <ul className="space-y-1.5 list-disc list-inside text-[11px] text-slate-600">
              <li>
                <strong className="text-amber-800">Afficheur OLED I2C :</strong> Connecter VCC &rarr; 3V3, GND &rarr; GND, SCL &rarr; GPIO22, SDA &rarr; GPIO21.
              </li>
              <li>
                <strong className="text-cyan-800">Module Relais 5V :</strong> Connecter VCC &rarr; VIN (5V), GND &rarr; GND, IN1 &rarr; GPIO4.
              </li>
              <li>
                <strong className="text-slate-900">Capteur DHT11 :</strong> Broche Data &rarr; GPIO15 avec résistance de pull-up 10k&Omega; vers 3V3.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-white flex gap-2">
          <button
            onClick={() => {
              window.print();
            }}
            className="flex-1 py-2.5 rounded-xl btn-gold-prestige font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">print</span>
            <span>Imprimer le Schéma Technique</span>
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
