import React, { useEffect, useMemo, useState } from 'react';
import type { Feedback360CompanyReport } from '../../types';
import { Info } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  companyReport: Feedback360CompanyReport;
  scaleMax: number;
}

interface MetricTooltip {
  body: string;
  items?: string[];
}

interface MetricCard {
  label: string;
  value: string | number;
  suffix?: string;
  note?: string;
  variant: 'black' | 'brand' | 'white' | 'soft';
  className: string;
  valueClassName?: string;
  tooltip?: MetricTooltip;
}

const formatDecimal = (value: number, fractionDigits = 1) =>
  Number.isFinite(value) ? value.toFixed(fractionDigits) : '0.0';

const formatPercent = (value: number, fractionDigits = 1) =>
  `${formatDecimal(value, fractionDigits)}%`;

const metricValueClassName = 'text-6xl sm:text-7xl xl:text-[5.5rem]';
const participantChartColors = ['#C41854', '#111114', '#F3B6CB', '#8F949E'];

interface ParticipantBreakdownItem {
  label: string;
  value: number;
  color: string;
  share: number;
  shareLabel?: string;
}

type ParticipantsChartMode = 'participation' | 'groups';

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ParticipantBreakdownItem;
    value: number;
  }>;
}

const ParticipantPieTooltip = ({ active, payload }: PieTooltipProps) => {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload;
  const value = Number(payload[0]?.value || item?.value || 0);
  const share = Math.round(Number(item?.share || 0));

  return (
    <div className="rounded-[1rem] border border-black/5 bg-white/95 px-3.5 py-3 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: item.color }}
        />
        <p className="text-xs font-black leading-none text-black">{item.label}</p>
      </div>
      <div className="mt-2 flex items-end gap-2.5">
        <p className="text-xl font-black tracking-tighter leading-none text-black">{value}</p>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] leading-none text-black/40">
          {share}% {item.shareLabel || 'účastníkov'}
        </p>
      </div>
    </div>
  );
};

