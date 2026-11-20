import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Course, CourseModule } from '../data/mockData.ts';

interface ScreenSolutionsProps {
  courses?: Course[];
  formationsVideoUrl?: string;
  onOpenVideo: (
    videoUrl?: string,
    courseTitle?: string,
    moduleTitle?: string,
    duration?: string,
    syllabus?: CourseModule[],
    pdfUrl?: string
  ) => void;
  onOpenPdf: (pdfUrl?: string) => void;
  onOpenCertificate: () => void;
  onAddToCart: (item: any) => void;
  onSelectCourse: (course: Course) => void;
}

// Helper to detect YouTube / Vimeo embeds or direct MP4
function parseVideoSource(rawUrl?: string): { isEmbed: boolean; embedUrl?: string; cleanUrl: string } {
  const url = (rawUrl || '').trim();
  const defaultLocal = '/assets/videos/electromen-hero.mp4';

  if (!url || url.includes('BigBuckBunny') || url.includes('commondatastorage.googleapis.com') || url.includes('mixkit.co')) {
    return { isEmbed: false, cleanUrl: defaultLocal };
  }

  // YouTube detection
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      isEmbed: true,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${ytMatch[1]}&controls=1&modestbranding=1&rel=0&playsinline=1`,
      cleanUrl: url
    };
  }

  // Vimeo detection
  const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/i);
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      isEmbed: true,
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[3]}?autoplay=1&muted=1&loop=1`,
      cleanUrl: url
    };
  }

  return { isEmbed: false, cleanUrl: url };
}

