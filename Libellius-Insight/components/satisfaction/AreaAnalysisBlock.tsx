import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { exportDataToExcel, exportBlockToPNG } from '../../utils/exportUtils';
import TeamSelectorGrid from './TeamSelectorGrid';
import ComparisonMatrix from './ComparisonMatrix';
import StyledSelect from '../ui/StyledSelect';
import { MapPin, Download, ChevronDown, Star, Target, BarChart as BarChartIcon, Maximize2, Minimize2, Image as ImageIcon, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';
import { FrequencyDistribution } from '../../types';

interface Props {
  area: AreaData;
  masterTeams: string[];
  scaleMax: number;
}

type FrequencyBucketKey = keyof FrequencyDistribution;
type FrequencyPctKey =
  | 'naPct'
  | 'onePct'
  | 'twoPct'
  | 'threePct'
  | 'fourPct'
  | 'fivePct';
type FrequencyCountKey =
  | 'naCount'
  | 'oneCount'
  | 'twoCount'
  | 'threeCount'
  | 'fourCount'
  | 'fiveCount';

interface AreaMetric {
  category: string;
  score: number;
  questionType?: string;
  frequencyDistribution?: FrequencyDistribution;
}

interface AreaTeam {
  teamName: string;
  metrics?: AreaMetric[];
}

interface AreaData {
  id: string | number;
  title: string;
  teams?: AreaTeam[];
}

interface ComparisonRow {
  category: string;
  questionType: string;
  [key: string]: string | number;
}

interface FrequencyChartRow {
  category: string;
  totalCount: number;
  naCount: number;
  oneCount: number;
  twoCount: number;
  threeCount: number;
  fourCount: number;
  fiveCount: number;
  naPct?: number;
  onePct?: number;
  twoPct?: number;
  threePct?: number;
  fourPct?: number;
  fivePct?: number;
}

interface TooltipPayloadItem {
  value?: number;
  payload?: FrequencyChartRow;
}

interface CustomBarTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

interface FrequencyDistributionTooltipBaseProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  coordinate?: { x?: number };
  viewBox?: { width?: number; x?: number };
}

interface FrequencyDistributionTooltipProps
  extends FrequencyDistributionTooltipBaseProps {
  hoveredBucketKey?: FrequencyBucketKey | null;
  selectedBucketKey?: FrequencyBucketKey | null;
}

interface YAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value?: string };
  isFullScreen?: boolean;
}

