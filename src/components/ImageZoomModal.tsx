import React from 'react';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  title: string;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title
}) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-fadeIn cursor-zoom-out"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col cursor-default"
      >
        {/* Header */}
        <div className="p-3 sm:p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400 text-lg sm:text-xl">zoom_in</span>
            <h3 className="font-syne text-xs sm:text-sm font-bold truncate max-w-xs sm:max-w-md">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* High-def Zoomed Image Canvas */}
        <div className="p-4 sm:p-8 flex items-center justify-center overflow-auto bg-slate-50 min-h-[300px] max-h-[75vh]">
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm transition-transform duration-200 hover:scale-105"
          />
        </div>
      </div>
    </div>
  );
};
