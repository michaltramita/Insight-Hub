import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { CompetencyData } from '../types';

interface CompetencyRadarProps {
  data: CompetencyData[];
  scaleMax?: number;
  variant?: 'card' | 'full';
}

const radarLegendItems = [
  {
    label: 'Celkové priemerné hodnotenie kolegami',
    color: '#C70F4D',
  },
  {
    label: 'Celkové sebahodnotenie',
    color: '#111114',
  },
];

const CompetencyRadar: React.FC<CompetencyRadarProps> = ({ data, scaleMax = 6, variant = 'card' }) => {
  const isFull = variant === 'full';

  return (
    <div
      className={`w-full animate-fade-in flex flex-col ${
        isFull
          ? 'h-full min-h-[620px] bg-transparent p-0 gap-6'
          : 'h-[450px] bg-white p-8 rounded-3xl shadow-2xl shadow-black/5 border border-black/5'
      }`}
    >
      {!isFull && (
        <h3 className="text-xl font-bold text-black mb-6 tracking-tight">Kompetenčný profil</h3>
      )}
      <div
        className={`flex flex-wrap items-center justify-center gap-3 ${
          isFull
            ? 'mx-auto w-fit rounded-2xl border border-black/5 bg-white px-5 py-3 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.65)]'
            : 'mb-5 rounded-2xl bg-black/[0.03] px-4 py-3'
        }`}
      >
        {radarLegendItems.map((item) => (
          <div
            key={item.label}
            className={`inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 font-black uppercase tracking-[0.12em] text-black/65 shadow-sm ring-1 ring-black/5 ${
              isFull ? 'text-[11px] sm:text-xs' : 'text-[9px]'
            }`}
          >
            <span
              className="h-3 w-3 rounded-full shadow-sm"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <div className={`w-full flex-1 ${isFull ? 'min-h-[540px]' : 'min-h-[300px]'}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius={isFull ? '74%' : '80%'} data={data}>
          <defs>
            <radialGradient id="radarBrandFill" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#F9B7CA" stopOpacity={isFull ? 0.75 : 0.48} />
              <stop offset="58%" stopColor="#D71B5B" stopOpacity={isFull ? 0.52 : 0.38} />
              <stop offset="100%" stopColor="#B81547" stopOpacity={isFull ? 0.32 : 0.25} />
            </radialGradient>
            <radialGradient id="radarSelfFill" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#111114" stopOpacity={isFull ? 0.22 : 0.13} />
              <stop offset="100%" stopColor="#111114" stopOpacity={isFull ? 0.08 : 0.04} />
            </radialGradient>
          </defs>
          <PolarGrid
            stroke={isFull ? '#B8154722' : '#00000010'}
            strokeWidth={isFull ? 1.4 : 1}
            gridType="polygon"
          />
          <PolarAngleAxis 
            dataKey="name" 
            tick={{
              fill: isFull ? '#111114CC' : '#00000080',
              fontSize: isFull ? 17 : 10,
              fontWeight: 900,
              letterSpacing: isFull ? 0.2 : 0,
            }}
          />
          <PolarRadiusAxis angle={30} domain={[0, scaleMax]} tick={false} axisLine={false} />
          <Radar
            name="Celkové priemerné hodnotenie kolegami"
            dataKey="othersScore"
            stroke="#C70F4D"
            strokeWidth={isFull ? 4 : 2.5}
            fill={isFull ? '#C70F4D' : 'url(#radarBrandFill)'}
            fillOpacity={isFull ? 0.78 : 1}
            isAnimationActive={true}
            animationDuration={1200}
            animationBegin={300}
            animationEasing="ease-out"
          />
          <Radar
            name="Celkové sebahodnotenie"
            dataKey="selfScore"
            stroke="#111114"
            strokeWidth={isFull ? 3.2 : 2.2}
            fill={isFull ? '#111114' : 'url(#radarSelfFill)'}
            fillOpacity={isFull ? 0.56 : 1}
            strokeDasharray={isFull ? '0' : undefined}
            isAnimationActive={true}
            animationDuration={1200}
            animationEasing="ease-out"
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              borderRadius: '1rem',
              border: '1px solid #00000010',
              boxShadow: '0 22px 50px -24px rgb(0 0 0 / 0.45)',
              fontWeight: 800,
            }}
            formatter={(value: unknown) => Number(value).toFixed(2)}
          />
        </RadarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CompetencyRadar;
