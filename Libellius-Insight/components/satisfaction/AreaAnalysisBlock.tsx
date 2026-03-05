import React, { useState, useEffect } from 'react';
import { exportBlockToPDF, exportDataToExcel } from '../../utils/exportUtils';
import TeamSelectorGrid from './TeamSelectorGrid';
import ComparisonMatrix from './ComparisonMatrix';
import { MapPin, Download, ChevronDown, Star, Target, BarChart as BarChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface Props {
  area: any;
  masterTeams: string[];
  scaleMax: number;
  isDarkMode: boolean; // <-- Pridaný prop
}

// Upravený Tooltip pre Dark Mode
const CustomBarTooltip = ({ active, payload, label, isDarkMode }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={`${isDarkMode ? 'bg-zinc-800 border-white/10' : 'bg-black border-transparent'} text-white p-4 sm:p-5 rounded-2xl shadow-2xl max-w-sm border z-50 transition-colors`}>
        <p className="font-bold text-sm mb-3 leading-snug">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand shadow-[0_0_8px_rgba(184,21,71,0.5)]"></div>
          <p className="font-black text-base sm:text-lg text-white">Skóre: {payload[0].value.toFixed(2)}</p>
        </div>
      </div>
    );
  }
  return null;
};

// Upravený YAxisTick pre Dark Mode
const CustomYAxisTick = ({ x, y, payload, isDarkMode }: any) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const maxLength = isMobile ? 40 : 80; 

  const words = payload.value.split(' ');
  const lines = [];
  let currentLine = '';

  words.forEach((word: string) => {
    if ((currentLine + word).length > maxLength) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  });
  if (currentLine) lines.push(currentLine.trim());

  const lineHeight = isMobile ? 16 : 18;
  const startY = y - ((lines.length - 1) * lineHeight) / 2;

  return (
    <g transform={`translate(${x},${startY})`}>
      {lines.map((line: string, index: number) => (
        <text 
          key={index} x={0} y={index * lineHeight} dy="0.35em" textAnchor="end" 
          fill={isDarkMode ? 'rgba(255,255,255,0.7)' : '#000000'} // Dynamická farba
          fontSize={isMobile ? 11 : 14} 
          fontWeight={800}
        >
          {line}
        </text>
      ))}
    </g>
  );
};

