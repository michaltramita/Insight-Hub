import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';
import { CompetencyData } from '../types';

interface CompetencyRadarProps {
  data: CompetencyData[];
  scaleMax?: number;
}

const CompetencyRadar: React.FC<CompetencyRadarProps> = ({ data, scaleMax = 6 }) => {
  return (
    <div className="w-full h-[450px] bg-white p-8 rounded-3xl shadow-2xl shadow-black/5 border border-black/5 animate-fade-in">
      <h3 className="text-xl font-bold text-black mb-6 tracking-tight">Kompetenčný profil</h3>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#00000010" />
          <PolarAngleAxis 
            dataKey="name" 
            tick={{ fill: '#00000080', fontSize: 10, fontWeight: 700 }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, scaleMax]} tick={false} axisLine={false} />
          <Radar
            name="Seba"
            dataKey="selfScore"
            stroke="#000000"
            fill="#000000"
            fillOpacity={0.1}
            isAnimationActive={true}
            animationDuration={1200}
            animationEasing="ease-out"
          />
          <Radar
            name="Okolie"
            dataKey="othersScore"
            stroke="#B81547"
            fill="#B81547"
            fillOpacity={0.4}
            isAnimationActive={true}
            animationDuration={1200}
            animationBegin={300}
            animationEasing="ease-out"
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', borderRadius: '1rem', border: '1px solid #00000010', boxShadow: '0 10px 30px -5px rgb(0 0 0 / 0.1)', fontWeight: 700 }}
            formatter={(value: number) => value.toFixed(2)}
          />
          <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 700, fontSize: '12px' }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CompetencyRadar;