export const ScreenSolutions: React.FC<ScreenSolutionsProps> = ({
  courses,
  formationsVideoUrl = '/assets/videos/electromen-hero.mp4',
  onOpenVideo,
  onOpenPdf,
  onOpenCertificate,
  onAddToCart,
  onSelectCourse
}) => {
  // 3 distinct main sections requested:
  // 1. Formation en électronique
  // 2. Formation en électrotechnique
  // 3. Formation en informatique
  const [activeSection, setActiveSection] = useState<'electronique' | 'electrotechnique' | 'informatique'>('electronique');
  const [accessFilter, setAccessFilter] = useState<'all' | 'free' | 'paid'>('all');

  const videoRef = useRef<HTMLVideoElement>(null);
  const parsed = parseVideoSource(formationsVideoUrl);
  const [videoSrc, setVideoSrc] = useState<string>(parsed.cleanUrl);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    const nextParsed = parseVideoSource(formationsVideoUrl);
    setVideoSrc(nextParsed.cleanUrl);
    setHasError(false);
    setIsMuted(true);
  }, [formationsVideoUrl]);

  // Reliable Autoplay compliant with modern mobile and desktop browser policies
  useEffect(() => {
    if (parsed.isEmbed) return;
    const vid = videoRef.current;
    if (!vid) return;

    vid.defaultMuted = true;
    vid.muted = true;
    setIsMuted(true);
    const playPromise = vid.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [videoSrc, parsed.isEmbed]);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleVideoError = () => {
    if (videoSrc !== '/assets/videos/electromen-hero.mp4') {
      // Fallback immediately to guaranteed local bundled video
      setVideoSrc('/assets/videos/electromen-hero.mp4');
    } else {
      setHasError(true);
    }
  };

  const handleOpenFullPresentation = () => {
    onOpenVideo(
      videoSrc,
      'Académie Technique & Métiers ELECTRO-MEN',
      'Vidéo Officielle de Présentation des Formations',
      'Haute Définition',
      undefined,
      '/assets/aistudio/Note_Regle_f4d3053f.pdf'
    );
  };

  const courseList = courses ?? [];

  // Filter courses by active section & status (published only for users)
  const sectionCourses = useMemo(() => {
    return courseList.filter((c) => {
      // Non-published or draft courses must NOT appear to ordinary users
      if (c.status && c.status !== 'published') return false;
      if ((c as any).isPublished === false) return false;

      const matchDomain = c.domain === activeSection;
      const matchAccess =
        accessFilter === 'all'
          ? true
          : accessFilter === 'free'
          ? c.isFree || c.price === 0
          : !c.isFree && c.price > 0;
      return matchDomain && matchAccess;
    });
  }, [courseList, activeSection, accessFilter]);

  return (
    <div className="space-y-6 pb-12 text-slate-900 font-sans animate-fadeIn">

      {/* HEADER ACADÉMIE & VIDÉO PUBLICITAIRE DE LA PAGE FORMATIONS */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-900 font-bold text-xs uppercase tracking-wide">
                Académie Technique &amp; Métiers
              </span>
              <span className="text-xs text-slate-500 font-medium">Session Ouverte</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Formations &amp; Certifications Professionnelles
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">
              Trois filières d'apprentissage pratique avec programmes structurés, vidéos didactiques, documents PDF téléchargeables et attestations vérifiables.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenCertificate}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-base text-amber-600">workspace_premium</span>
              <span>Certificat Officiel</span>
            </button>
          </div>
        </div>

        {/* VIDÉO DE PRÉSENTATION DES FORMATIONS (HAUTE COMPATIBILITÉ AVEC SON & CONTRÔLES) */}
        <div className="rounded-2xl border border-slate-300 overflow-hidden bg-slate-950 shadow-md relative select-none">
          <div className="relative aspect-video sm:aspect-21/9 w-full flex items-center justify-center bg-black">
            {parsed.isEmbed && parsed.embedUrl ? (
              <iframe
                src={parsed.embedUrl}
                title="Vidéo Officielle Formations ELECTRO-MEN"
                className="w-full h-full object-cover border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : !hasError ? (
              <video
                ref={videoRef}
                src={videoSrc}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                preload="auto"
                onError={handleVideoError}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="w-full h-full object-cover cursor-pointer"
                onClick={togglePlay}
              >
                <source src={videoSrc} type="video/mp4" />
              </video>
            ) : (
              <div className="p-6 text-center text-white space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center border border-amber-400/40">
                  <span className="material-symbols-outlined text-2xl">movie</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Vidéo des Formations</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Le flux vidéo externe est momentanément inaccessible. Cliquez pour recharger la vidéo certifiée locale.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHasError(false);
                    setVideoSrc('/assets/videos/electromen-hero.mp4');
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-md"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  <span>Relancer la Vidéo</span>
                </button>
              </div>
            )}

            {/* Dégradé cinématique léger */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 pointer-events-none"></div>

            {/* Overlay Info en bas */}
            <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 flex items-end justify-between gap-3 z-10 text-white pointer-events-none">
              <div>
                <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase mb-1 inline-block">
                  Vidéo Officielle • Académie Technique
                </span>
                <h3 className="text-sm sm:text-lg font-bold text-white drop-shadow-sm">
                  Découvrez l'Excellence Technique ELECTRO-MEN
                </h3>
                <p className="text-xs text-slate-300 hidden sm:block">
                  Apprenez sur du matériel réel avec les ingénieurs et techniciens supérieurs du Burkina Faso.
                </p>
              </div>
            </div>

            {/* Commandes interactives pour l'utilisateur (Son, Lecture/Pause & Agrandir) */}
            {!parsed.isEmbed && !hasError && (
              <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSound}
                  className="px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  title={isMuted ? 'Activer le son' : 'Couper le son'}
                >
                  <span className="material-symbols-outlined text-sm">
                    {isMuted ? 'volume_off' : 'volume_up'}
                  </span>
                  <span className="hidden sm:inline">{isMuted ? 'Activer le son' : 'Son actif'}</span>
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-semibold flex items-center justify-center transition-all cursor-pointer shadow-md"
                  title={isPlaying ? 'Mettre en pause' : 'Relancer la lecture'}
                >
                  <span className="material-symbols-outlined text-sm">
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenFullPresentation}
                  className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-semibold flex items-center justify-center transition-all cursor-pointer shadow-md"
                  title="Agrandir dans le lecteur dédié"
                >
                  <span className="material-symbols-outlined text-sm">open_in_full</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          LES 3 SECTIONS PRINCIPALES CLAIREMENT DISTINCTES (DEMANDE UTILISATEUR)
          1. Formation en électronique
          2. Formation en électrotechnique
          3. Formation en informatique
          ========================================================================= */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* SECTION 1 : ÉLECTRONIQUE */}
          <button
            type="button"
            onClick={() => setActiveSection('electronique')}
            className={`p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3 text-left cursor-pointer ${
              activeSection === 'electronique'
                ? 'bg-amber-50 border-amber-500 shadow-xs'
                : 'bg-white border-slate-200 hover:border-amber-300'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                activeSection === 'electronique'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">memory</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase block tracking-wider">
                Filière 1
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                Formation Électronique
              </h3>
              <span className="text-[11px] text-slate-500">IoT, CMS, PCB &amp; Capteurs</span>
            </div>
          </button>

          {/* SECTION 2 : ÉLECTROTECHNIQUE */}
          <button
            type="button"
            onClick={() => setActiveSection('electrotechnique')}
            className={`p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3 text-left cursor-pointer ${
              activeSection === 'electrotechnique'
                ? 'bg-cyan-50 border-cyan-600 shadow-xs'
                : 'bg-white border-slate-200 hover:border-cyan-300'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                activeSection === 'electrotechnique'
                  ? 'bg-cyan-700 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">bolt</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-cyan-800 uppercase block tracking-wider">
                Filière 2
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                Formation Électrotechnique
              </h3>
              <span className="text-[11px] text-slate-500">Armoires, VFD &amp; 380V</span>
            </div>
          </button>

          {/* SECTION 3 : INFORMATIQUE */}
          <button
            type="button"
            onClick={() => setActiveSection('informatique')}
            className={`p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3 text-left cursor-pointer ${
              activeSection === 'informatique'
                ? 'bg-emerald-50 border-emerald-600 shadow-xs'
                : 'bg-white border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                activeSection === 'informatique'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">laptop_mac</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase block tracking-wider">
                Filière 3
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                Formation Informatique
              </h3>
              <span className="text-[11px] text-slate-500">Réseaux, Systèmes &amp; Maintenance</span>
            </div>
          </button>
        </div>

        {/* FILTRE ACCÈS : TOUS • GRATUITS • PAYANTS */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold mr-1">Filtrer par accès :</span>
            <button
              type="button"
              onClick={() => setAccessFilter('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                accessFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Tous les cours
            </button>
            <button
              type="button"
              onClick={() => setAccessFilter('free')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                accessFilter === 'free'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-slate-200 text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>100% Gratuits</span>
            </button>
            <button
              type="button"
              onClick={() => setAccessFilter('paid')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                accessFilter === 'paid'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white border border-slate-200 text-amber-900 hover:bg-amber-50'
              }`}
            >
              <span className="material-symbols-outlined text-xs">lock</span>
              <span>Certifiants Payants</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 font-mono">
            {sectionCourses.length} programme{sectionCourses.length > 1 ? 's' : ''} disponible{sectionCourses.length > 1 ? 's' : ''}
          </span>
        </div>
      </section>

      {/* =========================================================================
          LISTE DES PROGRAMMES DE LA SECTION ACTIVE
          ========================================================================= */}
      <section className="space-y-4">
        {sectionCourses.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
            <span className="material-symbols-outlined text-4xl text-slate-300">school</span>
            <p className="text-slate-800 font-bold">
              Aucune formation n'est actuellement disponible dans ce domaine.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              De nouveaux programmes pratiques certifiés seront publiés prochainement par nos équipes techniques.
            </p>
            {accessFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setAccessFilter('all')}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 font-semibold text-xs cursor-pointer hover:bg-slate-200 mt-2"
              >
                Afficher tous les programmes
              </button>
            )}
          </div>
        ) : (
          sectionCourses.map((course) => {
            const isFreeCourse = Boolean(course.isFree || course.price === 0);

            return (
              <article
                key={course.id}
                className="rounded-2xl bg-white border border-slate-200 hover:border-amber-400 p-5 space-y-4 transition-all shadow-xs"
              >
                {/* Course Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Badge Gratuit vs Payant */}
                    {isFreeCourse ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Formation Gratuite</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">workspace_premium</span>
                        <span>Certifiante : {course.price.toLocaleString('fr-FR')} FCFA</span>
                      </span>
                    )}

                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                      {course.level}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                      {course.duration}
                    </span>
                  </div>

                  <div className="flex items-center text-amber-600 text-xs font-bold gap-1">
                    <span className="material-symbols-outlined text-base fill">star</span>
                    <span>{course.rating}/5</span>
                    <span className="text-slate-400 font-normal">({course.modulesCount || course.syllabus.length} modules)</span>
                  </div>
                </div>

                {/* Title & Description */}
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                    {course.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {course.description}
                  </p>
                </div>

                {/* Pedagogical Objectives if any */}
                {course.pedagogicalObjectives && course.pedagogicalObjectives.length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Objectifs Pédagogiques :
                    </span>
                    <ul className="space-y-1 text-slate-700">
                      {course.pedagogicalObjectives.map((obj, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-cyan-600 text-sm mt-0.5">check</span>
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* =========================================================================
                    MODULES, VIDÉOS & DOCUMENTS PDF ASSOCIÉS (EXIGENCES UTILISATEUR)
                    ========================================================================= */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-cyan-700 text-base">video_library</span>
                      <span>Programme &amp; Modules Pratiques ({course.syllabus.length})</span>
                    </h4>
                    {course.pdfUrl && (
                      <button
                        type="button"
                        onClick={() => onOpenPdf(course.pdfUrl)}
                        className="text-xs text-cyan-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                        <span>{course.pdfTitle || 'Guide du Cours (PDF)'}</span>
                      </button>
                    )}
                  </div>

                  {/* Modules List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {course.syllabus.map((mod, idx) => {
                      const isModFree = isFreeCourse || Boolean(mod.isFree);
                      const targetVid = mod.videoUrl || course.videoUrl || '/assets/videos/electromen-hero.mp4';

                      return (
                        <div
                          key={mod.id || idx}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  isModFree
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {isModFree ? 'Gratuit' : 'Certifiant'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">{mod.duration}</span>
                            </div>
                            <h5 className="font-semibold text-slate-900 truncate">{mod.title}</h5>
                          </div>

                          {/* Action Buttons for Module: Video and/or PDF */}
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Bouton Vidéo */}
                            <button
                              type="button"
                              onClick={() => {
                                onOpenVideo(
                                  targetVid,
                                  course.title,
                                  mod.title,
                                  mod.duration,
                                  course.syllabus,
                                  mod.pdfUrl || course.pdfUrl
                                );
                              }}
                              className="p-1.5 rounded-lg bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-400 text-slate-800 cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                              title="Visionner la vidéo du module"
                            >
                              <span className="material-symbols-outlined text-base text-amber-600">play_circle</span>
                            </button>

                            {/* Bouton PDF associé si présent */}
                            {mod.pdfUrl && (
                              <button
                                type="button"
                                onClick={() => onOpenPdf(mod.pdfUrl)}
                                className="p-1.5 rounded-lg bg-white hover:bg-slate-200 border border-slate-200 text-cyan-700 cursor-pointer transition-colors shadow-2xs"
                                title="Consulter le document PDF associé"
                              >
                                <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Prix & Actions */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Tarif &amp; Inscription</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-extrabold text-slate-900">
                        {isFreeCourse ? 'Accès 100% Gratuit' : `${course.price.toLocaleString('fr-FR')} FCFA`}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">• Formateur : {course.instructor}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectCourse(course)}
                      className="py-2.5 px-4 rounded-xl btn-gold-prestige font-semibold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-base">
                        {isFreeCourse ? 'play_arrow' : 'school'}
                      </span>
                      <span>{isFreeCourse ? 'Commencer Gratuitement' : 'S’inscrire au Programme'}</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* ASSISTANCE PÉDAGOGIQUE DIRECTE */}
      <section className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <span className="material-symbols-outlined text-xl">support_agent</span>
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
              Assistance &amp; Conseils Formateurs en Direct
            </h4>
            <p className="text-xs text-slate-500">
              Une question sur un montage, un schéma ou un TP ? Nos formateurs répondent rapidement.
            </p>
          </div>
        </div>

        <a
          href="https://wa.me/22665484738?text=Bonjour%20l'%C3%A9quipe%20p%C3%A9dagogique%20ELECTRO-MEN,%20j'ai%20une%20question%20sur%20un%20programme%20de%20formation."
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-transform shrink-0"
        >
          <span className="material-symbols-outlined text-base">chat</span>
          <span>Poser une Question (+226 65 48 47 38)</span>
        </a>
      </section>
    </div>
  );
};