interface ScoreLabelProps {
  value?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface DistributionLabelProps {
  value?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: FrequencyChartRow;
}

const FREQUENCY_BUCKETS: Array<{
  key: FrequencyBucketKey;
  label: string;
  pctKey: FrequencyPctKey;
  countKey: FrequencyCountKey;
  color: string;
  textColor: string;
}> = [
  { key: 'na', label: 'N/A', pctKey: 'naPct', countKey: 'naCount', color: '#111111', textColor: '#FFFFFF' },
  { key: 'one', label: '1', pctKey: 'onePct', countKey: 'oneCount', color: '#4A081C', textColor: '#FFFFFF' },
  { key: 'two', label: '2', pctKey: 'twoPct', countKey: 'twoCount', color: '#7D0E30', textColor: '#FFFFFF' },
  { key: 'three', label: '3', pctKey: 'threePct', countKey: 'threeCount', color: '#B81547', textColor: '#FFFFFF' },
  { key: 'four', label: '4', pctKey: 'fourPct', countKey: 'fourCount', color: '#CB446D', textColor: '#FFFFFF' },
  { key: 'five', label: '5', pctKey: 'fivePct', countKey: 'fiveCount', color: '#E88AA6', textColor: '#111111' },
];
const FREQUENCY_ALL_VALUE = '__ALL__';

const CustomBarTooltip = ({ active, payload, label }: CustomBarTooltipProps) => {
  if (active && payload && payload.length) {
    const score = Number(payload[0]?.value ?? 0);
    if (!Number.isFinite(score)) return null;
    return (
      <div className="bg-black text-white p-4 sm:p-5 rounded-2xl shadow-2xl max-w-sm border border-white/10 z-50">
        <p className="font-bold text-sm mb-3 leading-snug">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand"></div>
          <p className="font-black text-base sm:text-lg">Skóre: {score.toFixed(2)}</p>
        </div>
      </div>
    );
  }
  return null;
};

const FrequencyDistributionTooltip = ({
  active,
  payload,
  label,
  coordinate,
  viewBox,
  hoveredBucketKey,
  selectedBucketKey,
}: FrequencyDistributionTooltipProps) => {
  if (!(active && payload && payload.length)) return null;

  const payloadItems = Array.isArray(payload) ? payload : [];
  const rowFromPayload =
    payloadItems.find((item) => item?.payload)?.payload || null;

  const resolveBucketDef = (
    key: FrequencyBucketKey | null | undefined
  ) => {
    if (!key) return null;
    const bucketDef = FREQUENCY_BUCKETS.find((item) => item.key === key);
    if (!bucketDef) return null;
    const pct = Number(rowFromPayload?.[bucketDef.pctKey] ?? 0);
    if (!(pct > 0)) return null;
    return bucketDef;
  };

  const resolveBucketByPointer = () => {
    const viewWidth = Number(viewBox?.width ?? 0);
    const viewX = Number(viewBox?.x ?? 0);
    const pointerX = Number(coordinate?.x ?? NaN);
    if (!Number.isFinite(pointerX) || viewWidth <= 0) return null;

    const pointerPctRaw = ((pointerX - viewX) / viewWidth) * 100;
    const pointerPct = Math.max(0, Math.min(100, pointerPctRaw));

    let cumulative = 0;
    for (const bucket of FREQUENCY_BUCKETS) {
      const pct = Number(rowFromPayload?.[bucket.pctKey] ?? 0);
      if (!(pct > 0)) continue;
      const next = cumulative + pct;
      if (
        pointerPct >= cumulative - 0.0001 &&
        pointerPct <= next + 0.0001
      ) {
        return bucket;
      }
      cumulative = next;
    }
    return null;
  };

  const resolvedBucket = selectedBucketKey
    ? resolveBucketDef(selectedBucketKey)
    : resolveBucketByPointer() ||
      resolveBucketDef(hoveredBucketKey) ||
      FREQUENCY_BUCKETS.find(
        (bucket) => Number(rowFromPayload?.[bucket.pctKey] ?? 0) > 0
      ) ||
      null;

  if (!resolvedBucket) return null;

  const count = Number(rowFromPayload?.[resolvedBucket.countKey] ?? 0);
  const percentage = Number(rowFromPayload?.[resolvedBucket.pctKey] ?? 0);
  const total = Number(rowFromPayload?.totalCount ?? 0);
  if (!(count > 0) || !(percentage > 0) || !(total > 0)) return null;

  return (
    <div className="bg-black text-white p-4 sm:p-5 rounded-2xl shadow-2xl max-w-sm border border-white/10 z-50">
      <p className="font-bold text-sm mb-3 leading-snug">{label}</p>
      <div className="space-y-1.5">
        <p className="text-xs font-black uppercase tracking-widest text-white/60">Hodnota škály: {resolvedBucket.label}</p>
        <p className="font-black text-base sm:text-lg">
          {count} respondentov ({percentage.toFixed(2)}%)
        </p>
        <p className="text-xs font-bold text-white/65">Celkový počet odpovedí: {total}</p>
      </div>
    </div>
  );
};

const CustomYAxisTick = ({ x, y, payload, isFullScreen }: YAxisTickProps) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const maxLength = isMobile ? 34 : (isFullScreen ? 88 : 62);

  const words = String(payload?.value || '').split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word: string) => {
    if ((currentLine + word).length > maxLength) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  });
  if (currentLine) {
    lines.push(currentLine.trim());
  }

  const lineHeight = isMobile ? 15 : (isFullScreen ? 20 : 17);
  const startY = Number(y ?? 0) - ((lines.length - 1) * lineHeight) / 2;
  const fontSize = isMobile ? 12 : (isFullScreen ? 15 : 13);

  return (
    <g transform={`translate(${Number(x ?? 0)},${startY})`}>
      {lines.map((line: string, index: number) => (
        <text key={index} x={0} y={index * lineHeight} dy="0.35em" textAnchor="end" fill="#000" fontSize={fontSize} fontWeight={800}>
          {line}
        </text>
      ))}
    </g>
  );
};

