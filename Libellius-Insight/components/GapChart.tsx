import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { GapData } from '../types';

interface GapChartProps {
  data: GapData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as GapData;
    return (
      <div className="bg-white p-5 border border-black/5 rounded-2xl shadow-2xl shadow-black/10 max-w-xs">
        <p className="text-sm font-black mb-3 text-black">{data.statement}</p>
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-black/50">
            <span>Seba</span> 
            <span>{data.selfScore.toFixed(1)}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-black/50">
            <span>Ostatní</span> 
            <span>{data.othersScore.toFixed(1)}</span>
          </div>
          <div className="pt-3 mt-3 border-t border-black/5 flex justify-between items-center">
            <span className="text-xs font-black uppercase tracking-widest text-black/30">Rozdiel</span>
            <span className={`text-base font-black ${data.diff > 0 ? 'text-brand' : 'text-black'}`}>
              {data.diff > 0 ? '+' : ''}{data.diff.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const GapChart: React.FC<GapChartProps> = ({ data }) => {
  const sortedData = [...data].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 8);

  return (
    <div className="w-full h-[550px] bg-white p-10 rounded-3xl shadow-2xl shadow-black/5 border border-black/5 animate-fade-in">
      <div className="mb-10">
        <h3 className="text-2xl font-black text-black tracking-tight mb-2">Gap Analýza</h3>
        <p className="text-sm font-bold text-black/40 uppercase tracking-wider">
          Sebahodnotenie verzus Okolie (Rozptyl)
        </p>
      </div>
      
      <ResponsiveContainer width="100%" height="80%">
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#00000008" />
          <XAxis type="number" domain={[-3, 3]} tick={{ fontSize: 10, fill: '#00000040', fontWeight: 800 }} />
          <YAxis 
            type="category" 
            dataKey="statement" 
            width={180} 
            tick={{fontSize: 10, fill: '#000000', fontWeight: 700}}
            interval={0}
            tickFormatter={(value) => value.length > 28 ? `${value.substring(0, 28)}...` : value}
          />
          <Tooltip content={<CustomTooltip />} cursor={{fill: '#00000003'}} />
          <ReferenceLine x={0} stroke="#00000020" strokeWidth={2} />
          <Bar 
            dataKey="diff" 
            name="Rozdiel" 
            radius={[0, 10, 10, 0]}
            isAnimationActive={true}
            animationDuration={1000}
            animationEasing="ease-out"
          >
            {sortedData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.diff > 0 ? '#B81547' : '#000000'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GapChart;