const CompanyParticipantsBentoBlock: React.FC<Props> = ({ companyReport, scaleMax }) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [activeChartMode, setActiveChartMode] = useState<ParticipantsChartMode>('groups');
  const respondentCounts = companyReport.respondentCounts;
  const participantDistribution = companyReport.participantDistribution;
  const evaluatedPeople = companyReport.participants.length;
  const subordinateCount = Number(respondentCounts.subordinate || 0);
  const managerCount = Number(respondentCounts.manager || 0);
  const peerCount = Number(respondentCounts.peer || 0);
  const selfCount = Number(respondentCounts.self || 0);
  const externalFeedbackCount = subordinateCount + managerCount + peerCount;
  const totalFeedbackCount = externalFeedbackCount + selfCount;
  const participantTotal = Number(participantDistribution?.total || 0) || totalFeedbackCount;
  const completedCount = Number(participantDistribution?.completed || 0) || totalFeedbackCount;
  const participantSubordinateCount =
    Number(participantDistribution?.subordinate || 0) || subordinateCount;
  const participantManagerCount = Number(participantDistribution?.manager || 0) || managerCount;
  const participantPeerCount = Number(participantDistribution?.peer || 0) || peerCount;
  const successRate =
    Number(participantDistribution?.successRate || 0) ||
    (participantTotal ? (completedCount / participantTotal) * 100 : 0);

  const competencyLabels = useMemo(() => {
    if (companyReport.competencies.length > 0) {
      return companyReport.competencies.map((competency) => competency.label);
    }

    const labelMap = new Map<string, string>();
    for (const participant of companyReport.participants) {
      for (const competency of participant.competencies || []) {
        if (!labelMap.has(competency.id)) {
          labelMap.set(competency.id, competency.label);
        }
      }
    }

    return Array.from(labelMap.values());
  }, [companyReport.competencies, companyReport.participants]);

  const participantNames = useMemo(
    () => companyReport.participants.map((participant) => participant.name),
    [companyReport.participants]
  );
  const incompleteCount = Math.max(participantTotal - completedCount, 0);

  const participantBreakdown = useMemo<ParticipantBreakdownItem[]>(
    () =>
      [
        {
          label: 'Podriadená/ý',
          value: participantSubordinateCount,
          color: participantChartColors[0],
          share: participantTotal > 0 ? (participantSubordinateCount / participantTotal) * 100 : 0,
          shareLabel: 'účastníkov',
        },
        {
          label: 'Peer',
          value: participantPeerCount,
          color: participantChartColors[1],
          share: participantTotal > 0 ? (participantPeerCount / participantTotal) * 100 : 0,
          shareLabel: 'účastníkov',
        },
        {
          label: 'Nadriadená/ý',
          value: participantManagerCount,
          color: participantChartColors[2],
          share: participantTotal > 0 ? (participantManagerCount / participantTotal) * 100 : 0,
          shareLabel: 'účastníkov',
        },
        {
          label: 'Sebahodnotenie',
          value: selfCount,
          color: participantChartColors[3],
          share: participantTotal > 0 ? (selfCount / participantTotal) * 100 : 0,
          shareLabel: 'účastníkov',
        },
      ].filter((item) => item.value > 0),
    [
      participantManagerCount,
      participantPeerCount,
      participantSubordinateCount,
      participantTotal,
      selfCount,
    ]
  );

  const participationBreakdown = useMemo<ParticipantBreakdownItem[]>(
    () =>
      [
        {
          label: 'Korektne vyplnené',
          value: completedCount,
          color: participantChartColors[0],
          share: participantTotal > 0 ? (completedCount / participantTotal) * 100 : 0,
          shareLabel: 'z celku',
        },
        {
          label: 'Nevyplnené / nekorektné',
          value: incompleteCount,
          color: participantChartColors[1],
          share: participantTotal > 0 ? (incompleteCount / participantTotal) * 100 : 0,
          shareLabel: 'z celku',
        },
      ].filter((item) => item.value > 0),
    [completedCount, incompleteCount, participantTotal]
  );

  const activeChartData =
    activeChartMode === 'participation' ? participationBreakdown : participantBreakdown;
  const activeChartCenterValue =
    activeChartMode === 'participation' ? formatPercent(successRate, 0) : participantTotal;
  const activeChartCenterLabel =
    activeChartMode === 'participation' ? 'účasť' : 'účastníkov spolu';

  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('[data-tooltip-root="participants-metric"]')) {
        setActiveTooltip(null);
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const metrics: MetricCard[] = [
    {
      label: 'Skúmané oblasti',
      value: competencyLabels.length,
      note: 'Kompetencie vo výslednej správe',
      variant: 'soft',
      className: 'md:col-span-3 xl:col-span-5 min-h-[220px] sm:min-h-[250px] lg:min-h-[275px]',
      valueClassName: metricValueClassName,
      tooltip: {
        body: 'V reportovej časti „Výsledky za celú firmu“ sú vyhodnotené tieto oblasti:',
        items: competencyLabels,
      },
    },
    {
      label: 'Hodnotené osoby',
      value: evaluatedPeople,
      variant: 'white',
      className: 'md:col-span-3 xl:col-span-3 min-h-[220px] sm:min-h-[250px] lg:min-h-[275px]',
      valueClassName: metricValueClassName,
      tooltip: {
        body: 'V správe sú zahrnuté tieto hodnotené osoby:',
        items: participantNames,
      },
    },
    {
      label: 'Stupnica hodnotenia',
      value: `1-${scaleMax}`,
      note: 'Podľa metodiky 360 spätnej väzby',
      variant: 'brand',
      className: 'md:col-span-6 xl:col-span-4 min-h-[220px] sm:min-h-[250px] lg:min-h-[275px]',
      valueClassName: 'text-5xl sm:text-6xl xl:text-[4.75rem]',
      tooltip: {
        body: 'Počas 360° spätnej väzby bola použitá hodnotiaca stupnica s týmito významami:',
        items: [
          '1 = rozhodne nesúhlasím',
          '2 = nesúhlasím',
          '3 = skôr nesúhlasím',
          '4 = neutrálne',
          '5 = skôr súhlasím',
          '6 = súhlasím',
          '7 = rozhodne súhlasím',
          'Ak respondent nevedel odpovedať, mohol zvoliť „nemôžem hodnotiť“.',
        ],
      },
    },
  ];

  const getCardClassName = (variant: MetricCard['variant']) => {
    if (variant === 'black') {
      return 'bg-gradient-to-br from-[#0b0b0d] via-[#111114] to-[#1a1a1f] text-white shadow-2xl shadow-black/25';
    }
    if (variant === 'brand') {
      return 'bg-gradient-to-br from-[#b81547] via-[#c41854] to-[#d63c71] text-white shadow-2xl shadow-brand/20';
    }
    if (variant === 'soft') {
      return 'bg-gradient-to-br from-[#fff4f8] via-[#fff9fb] to-[#ffeef4] text-black border border-brand/10 shadow-2xl shadow-brand/10';
    }
    return 'bg-gradient-to-br from-white via-white to-black/[0.02] text-black border border-black/5 shadow-2xl';
  };

  const getLabelClassName = (variant: MetricCard['variant']) => {
    if (variant === 'black') return 'text-white/45';
    if (variant === 'brand') return 'text-white/60';
    if (variant === 'soft') return 'text-brand/75';
    return 'text-black/40';
  };

  const getNoteClassName = (variant: MetricCard['variant']) => {
    if (variant === 'black') return 'text-white/45';
    if (variant === 'brand') return 'text-white/60';
    if (variant === 'soft') return 'text-black/45';
    return 'text-black/35';
  };

  const getTooltipClassName = (variant: MetricCard['variant']) => {
    if (variant === 'black' || variant === 'brand') {
      return 'bg-white text-black border border-black/5 shadow-2xl';
    }
    return 'bg-black text-white border border-white/10 shadow-2xl';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-5 sm:gap-7 lg:gap-8 animate-fade-in">
      <section className="md:col-span-6 xl:col-span-12 bg-gradient-to-br from-white via-white to-black/[0.02] text-black border border-black/5 shadow-2xl relative overflow-hidden p-7 sm:p-9 lg:p-11 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem]">
        <div className="absolute -right-20 -top-24 w-72 h-72 rounded-full bg-brand/[0.05] blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[minmax(0,0.85fr)_minmax(420px,1.15fr)] gap-6 sm:gap-8 lg:gap-10 items-stretch">
          <div className="grid grid-cols-1 gap-5 sm:gap-6">
            <button
              type="button"
              onClick={() => setActiveChartMode('participation')}
              className={`text-left rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 lg:p-9 transition-all ${
                activeChartMode === 'participation'
                  ? 'border border-brand/30 bg-white text-black shadow-2xl shadow-brand/15 ring-1 ring-brand/15'
                  : 'border border-black/5 bg-white text-black shadow-2xl shadow-black/10 hover:scale-[1.01] hover:border-brand/20 hover:shadow-brand/10'
              }`}
            >
              <span
                className={`block text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] ${
                  activeChartMode === 'participation' ? 'text-brand/80' : 'text-black/35'
                }`}
              >
                Účasť
              </span>
              <p
                className={`mt-5 text-2xl sm:text-3xl font-black tracking-tighter leading-tight ${
                  activeChartMode === 'participation' ? 'text-black' : 'text-black/85'
                }`}
              >
                Úspešnosť vyplnenia
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                {participationBreakdown.map((item) => (
                  <span
                    key={item.label}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] ${
                      activeChartMode === 'participation'
                        ? 'border border-brand/10 bg-brand/[0.06] text-black/55'
                        : 'border border-black/5 bg-[#f7f7f8] text-black/40'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </span>
                ))}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveChartMode('groups')}
              className={`text-left rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 lg:p-9 transition-all ${
                activeChartMode === 'groups'
                  ? 'border border-brand/30 bg-white text-black shadow-2xl shadow-brand/15 ring-1 ring-brand/15'
                  : 'border border-black/5 bg-white text-black shadow-2xl shadow-black/10 hover:scale-[1.01] hover:border-brand/20 hover:shadow-brand/10'
              }`}
            >
              <span
                className={`block text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] ${
                  activeChartMode === 'groups' ? 'text-brand/80' : 'text-black/35'
                }`}
              >
                Rozdelenie podľa skupín
              </span>
              <p
                className={`mt-5 text-2xl sm:text-3xl font-black tracking-tighter leading-tight ${
                  activeChartMode === 'groups' ? 'text-black' : 'text-black/85'
                }`}
              >
                Štruktúra respondentov
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                {participantBreakdown.map((item) => (
                  <span
                    key={item.label}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] ${
                      activeChartMode === 'groups'
                        ? 'border border-brand/10 bg-brand/[0.06] text-black/55'
                        : 'border border-black/5 bg-[#f7f7f8] text-black/40'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </span>
                ))}
              </div>
            </button>
          </div>

          <div className="relative min-h-[390px] sm:min-h-[460px] xl:min-h-[560px] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-l from-brand/[0.04] via-transparent to-transparent pointer-events-none" />
            <div className="relative w-full max-w-[560px] aspect-square">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeChartData}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius="58%"
                    outerRadius="84%"
                    paddingAngle={4}
                    cornerRadius={28}
                    stroke="none"
                  >
                    {activeChartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={false}
                    content={<ParticipantPieTooltip />}
                    offset={24}
                    position={{ x: 16, y: 16 }}
                    wrapperStyle={{ outline: 'none', pointerEvents: 'none', zIndex: 30 }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-none text-black">
                  {activeChartCenterValue}
                </span>
                <span className="mt-3 text-[10px] sm:text-xs font-black uppercase tracking-[0.28em] text-black/35 text-center">
                  {activeChartCenterLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {metrics.map((metric) => (
        <section
          key={metric.label}
          className={`${metric.className} ${getCardClassName(metric.variant)} relative overflow-visible p-7 sm:p-9 lg:p-11 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] transition-transform hover:scale-[1.015] ${
            activeTooltip === metric.label ? 'z-[60]' : 'z-0'
          }`}
        >
          {metric.variant === 'brand' && (
            <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          )}
          <div className="relative z-10 h-full flex flex-col justify-between gap-7 sm:gap-8">
            <div className="flex items-start justify-between gap-4">
              <span
                className={`block text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] ${getLabelClassName(metric.variant)}`}
              >
                {metric.label}
              </span>

              {metric.tooltip && (
                <div className="relative shrink-0" data-tooltip-root="participants-metric">
                  <button
                    type="button"
                    aria-label={`Viac informácií: ${metric.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveTooltip((current) => (current === metric.label ? null : metric.label));
                    }}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                      metric.variant === 'black' || metric.variant === 'brand'
                        ? 'border-white/15 text-white/70 hover:bg-white/10'
                        : 'border-black/10 text-black/45 hover:bg-black/5'
                    }`}
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  {activeTooltip === metric.label && (
                    <div
                      className={`${getTooltipClassName(metric.variant)} absolute top-full right-0 z-[70] mt-3 w-[min(24rem,calc(100vw-4rem))] rounded-[1.25rem] p-4 sm:p-5 max-h-[22rem] overflow-y-auto`}
                    >
                      <p className="text-sm font-bold leading-relaxed">{metric.tooltip.body}</p>
                      {metric.tooltip.items && metric.tooltip.items.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {metric.tooltip.items.map((item, index) => (
                            <p
                              key={`${metric.label}-${index}-${item}`}
                              className="text-xs sm:text-sm font-semibold leading-relaxed opacity-90"
                            >
                              {item}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`${metric.valueClassName || 'text-6xl sm:text-7xl'} font-black tracking-tighter leading-none`}
                >
                  {metric.value}
                </span>
                {metric.suffix && (
                  <span
                    className={`text-2xl sm:text-3xl font-black tracking-tighter ${
                      metric.variant === 'brand' || metric.variant === 'black'
                        ? 'text-white/35'
                        : 'text-black/15'
                    }`}
                  >
                    {metric.suffix}
                  </span>
                )}
              </div>

              {metric.note && (
                <p
                  className={`mt-5 sm:mt-6 text-[10px] sm:text-xs font-black uppercase tracking-widest ${getNoteClassName(metric.variant)}`}
                >
                  {metric.note}
                </p>
              )}
            </div>
          </div>
        </section>
      ))}

    </div>
  );
};

export default CompanyParticipantsBentoBlock;
