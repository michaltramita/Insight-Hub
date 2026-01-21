import React, { useState, useMemo } from 'react';
import { EmployeeProfile } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Users, ArrowLeftRight } from 'lucide-react';

interface ComparisonViewProps {
  employees: EmployeeProfile[];
  scaleMax: number;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ employees, scaleMax }) => {
  const [idA, setIdA] = useState<string>(employees[0]?.id || '');
  const [idB, setIdB] = useState<string>(employees[1]?.id || employees[0]?.id || '');

  const employeeA = employees.find(e => e.id === idA);
  const employeeB = employees.find(e => e.id === idB);

  // Use static keys for chart data to enable smooth Recharts transitions
  const chartData = useMemo(() => {
    if (!employeeA) return [];
    return employeeA.competencies.map(compA => {
      const compB = employeeB?.competencies.find(c => c.name === compA.name);
      return {
        name: compA.name,
        selfA: compA.selfScore,
        othersA: compA.othersScore,
        selfB: compB?.selfScore || 0,
        othersB: compB?.othersScore || 0,
      };
    });
  }, [employeeA, employeeB]);

  if (employees.length < 1) return <div className="p-10 text-center font-bold opacity-20">Žiadne dáta na porovnanie.</div>;

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-black/5 border border-black/5">
        <div className="flex items-center gap-4 mb-10">
           <div className="p-4 bg-black rounded-2xl shadow-lg shadow-black/20">
              <ArrowLeftRight className="w-6 h-6 text-white" />
           </div>
           <div>
              <h3 className="text-2xl font-black text-black tracking-tight uppercase leading-none">Vzájomné porovnanie</h3>
              <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest mt-2">Benchmarking dvoch vybraných profilov</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-black/30 ml-2">Osoba A (Tmavá)</label>
            <select 
              value={idA}
              onChange={(e) => setIdA(e.target.value)}
              className="w-full p-5 bg-black/5 border-none text-black text-sm font-black rounded-[1.5rem] focus:ring-2 focus:ring-brand outline-none transition-all cursor-pointer appearance-none"
            >
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
             <label className="block text-[10px] font-black uppercase tracking-widest text-brand ml-2">Osoba B (Vínová)</label>
             <select 
              value={idB}
              onChange={(e) => setIdB(e.target.value)}
              className="w-full p-5 bg-brand/5 border-none text-black text-sm font-black rounded-[1.5rem] focus:ring-2 focus:ring-brand outline-none transition-all cursor-pointer appearance-none"
            >
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {employeeA && employeeB && (
        <div className="bg-white p-10 md:p-14 rounded-[2.5rem] shadow-2xl shadow-black/5 border border-black/5 h-[650px] relative">
           <div className="flex justify-between items-center mb-12">
              <h4 className="text-xl font-black text-black uppercase tracking-tighter">Profil kompetencií</h4>
              <div className="flex gap-4">
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-black rounded-full" />
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{employeeA.name}</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-brand rounded-full" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-brand">{employeeB.name}</span>
                 </div>
              </div>
           </div>

           <ResponsiveContainer width="100%" height="80%">
             <BarChart
               key={`${idA}-${idB}`} // Forces a fresh animation when the pair changes
               data={chartData}
               margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
             >
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000008" />
               <XAxis 
                 dataKey="name" 
                 // Fix: Removed textTransform as it is not a valid SVG attribute for the tick property
                 tick={{fontSize: 10, fontWeight: 900, fill: '#000000'}} 
                 interval={0}
                 axisLine={false}
                 tickLine={false}
               />
               <YAxis 
                 domain={[0, scaleMax]} 
                 tick={{fontSize: 10, fontWeight: 800, fill: '#00000040'}}
                 axisLine={false}
                 tickLine={false}
               />
               <Tooltip 
                 contentStyle={{ backgroundColor: '#fff', borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', fontWeight: 900, padding: '1.5rem' }}
                 cursor={{fill: '#00000005'}}
                 itemStyle={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
               />
               <Legend 
                  wrapperStyle={{ paddingTop: '40px', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }} 
                  iconType="circle"
               />
               
               <Bar 
                 name={`${employeeA.name} (Seba)`} 
                 dataKey="selfA" 
                 fill="#00000040" 
                 radius={[6, 6, 0, 0]} 
                 isAnimationActive={true} 
                 animationDuration={1000} 
                 animationEasing="ease-in-out"
               />
               <Bar 
                 name={`${employeeA.name} (Okolie)`} 
                 dataKey="othersA" 
                 fill="#000000" 
                 radius={[6, 6, 0, 0]} 
                 isAnimationActive={true} 
                 animationDuration={1000}
                 animationBegin={100}
                 animationEasing="ease-in-out"
               />
               
               <Bar 
                 name={`${employeeB.name} (Seba)`} 
                 dataKey="selfB" 
                 fill="#B8154740" 
                 radius={[6, 6, 0, 0]} 
                 isAnimationActive={true} 
                 animationDuration={1000}
                 animationBegin={200}
                 animationEasing="ease-in-out"
               />
               <Bar 
                 name={`${employeeB.name} (Okolie)`} 
                 dataKey="othersB" 
                 fill="#B81547" 
                 radius={[6, 6, 0, 0]} 
                 isAnimationActive={true} 
                 animationDuration={1000}
                 animationBegin={300}
                 animationEasing="ease-in-out"
               />
             </BarChart>
           </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default ComparisonView;