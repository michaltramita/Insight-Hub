import React, { useMemo, useRef, useState } from 'react';
import { Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  RecommendationCarousel,
  RecommendationCarouselHandle,
  RecommendationSlide,
} from '../ui/carousel';

interface Props {
  data: any;
}

const RecommendationsBlock: React.FC<Props> = ({ data }) => {
  const carouselRef = useRef<RecommendationCarouselHandle | null>(null);
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: true,
  });

  const slides = useMemo<RecommendationSlide[]>(
    () => [
      {
        id: 'step_1',
        title: 'Analyzovať a interpretovať výsledky',
        phase: 'Krok 1',
        description:
          'Správne pochopenie dát je základ, aby ďalšie rozhodnutia vychádzali z reality tímov a nie z domnienok.',
        timeframe: 'Začiatok procesu',
        isPriority: true,
      },
      {
        id: 'step_2',
        title: 'Stanoviť prioritné oblastí na zlepšenie',
        phase: 'Krok 2',
        description:
          'Vyberte témy s najväčším dopadom na výkon, spokojnosť a stabilitu, aby sa kapacita sústredila na to podstatné.',
        timeframe: 'Nastavenie priorít',
        isPriority: true,
      },
      {
        id: 'step_3',
        title: 'Vypracovať akčné plány',
        phase: 'Krok 3',
        description:
          'Každý plán nastavte konkrétne: čo sa ide urobiť, kto je zodpovedný, dokedy a ako sa bude merať úspech.',
        timeframe: 'Plánovanie',
      },
      {
        id: 'step_4',
        title: 'Komunikovať výsledkov prieskumu a akčných plánov zamestnancom',
        phase: 'Krok 4',
        description:
          'Otvorte komunikáciu zrozumiteľne a transparentne, aby ľudia vedeli, čo sa mení, prečo a čo to znamená pre ich prácu.',
        timeframe: 'Komunikácia tímom',
      },
      {
        id: 'step_5',
        title: 'Previazať výsledky prieskumu s rozvojom a vzdelávaním',
        phase: 'Krok 5',
        description:
          'Prepojte zistenia s rozvojovými aktivitami, aby sa zmena neudiala jednorazovo, ale systematicky.',
        timeframe: 'Rozvoj ľudí',
      },
      {
        id: 'step_6',
        title: 'Priebežne zbierať spätnú väzbu a vyhodnocovať pokrok',
        phase: 'Krok 6',
        description:
          'Sledujte priebeh realizácie, pravidelne vyhodnocujte progres a upravujte kroky podľa reálnej odozvy tímov.',
        timeframe: 'Priebežný monitoring',
      },
      {
        id: 'step_7',
        title: 'Zmerať výsledky opakovaním prieskumu',
        phase: 'Krok 7',
        description:
          'Opakované meranie potvrdí, čo fungovalo, čo treba upraviť a kde pokračovať v ďalšom cykle zlepšovania.',
        timeframe: 'Nadväzné meranie',
      },
    ],
    []
  );

  return (
    <div className="animate-fade-in">
      <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl space-y-6 sm:space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 sm:gap-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/5 rounded-full text-[10px] font-black uppercase text-brand tracking-[0.2em]">
              <Lightbulb className="w-3 h-3" /> Akčný plán po prieskume
            </div>
            <h2 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none break-words text-black">
              Odporúčania krok za krokom
            </h2>
            <p className="mt-3 text-xs sm:text-sm font-bold text-black/45 max-w-3xl">
              Každá karta predstavuje konkrétny krok, ktorý vám pomôže premeniť výstupy z prieskumu na reálnu zmenu v tímoch.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              onClick={() => carouselRef.current?.scrollLeft()}
              disabled={!scrollState.canScrollLeft}
              aria-label="Posunúť doľava"
              className="p-3 rounded-full border border-black/10 bg-white text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => carouselRef.current?.scrollRight()}
              disabled={!scrollState.canScrollRight}
              aria-label="Posunúť doprava"
              className="p-3 rounded-full border border-black/10 bg-white text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-brand hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="pt-2">
          <RecommendationCarousel
            ref={carouselRef}
            slides={slides}
            hideHeader
            hideControls
            onScrollStateChange={setScrollState}
          />
        </div>
      </div>
    </div>
  );
};

export default RecommendationsBlock;
