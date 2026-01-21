import React, { useState, useMemo, useEffect } from 'react';
import { FeedbackAnalysisResult, EngagementTeam, TeamWorkSituation } from '../types';
import TeamSelectorGrid from './satisfaction/TeamSelectorGrid';
import ComparisonMatrix from './satisfaction/ComparisonMatrix';
import { 
  RefreshCw, Users, Mail, CheckCircle2, Percent, Search, 
  Check, BarChart4, ClipboardCheck, MapPin, UserCheck,
  AlertCircle, Building2, Filter, Star, Target, SearchX, ArrowUpDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

type TabType = 'ENGAGEMENT' | 'WORK_SITUATION' | 'SUPERVISOR' | 'WORK_TEAM' | 'COMPANY_SITUATION';
type ViewMode = 'DETAIL' | 'COMPARISON';
type SortKey = 'count' | 'weight' | 'name';
type SortDirection = 'asc' | 'desc' | null;

const SatisfactionDashboard: React.FC<Props> = ({ result, onReset }) => {
  const data = result.satisfaction;
  const scaleMax = result.reportMetadata?.scaleMax || 6;
  
  const [activeTab, setActiveTab] = useState<TabType>('ENGAGEMENT');
  const [viewMode, setViewMode] = useState<ViewMode>('DETAIL');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [selectedWorkTeam, setSelectedWorkTeam] = useState<string>('');
  const [selectedSupervisorTeam, setSelectedSupervisorTeam] = useState<string>('');
  const [selectedWorkTeamTeam, setSelectedWorkTeamTeam] = useState<string>('');
  const [selectedCompanyTeam, setSelectedCompanyTeam] = useState<string>('');

  const [compWork, setCompWork] = useState<string[]>([]);
  const [compSup, setCompSup] = useState<string[]>([]);
  const [compWorkTeam, setCompWorkTeam] = useState<string[]>([]);
  const [compCompany, setCompCompany] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeamNames, setSelectedTeamNames] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const masterTeams = useMemo(() => {
    if (!data?.teamEngagement) return [];
    return data.teamEngagement
      .map(t => t.name)
      .filter(name => name && !['Celkový priemer', 'Priemer', 'total'].includes(name.toLowerCase()))
      .sort();
  }, [data]);

  const availableTeams = masterTeams;

  useEffect(() => {
    if (availableTeams.length > 0 && !selectedWorkTeam) {
      setSelectedWorkTeam(availableTeams[0]);
      setSelectedSupervisorTeam(availableTeams[0]);
      setSelectedWorkTeamTeam(availableTeams[0]);
      setSelectedCompanyTeam(availableTeams[0]);
      setSelectedTeamNames(availableTeams);
    }
  }, [availableTeams]);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 400);
    return () => clearTimeout(timer);
  }, [activeTab, viewMode]);

  if (!data) return null;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDirection === 'desc') setSortDirection('asc');
      else if (sortDirection === 'asc') {
        setSortDirection(null);
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const normalizeText = (text: string) => {
    if (!text) return "";
    return text.toLowerCase()
      .replace(/\n/g, ' ') // Odstránenie zalomení riadkov
      .trim()
      .replace(/\s+/g, ' ') // Zjednotenie medzier
      .replace(/[.:]$/, ''); // Odstránenie bodiek/dvojbodiek na konci
  };

  const findTeamData = (list: TeamWorkSituation[], targetName: string) => {
    const normTarget = normalizeText(targetName);
    
    // 1. Presná zhoda
    let found = list.find(t => normalizeText(t.teamName) === normTarget);
    
    // 2. Fuzzy zhoda (ak je Master názov obsiahnutý v extrahovanom názve alebo naopak)
    if (!found) {
      found = list.find(t => {
        const normT = normalizeText(t.teamName);
        return normT.includes(normTarget) || normTarget.includes(normT);
      });
    }
    
    return found;
  };

  const getActiveData = (source: TabType, teamName: string) => {
    let list: TeamWorkSituation[] = [];
    if (source === 'WORK_SITUATION') list = data.workSituationByTeam || [];
    else if (source === 'SUPERVISOR') list = data.supervisorByTeam || [];
    else if (source === 'WORK_TEAM') list = data.workTeamByTeam || [];
    else if (source === 'COMPANY_SITUATION') list = data.companySituationByTeam || [];

    const team = findTeamData(list, teamName) || list[0];
    return team ? [...team.metrics].sort((a, b) => b.score - a.score) : [];
  };

  const getComparisonData = (source: TabType, selectedTeams: string[]) => {
    let list: TeamWorkSituation[] = [];
    if (source === 'WORK_SITUATION') list = data.workSituationByTeam || [];
    else if (source === 'SUPERVISOR') list = data.supervisorByTeam || [];
    else if (source === 'WORK_TEAM') list = data.workTeamByTeam || [];
    else if (source === 'COMPANY_SITUATION') list = data.companySituationByTeam || [];

    const categories = Array.from(new Set(list.flatMap(t => t.metrics.map(m => m.category))));
    
    return categories.map(cat => {
      const row: any = { category: cat };
      const normalizedCat = normalizeText(cat);

      selectedTeams.forEach(tName => {
        const team = findTeamData(list, tName);
        if (team) {
          const metric = team.metrics.find(m => normalizeText(m.category) === normalizedCat);
          row[tName] = metric?.score || 0;
        } else {
          row[tName] = 0;
        }
      });
      return row;
    });
  };

  const filteredEngagement = useMemo(() => {
    let teams = [...(data.teamEngagement || [])].filter(t => 
      selectedTeamNames.includes(t.name) && t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortKey && sortDirection) {
      teams.sort((a, b) => {
        let valA: any, valB: any;
        if (sortKey === 'count' || sortKey === 'weight') {
          valA = a.count;
          valB = b.count;
        } else {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return teams;
  }, [data.teamEngagement, selectedTeamNames, searchTerm, sortKey, sortDirection]);

  const renderSection = (title: string, tab: TabType, teamValue: string, setTeamValue: (v: string) => void, compTeams: string[], setCompTeams: (v: string[]) => void) => {
    const activeMetrics = getActiveData(tab, teamValue);
    const top = activeMetrics.slice(0, 3);
    const bottom = [...activeMetrics].filter(m => m.score > 0 && m.score < 4.0).sort((a, b) => a.score - b.score).slice(0, 3);

    return (
      <div className="space-y-10 animate-fade-in">
        <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl shadow-black/5">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/5 rounded-full text-[10px] font-black uppercase text-brand tracking-widest"><MapPin className="w-3 h-3" /> Konfigurácia reportu</div>
              <h2 className="text-3xl font-black uppercase tracking-tighter leading-tight">{title}</h2>
              <div className="flex bg-black/5 p-1 rounded-xl w-fit">
                <button onClick={() => setViewMode('DETAIL')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'DETAIL' ? 'bg-white text-black shadow-sm' : 'text-black/30'}`}>Detail tímu</button>
                <button onClick={() => setViewMode('COMPARISON')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'COMPARISON' ? 'bg-white text-black shadow-sm' : 'text-black/30'}`}>Porovnanie tímov</button>
              </div>
            </div>
            {viewMode === 'DETAIL' && (
              <div className="w-full lg:w-96">
                <label className="block text-[10px] font-black uppercase tracking-widest text-black/30 mb-2 ml-2">Vyberte stredisko:</label>
                <select value={teamValue} onChange={(e) => setTeamValue(e.target.value)} className="w-full p-5 bg-black text-white rounded-2xl font-black text-sm outline-none shadow-xl cursor-pointer">
                  {availableTeams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>
          {viewMode === 'COMPARISON' && (
            <TeamSelectorGrid 
              availableTeams={availableTeams} 
              selectedTeams={compTeams} 
              onToggleTeam={(t) => setCompTeams(compTeams.includes(t) ? compTeams.filter(x => x !== t) : [...compTeams, t])}
              onClear={() => setCompTeams([])}
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
                    <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest mt-2">Kvantitatívny profil</p>
                  </div>
                </div>
                <div className="px-6 py-3 bg-black text-white text-[10px] font-black rounded-full uppercase tracking-widest">Škála 1-{scaleMax}</div>
              </div>
              <div className="h-[600px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeMetrics} layout="vertical" margin={{ left: 20, right: 60, bottom: 20, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#00000008" />
                    <XAxis type="number" domain={[0, scaleMax]} hide />
                    <YAxis dataKey="category" type="category" width={350} tick={{ fontSize: 11, fill: '#000', fontWeight: 900 }} interval={0} tickFormatter={(v) => v.length > 50 ? `${v.substring(0, 50)}...` : v} />
                    <Tooltip cursor={{ fill: '#00000005' }} contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px rgba(0,0,0,0.1)', padding: '1.5rem' }} />
                    <Bar dataKey="score" radius={[0, 16, 16, 0]} barSize={28}>
                      {activeMetrics.map((entry: any, index: number) => <Cell key={index} fill={entry.score <= 4.0 ? '#000000' : '#B81547'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl shadow-black/5">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 bg-brand/5 rounded-xl"><Star className="w-8 h-8 text-brand" /></div>
                    <h4 className="text-2xl font-black uppercase tracking-tighter">NAJLEPŠIE HODNOTENÉ</h4>
                  </div>
                  <div className="space-y-4">
                    {top.map((m, i) => (
                      <div key={i} className="p-8 rounded-[2rem] flex justify-between items-center transition-all duration-500 shadow-sm bg-brand text-white">
                        <span className="font-bold text-sm pr-6 leading-tight max-w-[70%]">{m.category}</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black text-white">{m.score.toFixed(2)}</span>
                          <span className="text-[10px] font-black opacity-40">/ {scaleMax}</span>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
               
               <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl shadow-black/5">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 bg-brand/5 rounded-xl"><Target className="w-8 h-8 text-brand" /></div>
                    <h4 className="text-2xl font-black uppercase tracking-tighter">KRITICKÉ MIESTA</h4>
                  </div>
                  <div className="space-y-4">
                    {bottom.length > 0 ? (
                      bottom.map((m, i) => (
                        <div key={i} className="p-8 rounded-[2rem] flex justify-between items-center transition-all duration-500 shadow-sm bg-black text-white">
                          <span className="font-bold text-sm pr-6 leading-tight max-w-[70%]">{m.category}</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-brand">{m.score.toFixed(2)}</span>
                            <span className="text-[10px] font-black opacity-30">/ {scaleMax}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center border-2 border-dashed border-black/5 rounded-[2.5rem]">
                        <p className="text-[11px] font-black uppercase tracking-widest text-black/20 leading-relaxed">
                          Nenašli sa žiadne tvrdenia<br/>pod hodnotou 4.0
                        </p>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <ComparisonMatrix teams={compTeams} matrixData={getComparisonData(tab, compTeams)} />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      {/* Report Header */}
      <div className="bg-white rounded-[2.5rem] border border-black/5 p-8 shadow-2xl shadow-black/5 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center shadow-xl shadow-brand/20"><ClipboardCheck className="text-white w-8 h-8" /></div>
           <div>
             <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">{data.clientName || "Report Spokojnosti"}</h1>
             <p className="text-black/40 font-bold uppercase tracking-widest text-[10px] mt-2">Dátum merania: {result.reportMetadata?.date || "Neznámy"}</p>
           </div>
        </div>
        <button onClick={onReset} className="flex items-center gap-2 px-6 py-3 bg-black/5 hover:bg-black hover:text-white rounded-full font-bold transition-all text-[10px] uppercase tracking-widest border border-black/5"><RefreshCw className="w-4 h-4" /> Nový súbor</button>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex bg-black/5 p-2 rounded-3xl w-full max-w-5xl mx-auto border border-black/5 shadow-inner overflow-x-auto no-scrollbar">
        {[
          { id: 'ENGAGEMENT', icon: Users, label: 'Zapojenie' },
          { id: 'WORK_SITUATION', icon: BarChart4, label: 'Prac. situácia' },
          { id: 'SUPERVISOR', icon: UserCheck, label: 'Nadriadený' },
          { id: 'WORK_TEAM', icon: Users, label: 'Prac. tím' },
          { id: 'COMPANY_SITUATION', icon: Building2, label: 'Firma' }
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as TabType)} className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-white text-black shadow-lg' : 'text-black/40 hover:text-black'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Engagement Tab Content */}
      {activeTab === 'ENGAGEMENT' && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-black text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
               <Mail className="absolute -bottom-4 -right-4 w-24 h-24 opacity-10 group-hover:scale-110 transition-transform duration-500" />
               <span className="block text-[10px] font-black uppercase opacity-50 mb-1">Odoslaných dotazníkov</span>
               <span className="text-5xl font-black tracking-tighter">{data.totalSent}</span>
            </div>
            <div className="bg-brand text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
               <CheckCircle2 className="absolute -bottom-4 -right-4 w-24 h-24 opacity-10 group-hover:scale-110 transition-transform duration-500" />
               <span className="block text-[10px] font-black uppercase opacity-60 mb-1">Prijatých odpovedí</span>
               <span className="text-5xl font-black tracking-tighter">{data.totalReceived}</span>
            </div>
            <div className="bg-white border border-black/5 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
               <Percent className="absolute -bottom-4 -right-4 w-24 h-24 text-brand opacity-5 group-hover:scale-110 transition-transform duration-500" />
               <span className="block text-[10px] font-black uppercase text-black/40 mb-1">Globálna úspešnosť</span>
               <span className="text-5xl font-black text-black tracking-tighter">{data.successRate}</span>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">Štruktúra stredísk</h3>
                <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest mt-2">Zobrazených {filteredEngagement.length} z {data.teamEngagement.length} stredísk</p>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/20" />
                  <input type="text" placeholder="Hľadať stredisko..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-black/5 border-none rounded-2xl font-bold text-xs outline-none focus:ring-4 focus:ring-brand/20 transition-all" />
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-3xl border border-black/5">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#fcfcfc] text-[11px] font-black uppercase tracking-widest text-black/40">
                  <tr>
                    <th className="p-6 cursor-pointer hover:text-black transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">Názov strediska <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th className="p-6 text-center cursor-pointer hover:text-black transition-colors" onClick={() => handleSort('count')}>
                      <div className="flex items-center justify-center gap-1">Počet odpovedí <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th className="p-6 text-center cursor-pointer hover:text-black transition-colors" onClick={() => handleSort('weight')}>
                      <div className="flex items-center justify-center gap-1">Váha (Podiel) <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {filteredEngagement.length > 0 ? (
                    filteredEngagement.map((team, idx) => {
                      const weight = (team.count / (data.totalReceived || 1)) * 100;
                      return (
                        <tr key={idx} className="hover:bg-brand/5 transition-colors font-black text-xs group">
                          <td className="p-6 group-hover:text-brand transition-colors">{team.name}</td>
                          <td className="p-6 text-center"><span className="px-3 py-1 bg-black/5 rounded-lg text-base">{team.count}</span></td>
                          <td className="p-6">
                            <div className="flex items-center justify-center gap-4">
                              <div className="w-32 bg-black/5 h-2.5 rounded-full overflow-hidden shadow-inner">
                                <div className="h-full bg-brand transition-all duration-1000" style={{ width: `${Math.min(weight * 2, 100)}%` }} />
                              </div>
                              <span className="text-brand font-black text-[11px] w-10 text-right">{weight.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} className="p-20 text-center">
                        <SearchX className="w-12 h-12 mx-auto text-black/10 mb-4" />
                        <p className="font-black uppercase tracking-widest text-black/20 text-sm">Žiadne výsledky pre hľadanie</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Dynamics Tab Sections */}
      {activeTab === 'WORK_SITUATION' && renderSection("Pracovná situácia", "WORK_SITUATION", selectedWorkTeam, setSelectedWorkTeam, compWork, setCompWork)}
      {activeTab === 'SUPERVISOR' && renderSection("Priamy nadriadený", "SUPERVISOR", selectedSupervisorTeam, setSelectedSupervisorTeam, compSup, setCompSup)}
      {activeTab === 'WORK_TEAM' && renderSection("Pracovný tím", "WORK_TEAM", selectedWorkTeamTeam, setSelectedWorkTeamTeam, compWorkTeam, setCompWorkTeam)}
      {activeTab === 'COMPANY_SITUATION' && renderSection("Situácia vo firme", "COMPANY_SITUATION", selectedCompanyTeam, setSelectedCompanyTeam, compCompany, setCompCompany)}
    </div>
  );
};

export default SatisfactionDashboard;
