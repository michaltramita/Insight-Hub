import React, { useState, useMemo, useEffect } from 'react';
import { FeedbackAnalysisResult, TeamWorkSituation } from '../types';
import TeamSelectorGrid from './satisfaction/TeamSelectorGrid';
import ComparisonMatrix from './satisfaction/ComparisonMatrix';
import { 
  RefreshCw, Users, Mail, CheckCircle2, Percent, Search, 
  BarChart4, ClipboardCheck, MapPin, UserCheck,
  Building2, Star, Target, SearchX
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

type TabType = 'ENGAGEMENT' | 'card1' | 'card2' | 'card3' | 'card4';

const SatisfactionDashboard: React.FC<Props> = ({ result, onReset }) => {
  const data = result.satisfaction;
  if (!data) return null;

  const [activeTab, setActiveTab] = useState<TabType>('ENGAGEMENT');
  const [selectedTeams, setSelectedTeams] = useState<Record<string, string>>({
    card1: '', card2: '', card3: '', card4: ''
  });

  const masterTeams = useMemo(() => {
    return (data.teamEngagement || [])
      .map(t => t.name)
      .filter(n => n && n.trim() !== "")
      .sort((a, b) => a === 'Priemer' ? -1 : b === 'Priemer' ? 1 : a.localeCompare(b));
  }, [data]);

  useEffect(() => {
    if (masterTeams.length > 0 && !selectedTeams.card1) {
      const init = masterTeams.includes('Priemer') ? 'Priemer' : masterTeams[0];
      setSelectedTeams({ card1: init, card2: init, card3: init, card4: init });
    }
  }, [masterTeams]);

  const renderSection = (cardId: 'card1' | 'card2' | 'card3' | 'card4') => {
    const card = data[cardId];
    if (!card) return null;
    const teamName = selectedTeams[cardId];
    const metrics = card.teams.find(t => t.teamName === teamName)?.metrics || [];

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border flex justify-between items-center">
          <h2 className="text-2xl font-black uppercase">{card.title}</h2>
          <select 
            value={teamName} 
            onChange={(e) => setSelectedTeams({...selectedTeams, [cardId]: e.target.value})}
            className="p-3 bg-black text-white rounded-xl font-bold text-sm"
          >
            {masterTeams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border h-[500px]">
          <ResponsiveContainer>
            <BarChart data={metrics} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, result.reportMetadata.scaleMax]} hide />
              <YAxis dataKey="category" type="category" width={200} tick={{fontSize: 10, fontWeight: 700}} />
              <Tooltip />
              <Bar dataKey="score" radius={[0, 10, 10, 0]} barSize={20}>
                {metrics.map((e, i) => <Cell key={i} fill={e.score <= 4 ? '#000' : '#B81547'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-8">
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border">
        <h1 className="text-2xl font-black uppercase tracking-tighter">{data.clientName}</h1>
        <button onClick={onReset} className="p-3 bg-black/5 rounded-full hover:bg-black hover:text-white transition-all"><RefreshCw size={20}/></button>
      </div>

      <div className="flex bg-black/5 p-2 rounded-2xl gap-2">
        <button onClick={() => setActiveTab('ENGAGEMENT')} className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase ${activeTab === 'ENGAGEMENT' ? 'bg-white shadow-sm' : 'opacity-40'}`}>Zapojenie</button>
        {['card1', 'card2', 'card3', 'card4'].map(c => (
          <button key={c} onClick={() => setActiveTab(c as TabType)} className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase ${activeTab === c ? 'bg-white shadow-sm' : 'opacity-40'}`}>
            {data[c as keyof typeof data]?.title || c}
          </button>
        ))}
      </div>

      {activeTab === 'ENGAGEMENT' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black text-white p-8 rounded-[2rem]">
            <span className="text-[10px] uppercase font-bold opacity-50">Odoslané</span>
            <div className="text-4xl font-black">{data.totalSent}</div>
          </div>
          <div className="bg-brand text-white p-8 rounded-[2rem]">
            <span className="text-[10px] uppercase font-bold opacity-50">Prijaté</span>
            <div className="text-4xl font-black">{data.totalReceived}</div>
          </div>
          <div className="bg-white border p-8 rounded-[2rem]">
            <span className="text-[10px] uppercase font-bold opacity-30">Úspešnosť</span>
            <div className="text-4xl font-black">{data.successRate}</div>
          </div>
        </div>
      ) : renderSection(activeTab as any)}
    </div>
  );
};

export default SatisfactionDashboard;
