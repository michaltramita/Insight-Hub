import React, { useState, useMemo, useEffect } from 'react';
import { FeedbackAnalysisResult } from '../types';
import TeamSelectorGrid from './satisfaction/TeamSelectorGrid';
import ComparisonMatrix from './satisfaction/ComparisonMatrix';
import OpenQuestionsBlock from './satisfaction/OpenQuestionsBlock';
import EngagementBlock from './satisfaction/EngagementBlock'; // <-- TOTO JE NÁŠ NOVÝ IMPORT
import { encryptReportToUrlPayload } from '../utils/reportCrypto';
import { exportBlockToPDF, exportDataToExcel } from '../utils/exportUtils';
import {
  Users, BarChart4, MapPin, UserCheck,
  Building2, Star, Target, Download, Link as LinkIcon, Check, ArrowUpDown, ChevronDown,
  MessageSquare, BarChart as BarChartIcon
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

type TabType = 'ENGAGEMENT' | 'OPEN_QUESTIONS' | string;
type ViewMode = 'DETAIL' | 'COMPARISON';
type ComparisonFilterType = 'ALL' | 'PRIEREZOVA' | 'SPECIFICKA';

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

const CustomYAxisTick = ({ x, y, payload }: any) => {
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
  if (currentLine) {
    lines.push(currentLine.trim());
  }

  const lineHeight = isMobile ? 16 : 18;
  const startY = y - ((lines.length - 1) * lineHeight) / 2;

  return (
    <g transform={`translate(${x},${startY})`}>
      {lines.map((line: string, index: number) => (
        <text
          key={index}
          x={0}
          y={index * lineHeight}
          dy="0.35em"
          textAnchor="end"
          fill="#000"
          fontSize={isMobile ? 13 : 18}
          fontWeight={800}
        >
          {line}
        </text>
      ))}
    </g>
  );
};

const SatisfactionDashboard: React.FC<Props> = ({ result, onReset }) => {
  const data = result.satisfaction || (result as any);
  const scaleMax = result.reportMetadata?.scaleMax || (data as any).reportMetadata?.scaleMax || 6;
  const isSharedView = typeof window !== 'undefined' && window.location.hash.startsWith('#report=');
  
  const [activeTab, setActiveTab] = useState<TabType>('ENGAGEMENT');
  const [viewMode, setViewMode] = useState<ViewMode>('DETAIL');
  const [copyStatus, setCopyStatus] = useState(false);
  const [comparisonFilter, setComparisonFilter] = useState<ComparisonFilterType>('ALL');

  const [selectedTeams, setSelectedTeams] = useState<Record<string, string>>({});
  const [comparisonSelection, setComparisonSelection] = useState<Record<string, string[]>>({});
  const [activeExportMenu, setActiveExportMenu] = useState<string | null>(null);

  const generateShareLink = async () => {
    try {
      const password = window.prompt('Zadajte heslo pre report (min. 6 znakov):');
      if (!password) return;

      if (password.trim().length < 6) {
        alert('Heslo musí mať aspoň 6 znakov.');
        return;
      }

      const encryptedPayload = await encryptReportToUrlPayload(result, password.trim());

      const clientMeta = encodeURIComponent(data.clientName || 'Klient');
      const surveyMeta = encodeURIComponent(data.surveyName || 'Prieskum spokojnosti');
      const issuedMeta = encodeURIComponent(
        result.reportMetadata?.date || new Date().toLocaleDateString('sk-SK')
      );

      const shareUrl =
        `${window.location.origin}${window.location.pathname}` +
        `#report=${encodeURIComponent(encryptedPayload)}` +
        `&client=${clientMeta}` +
        `&survey=${surveyMeta}` +
        `&issued=${issuedMeta}`;

      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopyStatus(true);
        setTimeout(() => setCopyStatus(false), 2000);
        alert('Odkaz bol skopírovaný. Heslo pošlite používateľovi zvlášť.');
      } catch (clipboardErr) {
        console.warn('Clipboard blocked:', clipboardErr);
        window.prompt('Skopírujte odkaz manuálne (Cmd+C):', shareUrl);
        setCopyStatus(true);
        setTimeout(() => setCopyStatus(false), 2000);
        alert('Schránka bola zablokovaná, odkaz som zobrazil na manuálne skopírovanie.');
      }
    } catch (err: any) {
      console.error('Share link error:', err);
      alert(`Chyba pri vytváraní zabezpečeného odkazu: ${err?.message || err}`);
    }
  };

  const exportToJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(result));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);

    const fileBaseName = `${data.clientName || 'firma'}_${data.surveyName || 'prieskum'}`
      .replace(/\s+/g, '_')
      .replace(/[^\w\-]/g, '');

    downloadAnchorNode.setAttribute('download', `${fileBaseName}_analyza.json`);
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
  }, [masterTeams, data.areas]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.export-dropdown-container')) {
        setActiveExportMenu(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

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

  const handlePdfExport = (blockId: string, fileName: string) => {
    exportBlockToPDF(blockId, fileName, () => setActiveExportMenu(null));
  };

  const handleExcelExport = (blockType: 'ENGAGEMENT' | 'AREA', areaId?: string, areaTitle?: string) => {
    let dataToExport: any[] = [];
    let fileName = '';

    // Zapojenie už je riešené vnútri EngagementBlock, ale tu si pre istotu necháme kostru, keby náhodou.
    if (blockType === 'AREA' && areaId) {
      if (viewMode === 'DETAIL') {
        const teamValue = selectedTeams[areaId] || '';
        const activeMetrics = getActiveData(areaId, teamValue);
        dataToExport = activeMetrics.map((m: any) => ({
          'Otázka / Kategória': m.category,
          'Skóre (max 6)': Number(m.score.toFixed(2)),
          'Typ otázky': m.questionType
        }));
        fileName = `Oblast_${areaTitle}_${teamValue}_Detail.xlsx`.replace(/\s+/g, '_');
      } else {
        const currentTeams = comparisonSelection[areaId] || [];
        const comparisonData = getComparisonData(areaId, currentTeams);
        dataToExport = comparisonData.map((row: any) => {
            const rowData: any = { 'Kategória': row.category, 'Typ otázky': row.questionType };
            currentTeams.forEach(team => {
                rowData[team] = row[team] !== undefined ? Number(row[team].toFixed(2)) : null;
            });
            return rowData;
        });
        fileName = `Oblast_${areaTitle}_Porovnanie.xlsx`.replace(/\s+/g, '_');
      }
    }

    exportDataToExcel(dataToExport, fileName, () => setActiveExportMenu(null));
  };

  const renderSection = (areaId: string) => {
    const area = getAreaById(areaId);
    if (!area) return null;

    const teamValue = selectedTeams[areaId] || '';
    const activeMetrics = getActiveData(areaId, teamValue);
    const top = activeMetrics.slice(0, 3);
    const bottom = [...activeMetrics]
      .filter((m: any) => m.score > 0 && m.score < 4.0)
      .sort((a: any, b: any) => a.score - b.score)
      .slice(0, 3);

    return (
      <div id={`block-area-${areaId}`} className="space-y-8 sm:space-y-10 animate-fade-in">
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
                
                <div className="relative export-dropdown-container export-buttons print:hidden">
                  <button
                    onClick={() => setActiveExportMenu(activeExportMenu === `area-${areaId}` ? null : `area-${areaId}`)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-black/5 hover:bg-black/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-black/60 hover:text-black"
                  >
                    <Download className="w-3 h-3" /> Export
                    <ChevronDown className={`w-3 h-3 transition-transform ${activeExportMenu === `area-${areaId}` ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {activeExportMenu === `area-${areaId}` && (
                    <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 z-50 flex flex-col gap-1 min-w-[120px] animate-fade-in">
                       <button
                        onClick={() => handlePdfExport(`block-area-${areaId}`, `Oblast_${area.title}`)}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 transition-colors"
                       >
                         PDF Dokument
                       </button>
                       <button
                        onClick={() => handleExcelExport('AREA', areaId, area.title)}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-brand/10 text-brand transition-colors"
                       >
                         Excel Dáta
                       </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex bg-black/5 p-1 rounded-2xl w-full sm:w-fit border border-black/5 overflow-x-auto no-scrollbar print:hidden">
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
              <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto print:hidden">
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

              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 bg-black/5 p-2 rounded-2xl w-full md:w-fit print:hidden">
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

              <div className="w-full">
                <div className="h-[450px] sm:h-[500px] lg:h-[550px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={activeMetrics}
                      layout="vertical"
                      margin={{ left: 10, right: 50, top: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#00000008" />
                      <XAxis type="number" domain={[0, scaleMax]} hide />
                      <YAxis
                        dataKey="category"
                        type="category"
                        width={typeof window !== 'undefined' && window.innerWidth < 768 ? 280: 600}
                        interval={0}
                        tick={<CustomYAxisTick />} 
                      />
                      <Tooltip cursor={{ fill: '#00000005' }} content={<CustomBarTooltip />} />
                      <Bar 
                        dataKey="score" 
                        radius={[0, 12, 12, 0]} 
                        barSize={typeof window !== 'undefined' && window.innerWidth < 768 ? 16 : 24}
                      >
                        {activeMetrics.map((entry: any, index: number) => (
                          <Cell key={index} fill={entry.score <= 4.0 ? '#000000' : '#B81547'} />
                        ))}
                        <LabelList
                          dataKey="score"
                          position="right"
                          style={{ 
                            fontWeight: 900, 
                            fontSize: typeof window !== 'undefined' && window.innerWidth < 768 ? '12px' : '14px', 
                            fill: '#000' 
                          }}
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
                  {top.map((m: any, i: number) => (
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
                  {bottom.length > 0 ? bottom.map((m: any, i: number) => (
                    <div key={i} className="p-4 sm:p-5 lg:p-7 rounded-2xl sm:rounded-3xl flex justify-between items-center gap-3 bg-black text-white shadow-lg group relative cursor-help">
                      <span className="font-bold text-xs pr-2 sm:pr-4 leading-snug tracking-wide line-clamp-2" title={m.category}>
                        {m.category}
                      </span>
                      <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-brand shrink-0">{m.score.toFixed(2)}</span>
                    </div>
                  )) : (
                    <p className="text-center py-10 text-black/20 font-black uppercase tracking-widest text-[10px]">Žiadne kritické body</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ComparisonMatrix
            teams={comparisonSelection[areaId] || []}
            matrixData={getComparisonData(areaId, comparisonSelection[areaId] || [])}
          />
        )}
      </div>
    );
  };

  if (!data) return null;

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
    <div className="min-h-screen flex flex-col px-4 sm:px-6 lg:px-8">
      <div className="flex-1 w-full max-w-[1600px] 2xl:max-w-[1800px] mx-auto flex flex-col">
        <div className="space-y-6 sm:space-y-8 animate-fade-in pb-10 sm:pb-12">

          {/* HLAVIČKA */}
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 p-5 sm:p-8 md:p-10 lg:p-12 shadow-2xl flex flex-col xl:flex-row justify-between items-start gap-6 sm:gap-8 relative overflow-hidden print:hidden">
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
                    className={`w-full xl:w-[220px] flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black transition-all text-[10px] sm:text-[11px] uppercase tracking-widest shadow-xl ${copyStatus ? 'bg-green-600 text-white scale-105' : 'bg-white border-2 border-brand text-brand hover:bg-brand hover:text-white'}`}
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

          {/* TABY */}
          <div className="flex gap-2 bg-black/5 p-2 rounded-2xl sm:rounded-3xl w-full mx-auto overflow-x-auto no-scrollbar border border-black/5 print:hidden">
            {allTabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as TabType)}
                className={`shrink-0 xl:shrink xl:flex-1 xl:min-w-0 flex items-center justify-center gap-2 py-3 sm:py-4 lg:py-5 px-4 sm:px-5 lg:px-6 rounded-xl sm:rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-white text-black shadow-lg' : 'text-black/40 hover:text-black'}`}
              >
                <t.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>

          {/* VYKRESLENIE SEKCII PODĽA AKTÍVNEHO TABU */}
          
          {activeTab === 'ENGAGEMENT' && (
            <EngagementBlock data={data} masterTeams={masterTeams} />
          )}
          
          {activeTab === 'OPEN_QUESTIONS' && (
            <OpenQuestionsBlock openQuestions={data.openQuestions || []} masterTeams={masterTeams} />
          )}

          {(data.areas || []).some((a: any) => a.id === activeTab) && renderSection(activeTab as string)}

          {/* PÄTIČKA */}
          <div className="mt-12 sm:mt-16 pt-8 sm:pt-10 border-t border-black/10 flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6 text-black/40 pb-4 sm:pb-6 print:hidden">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Libellius" className="h-14 sm:h-20 lg:h-24 w-auto object-contain" />
            </div>
            <div className="text-center md:text-right">
              <p className="text-xs font-bold text-black/60">© {new Date().getFullYear()} Libellius. Všetky práva vyhradené.</p>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-1">Generované pomocou umelej inteligencie</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SatisfactionDashboard;
