import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FeedbackAnalysisResult } from '../types';
import TeamSelectorGrid from './satisfaction/TeamSelectorGrid';
import ComparisonMatrix from './satisfaction/ComparisonMatrix';
import LZString from 'lz-string';
import {
  Users, Search, BarChart4, MapPin, UserCheck,
  Building2, Star, Target, Download, Link as LinkIcon, Check, ArrowUpDown, ChevronDown,
  MessageSquare, Quote, MessageCircle, Filter, Lightbulb, BarChart as BarChartIcon,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie
} from 'recharts';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

type TabType = 'ENGAGEMENT' | 'OPEN_QUESTIONS' | string;
type ViewMode = 'DETAIL' | 'COMPARISON';
type SortKey = 'count' | 'name';
type SortDirection = 'asc' | 'desc' | null;
type ComparisonFilterType = 'ALL' | 'PRIEREZOVA' | 'SPECIFICKA';
type EngagementVisualMode = 'CARDS' | 'PIE';

const PIE_COLORS = ['#B81547', '#000000', '#2B2B2B', '#555555', '#7F7F7F', '#AAAAAA', '#D4D4D4'];

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black text-white p-4 sm:p-5 rounded-2xl shadow-2xl max-w-sm border border-white/10 z-50">
        <p className="font-bold text-sm mb-3 leading-snug">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand"></div>
          <p className="font-black text-base sm:text-lg">Skóre: {payload[0].value.toFixed(2)}</p>
        </div>
      </div>
    );
  }
  return null;
};

