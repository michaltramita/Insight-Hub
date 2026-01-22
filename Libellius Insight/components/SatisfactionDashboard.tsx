import React, { useState, useMemo, useEffect } from 'react';
import { FeedbackAnalysisResult } from '../types';
import TeamSelectorGrid from './satisfaction/TeamSelectorGrid';
import ComparisonMatrix from './satisfaction/ComparisonMatrix';
import LZString from 'lz-string'; 
import { 
  RefreshCw, Search, BarChart4, ClipboardCheck, MapPin, UserCheck,
  Building2, Star, Target, Download, Link as LinkIcon, Check, SearchX
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

// Typy pre vnútro komponentu
type TabType = 'ENGAGEMENT' | 'card1' | 'card2' | 'card3' | 'card4';
type ViewMode = 'DETAIL' | 'COMPARISON';
type SortKey = 'count' | 'name';
type SortDirection = 'asc' | 'desc' | null;

const SatisfactionDashboard: React.FC<Props> = ({ result, onReset }) => {
  // --- OPRAVA NACÍTANIA DÁT (FALLBACK) ---
  const data = useMemo(() => {
    // 1. Skúsime nový formát (z Gemini)
    if (result.satisfaction) return result.satisfaction;
    // 2. Skúsime starý formát (kde bol JSON priamo objektom spokojnosti)
    if ((result as any).card1) return result as any;
    return null;
  }, [result]);

  const scaleMax = result.reportMetadata?.scaleMax || (data as any)?.reportMetadata?.scaleMax || 6;
  const [activeTab, setActiveTab] = useState<TabType>('ENGAGEMENT');
  const [viewMode, setViewMode] = useState<ViewMode>('DETAIL');
  const [copyStatus, setCopyStatus] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const [selectedTeams, setSelectedTeams] = useState<Record<string, string>>({
    card1: '', card2: '', card3: '', card4: ''
  });

  const [comparisonSelection, setComparisonSelection] = useState<Record<string, string[]>>({
    card1: [], card2: [], card3: [], card4: []
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Funkcia na generovanie Magic Linku
  const generateShareLink = () => {
    try {
      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(result));
      const shareUrl = `${window.location.origin}${window.location.pathname}#report=${compressed}`;
      navigator.clipboard.writeText(shareUrl);
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 3000);
    } catch (err) {
      alert("Nepodarilo sa skopírovať odkaz.");
    }
  };

  // Zoznam tímov
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

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[3rem] border-2 border-dashed border-black/10">
        <SearchX className="w-16 h-16 text-black/20 mb-4" />
        <h2 className="text-2xl font-black uppercase tracking-tighter">Dáta nenájdené</h2>
        <button onClick={onReset} className="mt-6 px-8 py-3 bg-black text-white rounded-full font-bold uppercase text-[10px]">Späť</button>
      </div>
    );
  }

  // --- POMOCNÉ FUNKCIE PRE SEKCIU ---
  const getActiveData = (tab: 'card1' | 'card2' | 'card3' | 'card4', teamName: string) => {
    const card = data[tab];
    if (!card) return [];
    const team = card.teams.find((t: any) => t.teamName === teamName) || card.teams[0];
    return team ? [...team.metrics].sort((a, b) => b.score - a.score) : [];
  };

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      {/* HEADER */}
      <div className="bg-white rounded-[2.5rem] border border-black/5 p-8 shadow-2xl shadow-black/5 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center shadow-xl shadow-brand/20">
             <ClipboardCheck className="text-white w-8 h-8" />
           </div>
           <div>
             <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">{data.clientName || "Report"}</h1>
             <p className="text-black/40 font-bold uppercase tracking-widest text-[10px] mt-2">Dátum: {result.reportMetadata?.date || 'Neuvedený'}</p>
           </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={generateShareLink}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all text-[10px] uppercase tracking-widest shadow-lg ${
              copyStatus ? 'bg-green-500 text-white' : 'bg-white border-2 border-brand text-brand hover:bg-brand hover:text-white'
            }`}
          >
            {copyStatus ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
            {copyStatus ? 'Skopírované!' : 'Zdieľať odkaz'}
          </button>

          <button 
            onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result));
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.setAttribute("href", dataStr);
              downloadAnchorNode.setAttribute("download", `${data.clientName || 'report'}_export.json`);
              downloadAnchorNode.click();
            }}
            className="flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-full font-bold text-[10px] uppercase tracking-widest"
          >
            <Download className="w-4 h-4" /> JSON
          </button>
          
          <button onClick={onReset} className="px-6 py-3 bg-black/5 hover:bg-black hover:text-white rounded-full font-bold text-[10px] uppercase tracking-widest transition-all">
            Reset
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex bg-black/5 p-2 rounded-3xl w-full max-w-5xl mx-auto overflow-x-auto no-scrollbar">
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

      {/* OBSAH SEKCIÍ (Grafy sa vyrenderujú tu) */}
      {activeTab === 'ENGAGEMENT' ? (
        <div className="animate-fade-in space-y-10">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-black text-white p-8 rounded-[2.5rem]">
                <span className="block text-[10px] font-black uppercase opacity-50">Rozoslaných</span>
                <span className="text-5xl font-black tracking-tighter">{data.totalSent}</span>
              </div>
              <div className="bg-brand text-white p-8 rounded-[2.5rem]">
                <span className="block text-[10px] font-black uppercase opacity-50">Vyplnených</span>
                <span className="text-5xl font-black tracking-tighter">{data.totalReceived}</span>
              </div>
              <div className="bg-white border border-black/5 p-8 rounded-[2.5rem]">
                <span className="block text-[10px] font-black uppercase text-black/40">Návratnosť</span>
                <span className="text-5xl font-black tracking-tighter">{data.successRate}</span>
              </div>
           </div>
        </div>
      ) : (
        <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-3xl font-black uppercase tracking-tighter">{data[activeTab]?.title}</h2>
            <select 
              value={selectedTeams[activeTab as keyof typeof selectedTeams]} 
              onChange={(e) => setSelectedTeams({...selectedTeams, [activeTab]: e.target.value})} 
              className="p-4 bg-black text-white rounded-2xl font-black text-xs outline-none"
            >
              {masterTeams.map((t: string) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          
          <div className="h-[600px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getActiveData(activeTab as any, selectedTeams[activeTab as keyof typeof selectedTeams])} layout="vertical" margin={{ left: 40, right: 80 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#00000008" />
                <XAxis type="number" domain={[0, scaleMax]} hide />
                <YAxis dataKey="category" type="category" width={380} tick={{ fontSize: 14, fontWeight: 900, fill: '#000' }} interval={0} />
                <Tooltip />
                <Bar dataKey="score" radius={[0, 10, 10, 0]} barSize={30}>
                  {getActiveData(activeTab as any, selectedTeams[activeTab as keyof typeof selectedTeams]).map((entry: any, index: number) => (
                    <Cell key={index} fill={entry.score <= 4.0 ? '#000' : '#B81547'} />
                  ))}
                  <LabelList dataKey="score" position="right" style={{ fontWeight: 900, fontSize: '14px' }} offset={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default SatisfactionDashboard;
