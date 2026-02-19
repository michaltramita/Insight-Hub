import React, { useState, useMemo, useEffect } from 'react';
import { FeedbackAnalysisResult } from '../types';
import TeamSelectorGrid from './satisfaction/TeamSelectorGrid';
import ComparisonMatrix from './satisfaction/ComparisonMatrix';
import LZString from 'lz-string';
import { 
  RefreshCw, Users, Search, BarChart4, ClipboardCheck, MapPin, UserCheck,
  Building2, Star, Target, Download, Link as LinkIcon, Check, SearchX, ArrowUpDown, ChevronDown, 
  MessageSquare, Quote, MessageCircle, Filter, Lightbulb, BarChart as BarChartIcon
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, Legend
} from 'recharts';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

type TabType = 'ENGAGEMENT' | 'OPEN_QUESTIONS' | 'card1' | 'card2' | 'card3' | 'card4';
type ViewMode = 'DETAIL' | 'COMPARISON';
type SortKey = 'count' | 'name';
type SortDirection = 'asc' | 'desc' | null;

const PIE_COLORS = ['#B81547', '#000000', '#2B2B2B', '#555555', '#7F7F7F', '#AAAAAA', '#D4D4D4'];

// --- NOVÝ KOMPONENT: Vlastný Tooltip pre BarChart ---
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black text-white p-5 rounded-2xl shadow-2xl max-w-sm border border-white/10 z-50">
        <p className="font-bold text-sm mb-3 leading-snug">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand"></div>
          <p className="font-black text-lg">Skóre: {payload[0].value.toFixed(2)}</p>
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

  const [showTeamFilter, setShowTeamFilter] = useState(false);
  const [selectedEngagementTeams, setSelectedEngagementTeams] = useState<string[]>([]);

  const [openQuestionsTeam, setOpenQuestionsTeam] = useState<string>('');
  const [selectedQuestionText, setSelectedQuestionText] = useState<string>('');
  const [expandedRecIndex, setExpandedRecIndex] = useState<number | null>(null);

  const [selectedTeams, setSelectedTeams] = useState<Record<string, string>>({
    card1: '', card2: '', card3: '', card4: ''
  });

  const [comparisonSelection, setComparisonSelection] = useState<Record<string, string[]>>({
    card1: [], card2: [], card3: [] , card4: []
  });

  const generateShareLink = () => {
    try {
      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(result));
      const shareUrl = `${window.location.origin}${window.location.pathname}#report=${compressed}`;
      navigator.clipboard.writeText(shareUrl);
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 2000);
    } catch (err) { alert("Chyba pri kopírovaní odkazu."); }
  };

  const exportToJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${data.clientName || 'report'}_analyza.json`);
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
    if (masterTeams.length > 0) {
      const initial = masterTeams.find((t: string) => t.toLowerCase().includes('priemer')) || masterTeams[0];
      if (!selectedTeams.card1) {
        setSelectedTeams({ card1: initial, card2: initial, card3: initial, card4: initial });
      }
      if (!openQuestionsTeam) {
        setOpenQuestionsTeam(initial);
      }
    }
  }, [masterTeams]);

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

  const getActiveData = (tab: 'card1' | 'card2' | 'card3' | 'card4', teamName: string) => {
    const card = data[tab];
    if (!card) return [];
    const team = card.teams.find((t: any) => t.teamName === teamName) || card.teams[0];
    return team ? [...team.metrics].sort((a, b) => b.score - a.score) : [];
  };

  const getComparisonData = (tab: 'card1' | 'card2' | 'card3' | 'card4', selectedNames: string[]) => {
    const card = data[tab];
    if (!card) return [];
    const categories = Array.from(new Set(card.teams.flatMap((t: any) => t.metrics.map((m: any) => m.category))));
    return categories.map(cat => {
      const row: any = { category: cat };
      selectedNames.forEach(tName => {
        const team = card.teams.find((t: any) => t.teamName === tName);
        const metric = team?.metrics.find((m: any) => m.category === cat);
        row[tName] = metric?.score || 0;
      });
      return row;
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

  const totalFilteredCount = filteredEngagement.reduce((acc, curr) => acc + curr.count, 0);

  const renderSection = (tab: 'card1' | 'card2' | 'card3' | 'card4') => {
    const card = data[tab];
    if (!card) return null;
    const teamValue = selectedTeams[tab];
    const activeMetrics = getActiveData(tab, teamValue);
    const top = activeMetrics.slice(0, 3);
    const bottom = [...activeMetrics].filter(m => m.score > 0 && m.score < 4.0).sort((a, b) => a.score - b.score).slice(0, 3);

    return (
      <div className="space-y-10 animate-fade-in">
        <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl">
          <div className="flex flex-col lg:flex-row justify-between items-end lg:items-center gap-8">
            <div className="space-y-6 w-full lg:w-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/5 rounded-full text-[10px] font-black uppercase text-brand tracking-[0.2em]">
                <MapPin className="w-3 h-3" /> Konfigurácia reportu
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">{card.title}</h2>
              <div className="flex bg-black/5 p-1 rounded-2xl w-fit border border-black/5">
                <button onClick={() => setViewMode('DETAIL')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'DETAIL' ? 'bg-white text-black shadow-lg scale-105' : 'text-black/30 hover:text-black/60'}`}>Detail tímu</button>
                <button onClick={() => setViewMode('COMPARISON')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'COMPARISON' ? 'bg-white text-black shadow-lg scale-105' : 'text-black/30 hover:text-black/60'}`}>Porovnanie</button>
              </div>
            </div>

            {viewMode === 'DETAIL' && (
              <div className="flex flex-col items-end gap-3 w-full lg:w-auto">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/20 mr-4">VYBRANÝ TÍM / STREDISKO:</span>
                <div className="relative w-full lg:w-auto min-w-[340px]">
                  <select 
                    value={teamValue} 
                    onChange={(e) => setSelectedTeams({...selectedTeams, [tab]: e.target.value})} 
                    className="w-full p-7 pr-14 bg-black text-white rounded-[1.5rem] font-black text-xl outline-none shadow-2xl cursor-pointer hover:bg-brand transition-all appearance-none tracking-tight"
                  >
                    {masterTeams.map((t: string) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-white/40 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {viewMode === 'COMPARISON' && (
            <div className="mt-8 border-t border-black/5 pt-8">
              <TeamSelectorGrid 
                availableTeams={masterTeams} 
                selectedTeams={comparisonSelection[tab]} 
                onToggleTeam={(t) => {
                  const current = comparisonSelection[tab];
                  setComparisonSelection({...comparisonSelection, [tab]: current.includes(t) ? current.filter(x => x !== t) : [...current, t]});
                }}
                onClear={() => setComparisonSelection({...comparisonSelection, [tab]: []})}
              />
            </div>
          )}
        </div>

        {viewMode === 'DETAIL' ? (
          <div className="space-y-10">
            <div className="bg-white p-10 md:p-14 rounded-[2.5rem] border border-black/5 shadow-2xl flex flex-col h-[750px]">
              <div className="mb-8 flex items-start gap-4">
                 <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
                    <BarChartIcon className="w-6 h-6 text-brand" />
                 </div>
                 <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-black">Hodnotenie jednotlivých tvrdení</h3>
                    <p className="text-sm font-bold text-black/40 mt-1">Stredisko: <span className="text-brand">{teamValue}</span></p>
                 </div>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeMetrics} layout="vertical" margin={{ left: 20, right: 80, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#00000008" />
                    <XAxis type="number" domain={[0, scaleMax]} hide />
                    {/* ZMYSluplné orezanie dlhého textu pre os Y */}
                    <YAxis 
                      dataKey="category" 
                      type="category" 
                      width={380} 
                      tick={{ fontSize: 12, fontWeight: 800, fill: '#000' }} 
                      interval={0} 
                      tickFormatter={(val) => val.length > 55 ? val.substring(0, 55) + '...' : val}
                    />
                    {/* Vlastný Tooltip zobrazí celý text */}
                    <Tooltip cursor={{ fill: '#00000005' }} content={<CustomBarTooltip />} />
                    <Bar dataKey="score" radius={[0, 15, 15, 0]} barSize={32}>
                      {activeMetrics.map((entry: any, index: number) => <Cell key={index} fill={entry.score <= 4.0 ? '#000000' : '#B81547'} />)}
                      <LabelList dataKey="score" position="right" style={{ fontWeight: 900, fontSize: '15px', fill: '#000' }} offset={15} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl">
                  <div className="flex items-center gap-4 mb-10 text-brand">
                    <Star className="w-8 h-8" />
                    <h4 className="text-2xl font-black uppercase tracking-tighter text-black">Silné stránky</h4>
                  </div>
                  <div className="space-y-4">
                    {top.map((m, i) => (
                      <div key={i} className="p-7 rounded-3xl flex justify-between items-center bg-brand text-white shadow-lg group relative cursor-help">
                        {/* Zobrazenie max 2 riadkov, originál vidno po ukázaní myšou */}
                        <span className="font-bold text-xs pr-4 leading-snug tracking-wide line-clamp-2" title={m.category}>{m.category}</span>
                        <span className="text-4xl font-black shrink-0">{m.score.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
               </div>
               <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl">
                  <div className="flex items-center gap-4 mb-10 text-black">
                    <Target className="w-8 h-8" />
                    <h4 className="text-2xl font-black uppercase tracking-tighter">Príležitosti</h4>
                  </div>
                  <div className="space-y-4">
                    {bottom.length > 0 ? bottom.map((m, i) => (
                      <div key={i} className="p-7 rounded-3xl flex justify-between items-center bg-black text-white shadow-lg group relative cursor-help">
                        {/* Zobrazenie max 2 riadkov, originál vidno po ukázaní myšou */}
                        <span className="font-bold text-xs pr-4 leading-snug tracking-wide line-clamp-2" title={m.category}>{m.category}</span>
                        <span className="text-4xl font-black text-brand shrink-0">{m.score.toFixed(2)}</span>
                      </div>
                    )) : <p className="text-center py-10 text-black/20 font-black uppercase tracking-widest text-[10px]">Žiadne kritické body</p>}
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <ComparisonMatrix teams={comparisonSelection[tab]} matrixData={getComparisonData(tab, comparisonSelection[tab])} />
        )}
      </div>
    );
  };

  if (!data) return null;

  const openQuestionsTeamData = data.openQuestions?.find((t: any) => t.teamName === openQuestionsTeam);
  const availableQuestions = openQuestionsTeamData?.questions || [];
  const selectedQuestionData = availableQuestions.find((q: any) => q.questionText === selectedQuestionText) || availableQuestions[0];

  return (
    <div className="space-y-8 animate-fade-in pb-24 px-4 md:px-0">
      {/* HEADER */}
      <div className="bg-white rounded-[2.5rem] border border-black/5 p-8 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center shadow-xl shadow-brand/20"><ClipboardCheck className="text-white w-8 h-8" /></div>
           <div>
             <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">{data.clientName || "Report"}</h1>
             <p className="text-black/40 font-bold uppercase tracking-widest text-[10px] mt-2">Dátum: {result.reportMetadata?.date || '2024'}</p>
           </div>
        </div>
        <div className="flex items-center gap-3">
          {!isSharedView && (
            <>
              <button onClick={generateShareLink} className={`flex
