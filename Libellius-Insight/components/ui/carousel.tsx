import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import HolographicCard from '@/components/ui/holographic-card';

export interface RecommendationSlide {
  id: string;
  title: string;
  phase: string;
  description: string;
  timeframe?: string;
  expectedOutcome?: string;
  isPriority?: boolean;
}

interface RecommendationCarouselProps {
  slides: RecommendationSlide[];
  title?: string;
  subtitle?: string;
  className?: string;
  hideHeader?: boolean;
  hideControls?: boolean;
  onScrollStateChange?: (state: {
    canScrollLeft: boolean;
    canScrollRight: boolean;
  }) => void;
}

export interface RecommendationCarouselHandle {
  scrollLeft: () => void;
  scrollRight: () => void;
}

export const RecommendationCarousel = React.forwardRef<
  RecommendationCarouselHandle,
  RecommendationCarouselProps
>(
  (
    {
      slides,
      title = 'Postup po prieskume spokojnosti',
      subtitle = 'Od insightu k zmysluplnej zmene',
      className,
      hideHeader = false,
      hideControls = false,
      onScrollStateChange,
      ...props
    },
    ref
  ) => {
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const scrollAnimationRef = React.useRef<number | null>(null);
    const [canScrollLeft, setCanScrollLeft] = React.useState(false);
    const [canScrollRight, setCanScrollRight] = React.useState(true);
    const [flippedCards, setFlippedCards] = React.useState<Record<string, boolean>>({});
    const cardHeightClass = 'h-[430px] sm:h-[500px] lg:h-[540px]';
    const cardOuterSizeClass = 'w-[304px] sm:w-[364px] lg:w-[404px] h-[454px] sm:h-[524px] lg:h-[564px]';

    const checkScrollability = React.useCallback(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }, []);

    React.useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      checkScrollability();
      container.addEventListener('scroll', checkScrollability);
      window.addEventListener('resize', checkScrollability);

      return () => {
        container.removeEventListener('scroll', checkScrollability);
        window.removeEventListener('resize', checkScrollability);
      };
    }, [slides, checkScrollability]);

    const scroll = (direction: 'left' | 'right') => {
      const container = scrollContainerRef.current;
      if (!container) return;

      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
        scrollAnimationRef.current = null;
      }

      const firstCard = container.querySelector('article');
      const firstCardWidth = firstCard instanceof HTMLElement ? firstCard.offsetWidth : 0;
      const containerStyles = window.getComputedStyle(container);
      const gap = parseFloat(containerStyles.columnGap || containerStyles.gap || '0') || 0;

      const stepSize =
        firstCardWidth > 0 ? firstCardWidth + gap : Math.max(container.clientWidth * 0.62, 260);
      const delta = direction === 'left' ? -stepSize : stepSize;

      const start = container.scrollLeft;
      const maxScroll = Math.max(container.scrollWidth - container.clientWidth, 0);
      const target = Math.min(Math.max(start + delta, 0), maxScroll);
      const distance = target - start;

      if (Math.abs(distance) < 1) return;

      const duration = 640;
      const startTime = performance.now();

      const easeInOutCubic = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const animateScroll = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(progress);

        container.scrollLeft = start + distance * eased;

        if (progress < 1) {
          scrollAnimationRef.current = requestAnimationFrame(animateScroll);
        } else {
          scrollAnimationRef.current = null;
          checkScrollability();
        }
      };

      scrollAnimationRef.current = requestAnimationFrame(animateScroll);
    };

    const toggleCard = (cardId: string) => {
      setFlippedCards((prev) => ({
        ...prev,
        [cardId]: !prev[cardId],
      }));
    };

    React.useEffect(() => {
      onScrollStateChange?.({ canScrollLeft, canScrollRight });
    }, [canScrollLeft, canScrollRight, onScrollStateChange]);

    React.useEffect(() => {
      return () => {
        if (scrollAnimationRef.current) {
          cancelAnimationFrame(scrollAnimationRef.current);
        }
      };
    }, []);

    React.useImperativeHandle(
      ref,
      () => ({
        scrollLeft: () => scroll('left'),
        scrollRight: () => scroll('right'),
      }),
      []
    );

    return (
      <section
        className={cn('w-full', className)}
        aria-labelledby="recommendation-carousel-heading"
        {...props}
      >
        {!hideHeader && (
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 px-1 sm:px-2 mb-6">
            <div className="min-w-0">
              <h3
                id="recommendation-carousel-heading"
                className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-black uppercase"
              >
                {title}
              </h3>
              <p className="mt-2 text-xs sm:text-sm font-bold text-black/45">
                {subtitle}
              </p>
            </div>

            {!hideControls && (
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <button
                  onClick={() => scroll('left')}
                  disabled={!canScrollLeft}
                  aria-label="Posunúť doľava"
                  className="p-3 rounded-full border border-black/10 bg-white text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => scroll('right')}
                  disabled={!canScrollRight}
                  aria-label="Posunúť doprava"
                  className="p-3 rounded-full border border-black/10 bg-white text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-brand hover:text-white"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="relative">
          <div
            ref={scrollContainerRef}
            className="flex items-stretch overflow-x-auto overflow-y-visible scroll-smooth snap-x snap-mandatory no-scrollbar gap-2 sm:gap-3 lg:gap-4 px-4 sm:px-5 lg:px-6 pt-4 pb-8"
          >
            {slides.map((slide, index) => {
              const isFlipped = !!flippedCards[slide.id];

              return (
              <article
                key={slide.id}
                className={cn(
                  'flex-shrink-0 snap-start',
                  cardOuterSizeClass
                )}
              >
                <div className="h-full w-full p-3">
                  <div className="group relative h-full w-full [perspective:1400px]">
                    <HolographicCard className="rounded-[1.5rem]">
                      <button
                        type="button"
                        onClick={() => toggleCard(slide.id)}
                        aria-label={`Karta ${slide.title}`}
                        aria-pressed={isFlipped}
                        className="w-full h-full text-left rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-brand/40"
                      >
                        <div
                          className={cn(
                            'relative h-full w-full rounded-[1.5rem] transition-transform duration-700'
                          )}
                          style={{
                            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                            WebkitTransform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                            transformStyle: 'preserve-3d',
                            WebkitTransformStyle: 'preserve-3d',
                          }}
                        >
                          <div
                            className="absolute inset-0 h-full w-full rounded-[1.5rem] bg-brand text-white border border-brand/80 shadow-xl transition-shadow duration-300 group-hover:shadow-2xl p-6 sm:p-8 lg:p-10 flex flex-col relative"
                            style={{
                              backfaceVisibility: 'hidden',
                              WebkitBackfaceVisibility: 'hidden',
                              transform: 'translateZ(0)',
                              WebkitTransform: 'translateZ(0)',
                            }}
                          >
                            <div className="pointer-events-none absolute inset-0 rounded-[1.5rem] overflow-hidden">
                              <span className="select-none absolute left-[-0.12em] bottom-[-0.1em] text-[clamp(11rem,30vw,19rem)] leading-none font-black text-white/20">
                                {index + 1}
                              </span>
                            </div>

                            <div className="relative z-10 flex items-center justify-between gap-3">
                              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-[0.22em]">
                                Krok {index + 1}
                              </span>
                              {slide.isPriority && (
                                <span className="text-[10px] font-black uppercase tracking-widest bg-black/25 text-white px-3 py-1.5 rounded-full">
                                  Priorita
                                </span>
                              )}
                            </div>

                            <div className="relative z-10 flex-1 flex items-center justify-start">
                              <h4 className="text-[clamp(1.35rem,2vw,2.1rem)] font-black tracking-tight leading-[1.12] text-left break-words max-w-[92%]">
                                {slide.title}
                              </h4>
                            </div>

                            <p className="relative z-10 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] text-white/75 text-center">
                              Ťuknite pre detail
                            </p>
                          </div>

                          <div
                            className="absolute inset-0 h-full w-full rounded-[1.5rem] border border-black/10 shadow-xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black p-6 sm:p-7 lg:p-8 flex flex-col text-white"
                            style={{
                              transform: 'rotateY(180deg) translateZ(0)',
                              WebkitTransform: 'rotateY(180deg) translateZ(0)',
                              backfaceVisibility: 'hidden',
                              WebkitBackfaceVisibility: 'hidden',
                            }}
                          >
                            <h5 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-[1.08] tracking-tight max-w-[92%]">
                              {slide.title}
                            </h5>

                            <p className="mt-4 text-base sm:text-lg lg:text-xl font-semibold text-white/90 leading-relaxed max-w-[95%]">
                              {slide.description}
                            </p>

                            <div className="mt-auto pt-6 flex flex-wrap items-center gap-2">
                              {slide.timeframe && (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/15 text-white text-[11px] font-bold">
                                  {slide.timeframe}
                                </span>
                              )}
                              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/15 text-white text-[11px] font-bold">
                                Akčný krok
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    </HolographicCard>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </div>
      </section>
    );
  }
);

RecommendationCarousel.displayName = 'RecommendationCarousel';
