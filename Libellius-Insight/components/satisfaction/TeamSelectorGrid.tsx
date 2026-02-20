
import React from 'react';
import { Check, X } from 'lucide-react';

interface TeamSelectorGridProps {
  availableTeams: string[];
  selectedTeams: string[];
  onToggleTeam: (team: string) => void;
  onClear: () => void;
}

const TeamSelectorGrid: React.FC<TeamSelectorGridProps> = ({ 
  availableTeams, 
  selectedTeams, 
  onToggleTeam, 
  onClear 
}) => {
  return (
    <div className="pt-10 border-t border-black/5 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <label className="block text-[10px] font-black uppercase tracking-widest text-black/30 ml-2">
          Vyberte tímy na porovnanie:
        </label>
        <button 
          onClick={onClear}
          className="text-[10px] font-black uppercase tracking-widest text-brand hover:underline flex items-center gap-1"
        >
          <X className="w-3 h-3" /> Vyčistiť výber
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {availableTeams.map(t => (
          <button
            key={t}
            onClick={() => onToggleTeam(t)}
            className={`flex items-center justify-between p-4 rounded-2xl font-bold text-xs transition-all border-2 text-left h-full ${
              selectedTeams.includes(t) 
                ? 'bg-brand border-brand text-white shadow-lg shadow-brand/20 transform scale-[1.02]' 
                : 'bg-black/5 border-transparent text-black/50 hover:border-black/10 hover:bg-black/[0.07]'
            }`}
          >
            <span className="flex-1 pr-2 leading-tight">{t}</span>
            {selectedTeams.includes(t) && <Check className="w-4 h-4 flex-shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TeamSelectorGrid;
