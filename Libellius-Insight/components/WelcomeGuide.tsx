import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface WelcomeGuideProps {
  onClose: () => void;
  clientName?: string;
}

type FocusRailItem = {
  id: string | number;
  title: string;
  description?: string;
  mediaSrc: string;
  mobileImageSrc?: string;
  meta?: string;
};

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(' ');

function wrap(min: number, max: number, v: number) {
  const rangeSize = max - min;
  return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
}

const BASE_SPRING = { type: 'spring', stiffness: 300, damping: 30, mass: 1 };
const TAP_SPRING = { type: 'spring', stiffness: 450, damping: 18, mass: 1 };

const ControlledVideo = ({
  src,
  isActive,
  className,
}: {
  src: string;
  isActive: boolean;
  className?: string;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => null);
    } else {
      videoRef.current.pause();
    }
  }, [isActive, src]);

  return (
    <video
      ref={videoRef}
      src={src}
      loop
      muted
      playsInline
      className={className}
    />
  );
};

const FocusRail: React.FC<{
  items: FocusRailItem[];
  onClose: () => void;
}> = ({ items, onClose }) => {
  const [active, setActive] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const lastWheelTime = useRef<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  const count = items.length;
  const activeIndex = wrap(0, count, active);
  const activeItem = items[activeIndex];

  const handlePrev = useCallback(() => {
    setActive((p) => p - 1);
  }, []);

  const handleNext = useCallback(() => {
    setActive((p) => p + 1);
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const now = Date.now();
      if (now - lastWheelTime.current < 400) return;

      const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = isHorizontal ? e.deltaX : e.deltaY;

      if (Math.abs(delta) > 20) {
        delta > 0 ? handleNext() : handlePrev();
        lastWheelTime.current = now;
      }
    },
    [handleNext, handlePrev]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') onClose();
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) =>
    Math.abs(offset) * velocity;

  const onDragEnd = (
    _e: MouseEvent | TouchEvent | PointerEvent,
    { offset, velocity }: PanInfo
  ) => {
    const swipe = swipePower(offset.x, velocity.x);
    if (swipe < -swipeConfidenceThreshold) handleNext();
    else if (swipe > swipeConfidenceThreshold) handlePrev();
  };

  const visibleIndices = isMobile ? [-1, 0, 1] : [-2, -1, 0, 1, 2];

  const getMediaSrc = (item: FocusRailItem) =>
    isMobile && item.mobileImageSrc ? item.mobileImageSrc : item.mediaSrc;

  const isVideo = (src: string) =>
    src.toLowerCase().endsWith('.mp4') || src.toLowerCase().endsWith('.webm');

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      className="relative min-h-[100dvh] w-full overflow-y-auto overflow-x-hidden text-white outline-none select-none"
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-50 rounded-full bg-white/10 p-3 text-white shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-brand md:right-6 md:top-6"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col px-4 pb-8 pt-20 md:px-8 md:pb-10 md:pt-10">
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={onDragEnd}
            className="relative flex h-[300px] sm:h-[390px] md:h-[470px] w-full items-center justify-center cursor-grab active:cursor-grabbing"
            style={{ perspective: 1200 }}
          >
            {visibleIndices.map((offset) => {
              const absIndex = active + offset;
              const index = wrap(0, count, absIndex);
              const item = items[index];
              const mediaSrc = getMediaSrc(item);

              const isCenter = offset === 0;
              const dist = Math.abs(offset);

              const xOffset = offset * (isMobile ? 170 : 300);
              const scale = isCenter ? 1 : 0.88;
              const rotateY = offset * -12;
              const opacity = isCenter ? 1 : Math.max(0.18, 1 - dist * 0.38);
              const blur = isCenter ? 0 : dist * 4;
              const brightness = isCenter ? 1 : 0.55;

              return (
                <motion.div
                  key={`${item.id}-${absIndex}`}
                  initial={false}
                  animate={{
                    x: xOffset,
                    scale,
                    rotateY,
                    opacity,
                    filter: `blur(${blur}px) brightness(${brightness})`,
                  }}
                  transition={(val) =>
                    val === 'scale' ? TAP_SPRING : BASE_SPRING
                  }
                  onClick={() => {
                    if (!isCenter) setActive((p) => p + offset);
                  }}
                  style={{
                    transformStyle: 'preserve-3d',
                    zIndex: isCenter ? 30 : 20 - dist,
                  }}
                  className={cn(
                    'absolute w-[calc(100%-16px)] md:w-[calc(100%-32px)] h-[260px] sm:h-[350px] md:h-[420px] max-w-[720px] overflow-hidden rounded-2xl border bg-neutral-900/95 p-2 md:rounded-[2rem] md:p-4',
                    isCenter
                      ? 'border-brand/50 shadow-[0_0_60px_-15px_rgba(184,21,71,0.35)]'
                      : 'border-white/10 shadow-2xl'
                  )}
                >
                  {isVideo(mediaSrc) ? (
                    <ControlledVideo
                      src={mediaSrc}
                      isActive={isCenter}
                      className="h-full w-full rounded-xl bg-white object-contain shadow-2xl border border-black/10 pointer-events-none"
                    />
                  ) : (
                    <img
                      src={mediaSrc}
                      alt={item.title}
                      className="h-full w-full rounded-xl bg-white object-contain shadow-2xl border border-black/10 pointer-events-none"
                    />
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
                  {!isCenter && (
                    <div className="pointer-events-none absolute inset-0 bg-black/55" />
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        <div className="mt-6 rounded-3xl bg-black/25 p-4 backdrop-blur-sm md:mt-8 md:p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-h-[110px] flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeItem.id}
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                  transition={{ duration: 0.25 }}
                  className="space-y-2 text-center md:text-left"
                >
                  {activeItem.meta && (
                    <span className="text-xs font-black uppercase tracking-widest text-brand">
                      {activeItem.meta}
                    </span>
                  )}

                  <h2 className="text-2xl font-black tracking-tight text-white md:text-4xl">
                    {activeItem.title}
                  </h2>

                  {activeItem.description && (
                    <p className="mx-auto max-w-2xl font-medium text-neutral-300 md:mx-0">
                      {activeItem.description}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex flex-col items-center gap-4 sm:flex-row md:items-center">
              <div className="flex items-center gap-1 rounded-full bg-white/10 p-1 ring-1 ring-white/20 backdrop-blur-md">
                <button
                  onClick={handlePrev}
                  className="rounded-full p-3 text-neutral-300 transition hover:bg-brand hover:text-white active:scale-95"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <span className="min-w-[52px] text-center text-xs font-bold text-neutral-300">
                  {activeIndex + 1} / {count}
                </span>

                <button
                  onClick={handleNext}
                  className="rounded-full p-3 text-neutral-300 transition hover:bg-brand hover:text-white active:scale-95"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <button
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-full bg-brand px-8 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-brand/30 transition-all hover:scale-105 active:scale-95"
              >
                Zobraziť report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const GUIDE_ITEMS: FocusRailItem[] = [
    {
      id: 1,
      title: 'Zapojenie účastníkov',
      description:
        'Prezrite si účasť cez prehľadnú tabuľku, interaktívny graf alebo detailné karty stredísk.',
      meta: 'Funkcia 1',
      mediaSrc: '/zapojenie.mp4',
      mobileImageSrc: '/zapojenie-mobil.mp4',
    },
    {
      id: 2,
      title: 'Otvorené otázky',
      description:
        'Spoznajte najčastejšie témy cez mapu početnosti tvrdení a prečítajte si odporúčania od AI.',
      meta: 'Analýza AI',
      mediaSrc: '/otazky.mp4',
      mobileImageSrc: '/otazky-mobil.mp4',
    },
    {
      id: 3,
      title: 'Hodnotenie tímov',
      description:
        'Podrobné zhrnutie každej oblasti pre konkrétny tím, vrátane identifikácie silných stránok.',
      meta: 'Detailný pohľad',
      mediaSrc: '/tim.mp4',
      mobileImageSrc: '/tim-mobil.mp4',
    },
    {
      id: 4,
      title: 'Porovnávanie tímov',
      description:
        'Porovnajte si v danej oblasti viacero tímov naraz a odhaľte kľúčové rozdiely vo výsledkoch.',
      meta: 'Súvislosti',
      mediaSrc: '/porovnanie.mp4',
      mobileImageSrc: '/porovnanie-mobil.mp4',
    },
    {
      id: 5,
      title: 'Export súborov',
      description:
        'Každý graf alebo tabuľku si stiahnete jedným kliknutím ako čistý PNG obrázok.',
      meta: 'Prezentácia',
      mediaSrc: '/export.mp4',
      mobileImageSrc: '/export-mobil.mp4',
    },
  ];

  const content = (
    <div
      className={cn(
        'fixed inset-0 z-[99999] bg-black/70 backdrop-blur-md transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <FocusRail items={GUIDE_ITEMS} onClose={handleClose} />
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
};

export default WelcomeGuide;
