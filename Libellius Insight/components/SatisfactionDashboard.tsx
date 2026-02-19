import React, { useState, useMemo, useEffect } from 'react';
import { FeedbackAnalysisResult } from '../types';
import TeamSelectorGrid from './satisfaction/TeamSelectorGrid';
import ComparisonMatrix from './satisfaction/ComparisonMatrix';
import LZString from 'lz-string';
import { 
  RefreshCw, Users, Search, BarChart4, ClipboardCheck, MapPin, UserCheck,
  Building2, Star, Target, Download, Link as LinkIcon, Check, SearchX, ArrowUpDown, ChevronDown, 
  MessageSquare, Quote, MessageCircle, Filter // <--- Pridaný Filter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

type TabType = 'ENGAGEMENT' | 'OPEN_QUESTIONS' | 'card1' | 'card2' | 'card3' | 'card4';
type ViewMode = 'DETAIL' | 'COMPARISON';
type SortKey = 'count' | 'name';
type SortDirection = 'asc' | 'desc' | null;

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

  // --- NOVÉ STAVY PRE FILTROVANIE V TABUĽKE ---
  const [showTeamFilter, setShowTeamFilter] = useState(false);
  const [selectedEngagementTeams, setSelectedEngagementTeams] = useState<string[]>([]);

  const [openQuestionsTeam, setOpenQuestionsTeam] = useState<string>('');

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

  const getOpenQuestionsForTeam = (teamName: string) => {
    if (!data.openQuestions) return [];
    const teamData = data.openQuestions.find((t: any) => t.teamName === teamName);
    return teamData ? teamData.questions : [];
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

  // --- UPRAVENÁ LOGIKA PRE FILTROVANIE ---
  const filteredEngagement = useMemo(() => {
    let teams = [...(data.teamEngagement || [])];

    // Filter cez vyhľadávanie
    if (searchTerm) {
      teams = teams.filter((t: any) => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Filter cez vybrané tímy (ak je nejaký vybraný)
    if (selectedEngagementTeams.length > 0) {
      teams = teams.filter((t: any) => selectedEngagementTeams.includes(t.name));
    }

    // Zoradenie
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
            <div className="bg-white p-10 md:p-14 rounded-[2.5rem] border border-black/5 shadow-2xl h-[650px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeMetrics} layout="vertical" margin={{ left: 20, right: 80, top: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#00000008" />
                  <XAxis type="number" domain={[0, scaleMax]} hide />
                  <YAxis dataKey="category" type="category" width={380} tick={{ fontSize: 13, fontWeight: 900, fill: '#000', width: 370 }} interval={0} />
                  <Tooltip cursor={{ fill: '#00000005' }} />
                  <Bar dataKey="score" radius={[0, 15, 15, 0]} barSize={32}>
                    {activeMetrics.map((entry: any, index: number) => <Cell key={index} fill={entry.score <= 4.0 ? '#000000' : '#B81547'} />)}
                    <LabelList dataKey="score" position="right" style={{ fontWeight: 900, fontSize: '15px', fill: '#000' }} offset={15} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl">
                  <div className="flex items-center gap-4 mb-10 text-brand">
                    <Star className="w-8 h-8" />
                    <h4 className="text-2xl font-black uppercase tracking-tighter text-black">Silné stránky</h4>
                  </div>
                  <div className="space-y-4">
                    {top.map((m, i) => (
                      <div key={i} className="p-7 rounded-3xl flex justify-between items-center bg-brand text-white shadow-lg">
                        <span className="font-bold text-xs pr-4 leading-tight uppercase tracking-wide">{m.category}</span>
                        <span className="text-4xl font-black">{m.score.toFixed(2)}</span>
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
                      <div key={i} className="p-7 rounded-3xl flex justify-between items-center bg-black text-white shadow-lg">
                        <span className="font-bold text-xs pr-4 leading-tight uppercase tracking-wide">{m.category}</span>
                        <span className="text-4xl font-black text-brand">{m.score.toFixed(2)}</span>
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
              <button onClick={generateShareLink} className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all text-[10px] uppercase tracking-widest shadow-lg ${copyStatus ? 'bg-green-600 text-white scale-105' : 'bg-white border-2 border-brand text-brand hover:bg-brand hover:text-white'}`}>
                {copyStatus ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                {copyStatus ? 'Odkaz skopírovaný!' : 'Zdieľať odkaz'}
              </button>
              <button onClick={exportToJson} className="flex items-center gap-2 px-6 py-3 bg-brand text-white hover:bg-brand/90 rounded-full font-bold transition-all text-[10px] uppercase tracking-widest shadow-lg shadow-brand/20">
                <Download className="w-4 h-4" /> Exportovať JSON
              </button>
            </>
          )}
          <button onClick={onReset} className="px-8 py-3 bg-black/5 hover:bg-black hover:text-white rounded-full font-bold text-[10px] uppercase tracking-widest border border-black/5 transition-all">
            {isSharedView ? 'Zavrieť report' : 'Reset'}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex bg-black/5 p-2 rounded-3xl w-full max-w-5xl mx-auto overflow-x-auto no-scrollbar border border-black/5">
        {[
          { id: 'ENGAGEMENT', icon: Users, label: 'Zapojenie' },
          { id: 'OPEN_QUESTIONS', icon: MessageSquare, label: 'Voľné otázky' },
          { id: 'card1', icon: BarChart4, label: data.card1?.title || 'Karta 1' },
          { id: 'card2', icon: UserCheck, label: data.card2?.title || 'Karta 2' },
          { id: 'card3', icon: Users, label: data.card3?.title || 'Karta 3' },
          { id: 'card4', icon: Building2, label: data.card4?.title || 'Karta 4' }
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as TabType)} className={`flex-1 flex items-center justify-center gap-2 py-5 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-white text-black shadow-lg scale-105' : 'text-black/40 hover:text-black'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'ENGAGEMENT' && (
        <div className="space-y-10 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-black text-white p-10 rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02]">
               <span className="block text-[10px] font-black uppercase opacity-50 mb-3 tracking-[0.2em]">CELKOVÝ POČET OSLOVENÝCH</span>
               <span className="text-7xl font-black tracking-tighter leading-none">{data.totalSent || 0}</span>
            </div>
            <div className="bg-brand text-white p-10 rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02]">
               <span className="block text-[10px] font-black uppercase opacity-60 mb-3 tracking-[0.2em]">POČET ZAPOJENÝCH OSOB</span>
               <span className="text-7xl font-black tracking-tighter leading-none">{data.totalReceived || 0}</span>
            </div>
            <div className="bg-white border border-black/5 p-10 rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02]">
               <span className="block text-[10px] font-black uppercase text-black/40 mb-3 tracking-[0.2em]">CELKOVÁ NÁVRATNOSŤ</span>
               <div className="flex items-baseline gap-1">
                 <span className="text-7xl font-black text-black tracking-tighter leading-none">{String(data.successRate || '0').replace('%', '')}</span>
                 <span className="text-4xl font-black text-black/10 tracking-tighter">%</span>
               </div>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
              <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">Štruktúra stredísk</h3>
              
              {/* --- NOVÉ TLAČIDLÁ PRE VYHĽADÁVANIE A FILTROVANIE --- */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/20" />
                  <input type="text" placeholder="Hľadať..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-black/5 rounded-2xl font-bold text-xs outline-none focus:bg-black/10 transition-all" />
                </div>
                <button
                  onClick={() => setShowTeamFilter(!showTeamFilter)}
                  className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-bold text-xs transition-all border border-black/5 ${showTeamFilter || selectedEngagementTeams.length > 0 ? 'bg-brand text-white shadow-lg' : 'bg-white hover:bg-black/5 text-black'}`}
                >
                  <Filter className="w-4 h-4" />
                  Výber ({selectedEngagementTeams.length > 0 ? selectedEngagementTeams.length : 'Všetky'})
                </button>
              </div>
            </div>

            {/* --- PANEL S VÝBEROM TÍMOV --- */}
            {showTeamFilter && (
              <div className="mb-8 p-6 bg-black/5 rounded-3xl border border-black/5 animate-fade-in">
                <div className="flex flex-wrap gap-2">
                  {masterTeams.map((team: string) => (
                    <button
                      key={team}
                      onClick={() => {
                        setSelectedEngagementTeams(prev =>
                          prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team]
                        )
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedEngagementTeams.includes(team) ? 'bg-black text-white shadow-md' : 'bg-white text-black hover:bg-black/10'}`}
                    >
                      {team}
                    </button>
                  ))}
                </div>
                {selectedEngagementTeams.length > 0 && (
                  <button
                    onClick={() => setSelectedEngagementTeams([])}
                    className="mt-4 text-[10px] uppercase tracking-widest font-black text-brand hover:underline"
                  >
                    Vymazať výber
                  </button>
                )}
              </div>
            )}

            

            <div className="overflow-hidden rounded-3xl border border-black/5">
              <table className="w-full text-left">
                <thead className="bg-[#fcfcfc] text-[11px] font-black uppercase tracking-widest text-black/40 border-b border-black/5">
                  <tr>
                    <th className="p-6 cursor-pointer hover:text-black transition-colors" onClick={() => handleSort('name')}><div className="flex items-center gap-2">Stredisko <ArrowUpDown className="w-3 h-3" /></div></th>
                    <th className="p-6 text-center cursor-pointer hover:text-black transition-colors" onClick={() => handleSort('count')}><div className="flex items-center justify-center gap-2">Počet <ArrowUpDown className="w-3 h-3" /></div></th>
                    <th className="p-6 text-center">Podiel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 font-black text-xs">
                  {filteredEngagement.length > 0 ? filteredEngagement.map((team: any, idx: number) => (
                    <tr key={idx} className={`hover:bg-brand/5 transition-colors group ${team.name.toLowerCase().includes('priemer') ? 'bg-brand/5 text-brand' : ''}`}>
                      <td className="p-7 group-hover:text-brand transition-colors">{team.name}</td>
                      <td className="p-7 text-center">{team.count}</td>
                      <td className="p-7">
                        <div className="flex items-center justify-center gap-5">
                          <div className="w-40 bg-black/5 h-2.5 rounded-full overflow-hidden">
                            <div className="h-full bg-brand shadow-[0_0_10px_rgba(184,21,71,0.3)]" style={{ width: `${(team.count / data.totalReceived) * 100}%` }} />
                          </div>
                          <span className="text-brand font-black text-xs min-w-[45px]">{((team.count / data.totalReceived) * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="p-10 text-center text-black/30 font-black uppercase tracking-widest text-xs">
                        Žiadne tímy nezodpovedajú filtru
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'OPEN_QUESTIONS' && (
        <div className="space-y-10 animate-fade-in">
           <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl">
             <div className="flex flex-col lg:flex-row justify-between items-end gap-8">
                <div className="space-y-6">
                   <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/5 rounded-full text-[10px] font-black uppercase text-brand tracking-[0.2em]">
                    <MessageSquare className="w-3 h-3" /> Kvalitatívna spätná väzba
                  </div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">Odpovede zamestnancov</h2>
                </div>
                
                <div className="flex flex-col items-end gap-3 w-full lg:w-auto">
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/20 mr-4">VYBRANÝ TÍM / STREDISKO:</span>
                   <div className="relative w-full lg:w-auto min-w-[340px]">
                      <select 
                        value={openQuestionsTeam} 
                        onChange={(e) => setOpenQuestionsTeam(e.target.value)} 
                        className="w-full p-7 pr-14 bg-black text-white rounded-[1.5rem] font-black text-xl outline-none shadow-2xl cursor-pointer hover:bg-brand transition-all appearance-none tracking-tight"
                      >
                        {masterTeams.map((t: string) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-white/40 pointer-events-none" />
                   </div>
                </div>
             </div>
           </div>

           <div className="columns-1 lg:columns-2 gap-8 space-y-8">
              {getOpenQuestionsForTeam(openQuestionsTeam).length > 0 ? (
                getOpenQuestionsForTeam(openQuestionsTeam).map((q: any, i: number) => (
                  <div key={i} className="bg-white p-8 rounded-[2rem] border border-black/5 shadow-xl break-inside-avoid hover:shadow-2xl transition-shadow duration-300">
                     <div className="flex items-start gap-4 mb-6">
                        <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
                          <MessageCircle className="w-6 h-6 text-brand" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tight leading-snug pt-1">
                           {q.questionText}
                        </h3>
                     </div>
                     
                     <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {q.answers && q.answers.length > 0 ? (
                          q.answers.map((ans: string, j: number) => (
                            <div key={j} className="relative group">
                               <div className="absolute left-0 top-4 bottom-4 w-1 bg-black/5 rounded-full group-hover:bg-brand transition-colors"></div>
                               <div className="pl-6 py-2">
                                  <Quote className="w-4 h-4 text-black/20 mb-2" />
                                  <p className="text-sm font-medium text-black/80 leading-relaxed italic">
                                    "{ans}"
                                  </p>
                               </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-black/20 font-bold text-xs uppercase tracking-widest italic pl-4 py-4">
                            Žiadne odpovede na túto otázku
                          </div>
                        )}
                     </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-20 bg-white rounded-[2.5rem] border border-black/5 text-black/30 font-black uppercase tracking-widest">
                  Pre vybrané stredisko nie sú dostupné žiadne textové odpovede
                </div>
              )}
           </div>
        </div>
      )}

      {['card1', 'card2', 'card3', 'card4'].includes(activeTab) && renderSection(activeTab as any)}
    </div>
  );
};

export default SatisfactionDashboard;