const AreaAnalysisBlock: React.FC<Props> = ({ area, masterTeams, scaleMax, isDarkMode }) => {
  const [viewMode, setViewMode] = useState<'DETAIL' | 'COMPARISON'>('DETAIL');
  const [teamValue, setTeamValue] = useState<string>('');
  const [comparisonSelection, setComparisonSelection] = useState<string[]>([]);
  const [comparisonFilter, setComparisonFilter] = useState<'ALL' | 'PRIEREZOVA' | 'SPECIFICKA'>('ALL');
  const [activeExportMenu, setActiveExportMenu] = useState<boolean>(false);

  // Farby pre graf
  const gridColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const labelColor = isDarkMode ? '#ffffff' : '#000000';
  const cardClass = "bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-2xl transition-all duration-300";

  useEffect(() => {
    if (masterTeams.length > 0 && !teamValue) {
      setTeamValue(masterTeams.find(t => t.toLowerCase().includes('priemer')) || masterTeams[0]);
    }
  }, [masterTeams, teamValue]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.export-dropdown-container')) {
        setActiveExportMenu(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const getActiveData = (teamName: string) => {
    if (!area) return [];
    const team = area.teams?.find((t: any) => t.teamName === teamName) || area.teams?.[0];
    return team && Array.isArray(team.metrics) ? [...team.metrics].sort((a, b) => b.score - a.score) : [];
  };

  const getComparisonData = (selectedNames: string[]) => {
    const cardTeams = Array.isArray(area?.teams) ? area.teams : [];
    if (!cardTeams.length) return [];
    const categories = Array.from(new Set(cardTeams.flatMap((t: any) => (Array.isArray(t.metrics) ? t.metrics.map((m: any) => m.category) : []))));
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

  const handlePdfExport = () => exportBlockToPDF(`block-area-${area.id}`, `Oblast_${area.title}`, () => setActiveExportMenu(false));
  const handleExcelExport = () => {
    let dataToExport: any[] = [];
    let fileName = '';
    if (viewMode === 'DETAIL') {
      const activeMetrics = getActiveData(teamValue);
      dataToExport = activeMetrics.map((m: any) => ({ 'Otázka / Kategória': m.category, 'Skóre (max 6)': Number(m.score.toFixed(2)), 'Typ otázky': m.questionType }));
      fileName = `Oblast_${area.title}_${teamValue}_Detail.xlsx`.replace(/\s+/g, '_');
    } else {
      const comparisonData = getComparisonData(comparisonSelection);
      dataToExport = comparisonData.map((row: any) => {
          const rowData: any = { 'Kategória': row.category, 'Typ otázky': row.questionType };
          comparisonSelection.forEach(team => { rowData[team] = row[team] !== undefined ? Number(row[team].toFixed(2)) : null; });
          return rowData;
      });
      fileName = `Oblast_${area.title}_Porovnanie.xlsx`.replace(/\s+/g, '_');
    }
    exportDataToExcel(dataToExport, fileName, () => setActiveExportMenu(false));
  };

  const activeMetrics = getActiveData(teamValue);
  const top = activeMetrics.slice(0, 3);
  const bottom = [...activeMetrics].filter((m: any) => m.score > 0 && m.score < 4.0).sort((a, b) => a.score - b.score).slice(0, 3);

  return (
    <div id={`block-area-${area.id}`} className="space-y-8 sm:space-y-10 animate-fade-in">
      {/* KONFIGURÁCIA */}
      <div className={`${cardClass} p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem]`}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 sm:gap-8">
          <div className="space-y-4 sm:space-y-6 w-full lg:w-auto min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/5 dark:bg-brand/10 rounded-full text-[10px] font-black uppercase text-brand tracking-[0.2em] print:hidden">
              <MapPin className="w-3 h-3" /> Konfigurácia reportu
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none dark:text-white text-black">
                {area.title}
              </h2>
              
              <div className="relative export-dropdown-container export-buttons print:hidden">
                <button
                  onClick={() => setActiveExportMenu(!activeExportMenu)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                >
                  <Download className="w-3 h-3" /> Export
                  <ChevronDown className={`w-3 h-3 transition-transform ${activeExportMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {activeExportMenu && (
                  <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-black/5 dark:border-white/10 p-2 z-50 flex flex-col gap-1 min-w-[140px] animate-fade-in">
                     <button onClick={handlePdfExport} className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 dark:hover:bg-white/5 dark:text-white text-black transition-colors">PDF Dokument</button>
                     <button onClick={handleExcelExport} className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-brand/10 text-brand transition-colors">Excel Dáta</button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl w-full sm:w-fit border border-black/5 dark:border-white/10 overflow-x-auto no-scrollbar print:hidden">
              <button onClick={() => setViewMode('DETAIL')} className={`shrink-0 px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'DETAIL' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-lg' : 'text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white'}`}>Detail tímu</button>
              <button onClick={() => setViewMode('COMPARISON')} className={`shrink-0 px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'COMPARISON' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-lg' : 'text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white'}`}>Porovnanie</button>
            </div>
          </div>

          {viewMode === 'DETAIL' && (
            <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto print:hidden">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/20 dark:text-white/20 lg:mr-4">VYBRANÝ TÍM / STREDISKO:</span>
              <div className="relative w-full lg:w-auto lg:min-w-[340px]">
                <select
                  value={teamValue} onChange={(e) => setTeamValue(e.target.value)}
                  className="w-full p-4 sm:p-5 lg:p-7 pr-12 sm:pr-14 bg-black dark:bg-zinc-800 text-white dark:text-white rounded-[1rem] sm:rounded-[1.25rem] lg:rounded-[1.5rem] font-black text-base sm:text-lg lg:text-xl outline-none shadow-2xl cursor-pointer hover:bg-brand transition-all appearance-none tracking-tight border border-transparent dark:border-white/5"
                >
                  {masterTeams.map((t: string) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-white/40 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {viewMode === 'COMPARISON' && (
          <div className="mt-8 border-t border-black/5 dark:border-white/10 pt-8 space-y-6">
            <TeamSelectorGrid
              availableTeams={masterTeams}
              selectedTeams={comparisonSelection}
              onToggleTeam={(t) => setComparisonSelection(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
              onClear={() => setComparisonSelection([])}
              isDarkMode={isDarkMode} // <-- Poslané do subkomponentu
            />

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 bg-black/5 dark:bg-white/5 p-2 rounded-2xl w-full md:w-fit print:hidden">
              <button onClick={() => setComparisonFilter('ALL')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${comparisonFilter === 'ALL' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-md' : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'}`}>Všetky tvrdenia</button>
              <button onClick={() => setComparisonFilter('PRIEREZOVA')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${comparisonFilter === 'PRIEREZOVA' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-md' : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'}`}><div className={`w-2 h-2 rounded-full ${comparisonFilter === 'PRIEREZOVA' ? 'bg-brand' : 'bg-transparent border border-black/20 dark:border-white/20'}`}></div>Prierezové</button>
              <button onClick={() => setComparisonFilter('SPECIFICKA')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${comparisonFilter === 'SPECIFICKA' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-md' : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'}`}><div className={`w-2 h-2 rounded-full ${comparisonFilter === 'SPECIFICKA' ? 'bg-brand' : 'bg-transparent border border-black/20 dark:border-white/20'}`}></div>Špecifické</button>
            </div>
          </div>
        )}
      </div>

      {viewMode === 'DETAIL' ? (
        <div className="space-y-8 sm:space-y-10">
          <div className={`${cardClass} p-6 sm:p-8 md:p-10 lg:p-14 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] flex flex-col`}>
            <div className="mb-6 sm:mb-8 flex items-start gap-4">
              <div className="bg-brand/5 dark:bg-brand/10 p-3 rounded-2xl flex-shrink-0">
                <BarChartIcon className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
              </div>
              <div className="min-w-0 text-black dark:text-white">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-black uppercase tracking-tight text-black dark:text-white">Hodnotenie jednotlivých tvrdení</h3>
                <p className="text-xs sm:text-sm font-bold text-black/40 dark:text-white/40 mt-1 break-words">Stredisko: <span className="text-brand">{teamValue}</span></p>
              </div>
            </div>

            <div className="w-full">
              <div className="h-[450px] sm:h-[500px] lg:h-[550px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeMetrics} layout="vertical" margin={{ left: 10, right: 50, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                    <XAxis type="number" domain={[0, scaleMax]} hide />
                    <YAxis dataKey="category" type="category" width={isMobileWidth() ? 120 : 250} interval={0} tick={<CustomYAxisTick isDarkMode={isDarkMode} />} />
                    <Tooltip cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }} content={<CustomBarTooltip isDarkMode={isDarkMode} />} />
                    <Bar dataKey="score" radius={[0, 12, 12, 0]} barSize={isMobileWidth() ? 16 : 24}>
                      {activeMetrics.map((entry: any, index: number) => (
                        <Cell key={index} fill={entry.score <= 4.0 ? (isDarkMode ? '#3f3f46' : '#27272a') : '#B81547'} />
                      ))}
                      <LabelList dataKey="score" position="right" style={{ fontWeight: 900, fontSize: isMobileWidth() ? '11px' : '13px', fill: labelColor }} offset={10} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-10">
            {/* SILNÉ STRÁNKY */}
            <div className={`${cardClass} p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem]`}>
              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10 text-brand">
                <Star className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" />
                <h4 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-black dark:text-white">Silné stránky</h4>
              </div>
              <div className="space-y-3 sm:space-y-4">
                {top.map((m: any, i: number) => (
                  <div key={i} className="p-4 sm:p-5 lg:p-7 rounded-2xl sm:rounded-3xl flex justify-between items-center gap-3 bg-brand text-white shadow-lg group relative cursor-help hover:scale-[1.02] transition-transform">
                    <span className="font-bold text-xs pr-2 sm:pr-4 leading-snug tracking-wide line-clamp-2 uppercase" title={m.category}>{m.category}</span>
                    <span className="text-2xl sm:text-3xl lg:text-4xl font-black shrink-0">{m.score.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PRÍLEŽITOSTI */}
            <div className={`${cardClass} p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem]`}>
              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10 text-black dark:text-white">
                <Target className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" />
                <h4 className="text-xl sm:text-2xl font-black uppercase tracking-tighter">Príležitosti</h4>
              </div>
              <div className="space-y-3 sm:space-y-4">
                {bottom.length > 0 ? bottom.map((m: any, i: number) => (
                  <div key={i} className="p-4 sm:p-5 lg:p-7 rounded-2xl sm:rounded-3xl flex justify-between items-center gap-3 bg-zinc-900 dark:bg-zinc-800 text-white shadow-lg group relative cursor-help hover:scale-[1.02] transition-transform">
                    <span className="font-bold text-xs pr-2 sm:pr-4 leading-snug tracking-wide line-clamp-2 uppercase" title={m.category}>{m.category}</span>
                    <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-brand shrink-0">{m.score.toFixed(2)}</span>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-10 opacity-20 dark:opacity-10">
                    <p className="font-black uppercase tracking-widest text-[10px] text-black dark:text-white">Žiadne kritické body</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ComparisonMatrix teams={comparisonSelection} matrixData={getComparisonData(comparisonSelection)} isDarkMode={isDarkMode} />
      )}
    </div>
  );
};

// Pomocná funkcia pre detekciu šírky (využitá v grafe)
const isMobileWidth = () => typeof window !== 'undefined' && window.innerWidth < 768;

export default AreaAnalysisBlock;
