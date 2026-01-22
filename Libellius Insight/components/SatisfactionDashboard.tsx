import React, { useState, useMemo, useEffect } from 'react';
import { FeedbackAnalysisResult, TeamWorkSituation } from '../types';
import TeamSelectorGrid from './satisfaction/TeamSelectorGrid';
import ComparisonMatrix from './satisfaction/ComparisonMatrix';
import { 
  RefreshCw, Users, Mail, CheckCircle2, Percent, Search, 
  BarChart4, ClipboardCheck, MapPin, UserCheck,
  Building2, Star, Target, SearchX, ArrowUpDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

type TabType = 'ENGAGEMENT' | 'card1' | 'card2' | 'card3' | 'card4';
type ViewMode = 'DETAIL' | 'COMPARISON';

const SatisfactionDashboard: React.FC<Props> = ({ result, onReset }) => {
  const data = result.satisfaction;
  if (!data) return null;

  const scaleMax = result.reportMetadata?.scaleMax || 6;
  const [activeTab, setActiveTab] = useState<TabType>('ENGAGEMENT');
  const [viewMode, setViewMode] = useState<ViewMode>('DETAIL');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedTeams, setSelectedTeams] = useState<Record<string, string>>({
    card1: '', card2: '', card3: '', card4: ''
  });

  const [comparisonSelection, setComparisonSelection] = useState<Record<string, string[]>>({
    card1: [], card2: [], card3: [], card4: []
  });

  const masterTeams = useMemo(() => {
    return (data.teamEngagement || [])
      .map(t => t.name)
      .filter(name => name && name.trim() !== "")
      .sort((a, b) => a === 'Priemer' ? -1 : b === 'Priemer' ? 1 : a.localeCompare(b));
  }, [data]);

  useEffect(() => {
    if (masterTeams.length > 0 && !selectedTeams.card1) {
      const initial = masterTeams.includes('Priemer') ? 'Priemer' : masterTeams[0];
      setSelectedTeams({ card1: initial, card2: initial, card3: initial, card4: initial });
    }
  }, [masterTeams]);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 400);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const getActiveData = (tab: 'card1' | 'card2' | 'card3' | 'card4', teamName: string) => {
    const card = data[tab];
    const team = card?.teams.find(t => t.teamName === teamName) || card?.teams[0];
    return team ? [...team.metrics].sort((a, b) => b.score - a.score) : [];
  };

  const renderSection = (tab: 'card1' | 'card2' | 'card3' | 'card4') => {
    const card = data[tab];
    if (!card) return null;
    const teamValue = selectedTeams[tab];
    const activeMetrics = getActiveData(tab, teamValue);

    return (
      <div className="space-y-10 animate-fade-in">
        <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase tracking-tighter">{card.title}</h2>
              <div className="flex bg-black/5 p-1 rounded-xl w-fit">
                <button onClick={() => setViewMode('DETAIL')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase ${viewMode === 'DETAIL' ? 'bg-white shadow-sm' : 'opacity-30'}`}>Detail</button>
                <button onClick={() => setViewMode('COMPARISON')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase ${viewMode === 'COMPARISON' ? 'bg-white shadow-sm' : 'opacity-30'}`}>Porovnanie</button>
              </div>
            </div>
            {viewMode === 'DETAIL' && (
              <select value={teamValue} onChange={(e) => setSelectedTeams({...selectedTeams, [tab]: e.target.value})} className="p-5 bg-black text-white rounded-2xl font-black text-sm outline-none">
                {masterTeams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
        </div>

        {viewMode === 'DETAIL' ? (
          <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl">
             <div className="h-[500px] w-full">
                <ResponsiveContainer>
                  <BarChart data={activeMetrics} layout="vertical" margin={{ left: 20, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#00000008" />
                    <XAxis type="number" domain={[0, scaleMax]} hide />
                    <YAxis dataKey="category" type="category" width={250} tick={{ fontSize: 10, fontWeight: 800 }} />
                    <Tooltip />
                    <Bar dataKey="score" radius={[0, 10, 10, 0]} barSize={20}>
                      {activeMetrics.map((e: any, i: number) => <Cell key={i} fill={e.score <= 4 ? '#000' : '#B81547'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
        ) : (
          <ComparisonMatrix teams={comparisonSelection[tab]} matrixData={[]} /> 
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl flex justify-between items-center">
        <h1 className="text-3xl font-black uppercase">{data.clientName}</h1>
        <button onClick={onReset} className="px-6 py-3 bg-black text-white rounded-full font-bold text-xs uppercase tracking-widest">Nový súbor</button>
      </div>

      <div className="flex bg-black/5 p-2 rounded-3xl gap-2 overflow-x-auto">
        <button onClick={() => setActiveTab('ENGAGEMENT')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase ${activeTab === 'ENGAGEMENT' ? 'bg-white shadow-md' : 'opacity-40'}`}>Zapojenie</button>
        {['card1', 'card2', 'card3', 'card4'].map((c) => (
          <button key={c} onClick={() => setActiveTab(c as TabType)} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase ${activeTab === c ? 'bg-white shadow-md' : 'opacity-40'}`}>
            {data[c as keyof typeof data]?.title || c}
          </button>
        ))}
      </div>

      {activeTab === 'ENGAGEMENT' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-6 text-white">
            <div className="bg-black p-8 rounded-[2rem]"><span className="block opacity-50 text-[10px] font-black uppercase">Odoslané</span><span className="text-4xl font-black">{data.totalSent}</span></div>
            <div className="bg-brand p-8 rounded-[2rem]"><span className="block opacity-50 text-[10px] font-black uppercase">Prijaté</span><span className="text-4xl font-black">{data.totalReceived}</span></div>
            <div className="bg-white text-black border p-8 rounded-[2rem]"><span className="block opacity-50 text-[10px] font-black uppercase">Úspešnosť</span><span className="text-4xl font-black">{data.successRate}</span></div>
          </div>
          <div className="bg-white p-10 rounded-[2.5rem] border shadow-xl">
            <table className="w-full">
              <thead className="text-[10px] font-black uppercase opacity-30 border-b">
                <tr><th className="p-4 text-left">Stredisko</th><th className="p-4 text-center">Počet</th></tr>
              </thead>
              <tbody className="text-xs font-black">
                {data.teamEngagement.map((t, i) => (
                  <tr key={i} className={`border-b ${t.name === 'Priemer' ? 'bg-brand/5 text-brand' : ''}`}>
                    <td className="p-4">{t.name}</td>
                    <td className="p-4 text-center">{t.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab !== 'ENGAGEMENT' && renderSection(activeTab as any)}
    </div>
  );
};

export default SatisfactionDashboard;
