import React, { useState, useRef, useEffect } from 'react';
import { CourseModule } from '../data/mockData.ts';

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPdf?: (pdfUrl?: string) => void;
  videoUrl?: string;
  courseTitle?: string;
  moduleTitle?: string;
  duration?: string;
  syllabus?: CourseModule[];
  pdfUrl?: string;
  onSelectModule?: (mod: CourseModule) => void;
}

// Helper to detect YouTube / Vimeo embeds or local MP4 files
function parseVideoSource(rawUrl?: string): { isEmbed: boolean; embedUrl?: string; cleanUrl: string } {
  const url = (rawUrl || '').trim();
  const defaultLocal = '/assets/videos/electromen-hero.mp4';

  if (!url || url.includes('BigBuckBunny') || url.includes('commondatastorage.googleapis.com') || url.includes('mixkit.co')) {
    return { isEmbed: false, cleanUrl: defaultLocal };
  }

  // YouTube detection (youtube.com, youtu.be, shorts)
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      isEmbed: true,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
      cleanUrl: url
    };
  }

  // Vimeo detection
  const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/i);
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      isEmbed: true,
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[3]}?autoplay=1`,
      cleanUrl: url
    };
  }

  return { isEmbed: false, cleanUrl: url };
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  isOpen,
  onClose,
  onOpenPdf,
  videoUrl,
  courseTitle = 'Formation Technique & Industrielle ELECTRO-MEN',
  moduleTitle = 'Module Pratique',
  duration = '25 min',
  syllabus,
  pdfUrl
}) => {
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>(videoUrl || '/assets/videos/electromen-hero.mp4');
  const [currentModuleTitle, setCurrentModuleTitle] = useState<string>(moduleTitle);
  const [currentDuration, setCurrentDuration] = useState<string>(duration);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | undefined>(pdfUrl);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen) {
      const targetUrl = videoUrl && videoUrl.trim() ? videoUrl.trim() : '/assets/videos/electromen-hero.mp4';
      setCurrentVideoUrl(targetUrl);
      setCurrentModuleTitle(moduleTitle);
      setCurrentDuration(duration);
      setCurrentPdfUrl(pdfUrl);
      setHasError(false);
      setIsPlaying(true);
      setIsMuted(false);
    }
  }, [isOpen, videoUrl, moduleTitle, duration, pdfUrl]);

  const parsed = parseVideoSource(currentVideoUrl);

  const handleVideoError = () => {
    if (currentVideoUrl !== '/assets/videos/electromen-hero.mp4') {
      // Fallback immediately to guaranteed local bundled video
      setCurrentVideoUrl('/assets/videos/electromen-hero.mp4');
    } else {
      setHasError(true);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const next = !videoRef.current.muted;
      videoRef.current.muted = next;
      setIsMuted(next);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Top Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 text-white">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <div className="truncate">
              <h3 className="font-syne text-sm sm:text-base font-extrabold text-white truncate">
                {courseTitle}
              </h3>
              <span className="text-[11px] text-cyan-400 font-medium truncate block">
                {currentModuleTitle} • Durée : {currentDuration}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer shrink-0 transition-colors"
            title="Fermer le lecteur"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Video Canvas Container */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden select-none">
          {parsed.isEmbed && parsed.embedUrl ? (
            <iframe
              src={parsed.embedUrl}
              title={currentModuleTitle}
              className="w-full h-full object-cover border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : !hasError ? (
            <div className="relative w-full h-full flex items-center justify-center group">
              <video
                ref={videoRef}
                src={parsed.cleanUrl}
                autoPlay
                playsInline
                controls
                onError={handleVideoError}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="w-full h-full object-contain bg-black"
              >
                <source src={parsed.cleanUrl} type="video/mp4" />
                Votre navigateur ne supporte pas la lecture de cette vidéo.
              </video>
            </div>
          ) : (
            <div className="p-6 text-center text-white space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center border border-amber-400/40">
                <span className="material-symbols-outlined text-2xl">movie_filter</span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Vidéo momentanément indisponible</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Le flux vidéo n'a pas pu être chargé depuis la source externe.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHasError(false);
                  setCurrentVideoUrl('/assets/videos/electromen-hero.mp4');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-md"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span>Lire la vidéo locale certifiée</span>
              </button>
            </div>
          )}
        </div>

        {/* Resource Bar & Attached PDF */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">
              Lecteur Certifié HD
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Audio &amp; Vidéo Didactique
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentPdfUrl && onOpenPdf && (
              <button
                type="button"
                onClick={() => onOpenPdf(currentPdfUrl)}
                className="px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                <span>Support de Cours (PDF)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>

        {/* Syllabus / Module Selection if syllabus provided */}
        {syllabus && syllabus.length > 0 && (
          <div className="p-3.5 bg-slate-900 border-t border-slate-800 overflow-y-auto max-h-48 space-y-2">
            <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider block">
              Tous les Modules de cette Formation ({syllabus.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {syllabus.map((mod, idx) => {
                const isSelected = mod.title === currentModuleTitle;
                return (
                  <button
                    key={mod.id || idx}
                    type="button"
                    onClick={() => {
                      const modVid = mod.videoUrl || videoUrl || '/assets/videos/electromen-hero.mp4';
                      setCurrentVideoUrl(modVid);
                      setCurrentModuleTitle(mod.title);
                      setCurrentDuration(mod.duration);
                      setCurrentPdfUrl(mod.pdfUrl || pdfUrl);
                      setHasError(false);
                    }}
                    className={`p-2 rounded-xl text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300 font-bold'
                        : 'bg-slate-950/60 border border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-sm shrink-0">
                        {isSelected ? 'play_circle' : 'play_arrow'}
                      </span>
                      <span className="truncate">{mod.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {mod.duration}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
