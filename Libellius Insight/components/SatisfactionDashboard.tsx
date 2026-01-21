import React, { useState, useMemo, useEffect } from 'react';
import { FeedbackAnalysisResult, EngagementTeam, TeamWorkSituation, SatisfactionCategory } from '../types';
// ... (vaše ostatné importy zostávajú rovnaké)

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

// ZMENA: TabType už nie je fixný enum, ale môže to byť 'ENGAGEMENT' alebo ID kategórie (index)
type ViewMode = 'DETAIL' | 'COMPARISON';
type SortKey = 'count' | 'weight' | 'name';
type SortDirection = 'asc' | 'desc' | null;

const SatisfactionDashboard: React.FC<Props> = ({ result, onReset }) => {
  const data = result.satisfaction;
  const scaleMax = result.reportMetadata?.scaleMax || 6;
  
  // --- DYNAMICKÉ STAVY ---
  const [activeTab, setActiveTab] = useState<string>('ENGAGEMENT');
  const [viewMode, setViewMode] = useState<ViewMode>('DETAIL');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ZMENA: Namiesto 4 rôznych stavov použijeme jeden objekt pre výber tímu v každej kategórii
  const [selectedTeams, setSelectedTeams] = useState<Record<string, string>>({});
  const [comparisonTeams, setComparisonTeams] = useState<Record<string, string[]>>({});

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

  // Inicializácia dynamických stavov pri načítaní dát
  useEffect(() => {
    if (masterTeams.length > 0 && data?.categories) {
      const initialSelected: Record<string, string> = {};
      const initialComp: Record<string, string[]> = {};
      
      data.categories.forEach((_, idx) => {
        initialSelected[idx] = masterTeams[0];
        initialComp[idx] = [];
      });
      
      setSelectedTeams(initialSelected);
      setComparisonTeams(initialComp);
      setSelectedTeamNames(masterTeams);
    }
  }, [masterTeams, data?.categories]);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 400);
    return () => clearTimeout(timer);
  }, [activeTab, viewMode]);

  if (!data) return null;

  // --- UNIVERZÁLNE POMOCNÉ FUNKCIE ---

  const findTeamData = (list: TeamWorkSituation[], targetName: string) => {
    const normTarget = targetName.toLowerCase().trim();
    let found = list.find(t => t.teamName.toLowerCase().trim() === normTarget);
    if (!found) {
      found = list.find(t => t.teamName.toLowerCase().includes(normTarget) || normTarget.includes(t.teamName.toLowerCase()));
    }
    return found;
  };

  const getActiveData = (categoryIndex: string, teamName: string) => {
    const category = data.categories[parseInt(categoryIndex)];
    if (!category) return [];
    const team = findTeamData(category.teams, teamName) || category.teams[0];
    return team ? [...team.metrics].sort((a, b) => b.score - a.score) : [];
  };

  const getComparisonData = (categoryIndex: string, selectedTeamsList: string[]) => {
    const category = data.categories[parseInt(categoryIndex)];
    if (!category) return [];
    const list = category.teams;
    const allCategories = Array.from(new Set(list.flatMap(t => t.metrics.map(m => m.category))));
    
    return allCategories.map(cat => {
      const row: any = { category: cat };
      selectedTeamsList.forEach(tName => {
        const team = findTeamData(list, tName);
        const metric = team?.metrics.find(m => m.category === cat);
        row[tName] = metric?.score || 0;
      });
      return row;
    });
  };

  // --- RENDEROVANIE SEKCIE (Zostáva skoro rovnaké, len s dynamickými parametrami) ---
  const renderDynamicSection = (category: SatisfactionCategory, index: number) => {
    const catId = index.toString();
    const teamValue = selectedTeams[catId] || masterTeams[0];
    const compTeams = comparisonTeams[catId] || [];

    const activeMetrics = getActiveData(catId, teamValue);
    const top = activeMetrics.slice(0, 3);
    const bottom = [...activeMetrics].filter(m => m.score > 0 && m.score < 4.0).sort((a, b) => a.score - b.score).slice(0, 3);

    return (
      <div className="space-y-10 animate-fade-in">
        {/* Tu je váš pôvodný biely konfiguračný box, len upravený na dynamické settery */}
        <div className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-2xl">
           <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
             <div className="space-y-4">
                <h2 className="text-3xl font-black uppercase tracking-tighter">{category.categoryName}</h2>
                <div className="flex bg-black/5 p-1 rounded-xl w-fit">
                  <button onClick={() => setViewMode('DETAIL')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${viewMode === 'DETAIL' ? 'bg-white shadow-sm' : 'text-black/30'}`}>Detail</button>
                  <button onClick={() => setViewMode('COMPARISON')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${viewMode === 'COMPARISON' ? 'bg-white shadow-sm' : 'text-black/30'}`}>Porovnanie</button>
                </div>
             </div>
             {viewMode === 'DETAIL' && (
               <select 
                 value={teamValue} 
                 onChange={(e) => setSelectedTeams({...selectedTeams, [catId]: e.target.value})}
                 className="w-full lg:w-96 p-5 bg-black text-white rounded-2xl font-black text-sm"
               >
                 {masterTeams.map(t => <option key={t} value={t}>{t}</option>)}
               </select>
             )}
           </div>
           {viewMode === 'COMPARISON' && (
             <TeamSelectorGrid 
               availableTeams={masterTeams} 
               selectedTeams={compTeams} 
               onToggleTeam={(t) => {
                 const current = compTeams.includes(t) ? compTeams.filter(x => x !== t) : [...compTeams, t];
                 setComparisonTeams({...comparisonTeams, [catId]: current});
               }}
               onClear={() => setComparisonTeams({...comparisonTeams, [catId]: []})}
             />
           )}
        </div>

        {viewMode === 'DETAIL' ? (
           <div className={`space-y-14 transition-all duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
              {/* Tu ide váš kód pre graf a Top/Bottom karty (rovnaký ako predtým) */}
              {/* Použite premenné top, bottom, activeMetrics */}
              <div className="bg-white p-10 md:p-14 rounded-[2.5rem] border border-black/5 shadow-2xl">
                 <h3 className="text-2xl font-black uppercase mb-12">{teamValue}</h3>
                 <div className="h-[600px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeMetrics} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={[0, scaleMax]} hide />
                        <YAxis dataKey="category" type="category" width={300} tick={{fontSize: 10, fontWeight: 900}} />
                        <Tooltip />
                        <Bar dataKey="score" radius={[0, 10, 10, 0]} barSize={25}>
                           {activeMetrics.map((entry: any, i: number) => <Cell key={i} fill={entry.score < 4 ? '#000' : '#B81547'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
        ) : (
          <ComparisonMatrix teams={compTeams} matrixData={getComparisonData(catId, compTeams)} />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      {/* Header (zostáva) */}
      <div className="bg-white rounded-[2.5rem] border border-black/5 p-8 shadow-2xl flex justify-between items-center">
        <h1 className="text-3xl font-black uppercase tracking-tighter">{data.clientName || "Report Spokojnosti"}</h1>
        <button onClick={onReset} className="px-6 py-3 bg-black text-white rounded-full font-bold text-[10px] uppercase">Nový súbor</button>
      </div>

      {/* DYNAMICKÁ NAVIGÁCIA */}
      <div className="flex bg-black/5 p-2 rounded-3xl w-full max-w-5xl mx-auto border border-black/5 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('ENGAGEMENT')} 
          className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-black text-[10px] uppercase transition-all ${activeTab === 'ENGAGEMENT' ? 'bg-white shadow-lg' : 'text-black/40'}`}
        >
          <Users className="w-4 h-4" /> Zapojenie
        </button>
        
        {data.categories.map((category, idx) => (
          <button 
            key={idx} 
            onClick={() => setActiveTab(idx.toString())} 
            className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-black text-[10px] uppercase transition-all ${activeTab === idx.toString() ? 'bg-white shadow-lg' : 'text-black/40'}`}
          >
            <BarChart4 className="w-4 h-4" /> {category.categoryName}
          </button>
        ))}
      </div>

      {/* OBSAH */}
      {activeTab === 'ENGAGEMENT' ? (
        <div className="space-y-10">
          {/* Tu nechajte váš kód pre Engagement (Odoslané/Prijaté/Tabuľka) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-black text-white p-8 rounded-[2.5rem]">
               <span className="text-[10px] font-black uppercase opacity-50">Odoslaných</span>
               <div className="text-5xl font-black">{data.totalSent}</div>
             </div>
             {/* ... atď pre Received a SuccessRate */}
          </div>
        </div>
      ) : (
        // Tu sa vykreslí konkrétna kategória podľa aktívneho tabu
        renderDynamicSection(data.categories[parseInt(activeTab)], parseInt(activeTab))
      )}
    </div>
  );
};

export default SatisfactionDashboard;