const SatisfactionDashboard: React.FC<Props> = ({ result, onReset }) => {
  const data = result.satisfaction || (result as any);
  const scaleMax = result.reportMetadata?.scaleMax || (data as any).reportMetadata?.scaleMax || 6;
  const isSharedView = typeof window !== 'undefined' && window.location.hash.startsWith('#report=');

  const [activeTab, setActiveTab] = useState<TabType>('ENGAGEMENT');
  const [viewMode, setViewMode] = useState<ViewMode>('DETAIL');
  const [copyStatus, setCopyStatus] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [comparisonFilter, setComparisonFilter] = useState<ComparisonFilterType>('ALL');
  const [engagementVisualMode, setEngagementVisualMode] = useState<EngagementVisualMode>('CARDS');

  const [showTeamFilter, setShowTeamFilter] = useState(false);
  const [selectedEngagementTeams, setSelectedEngagementTeams] = useState<string[]>([]);

  const [openQuestionsTeam, setOpenQuestionsTeam] = useState<string>('');
  const [selectedQuestionText, setSelectedQuestionText] = useState<string>('');
  const [expandedRecIndex, setExpandedRecIndex] = useState<number | null>(null);

  const [selectedTeams, setSelectedTeams] = useState<Record<string, string>>({});
  const [comparisonSelection, setComparisonSelection] = useState<Record<string, string[]>>({});

  const engagementCardsRef = useRef<HTMLDivElement | null>(null);
  const [canScrollEngagementLeft, setCanScrollEngagementLeft] = useState(false);
  const [canScrollEngagementRight, setCanScrollEngagementRight] = useState(false);

  const generateShareLink = () => {
    try {
      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(result));
      const shareUrl = `${window.location.origin}${window.location.pathname}#report=${compressed}`;
      navigator.clipboard.writeText(shareUrl);
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 2000);
    } catch (err) {
      alert("Chyba pri kopírovaní odkazu.");
    }
  };

  const exportToJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);

    const fileBaseName = `${data.clientName || 'firma'}_${data.surveyName || 'prieskum'}`
      .replace(/\s+/g, '_')
      .replace(/[^\w\-]/g, '');

    downloadAnchorNode.setAttribute("download", `${fileBaseName}_analyza.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const masterTeams = useMemo(() => {
    if (!data?.teamEngagement) return [];
    return data.teamEngagement
      .map((t: any) => t.name)
      .filter((name: string) => name && !['total', 'celkom'].includes(name.toLowerCase()))
      .sort((a: string, b: string) => {
        if (a.toLowerCase().includes('priemer')) return -1;
        if (b.toLowerCase().includes('priemer')) return 1;
        return a.localeCompare(b);
      });
  }, [data]);

  useEffect(() => {
    if (masterTeams.length === 0) return;

    const initialTeam = masterTeams.find((t: string) => t.toLowerCase().includes('priemer')) || masterTeams[0];

    if (!openQuestionsTeam) {
      setOpenQuestionsTeam(initialTeam);
    }

    setSelectedTeams(prev => {
      const next = { ...prev };
      (data.areas || []).forEach((area: any) => {
        if (!next[area.id]) next[area.id] = initialTeam;
      });
      return next;
    });

    setComparisonSelection(prev => {
      const next = { ...prev };
      (data.areas || []).forEach((area: any) => {
        if (!next[area.id]) next[area.id] = [];
      });
      return next;
    });
  }, [masterTeams, data.areas, openQuestionsTeam]);

  useEffect(() => {
    if (openQuestionsTeam && data.openQuestions) {
      const teamQuestions = data.openQuestions.find((t: any) => t.teamName === openQuestionsTeam)?.questions || [];
      if (teamQuestions.length > 0) {
        if (!teamQuestions.find((q: any) => q.questionText === selectedQuestionText)) {
          setSelectedQuestionText(teamQuestions[0].questionText);
        }
      } else {
        setSelectedQuestionText('');
      }
    }
    setExpandedRecIndex(null);
  }, [openQuestionsTeam, data.openQuestions, selectedQuestionText]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : sortDirection === 'asc' ? null : 'desc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const getAreaById = (areaId: string) => {
    return (data.areas || []).find((a: any) => a.id === areaId);
  };

  const getActiveData = (areaId: string, teamName: string) => {
    const area = getAreaById(areaId);
    if (!area) return [];
    const team = area.teams?.find((t: any) => t.teamName === teamName) || area.teams?.[0];
    return team && Array.isArray(team.metrics) ? [...team.metrics].sort((a, b) => b.score - a.score) : [];
  };

  const getComparisonData = (areaId: string, selectedNames: string[]) => {
    const area = getAreaById(areaId);
    const cardTeams = Array.isArray(area?.teams) ? area.teams : [];
    if (!cardTeams.length) return [];

    const categories = Array.from(
      new Set(cardTeams.flatMap((t: any) => (Array.isArray(t.metrics) ? t.metrics.map((m: any) => m.category) : [])))
    );

    const rows = categories.map((cat) => {
      const row: any = { category: cat };
      let qType = '';

      selectedNames.forEach((tName) => {
        const team = cardTeams.find((t: any) => t.teamName === tName);
        const metric = team?.metrics?.find((m: any) => m.category === cat);
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

  const filteredEngagement = useMemo(() => {
    let teams = [...(data.teamEngagement || [])];

    if (searchTerm) {
      teams = teams.filter((t: any) => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (selectedEngagementTeams.length > 0) {
      teams = teams.filter((t: any) => selectedEngagementTeams.includes(t.name));
    }

    if (sortKey && sortDirection) {
      teams.sort((a, b) => {
        const valA = sortKey === 'count' ? a.count : a.name.toLowerCase();
        const valB = sortKey === 'count' ? b.count : b.name.toLowerCase();
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return teams;
  }, [data.teamEngagement, searchTerm, selectedEngagementTeams, sortKey, sortDirection]);

  const totalFilteredCount = filteredEngagement.reduce((acc, curr) => acc + (Number(curr.count) || 0), 0);
  const safeTotalReceived = Number(data.totalReceived) > 0 ? Number(data.totalReceived) : 1;
  const safeTotalSent = Number(data.totalSent) > 0 ? Number(data.totalSent) : 1;

  const engagementChartData = useMemo(() => {
    return filteredEngagement.map((team: any, index: number) => {
      const count = Number(team.count) || 0;
      const percentage = totalFilteredCount > 0 ? Number(((count / totalFilteredCount) * 100).toFixed(1)) : 0;
      return {
        ...team,
        count,
        percentage,
        color: PIE_COLORS[index % PIE_COLORS.length],
      };
    });
  }, [filteredEngagement, totalFilteredCount]);

  const engagementTeamCards = useMemo(() => {
    return engagementChartData
      .slice()
      .sort((a, b) => b.count - a.count)
      .map((team: any) => {
        const responded = Number(team.count) || 0;

        const sentRaw = team.totalSent ?? team.sent ?? team.invited ?? team.osloveni ?? team.total;
        const teamSent =
          typeof sentRaw === 'number' && sentRaw > 0
            ? sentRaw
            : (responded > 0 && safeTotalReceived > 0)
              ? Math.round((responded / safeTotalReceived) * safeTotalSent)
              : 0;

        const responseRateTeam = teamSent > 0 ? Number(((responded / teamSent) * 100).toFixed(1)) : 0;
        const shareOfAllResponded = safeTotalReceived > 0 ? Number(((responded / safeTotalReceived) * 100).toFixed(1)) : 0;
        const shareOfAllSent = safeTotalSent > 0 ? Number(((teamSent / safeTotalSent) * 100).toFixed(1)) : 0;

        return {
          ...team,
          responded,
          teamSent,
          responseRateTeam,
          shareOfAllResponded,
          shareOfAllSent,
        };
      });
  }, [engagementChartData, safeTotalReceived, safeTotalSent]);

  const topEngagementTeam = engagementChartData.length > 0
    ? [...engagementChartData].sort((a, b) => b.count - a.count)[0]
    : null;

  const averagePerTeam = engagementChartData.length > 0
    ? Math.round(totalFilteredCount / engagementChartData.length)
    : 0;

  const updateEngagementScrollState = () => {
    const el = engagementCardsRef.current;
    if (!el) return;
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    setCanScrollEngagementLeft(el.scrollLeft > 8);
    setCanScrollEngagementRight(el.scrollLeft < maxScrollLeft - 8);
  };

  const scrollEngagementCards = (direction: 'left' | 'right') => {
    const el = engagementCardsRef.current;
    if (!el) return;
    const amount = Math.max(280, Math.round(el.clientWidth * 0.72));
    el.scrollBy({
      left: direction === 'right' ? amount : -amount,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    if (engagementVisualMode !== 'CARDS') return;

    const el = engagementCardsRef.current;
    if (!el) return;

    updateEngagementScrollState();

    const onScroll = () => updateEngagementScrollState();
    const onResize = () => updateEngagementScrollState();

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    const timer = window.setTimeout(updateEngagementScrollState, 50);

    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(timer);
    };
  }, [engagementVisualMode, engagementTeamCards.length]);

  const getThemeCloud = (question: any) => {
    if (!question?.themeCloud || !Array.isArray(question.themeCloud)) return [];
    return question.themeCloud
      .filter((t: any) => t?.theme)
      .map((t: any) => ({
        theme: String(t.theme),
        count: Number(t.count) || 0,
        percentage: Number(t.percentage) || 0,
      }))
      .sort((a: any, b: any) => b.count - a.count);
  };

  const getThemeFontSizeClass = (count: number, maxCount: number) => {
    if (maxCount <= 0) return 'text-sm';
    const ratio = count / maxCount;
    if (ratio >= 0.8) return 'text-2xl md:text-3xl';
    if (ratio >= 0.6) return 'text-xl md:text-2xl';
    if (ratio >= 0.4) return 'text-lg md:text-xl';
    if (ratio >= 0.2) return 'text-base md:text-lg';
    return 'text-sm md:text-base';
  };

  const renderSection = (areaId: string) => {
    const area = getAreaById(areaId);
    if (!area) return null;

    const teamValue = selectedTeams[areaId] || '';
    const activeMetrics = getActiveData(areaId, teamValue);
    const top = activeMetrics.slice(0, 3);
    const bottom = [...activeMetrics].filter(m => m.score > 0 && m.score < 4.0).sort((a, b) => a.score - b.score).slice(0, 3);

    return (
      <div className="space-y-8 sm:space-y-10 animate-fade-in">
        <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 w-full lg:w-auto min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/5 rounded-full text-[10px] font-black uppercase text-brand tracking-[0.2em]">
                <MapPin className="w-3 h-3" /> Konfigurácia reportu
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none break-words">
                {area.title}
              </h2>
              <div className="flex bg-black/5 p-1 rounded-2xl w-full sm:w-fit border border-black/5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setViewMode('DETAIL')}
                  className={`shrink-0 px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'DETAIL' ? 'bg-white text-black shadow-lg scale-105' : 'text-black/30 hover:text-black/60'}`}
                >
                  Detail tímu
                </button>
                <button
                  onClick={() => setViewMode('COMPARISON')}
                  className={`shrink-0 px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'COMPARISON' ? 'bg-white text-black shadow-lg scale-105' : 'text-black/30 hover:text-black/60'}`}
                >
                  Porovnanie
                </button>
              </div>
            </div>

            {viewMode === 'DETAIL' && (
              <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/20 lg:mr-4">
                  VYBRANÝ TÍM / STREDISKO:
                </span>
                <div className="relative w-full lg:w-auto lg:min-w-[340px]">
                  <select
                    value={teamValue}
                    onChange={(e) => setSelectedTeams({ ...selectedTeams, [areaId]: e.target.value })}
                    className="w-full p-4 sm:p-5 lg:p-7 pr-12 sm:pr-14 bg-black text-white rounded-[1rem] sm:rounded-[1.25rem] lg:rounded-[1.5rem] font-black text-base sm:text-lg lg:text-xl outline-none shadow-2xl cursor-pointer hover:bg-brand transition-all appearance-none tracking-tight"
                  >
                    {masterTeams.map((t: string) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-white/40 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {viewMode === 'COMPARISON' && (
            <div className="mt-8 border-t border-black/5 pt-8 space-y-6">
              <TeamSelectorGrid
                availableTeams={masterTeams}
                selectedTeams={comparisonSelection[areaId] || []}
                onToggleTeam={(t) => {
                  const current = comparisonSelection[areaId] || [];
                  setComparisonSelection({
                    ...comparisonSelection,
                    [areaId]: current.includes(t) ? current.filter(x => x !== t) : [...current, t]
                  });
                }}
                onClear={() => setComparisonSelection({ ...comparisonSelection, [areaId]: [] })}
              />

              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 bg-black/5 p-2 rounded-2xl w-full md:w-fit">
                <button
                  onClick={() => setComparisonFilter('ALL')}
                  className={`px-4 sm:px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${comparisonFilter === 'ALL' ? 'bg-white text-black shadow-md' : 'text-black/40 hover:text-black'}`}
                >
                  Všetky tvrdenia
                </button>
                <button
                  onClick={() => setComparisonFilter('PRIEREZOVA')}
                  className={`px-4 sm:px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${comparisonFilter === 'PRIEREZOVA' ? 'bg-white text-black shadow-md' : 'text-black/40 hover:text-black'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${comparisonFilter === 'PRIEREZOVA' ? 'bg-brand' : 'bg-transparent'}`}></div>
                  Prierezové
                </button>
                <button
                  onClick={() => setComparisonFilter('SPECIFICKA')}
                  className={`px-4 sm:px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${comparisonFilter === 'SPECIFICKA' ? 'bg-white text-black shadow-md' : 'text-black/40 hover:text-black'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${comparisonFilter === 'SPECIFICKA' ? 'bg-brand' : 'bg-transparent'}`}></div>
                  Špecifické
                </button>
              </div>
            </div>
          )}
        </div>

        {viewMode === 'DETAIL' ? (
          <div className="space-y-8 sm:space-y-10">
            <div className="bg-white p-6 sm:p-8 md:p-10 lg:p-14 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl flex flex-col">
              <div className="mb-6 sm:mb-8 flex items-start gap-4">
                <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
                  <BarChartIcon className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl lg:text-2xl font-black uppercase tracking-tight text-black">
                    Hodnotenie jednotlivých tvrdení
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-black/40 mt-1 break-words">
                    Stredisko: <span className="text-brand">{teamValue}</span>
                  </p>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <div className="min-w-[860px] h-[380px] sm:h-[420px] lg:h-[460px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={activeMetrics}
                      layout="vertical"
                      margin={{ left: 30, right: 55, top: 6, bottom: 6 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#00000008" />
                      <XAxis type="number" domain={[0, scaleMax]} hide />
                      <YAxis
                        dataKey="category"
                        type="category"
                        width={540}
                        tick={{ fontSize: 16, fontWeight: 800, fill: '#000' }}
                        interval={0}
                        tickFormatter={(val: string) => val.length > 70 ? val.substring(0, 70) + '...' : val}
                      />
                      <Tooltip cursor={{ fill: '#00000005' }} content={<CustomBarTooltip />} />
                      <Bar dataKey="score" radius={[0, 12, 12, 0]} barSize={24}>
                        {activeMetrics.map((entry: any, index: number) => (
                          <Cell key={index} fill={entry.score <= 4.0 ? '#000000' : '#B81547'} />
                        ))}
                        <LabelList
                          dataKey="score"
                          position="right"
                          style={{ fontWeight: 900, fontSize: '14px', fill: '#000' }}
                          offset={10}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-10">
              <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl">
                <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10 text-brand">
                  <Star className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" />
                  <h4 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-black">Silné stránky</h4>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {top.map((m, i) => (
                    <div key={i} className="p-4 sm:p-5 lg:p-7 rounded-2xl sm:rounded-3xl flex justify-between items-center gap-3 bg-brand text-white shadow-lg group relative cursor-help">
                      <span className="font-bold text-xs pr-2 sm:pr-4 leading-snug tracking-wide line-clamp-2" title={m.category}>
                        {m.category}
                      </span>
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
                  {bottom.length > 0 ? bottom.map((m, i) => (
                    <div key={i} className="p-4 sm:p-5 lg:p-7 rounded-2xl sm:rounded-3xl flex justify-between items-center gap-3 bg-black text-white shadow-lg group relative cursor-help">
                      <span className="font-bold text-xs pr-2 sm:pr-4 leading-snug tracking-wide line-clamp-2" title={m.category}>
                        {m.category}
                      </span>
                      <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-brand shrink-0">{m.score.toFixed(2)}</span>
                    </div>
                  )) : <p className="text-center py-10 text-black/20 font-black uppercase tracking-widest text-[10px]">Žiadne kritické body</p>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ComparisonMatrix teams={comparisonSelection[areaId] || []} matrixData={getComparisonData(areaId, comparisonSelection[areaId] || [])} />
        )}
      </div>
    );
  };

  if (!data) return null;

  const openQuestionsTeamData = data.openQuestions?.find((t: any) => t.teamName === openQuestionsTeam);
  const availableQuestions = openQuestionsTeamData?.questions || [];
  const selectedQuestionData = availableQuestions.find((q: any) => q.questionText === selectedQuestionText) || availableQuestions[0];

  const selectedQuestionThemeCloud = getThemeCloud(selectedQuestionData);
  const selectedQuestionMaxThemeCount =
    selectedQuestionThemeCloud.length > 0
      ? Math.max(...selectedQuestionThemeCloud.map((t: any) => t.count))
      : 0;

  const areaTabs = (data.areas || []).map((area: any, idx: number) => {
    const icons = [BarChart4, UserCheck, Users, Building2];
    return {
      id: area.id,
      icon: icons[idx % icons.length],
      label: area.title
    };
  });

  const allTabs = [
    { id: 'ENGAGEMENT', icon: Users, label: 'Zapojenie' },
    { id: 'OPEN_QUESTIONS', icon: MessageSquare, label: 'Otvorené otázky' },
    ...areaTabs
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8 max-w-[1600px] 2xl:max-w-[1800px] mx-auto">

      <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 p-5 sm:p-8 md:p-10 lg:p-12 shadow-2xl flex flex-col xl:flex-row justify-between items-start gap-6 sm:gap-8 relative overflow-hidden">
        <div className="flex flex-col gap-4 sm:gap-6 relative z-10 w-full xl:w-auto min-w-0">
          <div className="space-y-2 sm:space-y-3">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-brand/5 rounded-full border border-brand/10 w-fit">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-brand">Next-gen Analytics</span>
            </div>

            <div className="flex items-center gap-4">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tighter uppercase">
                Libellius <span className="text-brand">InsightHub</span>
              </h2>
            </div>
          </div>

          <div className="w-16 h-1 bg-black/5 rounded-full"></div>

          <div className="space-y-2 sm:space-y-3 min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl xl:text-5xl font-black tracking-tighter uppercase leading-none text-black break-words max-w-4xl">
              {data.surveyName || 'Prieskum spokojnosti'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/5 rounded-lg border border-black/5 min-w-0">
                <Building2 className="w-4 h-4 text-black/40 shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-black/60 truncate">
                  {data.clientName || 'Názov firmy'}
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-black/30">
                Vydané: {result.reportMetadata?.date || new Date().getFullYear().toString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:gap-3 relative z-10 w-full xl:w-auto xl:min-w-[220px] xl:items-end shrink-0 pt-1 sm:pt-2 md:pt-4 xl:pt-0">
          {!isSharedView && (
            <>
              <button
                onClick={generateShareLink}
                className={`w-full xl:w-[220px] flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black transition-all text-[10px] sm:text-[11px] uppercase tracking-widest shadow-xl ${copyStatus
                  ? 'bg-green-600 text-white scale-105'
                  : 'bg-white border-2 border-brand text-brand hover:bg-brand hover:text-white'
                  }`}
              >
                {copyStatus ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                {copyStatus ? 'Skopírované!' : 'Zdieľať'}
              </button>

              <button
                onClick={exportToJson}
                className="w-full xl:w-[220px] flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-black text-white hover:bg-brand rounded-xl sm:rounded-2xl font-black transition-all text-[10px] sm:text-[11px] uppercase tracking-widest shadow-2xl"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </>
          )}

          <button
            onClick={onReset}
            className="w-full xl:w-[220px] flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-black/5 hover:bg-black hover:text-white rounded-xl sm:rounded-2xl font-black transition-all text-[10px] sm:text-[11px] uppercase tracking-widest border border-black/5 group"
          >
            <ArrowUpDown className="w-4 h-4 text-black/40 group-hover:text-white" />
            {isSharedView ? 'Zavrieť report' : 'Zavrieť'}
          </button>
        </div>

        <div className="absolute top-[-20%] right-[-10%] w-72 sm:w-96 h-72 sm:h-96 bg-brand/5 rounded-full blur-[100px] pointer-events-none -z-0"></div>
      </div>

      <div className="flex gap-2 bg-black/5 p-2 rounded-2xl sm:rounded-3xl w-full mx-auto overflow-x-auto no-scrollbar border border-black/5">
        {allTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as TabType)}
            className={`shrink-0 xl:shrink xl:flex-1 xl:min-w-0 flex items-center justify-center gap-2 py-3 sm:py-4 lg:py-5 px-4 sm:px-5 lg:px-6 rounded-xl sm:rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-white text-black shadow-lg' : 'text-black/40 hover:text-black'
              }`}
          >
            <t.icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'ENGAGEMENT' && (
        <div className="space-y-8 sm:space-y-10 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-black text-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02]">
              <span className="block text-[9px] sm:text-[10px] font-black uppercase opacity-50 mb-2 sm:mb-3 tracking-[0.2em]">CELKOVÝ POČET OSLOVENÝCH</span>
              <span className="text-5xl sm:text-6xl xl:text-7xl font-black tracking-tighter leading-none">{data.totalSent || 0}</span>
            </div>
            <div className="bg-brand text-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02]">
              <span className="block text-[9px] sm:text-[10px] font-black uppercase opacity-60 mb-2 sm:mb-3 tracking-[0.2em]">POČET ZAPOJENÝCH OSOB</span>
              <span className="text-5xl sm:text-6xl xl:text-7xl font-black tracking-tighter leading-none">{data.totalReceived || 0}</span>
            </div>
            <div className="bg-white border border-black/5 p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02]">
              <span className="block text-[9px] sm:text-[10px] font-black uppercase text-black/40 mb-2 sm:mb-3 tracking-[0.2em]">CELKOVÁ NÁVRATNOSŤ</span>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl sm:text-6xl xl:text-7xl font-black text-black tracking-tighter leading-none">
                  {String(data.successRate || '0').replace('%', '')}
                </span>
                <span className="text-2xl sm:text-3xl xl:text-4xl font-black text-black/10 tracking-tighter">%</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl">
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 sm:mb-8 lg:mb-10 gap-4 sm:gap-6">
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter leading-none">Štruktúra stredísk</h3>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                <div className="relative w-full sm:flex-1 md:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/20" />
                  <input
                    type="text"
                    placeholder="Hľadať..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 sm:py-4 bg-black/5 rounded-2xl font-bold text-xs outline-none focus:bg-black/10 transition-all"
                  />
                </div>

                <button
                  onClick={() => setShowTeamFilter(!showTeamFilter)}
                  className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl font-bold text-xs transition-all border border-black/5 whitespace-nowrap ${showTeamFilter || selectedEngagementTeams.length > 0 ? 'bg-brand text-white shadow-lg' : 'bg-white hover:bg-black/5 text-black'
                    }`}
                >
                  <Filter className="w-4 h-4" />
                  Výber ({selectedEngagementTeams.length > 0 ? selectedEngagementTeams.length : 'Všetky'})
                </button>
              </div>
            </div>

            {showTeamFilter && (
              <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-black/5 rounded-2xl sm:rounded-3xl border border-black/5 animate-fade-in">
                <div className="flex flex-wrap gap-2">
                  {masterTeams.map((team: string) => (
                    <button
                      key={team}
                      onClick={() => {
                        setSelectedEngagementTeams(prev =>
                          prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team]
                        );
                      }}
                      className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedEngagementTeams.includes(team) ? 'bg-black text-white shadow-md' : 'bg-white text-black hover:bg-black/10'
                        }`}
                    >
                      {team}
                    </button>
                  ))}
                </div>
                {selectedEngagementTeams.length > 0 && (
                  <button onClick={() => setSelectedEngagementTeams([])} className="mt-4 text-[10px] uppercase tracking-widest font-black text-brand hover:underline">
                    Vymazať výber
                  </button>
                )}
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl sm:rounded-3xl border border-black/5">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-[#fcfcfc] text-[11px] font-black uppercase tracking-widest text-black/40 border-b border-black/5">
                  <tr>
                    <th className="p-4 sm:p-6 cursor-pointer hover:text-black transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-2">Stredisko <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th className="p-4 sm:p-6 text-center cursor-pointer hover:text-black transition-colors" onClick={() => handleSort('count')}>
                      <div className="flex items-center justify-center gap-2">Počet <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th className="p-4 sm:p-6 text-center">Podiel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 font-black text-xs">
                  {filteredEngagement.length > 0 ? filteredEngagement.map((team: any, idx: number) => (
                    <tr key={idx} className={`hover:bg-brand/5 transition-colors group ${team.name.toLowerCase().includes('priemer') ? 'bg-brand/5 text-brand' : ''}`}>
                      <td className="p-4 sm:p-7 group-hover:text-brand transition-colors">{team.name}</td>
                      <td className="p-4 sm:p-7 text-center">{team.count}</td>
                      <td className="p-4 sm:p-7">
                        <div className="flex items-center justify-center gap-4 sm:gap-5">
                          <div className="w-28 sm:w-40 bg-black/5 h-2.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand shadow-[0_0_10px_rgba(184,21,71,0.3)]"
                              style={{ width: `${(team.count / safeTotalReceived) * 100}%` }}
                            />
                          </div>
                          <span className="text-brand font-black text-xs min-w-[45px]">{((team.count / safeTotalReceived) * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="p-8 sm:p-10 text-center text-black/30 font-black uppercase tracking-widest text-xs">
                        Žiadne tímy nezodpovedajú filtru
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filteredEngagement.length > 0 && (
            <div className="bg-white p-6 sm:p-8 md:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl animate-fade-in">
              <div className="flex flex-col gap-6 sm:gap-8">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 sm:gap-6">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter leading-none">Vizualizácia zapojenia</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30 mt-2">
                      {selectedEngagementTeams.length > 0 ? "Podiel vo vybraných strediskách" : "Podiel na celkovej účasti"}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 w-full lg:w-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
                      <div className="bg-black/5 rounded-2xl px-4 py-3 border border-black/5 min-w-0 sm:min-w-[150px]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/30">Počet tímov</p>
                        <p className="text-xl sm:text-2xl font-black tracking-tight">{engagementChartData.length}</p>
                      </div>
                      <div className="bg-black/5 rounded-2xl px-4 py-3 border border-black/5 min-w-0 sm:min-w-[150px]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/30">Zapojených spolu</p>
                        <p className="text-xl sm:text-2xl font-black tracking-tight">{totalFilteredCount}</p>
                      </div>
                      <div className="bg-black/5 rounded-2xl px-4 py-3 border border-black/5 min-w-0 sm:min-w-[180px]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/30">Top tím</p>
                        <p className="text-sm font-black tracking-tight truncate">
                          {topEngagementTeam ? `${topEngagementTeam.name} (${topEngagementTeam.percentage}%)` : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex bg-black/5 p-1 rounded-2xl w-full lg:w-fit border border-black/5">
                      <button
                        onClick={() => setEngagementVisualMode('CARDS')}
                        className={`px-4 sm:px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${engagementVisualMode === 'CARDS' ? 'bg-white text-black shadow-md' : 'text-black/40 hover:text-black'}`}
                      >
                        Karty
                      </button>
                      <button
                        onClick={() => setEngagementVisualMode('PIE')}
                        className={`px-4 sm:px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${engagementVisualMode === 'PIE' ? 'bg-white text-black shadow-md' : 'text-black/40 hover:text-black'}`}
                      >
                        Koláč
                      </button>
                    </div>
                  </div>
                </div>

                {engagementVisualMode === 'CARDS' ? (
                  <div className="relative">
                    {engagementTeamCards.length > 2 && (
                      <>
                        <div className={`hidden sm:block absolute left-0 top-0 bottom-8 w-10 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none transition-opacity ${canScrollEngagementLeft ? 'opacity-100' : 'opacity-0'}`} />
                        <div className={`hidden sm:block absolute right-0 top-0 bottom-8 w-10 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none transition-opacity ${canScrollEngagementRight ? 'opacity-100' : 'opacity-0'}`} />

                        <button
                          type="button"
                          onClick={() => scrollEngagementCards('left')}
                          disabled={!canScrollEngagementLeft}
                          className={`hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full border shadow-lg transition-all ${canScrollEngagementLeft ? 'bg-white border-black/10 text-black hover:bg-black hover:text-white' : 'bg-white/70 border-black/5 text-black/20 cursor-not-allowed'}`}
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => scrollEngagementCards('right')}
                          disabled={!canScrollEngagementRight}
                          className={`hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full border shadow-lg transition-all ${canScrollEngagementRight ? 'bg-white border-black/10 text-black hover:bg-black hover:text-white' : 'bg-white/70 border-black/5 text-black/20 cursor-not-allowed'}`}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}

                    <div
                      ref={engagementCardsRef}
                      className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 pr-1 snap-x snap-mandatory no-scrollbar"
                    >
                      {engagementTeamCards.map((team: any, idx: number) => (
                        <div
  key={`${team.name}-${idx}`}
  className={`snap-start shrink-0 w-[92%] sm:w-[calc(50%-10px)] min-w-[300px] rounded-2xl sm:rounded-3xl border p-3 sm:p-4 ${
    idx === 0 ? 'bg-brand/5 border-brand/20' : 'bg-black/5 border-black/5'
  }`}
>
  <div className="flex items-start justify-between gap-2 mb-3">
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
      <h4 className="font-black text-sm sm:text-base text-black truncate">{team.name}</h4>
    </div>

    <div className="text-right shrink-0">
      <p className="text-[8px] font-black uppercase tracking-widest text-black/35 leading-none">
        Podiel odpovedí
      </p>
      <p className="text-base sm:text-lg font-black text-brand leading-none mt-1">
        {team.shareOfAllResponded}%
      </p>
    </div>
  </div>

  <div className="grid grid-cols-2 gap-2.5">
    <div className="bg-white rounded-xl border border-black/5 p-2.5">
      <p className="text-[8px] font-black uppercase tracking-widest text-black/35">Oslovených</p>
      <p className="text-base sm:text-lg font-black leading-none mt-1">{team.teamSent}</p>
    </div>

    <div className="bg-white rounded-xl border border-black/5 p-2.5">
      <p className="text-[8px] font-black uppercase tracking-widest text-black/35">Vyplnilo</p>
      <p className="text-base sm:text-lg font-black leading-none mt-1">{team.responded}</p>
    </div>

    <div className="bg-white rounded-xl border border-black/5 p-2.5">
      <p className="text-[8px] font-black uppercase tracking-widest text-black/35">Návratnosť</p>
      <p className="text-base sm:text-lg font-black leading-none mt-1">{team.responseRateTeam}%</p>
    </div>

    <div className="bg-white rounded-xl border border-black/5 p-2.5">
      <p className="text-[8px] font-black uppercase tracking-widest text-black/35">Podiel oslovení</p>
      <p className="text-base sm:text-lg font-black leading-none mt-1">{team.shareOfAllSent}%</p>
    </div>
  </div>

  <div className="mt-3 space-y-1.5">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-black/35 truncate">
        Podiel na celkovom vyplnení
      </p>
      <p className="text-[10px] font-black text-brand shrink-0">{team.shareOfAllResponded}%</p>
    </div>

    <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-black/5">
      <div
        className="h-full rounded-full"
        style={{ width: `${team.shareOfAllResponded}%`, backgroundColor: team.color }}
      />
    </div>
  </div>
</div>
                      ))}
                    </div>

                    {engagementTeamCards.length > 1 && (
                      <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-black/25">
                        Potiahnite do strán pre ďalšie tímy
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8 items-start xl:items-center">
                    <div className="xl:col-span-7 h-[340px] sm:h-[420px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={engagementChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={120}
                            paddingAngle={3}
                            dataKey="count"
                            nameKey="name"
                            stroke="none"
                          >
                            {engagementChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>

                          <Tooltip
                            formatter={(value, name) => {
                              const count = Number(value);
                              const percentage = totalFilteredCount > 0 ? ((count / totalFilteredCount) * 100).toFixed(1) : '0.0';
                              return [`${count} osôb (${percentage}%)`, name];
                            }}
                            contentStyle={{
                              borderRadius: '1rem',
                              border: 'none',
                              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                              fontWeight: 700
                            }}
                            itemStyle={{ fontWeight: 900, color: '#000' }}
                          />

                          <text
                            x="50%"
                            y="46%"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="fill-black"
                            style={{ fontSize: '30px', fontWeight: 900 }}
                          >
                            {totalFilteredCount}
                          </text>
                          <text
                            x="50%"
                            y="55%"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ fill: 'rgba(0,0,0,0.5)', fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as any }}
                          >
                            zapojených osôb
                          </text>
                          <text
                            x="50%"
                            y="62%"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ fill: 'rgba(0,0,0,0.3)', fontSize: '9px', fontWeight: 700 }}
                          >
                            Priemer na tím: {averagePerTeam}
                          </text>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="xl:col-span-5 w-full">
                      <div className="bg-black/5 rounded-2xl sm:rounded-3xl border border-black/5 p-4 md:p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-black/40">
                            Rozdelenie podľa tímov
                          </h4>
                        </div>

                        <div className="space-y-3 max-h-[340px] overflow-auto pr-1">
                          {engagementChartData
                            .slice()
                            .sort((a, b) => b.count - a.count)
                            .map((team: any, idx: number) => (
                              <div
                                key={`${team.name}-${idx}`}
                                className={`rounded-2xl border p-3 sm:p-4 ${idx === 0 ? 'bg-brand/5 border-brand/20' : 'bg-white border-black/5'}`}
                              >
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="w-3 h-3 rounded-full shrink-0"
                                      style={{ backgroundColor: team.color }}
                                    />
                                    <span className="font-black text-xs sm:text-sm text-black truncate">{team.name}</span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-xs sm:text-sm font-black leading-none">{team.count}</p>
                                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-brand mt-1">
                                      {team.percentage}%
                                    </p>
                                  </div>
                                </div>

                                <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${team.percentage}%`,
                                      backgroundColor: team.color
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'OPEN_QUESTIONS' && (
        <div className="space-y-8 sm:space-y-10 animate-fade-in">
          <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-6 sm:gap-8">
              <div className="space-y-4 sm:space-y-6 w-full lg:w-1/2 min-w-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/5 rounded-full text-[10px] font-black uppercase text-brand tracking-[0.2em]">
                  <Lightbulb className="w-3 h-3" /> Analýza a odporúčania
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none">Otvorené otázky</h2>
                <p className="text-sm font-medium text-black/50 leading-relaxed max-w-md">
                  Umelá inteligencia zosumarizovala odpovede zamestnancov a pre každú otázku vygenerovala kľúčové odporúčania pre manažment.
                </p>
              </div>
              <div className="flex flex-col gap-4 w-full lg:w-1/2">
                <div className="w-full">
                  <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-black/20 mb-2">VYBERTE TÍM:</span>
                  <div className="relative">
                    <select value={openQuestionsTeam} onChange={(e) => setOpenQuestionsTeam(e.target.value)} className="w-full p-4 sm:p-5 pr-12 bg-black text-white rounded-[1rem] sm:rounded-[1.5rem] font-black text-base sm:text-lg outline-none shadow-xl cursor-pointer hover:bg-brand transition-all appearance-none tracking-tight">
                      {masterTeams.map((t: string) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
                  </div>
                </div>
                <div className="w-full">
                  <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-black/20 mb-2">VYBERTE OTÁZKU:</span>
                  <div className="relative">
                    <select value={selectedQuestionText} onChange={(e) => setSelectedQuestionText(e.target.value)} className="w-full p-4 sm:p-5 pr-12 bg-black/5 text-black rounded-[1rem] sm:rounded-[1.5rem] font-bold text-sm outline-none shadow-sm cursor-pointer border border-black/5 hover:bg-black/10 transition-all appearance-none" disabled={availableQuestions.length === 0}>
                      {availableQuestions.length > 0 ? availableQuestions.map((q: any, i: number) => <option key={i} value={q.questionText}>{q.questionText}</option>) : <option value="">Žiadne otázky nie sú k dispozícii</option>}
                    </select>
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-black/40 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {selectedQuestionData?.recommendations && selectedQuestionData.recommendations.length > 0 ? (
            <div className="flex flex-col gap-4 sm:gap-6">

              {selectedQuestionThemeCloud.length > 0 && (
                <div className="bg-white p-6 sm:p-8 md:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-xl">
                  <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-brand mb-4 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" /> Tematická mapa odpovedí (otázka)
                  </h5>

                  <div className="bg-black/5 rounded-2xl p-4 sm:p-5 md:p-6 border border-black/5">
                    <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 sm:gap-y-3">
                      {selectedQuestionThemeCloud.map((theme: any, tIdx: number) => (
                        <span
                          key={tIdx}
                          title={`Výskyt: ${theme.count}x • Podiel: ${theme.percentage} % odpovedí`}
                          className={`
                            inline-flex items-center rounded-xl px-3 py-1.5
                            font-black tracking-tight cursor-help select-none
                            ${tIdx < 2 ? 'text-brand bg-brand/10' : 'text-black bg-white'}
                            ${getThemeFontSizeClass(theme.count, selectedQuestionMaxThemeCount)}
                          `}
                        >
                          {theme.theme}
                        </span>
                      ))}
                    </div>

                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/35 mt-4">
                      Veľkosť témy zodpovedá frekvencii výskytu
                    </p>
                  </div>
                </div>
              )}

              {selectedQuestionData.recommendations.map((rec: any, index: number) => {
                const hasQuotes = Array.isArray(rec?.quotes) && rec.quotes.length > 0;

                return (
                  <div
                    key={index}
                    className={`bg-white p-5 sm:p-6 md:p-8 lg:p-10 rounded-[1.25rem] sm:rounded-[1.75rem] lg:rounded-[2.5rem] border transition-all duration-300 flex flex-col group cursor-pointer ${expandedRecIndex === index ? 'border-brand/20 shadow-2xl' : 'border-black/5 shadow-xl hover:shadow-2xl hover:border-black/10'}`}
                    onClick={() => setExpandedRecIndex(expandedRecIndex === index ? null : index)}
                  >
                    <div className="flex flex-col md:flex-row gap-4 sm:gap-6 md:gap-8 items-start w-full">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 shadow-sm ${expandedRecIndex === index ? 'bg-brand text-white scale-110' : 'bg-brand/5 text-brand group-hover:scale-110 group-hover:bg-brand group-hover:text-white'}`}>
                        <span className="font-black text-xl sm:text-2xl">{index + 1}</span>
                      </div>
                      <div className="flex-grow pt-1 sm:pt-2 flex flex-col md:flex-row justify-between items-start gap-4 min-w-0">
                        <div className="max-w-4xl min-w-0">
                          <h4 className="text-lg sm:text-xl md:text-2xl font-black text-black mb-2 sm:mb-4 leading-tight break-words">{rec.title}</h4>
                          <p className="text-sm sm:text-base text-black/60 font-medium leading-relaxed break-words">{rec.description}</p>
                        </div>
                        <div className={`shrink-0 mt-1 md:mt-2 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-black/5 transition-transform duration-300 ${expandedRecIndex === index ? 'rotate-180 bg-brand/10 text-brand' : 'text-black/40 group-hover:bg-black/10'}`}>
                          <ChevronDown className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    {expandedRecIndex === index && (
                      <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-black/5 animate-fade-in pl-0 md:pl-24 space-y-6 sm:space-y-8">
                        {hasQuotes ? (
                          <div>
                            <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-brand mb-4 sm:mb-6 flex items-center gap-2">
                              <MessageCircle className="w-4 h-4" /> Reprezentatívne citácie z odpovedí
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                              {rec.quotes.map((quote: string, qIdx: number) => (
                                <div key={qIdx} className="bg-black/5 p-4 sm:p-5 rounded-2xl relative">
                                  <Quote className="w-5 h-5 text-black/10 absolute top-4 left-4" />
                                  <p className="text-sm font-medium text-black/80 italic pl-8 leading-relaxed">"{quote}"</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-black/5 rounded-2xl p-4 sm:p-5 text-sm font-bold text-black/50">
                            Pre toto odporúčanie nie sú dostupné citácie.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 sm:py-20 bg-white rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 text-black/30 font-black uppercase tracking-widest text-xs sm:text-sm">
              Pre túto otázku a stredisko nie sú dostupné žiadne odporúčania.
            </div>
          )}
        </div>
      )}

      {(data.areas || []).some((a: any) => a.id === activeTab) && renderSection(activeTab as string)}

      <div className="mt-12 sm:mt-16 pt-8 sm:pt-10 border-t border-black/10 flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6 text-black/40 pb-4 sm:pb-6">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Libellius" className="h-14 sm:h-20 lg:h-24 w-auto object-contain" />
        </div>
        <div className="text-center md:text-right">
          <p className="text-xs font-bold text-black/60">© {new Date().getFullYear()} Libellius. Všetky práva vyhradené.</p>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-1">Generované pomocou umelej inteligencie</p>
        </div>
      </div>
    </div>
  );
};

export default SatisfactionDashboard;
