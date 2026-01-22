import React, { useState, useMemo, useEffect } from 'react';
import { FeedbackAnalysisResult, TeamWorkSituation } from '../types';
import TeamSelectorGrid from './satisfaction/TeamSelectorGrid';
import ComparisonMatrix from './satisfaction/ComparisonMatrix';
import LZString from 'lz-string';
import { 
  RefreshCw, Users, Mail, CheckCircle2, Percent, Search, 
  BarChart4, ClipboardCheck, MapPin, UserCheck,
  Building2, Star, Target, SearchX, ArrowUpDown, Download,
  Link as LinkIcon, Check
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

type TabType = 'ENGAGEMENT' | 'card1' | 'card2' | 'card3' | 'card4';
type ViewMode = 'DETAIL' | 'COMPARISON';
type SortKey = 'count' | 'name';
type SortDirection = 'asc' | 'desc' | null;

const SatisfactionDashboard: React.FC<Props> = ({ result, onReset }) => {
  const data = result.satisfaction || (result as any);
  const scaleMax = result.reportMetadata?.scaleMax || (data as any).reportMetadata?.scaleMax || 6;
  
  // --- KONTROLA ZDIEĽANÉHO POHĽADU ---
  const isSharedView = typeof window !== 'undefined' && window.location.hash.startsWith('#report=');
  
  const [activeTab, setActiveTab] = useState<TabType>('ENGAGEMENT');
  const [viewMode, setViewMode] = useState<ViewMode>('DETAIL');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);

  const [selectedTeams, setSelectedTeams] = useState<Record<string, string>>({
    card1: '', card2: '', card3: '', card4: ''
  });

  const [comparisonSelection, setComparisonSelection] = useState<Record<string, string[]>>({
    card1: [], card2: [], card3: [] , card4: []
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

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

  if (!data || (!data.card1 && !data.teamEngagement)) return null;

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
        const isAvgA = a.toLowerCase().includes('priemer');
        const isAvgB = b.toLowerCase().includes('priemer');
        if (isAvgA && !isAvgB) return -1;
        if (!isAvgA && isAvgB) return 1;
        return a.localeCompare(b);
      });
  }, [data]);

  useEffect(() => {
    if (masterTeams.length > 0 && !selectedTeams.card1) {
      const initial = masterTeams.find((t: string) => t.toLowerCase().includes('priemer')) || masterTeams[0];
      setSelectedTeams({ card1: initial, card2: initial, card3: initial, card4: initial });
    }
  }, [masterTeams]);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 400);
    return () => clearTimeout(timer);
  }, [activeTab, viewMode]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : sortDirection === 'asc' ? null : 'desc');
      if (sortDirection === 'asc') setSortKey(null);
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
    let teams = [...(data.teamEngagement || [])].filter((t: any) => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
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
  }, [data.teamEngagement, searchTerm, sortKey, sortDirection]);

  const renderSection = (tab: 'card1' | 'card2' | 'card3' | 'card4') => {
    const card = data[tab];
    if (!card) return null;

    const teamValue = selectedTeams[tab];
    const activeMetrics = getActiveData(tab, teamValue);
    const top = activeMetrics.slice(0, 3);
    const bottom = [...activeMetrics].filter(m => m.score > 0 && m.score < 4.0).sort((a, b) => a.score - b.score).slice(0, 3);

    return (
      <div className="space-y-10 animate-fade-in">
        <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl shadow-black/5">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/5 rounded-full text-[10px] font-black uppercase text-brand tracking-widest">
                <MapPin className="w-3 h-3" /> Konfigurácia reportu
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter leading-tight">{card.title}</h2>
              <div className="flex bg-black/5 p-1 rounded-xl w-fit">
                <button onClick={() => setViewMode('DETAIL')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'DETAIL' ? 'bg-white text-black shadow-sm' : 'text-black/30'}`}>Detail tímu</button>
                <button onClick={() => setViewMode('COMPARISON')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'COMPARISON' ? 'bg-white text-black shadow-sm' : 'text-black/30'}`}>Porovnanie</button>
              </div>
            </div>
            {viewMode === 'DETAIL' && (
              <div className="w-full lg:w-96">
                <label className="block text-[10px] font-black uppercase tracking-widest text-black/30 mb-2 ml-2">Vyberte stredisko:</label>
                <select 
                  value={teamValue} 
                  onChange={(e) => setSelectedTeams({...selectedTeams, [tab]: e.target.value})} 
                  className="w-full p-5 bg-black text-white rounded-2xl font-black text-sm outline-none shadow-xl cursor-pointer"
                >
                  {masterTeams.map((t: string) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>
          {viewMode === 'COMPARISON' && (
            <TeamSelectorGrid 
              availableTeams={masterTeams} 
              selectedTeams={comparisonSelection[tab]} 
              onToggleTeam={(t) => {
                const current = comparisonSelection[tab];
                setComparisonSelection({
                  ...comparisonSelection, 
                  [tab]: current.includes(t) ? current.filter(x => x !== t) : [...current, t]
                });
              }}
              onClear={() => setComparisonSelection({...comparisonSelection, [tab]: []})}
            />
          )}
        </div>

        {viewMode === 'DETAIL' ? (
          <div className={`space-y-14 transition-all duration-500 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
            <div className="bg-white p-10 md:p-14 rounded-[2.5rem] border border-black/5 shadow-2xl shadow-black/5">
              <div className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-brand rounded-2xl shadow-lg shadow-brand/20"><BarChart4 className="w-8 h-8 text-white" /></div>
                  <div>
                    <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none">{teamValue}</h3>
                    <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest mt-2">Kvantitatívny profil oblasti</p>
                  </div>
                </div>
                <div className="px-6 py-3 bg-black text-white text-[10px] font-black rounded-full uppercase tracking-widest">Škála 1-{scaleMax}</div>
              </div>
              <div className="h-[600px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeMetrics} layout="vertical" margin={{ left: 20, right: 80, bottom: 20, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#00000008" />
                    <XAxis type="number" domain={[0, scaleMax]} hide />
                    <YAxis 
                      dataKey="category" 
                      type="category" 
                      width={380} 
                      tick={{ fontSize: 14, fill: '#000', fontWeight: 900, width: 370 }} 
                      interval={0} 
                    />
                    <Tooltip 
                       cursor={{ fill: '#00000005' }}
                       contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px rgba(0,0,0,0.1)', fontSize: '14px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="score" radius={[0, 12, 12, 0]} barSize={24}>
                      {activeMetrics.map((entry: any, index: number) => <Cell key={index} fill={entry.score <= 4.0 ? '#000000' : '#B81547'} />)}
                      <LabelList dataKey="score" position="right" style={{ fill: '#000', fontWeight: 900, fontSize: '14px' }} offset={10} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl shadow-black/5">
                  <div className="flex items-center gap-4 mb-10 text-brand">
                    <Star className="w-8 h-8" />
                    <h4 className="text-2xl font-black uppercase tracking-tighter">Silné stránky</h4>
                  </div>
                  <div className="space-y-4">
                    {top.map((m, i) => (
                      <div key={i} className="p-6 rounded-3xl flex justify-between items-center bg-brand text-white shadow-lg shadow-brand/10">
                        <span className="font-bold text-xs pr-4 leading-tight">{m.category}</span>
                        <span className="text-3xl font-black">{m.score.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
               </div>
               
               <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl shadow-black/5">
                  <div className="flex items-center gap-4 mb-10 text-black">
                    <Target className="w-8 h-8" />
                    <h4 className="text-2xl font-black uppercase tracking-tighter">Príležitosti</h4>
                  </div>
                  <div className="space-y-4">
                    {bottom.length > 0 ? bottom.map((m, i) => (
                      <div key={i} className="p-6 rounded-3xl flex justify-between items-center bg-black text-white">
                        <span className="font-bold text-xs pr-4 leading-tight">{m.category}</span>
                        <span className="text-3xl font-black text-brand">{m.score.toFixed(2)}</span>
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

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      <div className="bg-white rounded-[2.5rem] border border-black/5 p-8 shadow-2xl shadow-black/5 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center shadow-xl shadow-brand/20"><ClipboardCheck className="text-white w-8 h-8" /></div>
           <div>
             <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">{data.clientName || "Report"}</h1>
             <p className="text-black/40 font-bold uppercase tracking-widest text-[10px] mt-2">Dátum: {result.reportMetadata?.date || '2024'}</p>
           </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* TLAČIDLÁ SA ZOBRAZIA LEN AK NIE SME V ZDIEĽANOM ODKAZE */}
          {!isSharedView && (
            <>
              <button 
                onClick={generateShareLink}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all text-[10px] uppercase tracking-widest shadow-lg ${
                  copyStatus 
                    ? 'bg-green-600 text-white scale-105' 
                    : 'bg-white border-2 border-brand text-brand hover:bg-brand hover:text-white'
                }`}
              >
                {copyStatus ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                {copyStatus ? 'Odkaz skopírovaný!' : 'Zdieľať odkaz'}
              </button>

              <button 
                onClick={exportToJson}
                className="flex items-center gap-2 px-6 py-3 bg-brand text-white hover:bg-brand/90 rounded-full font-bold transition-all text-[10px] uppercase tracking-widest shadow-lg shadow-brand/20"
              >
                <Download className="w-4 h-4" /> Exportovať JSON
              </button>
            </>
          )}

          <button 
            onClick={onReset} 
            className="flex items-center gap-2 px-6 py-3 bg-black/5 hover:bg-black hover:text-white rounded-full font-bold transition-all text-[10px] uppercase tracking-widest border border-black/5"
          >
            <RefreshCw className="w-4 h-4" /> {isSharedView ? 'Zavrieť report' : 'Reset'}
          </button>
        </div>
      </div>

      <div className="flex bg-black/5 p-2 rounded-3xl w-full max-w-5xl mx-auto border border-black/5 shadow-inner overflow-x-auto no-scrollbar">
        {[
          { id: 'ENGAGEMENT', icon: Users, label: 'Zapojenie' },
          { id: 'card1', icon: BarChart4, label: data.card1?.title || 'Karta 1' },
          { id: 'card2', icon: UserCheck, label: data.card2?.title || 'Karta 2' },
          { id: 'card3', icon: Users, label: data.card3?.title || 'Karta 3' },
          { id: 'card4', icon: Building2, label: data.card4?.title || 'Karta 4' }
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as TabType)} className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-white text-black shadow-lg' : 'text-black/40 hover:text-black'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'ENGAGEMENT' && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-black text-white p-8 rounded-[2.5rem] shadow-xl">
               <span className="block text-[10px] font-black uppercase opacity-50 mb-1">Rozoslaných</span>
               <span className="text-5xl font-black tracking-tighter">{data.totalSent || 0}</span>
            </div>
            <div className="bg-brand text-white p-8 rounded-[2.5rem] shadow-xl">
               <span className="block text-[10px] font-black uppercase opacity-60 mb-1">Vyplnených</span>
               <span className="text-5xl font-black tracking-tighter">{data.totalReceived || 0}</span>
            </div>
            <div className="bg-white border border-black/5 p-8 rounded-[2.5rem] shadow-xl">
               <span className="block text-[10px] font-black uppercase text-black/40 mb-1">Návratnosť</span>
               <span className="text-5xl font-black text-black tracking-tighter">{data.successRate || '0%'}</span>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
              <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">Štruktúra stredísk</h3>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/20" />
                <input type="text" placeholder="Hľadať..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-black/5 rounded-2xl font-bold text-xs outline-none" />
              </div>
            </div>
            <div className="overflow-hidden rounded-3xl border border-black/5">
              <table className="w-full text-left">
                <thead className="bg-[#fcfcfc] text-[11px] font-black uppercase tracking-widest text-black/40 border-b border-black/5">
                  <tr>
                    <th className="p-6 cursor-pointer" onClick={() => handleSort('name')}>Stredisko</th>
                    <th className="p-6 text-center cursor-pointer" onClick={() => handleSort('count')}>Počet</th>
                    <th className="p-6 text-center">Podiel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 font-black text-xs">
                  {filteredEngagement.map((team: any, idx: number) => (
                    <tr key={idx} className={`hover:bg-brand/5 transition-colors group ${team.name.toLowerCase().includes('priemer') ? 'bg-brand/5 text-brand' : ''}`}>
                      <td className="p-6 group-hover:text-brand">{team.name}</td>
                      <td className="p-6 text-center">{team.count}</td>
                      <td className="p-6">
                        <div className="flex items-center justify-center gap-4">
                          <div className="w-32 bg-black/5 h-2 rounded-full overflow-hidden">
                            <div className="h-full bg-brand" style={{ width: `${(team.count / data.totalReceived) * 100}%` }} />
                          </div>
                          <span className="text-brand text-[10px]">{((team.count / data.totalReceived) * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'card1' && renderSection('card1')}
      {activeTab === 'card2' && renderSection('card2')}
      {activeTab === 'card3' && renderSection('card3')}
      {activeTab === 'card4' && renderSection('card4')}
    </div>
  );
};

export default SatisfactionDashboard;
