import React, { useState, useMemo, useEffect, useRef } from 'react';
import { exportBlockToPDF, exportDataToExcel } from '../../utils/exportUtils';
import { Search, Filter, ArrowUpDown, Download, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Sector, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: any;
  masterTeams: string[];
  isDarkMode: boolean; // <-- Pridané do Props
}

type SortKey = 'count' | 'name';
type SortDirection = 'asc' | 'desc' | null;
type EngagementVisualMode = 'CARDS' | 'PIE';

const PIE_COLORS = [
  '#4A081C', '#630B26', '#7D0E30', '#97113A', '#B81547', 
  '#C22C5A', '#CB446D', '#D55B80', '#DE7393', '#E88AA6', 
  '#EFA1B8', '#F5B9CB', '#F9D0DD', '#FCE8EE', '#FFF2F5', 
];

const EngagementBlock: React.FC<Props> = ({ data, masterTeams, isDarkMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [engagementVisualMode, setEngagementVisualMode] = useState<EngagementVisualMode>('CARDS');
  const [hoveredPie, setHoveredPie] = useState<number | null>(null);
  const [showTeamFilter, setShowTeamFilter] = useState(false);
  const [selectedEngagementTeams, setSelectedEngagementTeams] = useState<string[]>([]);
  const [expandedEngagementCard, setExpandedEngagementCard] = useState<string | null>(null);
  const [activeExportMenu, setActiveExportMenu] = useState<string | null>(null);

  const engagementCardsRef = useRef<HTMLDivElement | null>(null);
  const [canScrollEngagementLeft, setCanScrollEngagementLeft] = useState(false);
  const [canScrollEngagementRight, setCanScrollEngagementRight] = useState(false);

  const safeTotalReceived = Number(data.totalReceived) > 0 ? Number(data.totalReceived) : 1;
  const safeTotalSent = Number(data.totalSent) > 0 ? Number(data.totalSent) : 1;

  // Dynamické farby pre Recharts a UI
  const chartTextColor = isDarkMode ? '#e4e4e7' : '#3f3f46';
  const gridBorderColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const cardBgClass = "bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-2xl transition-colors duration-300";

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.export-dropdown-container')) {
        setActiveExportMenu(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : sortDirection === 'asc' ? null : 'desc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
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
      teams.sort((a: any, b: any) => {
        const valA = sortKey === 'count' ? a.count : a.name.toLowerCase();
        const valB = sortKey === 'count' ? b.count : b.name.toLowerCase();
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return teams;
  }, [data.teamEngagement, searchTerm, selectedEngagementTeams, sortKey, sortDirection]);

  const handlePdfExport = (blockId: string, fileName: string) => {
    exportBlockToPDF(blockId, fileName, () => setActiveExportMenu(null));
  };

  const handleExcelExport = () => {
    const dataToExport = filteredEngagement.map((t: any) => ({
      'Tím / Stredisko': t.name,
      'Počet zapojených': t.count,
      'Podiel na celkovom vyplnení (%)': Number(((t.count / safeTotalReceived) * 100).toFixed(1))
    }));
    exportDataToExcel(dataToExport, 'Zapojenie_Timov.xlsx', () => setActiveExportMenu(null));
  };

  const engagementChartData = useMemo(() => {
    const baseTeams = (data.teamEngagement || []).filter((t: any) => t.name && !['total', 'celkom'].includes(t.name.toLowerCase()));
    const isFiltering = selectedEngagementTeams.length > 0 || searchTerm !== '';

    const mappedTeams = baseTeams.map((team: any) => {
      const count = Number(team.count) || 0;
      const percentage = safeTotalReceived > 0 ? Number(((count / safeTotalReceived) * 100).toFixed(1)) : 0;
      const isActive = isFiltering ? filteredEngagement.some((ft: any) => ft.name === team.name) : true;
      return { ...team, count, percentage, isActive };
    });

    const sortedTeams = mappedTeams.sort((a: any, b: any) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return b.count - a.count;
    });

    let activeIndex = 0;
    return sortedTeams.map((team: any) => ({
      ...team,
      color: team.isActive ? PIE_COLORS[activeIndex++ % PIE_COLORS.length] : (isDarkMode ? '#27272a' : '#f4f4f5')
    }));
  }, [data.teamEngagement, filteredEngagement, safeTotalReceived, selectedEngagementTeams.length, searchTerm, isDarkMode]);

  const engagementTeamCards = useMemo(() => {
    return engagementChartData
      .filter((team: any) => team.isActive)
      .sort((a: any, b: any) => b.count - a.count)
      .map((team: any) => {
        const responded = Number(team.count) || 0;
        const sentRaw = team.totalSent ?? team.sent ?? team.invited ?? team.osloveni ?? team.total;
        const teamSent = typeof sentRaw === 'number' && sentRaw > 0 ? sentRaw : (responded > 0 && safeTotalReceived > 0) ? Math.round((responded / safeTotalReceived) * safeTotalSent) : 0;
        const responseRateTeam = teamSent > 0 ? Number(((responded / teamSent) * 100).toFixed(1)) : 0;
        const shareOfAllResponded = safeTotalReceived > 0 ? Number(((responded / safeTotalReceived) * 100).toFixed(1)) : 0;
        const shareOfAllSent = safeTotalSent > 0 ? Number(((teamSent / safeTotalSent) * 100).toFixed(1)) : 0;

        return { ...team, responded, teamSent, responseRateTeam, shareOfAllResponded, shareOfAllSent };
      });
  }, [engagementChartData, safeTotalReceived, safeTotalSent]);

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
    el.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' });
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

  return (
    <div className="space-y-8 sm:space-y-10 animate-fade-in">
      {/* Celkové metriky */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-black dark:bg-zinc-900 text-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02]">
          <span className="block text-[9px] sm:text-[10px] font-black uppercase opacity-50 mb-2 sm:mb-3 tracking-[0.2em]">CELKOVÝ POČET OSLOVENÝCH</span>
          <span className="text-5xl sm:text-6xl xl:text-7xl font-black tracking-tighter leading-none">{data.totalSent || 0}</span>
        </div>
        <div className="bg-brand text-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02]">
          <span className="block text-[9px] sm:text-[10px] font-black uppercase opacity-60 mb-2 sm:mb-3 tracking-[0.2em]">POČET ZAPOJENÝCH OSOB</span>
          <span className="text-5xl sm:text-6xl xl:text-7xl font-black tracking-tighter leading-none">{data.totalReceived || 0}</span>
        </div>
        <div className={`${cardBgClass} p-6 sm:p-8 lg:p-10 transition-transform hover:scale-[1.02]`}>
          <span className="block text-[9px] sm:text-[10px] font-black uppercase text-black/40 dark:text-white/30 mb-2 sm:mb-3 tracking-[0.2em]">CELKOVÁ NÁVRATNOSŤ</span>
          <div className="flex items-baseline gap-1">
            <span className="text-5xl sm:text-6xl xl:text-7xl font-black text-black dark:text-white tracking-tighter leading-none">
              {String(data.successRate || '0').replace('%', '')}
            </span>
            <span className="text-2xl sm:text-3xl xl:text-4xl font-black text-black/10 dark:text-white/10 tracking-tighter">%</span>
          </div>
        </div>
      </div>

      {/* Tabuľka a filtre */}
      <div id="block-engagement" className={`${cardBgClass} p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem]`}>
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 sm:mb-8 lg:mb-10 gap-4 sm:gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter leading-none dark:text-white text-black">Prehľad zapojenia v tímoch</h3>
            
            <div className="relative export-dropdown-container export-buttons print:hidden">
              <button
                onClick={() => setActiveExportMenu(activeExportMenu === 'engagement' ? null : 'engagement')}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
              >
                <Download className="w-3 h-3" /> Export
                <ChevronDown className={`w-3 h-3 transition-transform ${activeExportMenu === 'engagement' ? 'rotate-180' : ''}`} />
              </button>
              
              {activeExportMenu === 'engagement' && (
                <div className="absolute top-full left-0 mt-2 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-black/5 dark:border-white/10 p-2 z-50 flex flex-col gap-1 min-w-[120px] animate-fade-in">
                  <button
                    onClick={() => handlePdfExport('block-engagement', 'Zapojenie_Timov')}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 dark:hover:bg-white/5 dark:text-white text-black transition-colors"
                  >
                    PDF Dokument
                  </button>
                  <button
                    onClick={handleExcelExport}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-brand/10 text-brand transition-colors"
                  >
                    Excel Dáta
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto print:hidden">
            <div className="relative w-full sm:flex-1 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/20 dark:text-white/20" />
              <input
                type="text"
                placeholder="Hľadať..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 sm:py-4 bg-black/5 dark:bg-white/5 dark:text-white rounded-2xl font-bold text-xs outline-none focus:bg-black/10 dark:focus:bg-white/10 transition-all placeholder:text-black/20 dark:placeholder:text-white/20"
              />
            </div>

            <button
              onClick={() => setShowTeamFilter(!showTeamFilter)}
              className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl font-bold text-xs transition-all border border-black/5 dark:border-white/5 whitespace-nowrap ${showTeamFilter || selectedEngagementTeams.length > 0 ? 'bg-brand text-white shadow-lg' : 'bg-white dark:bg-zinc-800 hover:bg-black/5 dark:hover:bg-white/5 text-black dark:text-white'}`}
            >
              <Filter className="w-4 h-4" />
              Výber ({selectedEngagementTeams.length > 0 ? selectedEngagementTeams.length : 'Všetky'})
            </button>
          </div>
        </div>

        {showTeamFilter && (
          <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-black/5 dark:bg-white/5 rounded-2xl sm:rounded-3xl border border-black/5 dark:border-white/10 animate-fade-in print:hidden">
            <div className="flex flex-wrap gap-2">
              {masterTeams.map((team: string) => (
                <button
                  key={team}
                  onClick={() => setSelectedEngagementTeams(prev => prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team])}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedEngagementTeams.includes(team) ? 'bg-black dark:bg-white text-white dark:text-black shadow-md' : 'bg-white dark:bg-zinc-800 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10'}`}
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

        <div className="overflow-x-auto rounded-2xl sm:rounded-3xl border border-black/5 dark:border-white/10">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-[#fcfcfc] dark:bg-zinc-800/50 text-sm font-black uppercase tracking-widest text-black/60 dark:text-white/40 border-b border-black/5 dark:border-white/10">
              <tr>
                <th className="p-4 sm:p-6 cursor-pointer hover:text-black dark:hover:text-white transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-2">Tím <ArrowUpDown className="w-3 h-3 print:hidden" /></div>
                </th>
                <th className="p-4 sm:p-6 text-center cursor-pointer hover:text-black dark:hover:text-white transition-colors" onClick={() => handleSort('count')}>
                  <div className="flex items-center justify-center gap-2">Počet <ArrowUpDown className="w-3 h-3 print:hidden" /></div>
                </th>
                <th className="p-4 sm:p-6 text-center">% podiel na celkovom vyplnení</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5 font-black text-sm dark:text-zinc-300">
              {filteredEngagement.length > 0 ? filteredEngagement.map((team: any, idx: number) => (
                <tr key={idx} className={`hover:bg-brand/5 dark:hover:bg-brand/10 transition-colors group ${team.name.toLowerCase().includes('priemer') ? 'bg-brand/5 dark:bg-brand/10 text-brand' : ''}`}>
                  <td className="p-4 sm:p-7 group-hover:text-brand transition-colors">{team.name}</td>
                  <td className="p-4 sm:p-7 text-center">{team.count}</td>
                  <td className="p-4 sm:p-7">
                    <div className="flex items-center justify-center gap-4 sm:gap-5">
                      <div className="w-28 sm:w-40 bg-black/5 dark:bg-white/5 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand shadow-[0_0_10px_rgba(184,21,71,0.3)]"
                          style={{ width: `${(team.count / safeTotalReceived) * 100}%` }}
                        />
                      </div>
                      <span className="text-brand font-black text-sm min-w-[80px]">{((team.count / safeTotalReceived) * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="p-8 sm:p-10 text-center text-black/30 dark:text-white/20 font-black uppercase tracking-widest text-xs">
                    Žiadne tímy nezodpovedajú filtru
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Karty a Graf */}
      {filteredEngagement.length > 0 && (
        <div className={`${cardBgClass} p-6 sm:p-8 md:p-10 lg:p-12 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] animate-fade-in print:hidden`}>
          <div className="flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 sm:gap-6">
              <div>
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none dark:text-white text-black">
                  Podrobný prehľad tímov
                </h3>
                <p className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-black/30 dark:text-white/30 mt-2">
                  {selectedEngagementTeams.length > 0 ? 'Podiel vo vybraných strediskách' : 'Výsledky a odporúčania'}
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-3">
                  <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl w-full lg:w-fit border border-black/5 dark:border-white/10">
                    <button
                      onClick={() => setEngagementVisualMode('CARDS')}
                      className={`flex-1 lg:flex-none px-4 sm:px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all text-center ${
                        engagementVisualMode === 'CARDS' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-md' : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      Karty
                    </button>
                    <button
                      onClick={() => setEngagementVisualMode('PIE')}
                      className={`flex-1 lg:flex-none px-4 sm:px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all text-center ${
                        engagementVisualMode === 'PIE' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-md' : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      Koláč
                    </button>
                  </div>

                  {engagementVisualMode === 'CARDS' && engagementTeamCards.length > 2 && (
                    <div className="hidden sm:flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => scrollEngagementCards('left')}
                        disabled={!canScrollEngagementLeft}
                        className={`w-10 h-10 flex items-center justify-center rounded-full border shadow-sm transition-all ${
                          canScrollEngagementLeft ? 'bg-white dark:bg-zinc-800 border-black/10 dark:border-white/10 text-black dark:text-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black' : 'bg-white/70 dark:bg-zinc-800/70 border-black/5 dark:border-white/5 text-black/20 dark:text-white/20 cursor-not-allowed'
                        }`}
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => scrollEngagementCards('right')}
                        disabled={!canScrollEngagementRight}
                        className={`w-10 h-10 flex items-center justify-center rounded-full border shadow-sm transition-all ${
                          canScrollEngagementRight ? 'bg-white dark:bg-zinc-800 border-black/10 dark:border-white/10 text-black dark:text-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black' : 'bg-white/70 dark:bg-zinc-800/70 border-black/5 dark:border-white/5 text-black/20 dark:text-white/20 cursor-not-allowed'
                        }`}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {engagementVisualMode === 'CARDS' ? (
              <div className="relative">
                {engagementTeamCards.length > 2 && (
                  <>
                    <div className={`hidden sm:block absolute left-0 top-0 bottom-8 w-10 bg-gradient-to-r ${isDarkMode ? 'from-zinc-900 to-transparent' : 'from-white to-transparent'} z-10 pointer-events-none transition-opacity ${canScrollEngagementLeft ? 'opacity-100' : 'opacity-0'}`} />
                    <div className={`hidden sm:block absolute right-0 top-0 bottom-8 w-10 bg-gradient-to-l ${isDarkMode ? 'from-zinc-900 to-transparent' : 'from-white to-transparent'} z-10 pointer-events-none transition-opacity ${canScrollEngagementRight ? 'opacity-100' : 'opacity-0'}`} />
                  </>
                )}

                <div ref={engagementCardsRef} className="flex items-start gap-4 sm:gap-5 overflow-x-auto pb-2 pr-1 snap-x snap-mandatory no-scrollbar">
                  {engagementTeamCards.map((team: any, idx: number) => {
                    const cardId = `${team.name}-${idx}`;
                    const isExpanded = expandedEngagementCard === cardId;

                    return (
                      <div key={cardId} className={`snap-start self-start shrink-0 w-full sm:w-[calc(50%-10px)] sm:min-w-[320px] min-h-[380px] lg:min-h-[430px] rounded-2xl sm:rounded-3xl border p-4 sm:p-5 lg:p-6 print:w-full print:break-inside-avoid ${idx === 0 ? 'bg-brand/5 dark:bg-brand/10 border-brand/20' : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5'}`}>
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                            <h4 className="font-black text-base sm:text-lg lg:text-xl text-black dark:text-white truncate">{team.name}</h4>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-black/35 dark:text-white/35 leading-none">Tím</p>
                            <p className="text-lg sm:text-xl lg:text-2xl font-black text-black dark:text-white leading-none mt-1">#{idx + 1}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/5 dark:border-white/5 p-3 sm:p-4 shadow-sm">
                            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-black/35 dark:text-white/35">Počet oslovených</p>
                            <p className="text-lg sm:text-xl lg:text-2xl font-black leading-none mt-1.5 dark:text-white">{team.teamSent}</p>
                          </div>
                          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/5 dark:border-white/5 p-3 sm:p-4 shadow-sm">
                            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-black/35 dark:text-white/35">Počet odpovedí</p>
                            <p className="text-lg sm:text-xl lg:text-2xl font-black leading-none mt-1.5 dark:text-white">{team.responded}</p>
                          </div>
                          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/5 dark:border-white/5 p-3 sm:p-4 shadow-sm">
                            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-black/35 dark:text-white/35">Návratnosť v %</p>
                            <p className="text-lg sm:text-xl lg:text-2xl font-black leading-none mt-1.5 dark:text-white">{team.responseRateTeam}%</p>
                          </div>
                          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/5 dark:border-white/5 p-3 sm:p-4 shadow-sm">
                            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-black/35 dark:text-white/35">% podiel</p>
                            <p className="text-lg sm:text-xl lg:text-2xl font-black leading-none mt-1.5 text-brand">{team.shareOfAllResponded}%</p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="w-full h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${team.shareOfAllResponded}%`, backgroundColor: team.color }} />
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                          <button type="button" onClick={() => setExpandedEngagementCard(isExpanded ? null : cardId)} className="w-full flex items-center justify-between rounded-xl px-2 py-2.5 hover:bg-white/70 dark:hover:bg-zinc-800 transition-colors group/btn">
                            <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-black/50 dark:text-white/50 group-hover/btn:text-brand transition-colors">
                              {isExpanded ? 'Skryť' : 'Interpretácia dát'}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-black/40 dark:text-white/40 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-brand' : ''}`} />
                          </button>

                          {isExpanded && (
                            <div className="mt-3 animate-fade-in">
                              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/5 dark:border-white/5 p-4 sm:p-5 shadow-inner">
                                <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-black/35 dark:text-white/35 mb-2 text-brand">AI Pohľad</p>
                                <p className="text-base sm:text-[16px] lg:text-[17px] font-medium leading-relaxed text-black/80 dark:text-zinc-300">
                                  {team.aiSummary || `Návratnosť pre tím ${team.name} je na úrovni ${team.responseRateTeam}%. Bližšia interpretácia zatiaľ nebola doplnená.`}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {engagementTeamCards.length > 1 && (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-black/25 dark:text-white/20 leading-tight max-w-[60%] sm:max-w-none">
                      Potiahnite do strán pre ďalšie tímy
                    </p>
                    {engagementTeamCards.length > 2 && (
                      <div className="flex sm:hidden items-center gap-2">
                        <button type="button" onClick={() => scrollEngagementCards('left')} disabled={!canScrollEngagementLeft} className={`w-9 h-9 flex items-center justify-center rounded-full border transition-all ${canScrollEngagementLeft ? 'bg-white dark:bg-zinc-800 border-black/10 dark:border-white/10 text-black dark:text-white' : 'bg-white/70 dark:bg-zinc-800/70 border-black/5 dark:border-white/5 text-black/20 dark:text-white/20'}`}>
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => scrollEngagementCards('right')} disabled={!canScrollEngagementRight} className={`w-9 h-9 flex items-center justify-center rounded-full border transition-all ${canScrollEngagementRight ? 'bg-white dark:bg-zinc-800 border-black/10 dark:border-white/10 text-black dark:text-white' : 'bg-white/70 dark:bg-zinc-800/70 border-black/5 dark:border-white/5 text-black/20 dark:text-white/20'}`}>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8 items-start xl:items-center">
                <div className="xl:col-span-7 h-[280px] sm:h-[400px] lg:h-[500px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={engagementChartData}
                        cx="50%" cy="50%" outerRadius="75%" dataKey="count" nameKey="name" stroke={isDarkMode ? '#18181b' : '#ffffff'} strokeWidth={2}
                        onMouseEnter={(_, index) => setHoveredPie(index)}
                        onMouseLeave={() => setHoveredPie(null)}
                        shape={(props: any) => {
                          const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, index } = props;
                          const isHovered = hoveredPie === index;
                          const isFiltering = typeof selectedEngagementTeams !== 'undefined' && selectedEngagementTeams.length > 0;
                          const isSelected = isFiltering && payload.isActive;
                          
                          let radiusOffset = 0;
                          if (isSelected) radiusOffset += 12; 
                          if (isHovered) radiusOffset += 8;  
                          
                          return (
                            <Sector
                              cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + radiusOffset}
                              startAngle={startAngle} endAngle={endAngle} fill={fill} stroke={isDarkMode ? '#18181b' : '#ffffff'} strokeWidth={2}
                              style={{ transition: 'all 0.25s ease-out' }} 
                            />
                          );
                        }}
                      >
                        {engagementChartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => {
                          const count = Number(value);
                          const percentage = safeTotalReceived > 0 ? ((count / safeTotalReceived) * 100).toFixed(1) : '0.0';
                          return [`${count} osôb (${percentage}%)`, name];
                        }}
                        contentStyle={{ 
                          borderRadius: '1rem', 
                          border: 'none', 
                          backgroundColor: isDarkMode ? '#18181b' : '#fff',
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', 
                          fontWeight: 700 
                        }}
                        itemStyle={{ fontWeight: 900, color: isDarkMode ? '#fff' : '#000' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="xl:col-span-5 w-full">
                  <div className="bg-black/5 dark:bg-white/5 rounded-2xl sm:rounded-3xl border border-black/5 dark:border-white/10 p-4 md:p-5">
                    <h4 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-black/40 dark:text-white/40 mb-4">
                      Rozdelenie podľa tímov
                    </h4>
                    <div className="space-y-3 max-h-[340px] overflow-auto pr-1 custom-scrollbar">
                      {engagementChartData.slice().sort((a: any, b: any) => {
                        if (a.isActive && !b.isActive) return -1;
                        if (!a.isActive && b.isActive) return 1;
                        return b.count - a.count;
                      }).map((team: any, idx: number) => (
                        <div key={`${team.name}-${idx}`} className={`rounded-2xl border p-3 sm:p-4 transition-all ${team.isActive ? (idx === 0 ? 'bg-brand/5 dark:bg-brand/20 border-brand/20' : 'bg-white dark:bg-zinc-900 border-black/5 dark:border-white/5') : 'bg-black/5 dark:bg-white/5 border-transparent opacity-50 grayscale'}`}>
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                              <span className="font-black text-xs sm:text-sm text-black dark:text-white truncate">{team.name}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs sm:text-sm font-black leading-none dark:text-white">{team.count}</p>
                              <p className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest mt-1 ${team.isActive ? 'text-brand' : 'text-black/40 dark:text-white/30'}`}>{team.percentage}%</p>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${team.percentage}%`, backgroundColor: team.color }} />
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
  );
};

export default EngagementBlock;
