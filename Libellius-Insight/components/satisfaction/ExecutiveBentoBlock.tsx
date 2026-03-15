import React, { useMemo } from 'react';
import { BarChart3, Download, Layers3, MessageSquareQuote, ShieldAlert, Sparkles, Target, Users } from 'lucide-react';
import { exportBlockToPNG } from '../../utils/exportUtils';

interface Props {
  data: any;
  scaleMax: number;
}

type AreaAverage = { title: string; score: number };
type TeamAverage = { teamName: string; score: number };
type MetricItem = { areaTitle: string; teamName: string; category: string; score: number; questionType?: string };
type ThemeItem = { theme: string; count: number; percentage: number };

const cardClass = 'bg-white border border-black/5 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl p-5 sm:p-6 lg:p-7';

const slugify = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const ExecutiveBentoBlock: React.FC<Props> = ({ data, scaleMax }) => {
  const overview = useMemo(() => {
    const safeScaleMax = Number(scaleMax) > 0 ? Number(scaleMax) : 6;

    const allMetrics: MetricItem[] = (data?.areas || []).flatMap((area: any) =>
      (area?.teams || []).flatMap((team: any) =>
        (team?.metrics || [])
          .filter((metric: any) => Number(metric?.score) > 0)
          .map((metric: any) => ({
            areaTitle: String(area?.title || 'Oblasť'),
            teamName: String(team?.teamName || 'Tím'),
            category: String(metric?.category || 'Metrika'),
            score: Number(metric?.score) || 0,
            questionType: metric?.questionType,
          }))
      )
    );

    const overallScore = allMetrics.length
      ? allMetrics.reduce((sum, item) => sum + item.score, 0) / allMetrics.length
      : 0;

    const areaAverages: AreaAverage[] = (data?.areas || [])
      .map((area: any) => {
        const scores = (area?.teams || []).flatMap((team: any) =>
          (team?.metrics || [])
            .map((metric: any) => Number(metric?.score) || 0)
            .filter((score: number) => score > 0)
        );

        return {
          title: String(area?.title || 'Oblasť'),
          score: scores.length ? scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length : 0,
        };
      })
      .filter((area: AreaAverage) => area.score > 0)
      .sort((a: AreaAverage, b: AreaAverage) => b.score - a.score);

    const teamScoresMap = new Map<string, number[]>();
    allMetrics.forEach((metric) => {
      if (!teamScoresMap.has(metric.teamName)) teamScoresMap.set(metric.teamName, []);
      teamScoresMap.get(metric.teamName)?.push(metric.score);
    });

    const teamAverages: TeamAverage[] = Array.from(teamScoresMap.entries())
      .map(([teamName, scores]) => ({
        teamName,
        score: scores.length ? scores.reduce((sum, item) => sum + item, 0) / scores.length : 0,
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const topStatements = [...allMetrics]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const bottomStatements = [...allMetrics]
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    const aggregatedThemesMap = new Map<string, { count: number; percentage: number }>();
    const allQuotes: string[] = [];

    (data?.openQuestions || []).forEach((team: any) => {
      (team?.questions || []).forEach((question: any) => {
        (question?.themeCloud || []).forEach((themeItem: any) => {
          const theme = String(themeItem?.theme || '').trim();
          if (!theme) return;
          const current = aggregatedThemesMap.get(theme) || { count: 0, percentage: 0 };
          aggregatedThemesMap.set(theme, {
            count: current.count + (Number(themeItem?.count) || 0),
            percentage: current.percentage + (Number(themeItem?.percentage) || 0),
          });
        });

        (question?.recommendations || []).forEach((recommendation: any) => {
          (recommendation?.quotes || []).forEach((quote: any) => {
            const cleanQuote = String(quote || '').trim();
            if (cleanQuote) allQuotes.push(cleanQuote);
          });
        });
      });
    });

    const openQuestionThemes: ThemeItem[] = Array.from(aggregatedThemesMap.entries())
      .map(([theme, values]) => ({ theme, count: values.count, percentage: Number(values.percentage.toFixed(1)) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const uniqueQuotes = Array.from(new Set(allQuotes)).slice(0, 2);

    const strongestArea = areaAverages[0];
    const weakestArea = areaAverages[areaAverages.length - 1];
    const strongestTeam = teamAverages[0];
    const weakestTeam = teamAverages[teamAverages.length - 1];

    const numericSuccessRate = (() => {
      const clean = String(data?.successRate || '0').replace('%', '').replace(',', '.');
      const parsed = Number(clean);
      return Number.isFinite(parsed) ? parsed : 0;
    })();

    const leadingTheme = openQuestionThemes[0]?.theme || '';
    const leadingThemeNormalized = slugify(leadingTheme);

    const focusPoints = [
      weakestArea
        ? `Posilniť oblasť „${weakestArea.title}“, ktorá aktuálne dosahuje ${weakestArea.score.toFixed(2)} z ${safeScaleMax}.`
        : 'Posilniť najslabšiu oblasť identifikovanú v dátach.',
      bottomStatements[0]
        ? `Zamerať sa na tému „${bottomStatements[0].category}“, ktorá patrí medzi najslabšie hodnotené položky.`
        : 'Zamerať sa na najslabšie hodnotené položky v reporte.',
      leadingTheme
        ? `Prepojiť akčný plán aj s otvorenými odpoveďami, kde najviac rezonuje téma „${leadingTheme}”.`
        : 'Pri ďalších krokoch prepojiť kvantitatívne výsledky aj s otvorenými odpoveďami.',
    ];

    let overviewMessage = 'Spokojnosť pôsobí stabilne, no report ukazuje jasný priestor na zlepšenie.';
    if (strongestArea && weakestArea) {
      overviewMessage = `Najsilnejšie vychádza oblasť „${strongestArea.title}“, zatiaľ čo najväčší priestor na posun je v oblasti „${weakestArea.title}”.`;
    }
    if (leadingThemeNormalized.includes('odmen') || leadingThemeNormalized.includes('financ')) {
      overviewMessage += ' V otvorených odpovediach sa zároveň výrazne objavuje téma odmeňovania.';
    } else if (leadingThemeNormalized.includes('proces') || leadingThemeNormalized.includes('plan')) {
      overviewMessage += ' V otvorených odpovediach sa zároveň výrazne objavuje téma procesov a plánovania.';
    } else if (leadingThemeNormalized.includes('komunik')) {
      overviewMessage += ' V otvorených odpovediach sa zároveň výrazne objavuje téma komunikácie.';
    }

    return {
      safeScaleMax,
      overallScore,
      areaAverages,
      teamAverages,
      topStatements,
      bottomStatements,
      openQuestionThemes,
      uniqueQuotes,
      strongestArea,
      weakestArea,
      strongestTeam,
      weakestTeam,
      numericSuccessRate,
      focusPoints,
      overviewMessage,
    };
  }, [data, scaleMax]);

  const handleExport = () => {
    const clientSlug = String(data?.clientName || 'klient')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w\-]/g, '');

    exportBlockToPNG('block-overview-bento', `InsightHub_BentoGrid_${clientSlug}`);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/5 rounded-full text-[10px] font-black uppercase text-brand tracking-[0.2em] mb-3">
            <Sparkles className="w-3 h-3" /> Executive summary
          </div>
          <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter leading-none">Bento grid reportu</h3>
          <p className="text-sm font-medium text-black/50 mt-2 max-w-3xl">
            Rýchly manažérsky prehľad pre klienta, pripravený aj na export do prezentácie.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="export-buttons flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-black text-white hover:bg-brand rounded-2xl font-black transition-all text-[10px] sm:text-[11px] uppercase tracking-widest shadow-2xl"
        >
          <Download className="w-4 h-4" /> Export PNG
        </button>
      </div>

      <div id="block-overview-bento" className="bg-[#fafafa] border border-black/5 rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 shadow-2xl">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 auto-rows-[minmax(160px,auto)]">
          <div className={`${cardClass} xl:col-span-5 xl:row-span-2 bg-black text-white relative overflow-hidden`}>
            <div className="relative z-10 h-full flex flex-col justify-between gap-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Celkový index spokojnosti</span>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-none">
                    {overview.overallScore.toFixed(2)}
                  </span>
                  <span className="text-xl sm:text-2xl lg:text-3xl font-black text-white/20 mb-2">/ {overview.safeScaleMax}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full"
                    style={{ width: `${Math.max(0, Math.min(100, (overview.overallScore / overview.safeScaleMax) * 100))}%` }}
                  />
                </div>
                <p className="text-sm sm:text-base text-white/75 max-w-2xl leading-relaxed">
                  {overview.overviewMessage}
                </p>
              </div>
            </div>
            <div className="absolute right-[-3rem] bottom-[-3rem] w-40 h-40 bg-brand/20 blur-3xl rounded-full" />
          </div>

          <div className={`${cardClass} xl:col-span-3`}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Návratnosť</p>
                <h4 className="text-lg font-black uppercase tracking-tight mt-2">Zapojenie</h4>
              </div>
              <Users className="w-5 h-5 text-brand" />
            </div>

            <div className="flex items-end gap-2 mb-3">
              <span className="text-5xl font-black tracking-tighter leading-none">{overview.numericSuccessRate.toFixed(0)}</span>
              <span className="text-2xl font-black text-black/15 mb-1">%</span>
            </div>
            <p className="text-sm text-black/60 font-medium">
              {Number(data?.totalReceived || 0)} vyplnení z {Number(data?.totalSent || 0)} oslovených.
            </p>
          </div>

          <div className={`${cardClass} xl:col-span-4`}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Oblasti</p>
                <h4 className="text-lg font-black uppercase tracking-tight mt-2">Priemerné skóre</h4>
              </div>
              <Layers3 className="w-5 h-5 text-brand" />
            </div>

            <div className="space-y-4">
              {overview.areaAverages.slice(0, 4).map((area) => (
                <div key={area.title}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-sm font-bold text-black/70">{area.title}</span>
                    <span className="text-sm font-black">{area.score.toFixed(2)}</span>
                  </div>
                  <div className="h-2.5 bg-black/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full"
                      style={{ width: `${Math.max(0, Math.min(100, (area.score / overview.safeScaleMax) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${cardClass} xl:col-span-4`}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Tímy</p>
                <h4 className="text-lg font-black uppercase tracking-tight mt-2">Porovnanie tímov</h4>
              </div>
              <BarChart3 className="w-5 h-5 text-brand" />
            </div>

            <div className="space-y-4">
              {overview.teamAverages.slice(0, 4).map((team) => (
                <div key={team.teamName}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-sm font-bold text-black/70">{team.teamName}</span>
                    <span className="text-sm font-black">{team.score.toFixed(2)}</span>
                  </div>
                  <div className="h-2.5 bg-black/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black rounded-full"
                      style={{ width: `${Math.max(0, Math.min(100, (team.score / overview.safeScaleMax) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {(overview.strongestTeam || overview.weakestTeam) && (
              <p className="text-xs font-bold text-black/45 mt-5 leading-relaxed">
                {overview.strongestTeam ? `Najsilnejšie vychádza tím ${overview.strongestTeam.teamName}` : ''}
                {overview.strongestTeam && overview.weakestTeam ? ', ' : ''}
                {overview.weakestTeam ? `najväčšiu pozornosť si pýta tím ${overview.weakestTeam.teamName}.` : ''}
              </p>
            )}
          </div>

          <div className={`${cardClass} xl:col-span-4`}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Silné stránky</p>
                <h4 className="text-lg font-black uppercase tracking-tight mt-2">Top 3 výroky</h4>
              </div>
              <Sparkles className="w-5 h-5 text-brand" />
            </div>

            <div className="space-y-4">
              {overview.topStatements.map((item, index) => (
                <div key={`${item.teamName}-${item.category}`} className="flex gap-4">
                  <span className="text-xl font-black text-brand/70 leading-none mt-0.5">0{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-black leading-snug">{item.category}</p>
                    <div className="flex items-center justify-between gap-3 mt-2 text-xs font-bold text-black/40 uppercase tracking-wider">
                      <span>{item.areaTitle}</span>
                      <span className="text-black">{item.score.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${cardClass} xl:col-span-4 bg-[#fff8fa]`}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Riziká</p>
                <h4 className="text-lg font-black uppercase tracking-tight mt-2">Najslabšie miesta</h4>
              </div>
              <ShieldAlert className="w-5 h-5 text-brand" />
            </div>

            <div className="space-y-4">
              {overview.bottomStatements.map((item, index) => (
                <div key={`${item.teamName}-${item.category}-${index}`} className="flex gap-4">
                  <span className="text-xl font-black text-brand leading-none mt-0.5">0{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-black leading-snug">{item.category}</p>
                    <div className="flex items-center justify-between gap-3 mt-2 text-xs font-bold text-black/40 uppercase tracking-wider">
                      <span>{item.areaTitle}</span>
                      <span className="text-black">{item.score.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${cardClass} xl:col-span-4`}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Otvorené odpovede</p>
                <h4 className="text-lg font-black uppercase tracking-tight mt-2">Kľúčové témy</h4>
              </div>
              <MessageSquareQuote className="w-5 h-5 text-brand" />
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {overview.openQuestionThemes.length > 0 ? overview.openQuestionThemes.map((theme) => (
                <div key={theme.theme} className="px-3 py-2 rounded-xl bg-black/5 border border-black/5">
                  <div className="text-xs font-black text-black leading-none">{theme.theme}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-black/40 mt-1">{theme.count}× výskyt</div>
                </div>
              )) : (
                <p className="text-sm font-medium text-black/45">Otvorené odpovede zatiaľ nie sú k dispozícii.</p>
              )}
            </div>

            {overview.uniqueQuotes.length > 0 && (
              <div className="space-y-3">
                {overview.uniqueQuotes.map((quote, index) => (
                  <blockquote key={index} className="text-sm font-medium text-black/65 leading-relaxed border-l-2 border-brand pl-4 italic">
                    „{quote}“
                  </blockquote>
                ))}
              </div>
            )}
          </div>

          <div className={`${cardClass} xl:col-span-12 bg-brand text-white`}>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Akčné priority</p>
                <h4 className="text-xl sm:text-2xl font-black uppercase tracking-tight mt-2">Čo si pýta pozornosť manažmentu teraz</h4>
              </div>
              <Target className="w-5 h-5 text-white/80 shrink-0 mt-1" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              {overview.focusPoints.map((point, index) => (
                <div key={index} className="bg-white/10 rounded-[1.25rem] p-4 sm:p-5 border border-white/10">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55 mb-3">Priorita 0{index + 1}</div>
                  <p className="text-sm sm:text-base font-semibold leading-relaxed text-white">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveBentoBlock;
