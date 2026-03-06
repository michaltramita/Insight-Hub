import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { exportBlockToPDF, exportDataToExcel } from '../../utils/exportUtils';
import TeamSelectorGrid from './TeamSelectorGrid';
import ComparisonMatrix from './ComparisonMatrix';
import { MapPin, Download, ChevronDown, Star, Target, BarChart as BarChartIcon, Maximize2, Minimize2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface Props {
  area: any;
  masterTeams: string[];
  scaleMax: number;
}

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

const CustomYAxisTick = ({ x, y, payload, isFullScreen }: any) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const maxLength = isMobile ? 40 : (isFullScreen ? 100 : 80); 

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
  if (currentLine) {
    lines.push(currentLine.trim());
  }

  const lineHeight = isMobile ? 16 : (isFullScreen ? 22 : 18);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  const fontSize = isMobile ? 13 : (isFullScreen ? 16 : 14); // Jemne som zmenšil max font pre istotu v PDF

  return (
    <g transform={`translate(${x},${startY})`}>
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
  const [activeExportMenu, setActiveExportMenu] = useState<boolean>(false);
  
  // Stav pre Fullscreen
  const [isFullScreen, setIsFullScreen] = useState(false);

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

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullScreen(false);
    };
    window.addEventListener('keydown', handleEsc);

    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isFullScreen]);

  const getActiveData = (teamName: string) => {
    if (!area) return [];
    const team = area.teams?.find((t: any) => t.teamName === teamName) || area.teams?.[0];
    return team && Array.isArray(team.metrics) ? [...team.metrics].sort((a, b) => b.score - a.score) : [];
  };

  const getComparisonData = (selectedNames: string[]) => {
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

  const handlePdfExport = () => {
    const targetId = isFullScreen ? `fullscreen-block-${area.id}` : `block-area-${area.id}`;
    const fileName = `Oblast_${area.title}${isFullScreen ? '_Fullscreen' : ''}`;
    
    // Pred exportom chvíľu počkáme, nech sa Recharts poriadne usadia, ak by sa niečo dialo s layoutom
    setTimeout(() => {
        exportBlockToPDF(targetId, fileName, () => setActiveExportMenu(false));
    }, 100);
  };

  const handleExcelExport = () => {
    let dataToExport: any[] = [];
    let fileName = '';

    if (viewMode === 'DETAIL') {
      const activeMetrics = getActiveData(teamValue);
      dataToExport = activeMetrics.map((m: any) => ({
        'Otázka / Kategória': m.category,
        'Skóre (max 6)': Number(m.score.toFixed(2)),
        'Typ otázky': m.questionType
      }));
      fileName = `Oblast_${area.title}_${teamValue}_Detail.xlsx`.replace(/\s+/g, '_');
    } else {
      const comparisonData = getComparisonData(comparisonSelection);
      dataToExport = comparisonData.map((row: any) => {
          const rowData: any = { 'Kategória': row.category, 'Typ otázky': row.questionType };
          comparisonSelection.forEach(team => {
              rowData[team] = row[team] !== undefined ? Number(row[team].toFixed(2)) : null;
          });
          return rowData;
      });
      fileName = `Oblast_${area.title}_Porovnanie.xlsx`.replace(/\s+/g, '_');
    }
    exportDataToExcel(dataToExport, fileName, () => setActiveExportMenu(false));
  };

  if (!area) return null;

  const activeMetrics = getActiveData(teamValue);
  const top = activeMetrics.slice(0, 3);
  const bottom = [...activeMetrics].filter((m: any) => m.score > 0 && m.score < 4.0).sort((a, b) => a.score - b.score).slice(0, 3);

  const getAxisWidth = () => {
    if (typeof window === 'undefined') return 600;
    if (window.innerWidth < 768) return 280;
    return isFullScreen ? 600 : 500; // Zmenšil som max. šírku osi, aby zostalo viac miesta na stĺpce v PDF
  };

  // 1. ZOSTAVENÝ BOX PRE DETAIL (GRAF)
  const renderChartBox = (
    <div 
      // V prípade fullscreenu používame ID na obaľovací div grafu, nie na samotný full-screen wrapper
      className={`${
        isFullScreen 
          ? 'fixed inset-0 z-[9999] bg-white p-6 sm:p-10 flex flex-col overflow-y-auto overflow-x-hidden animate-fade-in' 
          : 'bg-white p-6 sm:p-8 md:p-10 lg:p-14 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl flex flex-col'
      }`}
    >
      <div id={isFullScreen ? `fullscreen-block-${area.id}` : undefined} className="flex-1 flex flex-col w-full max-w-[1920px] mx-auto bg-white">
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
              <>
                <button
                  onClick={handlePdfExport}
                  className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all bg-black/5 text-black hover:bg-black hover:text-white"
                  title="Stiahnuť zobrazenie do PDF"
                >
                  <Download className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
                </button>
                <button
                  onClick={handleExcelExport}
                  className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all bg-brand/10 text-brand hover:bg-brand hover:text-white"
                  title="Stiahnuť dáta do Excelu"
                >
                  <Download className="w-4 h-4" /> <span className="hidden sm:inline">Excel</span>
                </button>
              </>
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
          {/* DÔLEŽITÉ: Používam konkrétnejšie výšky a padding, aby sa graf "zapasoval" aj pre export */}
          <div className={`${isFullScreen ? 'h-full min-h-[600px] w-full' : 'h-[450px] sm:h-[500px] lg:h-[550px] w-full'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeMetrics} layout="vertical" margin={{ left: 10, right: 60, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#00000008" />
                <XAxis type="number" domain={[0, scaleMax]} hide />
                <YAxis 
                  dataKey="category" 
                  type="category" 
                  width={getAxisWidth()} 
                  interval={0} 
                  tick={<CustomYAxisTick isFullScreen={isFullScreen} />} 
                />
                <Tooltip cursor={{ fill: '#00000005' }} content={<CustomBarTooltip />} />
                <Bar 
                  dataKey="score" 
                  radius={[0, 12, 12, 0]} 
                  barSize={isFullScreen ? 28 : (typeof window !== 'undefined' && window.innerWidth < 768 ? 16 : 24)}
                >
                  {activeMetrics.map((entry: any, index: number) => (
                    <Cell key={index} fill={entry.score <= 4.0 ? '#000000' : '#B81547'} />
                  ))}
                  <LabelList 
                    dataKey="score" 
                    position="right" 
                    style={{ fontWeight: 900, fontSize: isFullScreen ? '16px' : (typeof window !== 'undefined' && window.innerWidth < 768 ? '12px' : '14px'), fill: '#000' }} 
                    offset={15} 
                    formatter={(val: number) => val.toFixed(2)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  // 2. ZOSTAVENÝ BOX PRE POROVNANIE (MATICA)
  const renderComparisonBox = (
    <div 
      className={`${
        isFullScreen 
          ? 'fixed inset-0 z-[9999] bg-white p-6 sm:p-10 flex flex-col overflow-y-auto animate-fade-in' 
          : 'relative mt-4'
      }`}
    >
      <div id={isFullScreen ? `fullscreen-block-${area.id}` : undefined} className="flex-1 flex flex-col w-full max-w-[1920px] mx-auto bg-white">
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
              <>
                <button
                  onClick={handlePdfExport}
                  className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all bg-black/5 text-black hover:bg-black hover:text-white"
                  title="Stiahnuť tabuľku do PDF"
                >
                  <Download className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
                </button>
                <button
                  onClick={handleExcelExport}
                  className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all bg-brand/10 text-brand hover:bg-brand hover:text-white"
                  title="Stiahnuť dáta do Excelu"
                >
                  <Download className="w-4 h-4" /> <span className="hidden sm:inline">Excel</span>
                </button>
              </>
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
          <ComparisonMatrix teams={comparisonSelection} matrixData={getComparisonData(comparisonSelection)} />
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
                <MapPin className="w-3 h-3" /> Konfigurácia reportu
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none break-words">
                  {area.title}
                </h2>
                
                <div className="print:hidden">
                  <button
                    onClick={handleExcelExport}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand/10 hover:bg-brand/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-brand"
                  >
                    <Download className="w-3 h-3" /> Excel Dáta
                  </button>
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
                  <select
                    value={teamValue}
                    onChange={(e) => setTeamValue(e.target.value)}
                    className="w-full p-4 sm:p-5 lg:p-7 pr-12 sm:pr-14 bg-black text-white rounded-[1rem] sm:rounded-[1.25rem] lg:rounded-[1.5rem] font-black text-base sm:text-lg lg:text-xl outline-none shadow-2xl cursor-pointer hover:bg-brand transition-all appearance-none tracking-tight"
                  >
                    {masterTeams.map((t: string) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-white/40 pointer-events-none" />
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

          {!isFullScreen && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-10">
              <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl">
                <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10 text-brand">
                  <Star className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" />
                  <h4 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-black">Silné stránky</h4>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {top.map((m: any, i: number) => (
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
                  {bottom.length > 0 ? bottom.map((m: any, i: number) => (
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
