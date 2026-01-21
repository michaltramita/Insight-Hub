
import React, { useState, useEffect } from 'react';
import { FeedbackAnalysisResult } from '../types';
import CompetencyRadar from './RadarChart';
import TopBottomList from './TopBottomLists';
import { User, Calendar, BrainCircuit, RefreshCw, Users, TrendingUp, AlertCircle } from 'lucide-react';

interface DashboardProps {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ result, onReset }) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  useEffect(() => {
    if (result.employees && result.employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(result.employees[0].id);
    }
  }, [result, selectedEmployeeId]);

  const currentEmployee = result.employees?.find(e => e.id === selectedEmployeeId);
  const scaleMax = result.reportMetadata.scaleMax || 6;

  if (!currentEmployee) return null;

  return (
    <div className="space-y-12 pb-24 animate-fade-in">
      {/* Header */}
      <div className="bg-white rounded-[2.5rem] border border-black/5 p-10 shadow-2xl shadow-black/5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
           <div>
             <h1 className="text-4xl font-black text-black tracking-tight mb-3 uppercase tracking-tighter">Report individuálnych kompetencií</h1>
             <div className="flex items-center gap-6 text-black/40 text-sm font-bold uppercase tracking-widest">
                <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {result.reportMetadata.date}</span>
                <span className="flex items-center gap-2"><Users className="w-4 h-4" /> {result.employees?.length} Osôb</span>
             </div>
           </div>
           <button onClick={onReset} className="flex items-center gap-2 px-6 py-3 font-bold text-black bg-black/5 hover:bg-black hover:text-white rounded-full transition-all border border-black/5 uppercase text-xs tracking-widest">
              <RefreshCw className="w-4 h-4" /> Nový report
            </button>
        </div>

        <div className="max-w-sm">
           <label className="block text-[10px] font-black uppercase tracking-widest text-black/30 mb-2">Vyberte zamestnanca</label>
           <select 
             value={selectedEmployeeId}
             onChange={(e) => setSelectedEmployeeId(e.target.value)}
             className="w-full p-4 bg-black/5 border-none text-black text-sm font-bold rounded-2xl focus:ring-2 focus:ring-brand outline-none transition-all cursor-pointer"
           >
              {result.employees?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
           </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-10">
          <CompetencyRadar data={currentEmployee.competencies} scaleMax={scaleMax} />
          
          <div className="bg-brand text-white p-10 rounded-[2.5rem] shadow-xl shadow-brand/20 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="flex items-start gap-5">
              <BrainCircuit className="w-10 h-10 text-white flex-shrink-0" />
              <div>
                <h3 className="text-xl font-bold mb-4 uppercase tracking-tight">Rozvojové odporúčanie</h3>
                <p className="text-white/80 text-sm leading-relaxed font-medium">{currentEmployee.recommendations}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
               <TopBottomList items={currentEmployee.topStrengths} type="strength" />
             </div>
             <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
               <TopBottomList items={currentEmployee.topWeaknesses} type="weakness" />
             </div>
          </div>

          {/* Table: Overrated Potential (Gaps) */}
          <div className="bg-white p-12 rounded-[2.5rem] border border-black/5 shadow-2xl shadow-black/5 animate-fade-in" style={{ animationDelay: '500ms' }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-black/5 rounded-xl"><AlertCircle className="w-7 h-7 text-brand" /></div>
              <h3 className="text-2xl font-black uppercase tracking-tighter">Preceňovaný potenciál</h3>
            </div>
            <div className="overflow-hidden rounded-2xl border border-black/5">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest">Tvrdenie / Oblasť</th>
                    <th className="p-5 text-center text-[10px] font-black uppercase tracking-widest">Seba</th>
                    <th className="p-5 text-center text-[10px] font-black uppercase tracking-widest">Okolie</th>
                    <th className="p-5 text-center text-[10px] font-black uppercase tracking-widest">Rozdiel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {currentEmployee.gaps.filter(g => g.diff > 0).map((gap, i) => (
                    <tr 
                      key={i} 
                      className="hover:bg-brand/5 transition-colors animate-row-slide-in"
                      style={{ animationDelay: `${600 + (i * 50)}ms` }}
                    >
                      <td className="p-5 text-sm font-bold text-black/70">{gap.statement}</td>
                      <td className="p-5 text-center font-black">{gap.selfScore.toFixed(1)}</td>
                      <td className="p-5 text-center font-black">{gap.othersScore.toFixed(1)}</td>
                      <td className="p-5 text-center font-black text-brand">+{gap.diff.toFixed(2)}</td>
                    </tr>
                  ))}
                  {currentEmployee.gaps.filter(g => g.diff > 0).length === 0 && (
                    <tr><td colSpan={4} className="p-10 text-center text-black/30 font-bold italic">Žiadne výrazné rozdiely v sebahodnotení.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;