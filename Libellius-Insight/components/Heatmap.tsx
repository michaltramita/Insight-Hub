
import React from 'react';
import { EmployeeProfile } from '../types';

interface HeatmapProps {
  employees: EmployeeProfile[];
  scaleMax: number;
}

const Heatmap: React.FC<HeatmapProps> = ({ employees, scaleMax }) => {
  const allCompetencies = Array.from(
    new Set(employees.flatMap(e => e.competencies.map(c => c.name)))
  );

  const getScoreColor = (score: number) => {
    const percentage = score / scaleMax;
    // We'll use a grayscale to brand color ramp
    if (percentage < 0.4) {
      return `rgba(0, 0, 0, 0.05)`;
    } else if (percentage < 0.6) {
      return `rgba(184, 21, 71, 0.15)`;
    } else if (percentage < 0.8) {
      return `rgba(184, 21, 71, 0.4)`;
    } else {
      return `rgba(184, 21, 71, 0.8)`;
    }
  };

  const getTextColor = (score: number) => {
    return (score / scaleMax) > 0.7 ? 'text-white' : 'text-black';
  };

  return (
    <div className="bg-white p-10 rounded-3xl shadow-2xl shadow-black/5 border border-black/5 overflow-hidden animate-fade-in">
      <h3 className="text-2xl font-black text-black mb-8 tracking-tight uppercase tracking-tighter">Tímová Heatmapa</h3>
      
      <div className="overflow-x-auto rounded-2xl border border-black/5">
        <table className="min-w-full w-full border-collapse">
          <thead>
            <tr className="bg-black text-white">
              <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                Zamestnanec
              </th>
              {allCompetencies.map(comp => (
                <th key={comp} className="px-6 py-5 text-center text-[10px] font-black uppercase tracking-widest border-b border-white/10 min-w-[120px]">
                  {comp}
                </th>
              ))}
              <th className="px-6 py-5 text-center text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                AVG
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {employees.map((employee, idx) => {
              const totalScore = employee.competencies.reduce((acc, curr) => acc + curr.othersScore, 0);
              const avgScore = totalScore / (employee.competencies.length || 1);
              
              return (
                <tr 
                  key={employee.id} 
                  className="hover:bg-black/5 transition-colors animate-row-slide-in"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <td className="px-6 py-5 whitespace-nowrap text-sm font-black text-black border-r border-black/5">
                    {employee.name}
                  </td>
                  {allCompetencies.map(compName => {
                    const comp = employee.competencies.find(c => c.name === compName);
                    const score = comp ? comp.othersScore : 0;
                    return (
                      <td key={compName} className="p-1 text-center">
                        {comp ? (
                            <div 
                              className={`w-full py-4 rounded-xl text-xs font-black transition-all hover:scale-[1.02] cursor-default ${getTextColor(score)}`}
                              style={{ backgroundColor: getScoreColor(score) }}
                            >
                              {score.toFixed(1)}
                            </div>
                        ) : (
                            <span className="text-black/10">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-6 py-5 whitespace-nowrap text-center font-black text-brand text-lg">
                     {avgScore.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Heatmap;