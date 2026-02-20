import React from 'react';
import { StatementData } from '../types';
import { ThumbsUp, ThumbsDown, BarChart3 } from 'lucide-react';

interface ListProps {
  items: StatementData[];
  type: 'strength' | 'weakness';
}

const TopBottomList: React.FC<ListProps> = ({ items, type }) => {
  const isStrength = type === 'strength';
  const Icon = isStrength ? ThumbsUp : ThumbsDown;
  const colorClass = isStrength ? 'text-black' : 'text-brand';
  const bgClass = isStrength ? 'bg-black/5' : 'bg-brand/5';
  const barColor = isStrength ? 'bg-black' : 'bg-brand';

  return (
    <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-black/5 border border-black/5 flex flex-col h-full">
      <div className="flex items-center gap-4 mb-8">
        <div className={`p-3 rounded-2xl ${bgClass}`}>
          <Icon className={`w-7 h-7 ${colorClass}`} />
        </div>
        <h3 className="text-xl font-bold text-black tracking-tight">
          {isStrength ? 'Najväčšie silné stránky' : 'Kľúčové oblasti rozvoja'}
        </h3>
      </div>
      
      <div className="space-y-8 flex-1">
        {items.map((item, idx) => (
          <div key={idx} className="group">
            <div className="flex justify-between items-end mb-3">
              <span className="text-sm font-bold text-black leading-snug pr-4">
                {item.text}
              </span>
              <span className={`text-lg font-black ${isStrength ? 'text-black/30' : 'text-brand'}`}>
                {item.score.toFixed(1)}
              </span>
            </div>
            <div className="w-full bg-black/5 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-full rounded-full ${barColor} transition-all duration-700 ease-out`} 
                style={{ width: `${(item.score / 6) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopBottomList;