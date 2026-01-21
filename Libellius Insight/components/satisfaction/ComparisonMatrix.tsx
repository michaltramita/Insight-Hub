
import React from 'react';
import { LayoutGrid } from 'lucide-react';

interface ComparisonMatrixProps {
  teams: string[];
  matrixData: any[];
}

const ComparisonMatrix: React.FC<ComparisonMatrixProps> = ({ teams, matrixData }) => {
  const getCellColor = (score: number) => {
    if (score === 0) return 'bg-black/5 text-black/20';
    if (score <= 4.0) return 'bg-black text-white';
    if (score <= 4.5) return 'bg-brand/10 text-brand';
    if (score <= 5.0) return 'bg-brand/40 text-white';
    return 'bg-brand text-white';
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl shadow-black/5 overflow-hidden animate-fade-in">
      <div className="p-8 md:p-12 border-b border-black/5 bg-[#fcfcfc]">
         <div className="flex items-center gap-4">
           <div className="p-4 bg-black rounded-2xl">
             <LayoutGrid className="w-8 h-8 text-white" />
           </div>
           <div>
             <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">POROVNÁVACIA MATICA</h3>
             <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest mt-2">
               VÝSLEDKY PRE {teams.length} VYBRANÝCH TÍMOV
             </p>
           </div>
         </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-black text-white">
              <th className="p-6 text-left text-[11px] font-black uppercase tracking-widest sticky left-0 z-20 bg-black min-w-[350px]">
                KATEGÓRIA / OTÁZKA
              </th>
              {teams.map(team => (
                <th key={team} className="p-6 text-center text-[10px] font-black uppercase tracking-widest min-w-[150px] border-l border-white/10">
                  {team}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {matrixData.map((row, idx) => (
              <tr key={idx} className="hover:bg-black/[0.02] transition-colors group">
                <td className="p-6 text-xs font-bold text-black sticky left-0 z-10 bg-white border-r border-black/5 group-hover:bg-[#fcfcfc]">
                  {row.category}
                </td>
                {teams.map(team => (
                  <td key={team} className="p-0 border-l border-black/5">
                    <div className={`w-full h-full p-6 text-center font-black text-sm transition-all ${getCellColor(row[team])}`}>
                      {row[team] > 0 ? row[team].toFixed(2) : '-'}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ComparisonMatrix;