const AreaAnalysisBlock: React.FC<Props> = ({ area, masterTeams, scaleMax }) => {
  const [viewMode, setViewMode] = useState<'DETAIL' | 'COMPARISON'>('DETAIL');
  const [teamValue, setTeamValue] = useState<string>('');
  const [comparisonSelection, setComparisonSelection] = useState<string[]>([]);
  const [comparisonFilter, setComparisonFilter] = useState<'ALL' | 'PRIEREZOVA' | 'SPECIFICKA'>('ALL');
  const [selectedFrequencyBucket, setSelectedFrequencyBucket] = useState<
    keyof FrequencyDistribution | null
  >(null);
  const [hoveredFrequencyBucket, setHoveredFrequencyBucket] = useState<
    keyof FrequencyDistribution | null
  >(null);
  const [isFrequencyFullScreen, setIsFrequencyFullScreen] = useState(false);
  
  const [activeExportMenu, setActiveExportMenu] = useState<boolean>(false);
  const [activeFullscreenExportMenu, setActiveFullscreenExportMenu] = useState<boolean>(false);
  
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (masterTeams.length > 0 && !teamValue) {
      setTeamValue(masterTeams.find(t => t.toLowerCase().includes('priemer')) || masterTeams[0]);
    }
  }, [masterTeams, teamValue]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.export-dropdown-container')) {
        setActiveExportMenu(false);
      }
      if (!target.closest('.export-fullscreen-dropdown-container')) {
        setActiveFullscreenExportMenu(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsFullScreen(false);
      setIsFrequencyFullScreen(false);
    };
    window.addEventListener('keydown', handleEsc);

    if (isFullScreen || isFrequencyFullScreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setActiveFullscreenExportMenu(false);
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isFullScreen, isFrequencyFullScreen]);

  const comparisonAnimationKey = `${comparisonSelection.slice().sort().join('|') || 'none'}-${comparisonFilter}`;

  const getActiveData = (teamName: string): AreaMetric[] => {
    if (!area) return [];
    const team =
      area.teams?.find((t) => t.teamName === teamName) || area.teams?.[0];
    return team && Array.isArray(team.metrics) ? [...team.metrics].sort((a, b) => b.score - a.score) : [];
  };

  const getComparisonData = (selectedNames: string[]): ComparisonRow[] => {
    const cardTeams: AreaTeam[] = Array.isArray(area?.teams) ? area.teams : [];
    if (!cardTeams.length) return [];

    const categories = Array.from(
      new Set(
        cardTeams.flatMap((t) =>
          Array.isArray(t.metrics) ? t.metrics.map((m) => m.category) : []
        )
      )
    );

    const rows = categories.map((cat): ComparisonRow => {
      const row: ComparisonRow = { category: cat, questionType: '' };
      let qType = '';
      selectedNames.forEach((tName) => {
        const team = cardTeams.find((t) => t.teamName === tName);
        const metric = team?.metrics?.find((m) => m.category === cat);
        row[tName] = Number(metric?.score ?? 0);
        if (metric?.questionType) qType = metric.questionType;
      });
      row.questionType = qType;
      return row;
    });

    return rows.filter((row) => {
      if (comparisonFilter === 'ALL') return true;
      const typeStr = String(row.questionType || '').toLowerCase();
      if (comparisonFilter === 'PRIEREZOVA') return typeStr.includes('prierez');
      if (comparisonFilter === 'SPECIFICKA') return typeStr.includes('specif') || typeStr.includes('špecif');
      return true;
    });
  };

  const handlePngExport = () => {
    setActiveFullscreenExportMenu(false);
    const targetId = isFullScreen ? `fullscreen-block-${area.id}` : `block-area-${area.id}`;
    const fileName = `Oblast_${area.title}${isFullScreen ? '_Fullscreen' : ''}`.replace(/\s+/g, '_');
    exportBlockToPNG(targetId, fileName);
  };

  const handleExcelExport = () => {
    setActiveExportMenu(false);
    setActiveFullscreenExportMenu(false);
    
    let dataToExport: Array<
      Record<string, string | number | null | undefined>
    > = [];
    let fileName = '';

    if (viewMode === 'DETAIL') {
      const activeMetrics = getActiveData(teamValue);
      dataToExport = activeMetrics.map((m) => ({
        'Otázka / Kategória': m.category,
        'Skóre (max 5)': Number(m.score.toFixed(2)),
        'Typ otázky': m.questionType,
        'Početnosť N/A': m.frequencyDistribution?.na ?? '',
        'Početnosť 1': m.frequencyDistribution?.one ?? '',
        'Početnosť 2': m.frequencyDistribution?.two ?? '',
        'Početnosť 3': m.frequencyDistribution?.three ?? '',
        'Početnosť 4': m.frequencyDistribution?.four ?? '',
        'Početnosť 5': m.frequencyDistribution?.five ?? '',
      }));
      fileName = `Oblast_${area.title}_${teamValue}_Detail.xlsx`.replace(/\s+/g, '_');
    } else {
      const comparisonData = getComparisonData(comparisonSelection);
      dataToExport = comparisonData.map((row) => {
          const rowData: Record<string, string | number | null | undefined> = { 'Kategória': row.category, 'Typ otázky': row.questionType };
          comparisonSelection.forEach((team) => {
              const scoreValue = row[team];
              rowData[team] = typeof scoreValue === 'number' ? Number(scoreValue.toFixed(2)) : null;
          });
          return rowData;
      });
      fileName = `Oblast_${area.title}_Porovnanie.xlsx`.replace(/\s+/g, '_');
    }
    exportDataToExcel(dataToExport, fileName);
  };

  if (!area) return null;

  const activeMetrics = getActiveData(teamValue);
  const frequencyChartData: FrequencyChartRow[] = activeMetrics
    .map<FrequencyChartRow | null>((metric) => {
      const freq = metric?.frequencyDistribution as FrequencyDistribution | undefined;
      if (!freq) return null;

      const naCount = Number(freq.na ?? 0) || 0;
      const oneCount = Number(freq.one ?? 0) || 0;
      const twoCount = Number(freq.two ?? 0) || 0;
      const threeCount = Number(freq.three ?? 0) || 0;
      const fourCount = Number(freq.four ?? 0) || 0;
      const fiveCount = Number(freq.five ?? 0) || 0;
      const totalCount =
        naCount + oneCount + twoCount + threeCount + fourCount + fiveCount;

      return {
        category: String(metric?.category || ''),
        totalCount,
        naCount,
        oneCount,
        twoCount,
        threeCount,
        fourCount,
        fiveCount,
        naPct: totalCount > 0 && naCount > 0 ? (naCount / totalCount) * 100 : undefined,
        onePct: totalCount > 0 && oneCount > 0 ? (oneCount / totalCount) * 100 : undefined,
        twoPct: totalCount > 0 && twoCount > 0 ? (twoCount / totalCount) * 100 : undefined,
        threePct:
          totalCount > 0 && threeCount > 0
            ? (threeCount / totalCount) * 100
            : undefined,
        fourPct: totalCount > 0 && fourCount > 0 ? (fourCount / totalCount) * 100 : undefined,
        fivePct: totalCount > 0 && fiveCount > 0 ? (fiveCount / totalCount) * 100 : undefined,
      };
    })
    .filter(
      (row): row is FrequencyChartRow => row !== null && row.totalCount > 0
    );

  const top = activeMetrics.filter((m) => m.score >= 4.0).slice(0, 3);
  const bottom = [...activeMetrics]
    .filter((m) => m.score > 0 && m.score < 4.0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
  const metricCount = activeMetrics.length;
  const frequencyMetricCount = frequencyChartData.length;

  const getAxisWidth = () => {
    if (typeof window === 'undefined') return isFullScreen ? 560 : 430;
    if (window.innerWidth < 768) return 230;
    return isFullScreen ? 560 : 430;
  };

  const getBarSize = () => {
    if (isMobileViewport) return metricCount <= 3 ? 20 : 16;
    if (isFullScreen) return metricCount <= 5 ? 34 : 28;
    if (metricCount <= 3) return 30;
    if (metricCount <= 6) return 24;
    return 20;
  };

  const getChartHeight = () => {
    const rowHeight = isMobileViewport ? 64 : isFullScreen ? 76 : 68;
    const basePadding = isMobileViewport ? 95 : isFullScreen ? 160 : 120;
    const minHeight = isFullScreen ? 620 : 270;
    const maxHeight = isFullScreen ? 1400 : 650;
    const dynamicHeight = metricCount * rowHeight + basePadding;
    return Math.max(minHeight, Math.min(maxHeight, dynamicHeight));
  };

  const xAxisMax = 5;
  const xAxisTicks = [1, 2, 3, 4, 5];
  const frequencyXAxisTicks = [0, 20, 40, 60, 80, 100];
  const frequencyFilterOptions = [
    { value: FREQUENCY_ALL_VALUE, label: 'Všetky hodnoty' },
    ...FREQUENCY_BUCKETS.map((bucket) => ({
      value: bucket.key,
      label: `Hodnota ${bucket.label}`,
    })),
  ];

  const renderScoreBadge = (props: unknown) => {
    const safeProps = props as ScoreLabelProps;
    const score = Number(safeProps?.value);
    if (!Number.isFinite(score)) return null;

    const label = score.toFixed(2);
    const x = Number(safeProps?.x ?? 0);
    const y = Number(safeProps?.y ?? 0);
    const width = Number(safeProps?.width ?? 0);
    const height = Number(safeProps?.height ?? 0);
    const fontSize = isFullScreen ? 13 : 12;
    const badgeHeight = isFullScreen ? 28 : 24;
    const paddingX = 8;
    const badgeWidth = Math.max(54, label.length * (fontSize * 0.62) + paddingX * 2);
    const textColor = score > 4 ? '#B81547' : '#111111';

    return (
      <g transform={`translate(${x + width + 10},${y + height / 2 - badgeHeight / 2})`}>
        <rect
          width={badgeWidth}
          height={badgeHeight}
          rx={999}
          ry={999}
          fill={textColor}
          opacity={0.1}
        />
        <text
          x={badgeWidth / 2}
          y={badgeHeight / 2}
          dy="0.35em"
          textAnchor="middle"
          fill={textColor}
          fontSize={fontSize}
          fontWeight={900}
        >
          {label}
        </text>
      </g>
    );
  };

  const getFrequencyChartHeight = () => {
    if (frequencyMetricCount <= 0) return 0;
    const rowHeight = isMobileViewport ? 58 : isFrequencyFullScreen ? 70 : 64;
    const basePadding = isMobileViewport ? 90 : isFrequencyFullScreen ? 130 : 110;
    const minHeight = isFrequencyFullScreen ? 320 : 230;
    const maxHeight = isFrequencyFullScreen ? 1200 : 620;
    const dynamicHeight = frequencyMetricCount * rowHeight + basePadding;
    return Math.max(minHeight, Math.min(maxHeight, dynamicHeight));
  };

  const getFrequencyAxisWidth = () => {
    if (typeof window === 'undefined') return isFrequencyFullScreen ? 560 : 430;
    if (window.innerWidth < 768) return 230;
    return isFrequencyFullScreen ? 560 : 430;
  };

  const renderDistributionCountLabel =
    (countKey: FrequencyCountKey, textColor: string) =>
    (props: unknown) => {
      const safeProps = props as DistributionLabelProps;
      const percentage = Number(safeProps?.value ?? 0);
      const count = Number(safeProps?.payload?.[countKey] ?? 0);

      if (!Number.isFinite(percentage) || !Number.isFinite(count)) return null;
      if (count <= 0) return null;

      const x = Number(safeProps?.x ?? 0);
      const y = Number(safeProps?.y ?? 0);
      const width = Number(safeProps?.width ?? 0);
      const height = Number(safeProps?.height ?? 0);
      const fontSize = width < 28 ? (isFrequencyFullScreen ? 11 : 10) : isFrequencyFullScreen ? 16 : 13;
      const isNarrow = width < 18;
      const labelX = isNarrow ? x + width + 3 : x + width / 2;
      const textAnchor = isNarrow ? 'start' : 'middle';
      const fill = isNarrow ? '#111111' : textColor;

      return (
        <text
          x={labelX}
          y={y + height / 2}
          dy="0.35em"
          textAnchor={textAnchor}
          fill={fill}
          fontSize={fontSize}
          fontWeight={900}
          paintOrder="stroke"
          stroke={isNarrow ? '#FFFFFF' : 'none'}
          strokeWidth={isNarrow ? 2 : 0}
        >
          {count}
        </text>
      );
    };

  const renderChartBox = (
    <div 
      className={`${
        isFullScreen 
          ? 'fixed inset-0 z-[9999] bg-white p-6 sm:p-10 flex flex-col overflow-y-auto overflow-x-hidden animate-fade-in' 
          : 'bg-white p-6 sm:p-8 md:p-10 lg:p-14 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl flex flex-col'
      }`}
    >
      <div id={isFullScreen ? `fullscreen-block-${area.id}` : undefined} className="flex-1 flex flex-col w-full max-w-[1920px] mx-auto bg-white p-2">
        <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
              <BarChartIcon className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-black uppercase tracking-tight text-black">
                Hodnotenie jednotlivých tvrdení
              </h3>
              <p className="text-xs sm:text-sm font-bold text-black/40 mt-1 break-words">
                Stredisko: <span className="text-brand">{teamValue}</span>
                {isFullScreen && ` | Oblasť: ${area.title}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 print:hidden" data-html2canvas-ignore="true">
            {isFullScreen && (
              <div className="relative export-fullscreen-dropdown-container">
                <button
                  onClick={() => setActiveFullscreenExportMenu(!activeFullscreenExportMenu)}
                  className="flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-3 bg-black/5 hover:bg-black/10 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all text-black/60 hover:text-black"
                >
                  <Download className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Export</span>
                  <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${activeFullscreenExportMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {activeFullscreenExportMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 z-50 flex flex-col gap-1 min-w-[140px] animate-fade-in">
                      <button onClick={handlePngExport} className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 transition-colors">
                        <ImageIcon className="w-3 h-3" /> Obrázok PNG
                      </button>
                      <button onClick={handleExcelExport} className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-brand/10 text-brand transition-colors">
                        <Download className="w-3 h-3" /> Excel Dáta
                      </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all ${
                isFullScreen ? 'bg-black text-white hover:bg-zinc-800' : 'bg-black/5 text-black/50 hover:bg-black hover:text-white'
              }`}
              title={isFullScreen ? 'Zavrieť na celú obrazovku (Esc)' : 'Zobraziť na celú obrazovku'}
            >
              {isFullScreen ? (
                <><Minimize2 className="w-4 h-4" /> <span className="hidden sm:inline">Zavrieť</span></>
              ) : (
                <><Maximize2 className="w-4 h-4" /> <span className="hidden sm:inline">Zväčšiť graf</span></>
              )}
            </button>
          </div>
        </div>

        <div className={`w-full ${isFullScreen ? 'flex-1 min-h-[600px]' : ''}`}>
          <div className="w-full" style={{ height: getChartHeight() }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeMetrics} layout="vertical" margin={{ left: 10, right: 94, top: 8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="#00000010" />
                <XAxis
                  type="number"
                  domain={[0, xAxisMax]}
                  ticks={xAxisTicks}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: '#00000066',
                    fontSize: isFullScreen ? 12 : 11,
                    fontWeight: 800,
                  }}
                />
                {xAxisMax >= 4 && (
                  <ReferenceLine
                    x={4}
                    stroke="#B81547"
                    strokeWidth={1.5}
                    strokeDasharray="4 6"
                    ifOverflow="visible"
                  />
                )}
                <YAxis 
                  dataKey="category" 
                  type="category" 
                  width={getAxisWidth()} 
                  interval={0} 
                  tick={<CustomYAxisTick isFullScreen={isFullScreen} />} 
                />
                <Tooltip 
                  cursor={{ fill: '#00000005' }} 
                  content={<CustomBarTooltip />} 
                  isAnimationActive={false} 
                />
                <Bar
                  dataKey="score"
                  radius={[0, 12, 12, 0]}
                  barSize={getBarSize()}
                  isAnimationActive={false}
                  fillOpacity={1}
                >
                  {activeMetrics.map((entry, index: number) => (
                    <Cell key={index} fill={entry.score <= 4.0 ? '#000000' : '#B81547'} fillOpacity={1} opacity={1} />
                  ))}
                  <LabelList
                    dataKey="score"
                    content={renderScoreBadge}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderComparisonBox = (
    <div 
      className={`${
        isFullScreen 
          ? 'fixed inset-0 z-[9999] bg-white p-6 sm:p-10 flex flex-col overflow-y-auto animate-fade-in' 
          : 'relative mt-4'
      }`}
    >
      <div id={isFullScreen ? `fullscreen-block-${area.id}` : undefined} className="flex-1 flex flex-col w-full max-w-[1920px] mx-auto bg-white p-2">
        <div className={`flex justify-between items-start gap-4 ${isFullScreen ? 'mb-8' : 'mb-4'}`}>
          {isFullScreen ? (
            <div className="min-w-0">
               <h3 className="text-lg sm:text-xl lg:text-2xl font-black uppercase tracking-tight text-black">
                 Porovnanie tímov
               </h3>
               <p className="text-xs sm:text-sm font-bold text-black/40 mt-1 break-words">
                 Oblasť: <span className="text-brand">{area.title}</span>
               </p>
            </div>
          ) : (
            <div /> 
          )}

          <div className="flex items-center gap-2 shrink-0 print:hidden" data-html2canvas-ignore="true">
            {isFullScreen && (
              <div className="relative export-fullscreen-dropdown-container">
                <button
                  onClick={() => setActiveFullscreenExportMenu(!activeFullscreenExportMenu)}
                  className="flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-3 bg-black/5 hover:bg-black/10 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all text-black/60 hover:text-black"
                >
                  <Download className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Export</span>
                  <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${activeFullscreenExportMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {activeFullscreenExportMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 z-50 flex flex-col gap-1 min-w-[140px] animate-fade-in">
                      <button onClick={handlePngExport} className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 transition-colors">
                        <ImageIcon className="w-3 h-3" /> Obrázok PNG
                      </button>
                      <button onClick={handleExcelExport} className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-brand/10 text-brand transition-colors">
                        <Download className="w-3 h-3" /> Excel Dáta
                      </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all ${
                isFullScreen 
                  ? 'bg-black text-white hover:bg-zinc-800' 
                  : 'bg-black/5 text-black/50 hover:bg-black hover:text-white'
              }`}
              title={isFullScreen ? 'Zavrieť na celú obrazovku (Esc)' : 'Zobraziť tabuľku na celú obrazovku'}
            >
              {isFullScreen ? (
                <><Minimize2 className="w-4 h-4" /> <span className="hidden sm:inline">Zavrieť</span></>
              ) : (
                <><Maximize2 className="w-4 h-4" /> <span className="hidden sm:inline">Zväčšiť tabuľku</span></>
              )}
            </button>
          </div>
        </div>

        <div className={`w-full ${isFullScreen ? 'flex-1 overflow-y-auto no-scrollbar pb-8' : ''}`}>
          <div
            key={comparisonAnimationKey}
            className="animate-fade-in"
          >
            <ComparisonMatrix teams={comparisonSelection} matrixData={getComparisonData(comparisonSelection)} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderFrequencyDistributionBlock = (
    <div
      className={`${
        isFrequencyFullScreen
          ? 'fixed inset-0 z-[9999] bg-white p-6 sm:p-10 flex flex-col overflow-y-auto overflow-x-hidden animate-fade-in'
          : 'bg-white p-6 sm:p-8 md:p-10 lg:p-12 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl'
      }`}
    >
      <div
        id={isFrequencyFullScreen ? `fullscreen-frequency-block-${area.id}` : undefined}
        className="w-full max-w-[1920px] mx-auto"
      >
        <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
              <Filter className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-black uppercase tracking-tight text-black">
                Graf početnosti hodnôt
              </h3>
              <p className="text-xs sm:text-sm font-bold text-black/40 mt-1 break-words">
                Stredisko: <span className="text-brand">{teamValue}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 print:hidden" data-html2canvas-ignore="true">
            <div className="w-[190px] sm:w-[220px]">
              <StyledSelect
                value={selectedFrequencyBucket || FREQUENCY_ALL_VALUE}
                onChange={(value) => {
                  if (value === FREQUENCY_ALL_VALUE) {
                    setSelectedFrequencyBucket(null);
                    return;
                  }
                  setSelectedFrequencyBucket(value as keyof FrequencyDistribution);
                }}
                options={frequencyFilterOptions}
                buttonClassName="w-full px-3 py-2 sm:px-4 sm:py-3 bg-black/5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest text-black/70 border border-black/5 hover:bg-black/10"
                panelClassName="bg-white border-black/10"
                optionClassName="text-black/70 hover:bg-black/5 hover:text-black"
                selectedOptionClassName="bg-brand text-white"
                iconClassName="text-black/40 w-4 h-4"
              />
            </div>

            <button
              onClick={() => setIsFrequencyFullScreen(!isFrequencyFullScreen)}
              className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all ${
                isFrequencyFullScreen
                  ? 'bg-black text-white hover:bg-zinc-800'
                  : 'bg-black/5 text-black/50 hover:bg-black hover:text-white'
              }`}
              title={
                isFrequencyFullScreen
                  ? 'Zavrieť na celú obrazovku (Esc)'
                  : 'Zobraziť na celú obrazovku'
              }
            >
              {isFrequencyFullScreen ? (
                <>
                  <Minimize2 className="w-4 h-4" /> <span className="hidden sm:inline">Zavrieť</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" /> <span className="hidden sm:inline">Zväčšiť graf</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="w-full" style={{ height: getFrequencyChartHeight() }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={frequencyChartData}
              layout="vertical"
              margin={{ left: 10, right: 28, top: 8, bottom: 16 }}
              onMouseLeave={() => setHoveredFrequencyBucket(null)}
            >
              <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="#00000010" />
              <XAxis
                type="number"
                domain={[0, 100]}
                ticks={frequencyXAxisTicks}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => `${value}%`}
                tick={{
                  fill: '#00000066',
                  fontSize: isFrequencyFullScreen ? 12 : 11,
                  fontWeight: 800,
                }}
              />
              <YAxis
                dataKey="category"
                type="category"
                width={getFrequencyAxisWidth()}
                interval={0}
                tick={<CustomYAxisTick isFullScreen={isFrequencyFullScreen} />}
              />
              <Tooltip
                cursor={{ fill: '#00000005' }}
                content={(tooltipProps: unknown) => (
                  <FrequencyDistributionTooltip
                    {...(tooltipProps as FrequencyDistributionTooltipBaseProps)}
                    hoveredBucketKey={hoveredFrequencyBucket}
                    selectedBucketKey={selectedFrequencyBucket}
                  />
                )}
                isAnimationActive={false}
                shared
              />

              {FREQUENCY_BUCKETS.map((bucket, index) => {
                const isFirst = index === 0;
                const isLast = index === FREQUENCY_BUCKETS.length - 1;
                const isHighlighted =
                  !selectedFrequencyBucket || selectedFrequencyBucket === bucket.key;

                return (
                  <Bar
                    key={bucket.key}
                    dataKey={bucket.pctKey}
                    stackId="distribution"
                    fill={isHighlighted ? bucket.color : '#D4D4D8'}
                    isAnimationActive={false}
                    onMouseMove={() => setHoveredFrequencyBucket(bucket.key)}
                    onMouseLeave={() => setHoveredFrequencyBucket(null)}
                    radius={
                      isFirst
                        ? [10, 0, 0, 10]
                        : isLast
                        ? [0, 10, 10, 0]
                        : [0, 0, 0, 0]
                    }
                  >
                    <LabelList
                      dataKey={bucket.pctKey}
                      content={renderDistributionCountLabel(
                        bucket.countKey,
                        isHighlighted ? bucket.textColor : '#3F3F46'
                      )}
                    />
                  </Bar>
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 sm:gap-3 justify-end">
          {FREQUENCY_BUCKETS.map((bucket) => (
            <div
              key={`legend-${bucket.key}`}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-black/10 bg-white"
            >
              <span
                className="w-3.5 h-3.5 rounded-sm"
                style={{ backgroundColor: bucket.color }}
              />
              <span className="text-[11px] sm:text-xs font-black tracking-wide text-black/75">
                {bucket.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div id={`block-area-${area.id}`} className="space-y-8 sm:space-y-10 animate-fade-in">
      
      {!isFullScreen && (
        <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 w-full lg:w-auto min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/5 rounded-full text-[10px] font-black uppercase text-brand tracking-[0.2em] print:hidden">
                <MapPin className="w-3 h-3" /> FILTRE A ZOBRAZENIE
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none break-words">
                  {area.title}
                </h2>
                
                <div className="relative export-dropdown-container print:hidden">
                  <button
                    onClick={() => setActiveExportMenu(!activeExportMenu)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-black/5 hover:bg-black/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-black/60 hover:text-black"
                  >
                    <Download className="w-3 h-3" /> Export
                    <ChevronDown className={`w-3 h-3 transition-transform ${activeExportMenu ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {activeExportMenu && (
                    <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 z-50 flex flex-col gap-1 min-w-[120px] animate-fade-in">
                        <button onClick={handleExcelExport} className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-brand/10 text-brand transition-colors">
                          <Download className="w-3 h-3" /> Excel Dáta
                        </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex bg-black/5 p-1 rounded-2xl w-full sm:w-fit border border-black/5 overflow-x-auto no-scrollbar print:hidden">
                <button onClick={() => setViewMode('DETAIL')} className={`shrink-0 px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'DETAIL' ? 'bg-white text-black shadow-lg scale-105' : 'text-black/30 hover:text-black/60'}`}>
                  Detail tímu
                </button>
                <button onClick={() => setViewMode('COMPARISON')} className={`shrink-0 px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'COMPARISON' ? 'bg-white text-black shadow-lg scale-105' : 'text-black/30 hover:text-black/60'}`}>
                  Porovnanie
                </button>
              </div>
            </div>

            {viewMode === 'DETAIL' && (
              <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto print:hidden">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/20 lg:mr-4">
                  VYBRANÝ TÍM / STREDISKO:
                </span>
                <div className="relative w-full lg:w-auto lg:min-w-[340px]">
                  <StyledSelect
                    value={teamValue}
                    onChange={setTeamValue}
                    options={masterTeams.map((team: string) => ({
                      value: team,
                      label: team,
                    }))}
                    buttonClassName="w-full p-4 sm:p-5 lg:p-7 bg-black text-white rounded-[1rem] sm:rounded-[1.25rem] lg:rounded-[1.5rem] font-black text-base sm:text-lg lg:text-xl shadow-2xl hover:bg-brand tracking-tight"
                    panelClassName="bg-white border-black/10"
                    optionClassName="text-black/70 hover:bg-black/5 hover:text-black"
                    selectedOptionClassName="bg-brand text-white"
                    iconClassName="text-white/40 w-5 h-5 sm:w-6 sm:h-6"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'COMPARISON' && !isFullScreen && (
        <div className="bg-white p-6 sm:p-8 rounded-[1.5rem] border border-black/5 shadow-xl">
          <TeamSelectorGrid
            availableTeams={masterTeams}
            selectedTeams={comparisonSelection}
            onToggleTeam={(t) => {
              setComparisonSelection(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
            }}
            onClear={() => setComparisonSelection([])}
          />

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 bg-black/5 p-2 rounded-2xl w-full md:w-fit mt-6 print:hidden">
            <button onClick={() => setComparisonFilter('ALL')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${comparisonFilter === 'ALL' ? 'bg-white text-black shadow-md' : 'text-black/40 hover:text-black'}`}>
              Všetky tvrdenia
            </button>
            <button onClick={() => setComparisonFilter('PRIEREZOVA')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${comparisonFilter === 'PRIEREZOVA' ? 'bg-white text-black shadow-md' : 'text-black/40 hover:text-black'}`}>
              <div className={`w-2 h-2 rounded-full ${comparisonFilter === 'PRIEREZOVA' ? 'bg-brand' : 'bg-transparent border border-black/20'}`}></div>
              Prierezové
            </button>
            <button onClick={() => setComparisonFilter('SPECIFICKA')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${comparisonFilter === 'SPECIFICKA' ? 'bg-white text-black shadow-md' : 'text-black/40 hover:text-black'}`}>
              <div className={`w-2 h-2 rounded-full ${comparisonFilter === 'SPECIFICKA' ? 'bg-brand' : 'bg-transparent border border-black/20'}`}></div>
              Špecifické
            </button>
          </div>
        </div>
      )}

      {viewMode === 'DETAIL' ? (
        <div className="space-y-8 sm:space-y-10">
          
          {isFullScreen && typeof document !== 'undefined' 
            ? createPortal(renderChartBox, document.body) 
            : renderChartBox
          }

          {frequencyChartData.length > 0 && (
            isFrequencyFullScreen && typeof document !== 'undefined'
              ? createPortal(renderFrequencyDistributionBlock, document.body)
              : !isFullScreen && renderFrequencyDistributionBlock
          )}

          {!isFullScreen && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-10">
              <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl">
                <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10 text-brand">
                  <Star className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" />
                  <h4 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-black">Silné stránky</h4>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {top.map((m, i: number) => (
                    <div key={i} className="p-4 sm:p-5 lg:p-7 rounded-2xl sm:rounded-3xl flex justify-between items-center gap-3 bg-brand text-white shadow-lg group relative cursor-help">
                      <span className="font-bold text-xs pr-2 sm:pr-4 leading-snug tracking-wide line-clamp-2" title={m.category}>{m.category}</span>
                      <span className="text-2xl sm:text-3xl lg:text-4xl font-black shrink-0">{m.score.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl">
                <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10 text-black">
                  <Target className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" />
                  <h4 className="text-xl sm:text-2xl font-black uppercase tracking-tighter">Príležitosti</h4>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {bottom.length > 0 ? bottom.map((m, i: number) => (
                    <div key={i} className="p-4 sm:p-5 lg:p-7 rounded-2xl sm:rounded-3xl flex justify-between items-center gap-3 bg-black text-white shadow-lg group relative cursor-help">
                      <span className="font-bold text-xs pr-2 sm:pr-4 leading-snug tracking-wide line-clamp-2" title={m.category}>{m.category}</span>
                      <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-brand shrink-0">{m.score.toFixed(2)}</span>
                    </div>
                  )) : (
                    <p className="text-center py-10 text-black/20 font-black uppercase tracking-widest text-[10px]">Žiadne kritické body</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {isFullScreen && typeof document !== 'undefined' 
            ? createPortal(renderComparisonBox, document.body) 
            : renderComparisonBox
          }
        </>
      )}
    </div>
  );
};

export default AreaAnalysisBlock;
