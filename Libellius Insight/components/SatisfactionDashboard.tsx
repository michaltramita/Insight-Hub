import React, { useState, useMemo, useEffect } from 'react';
import { FeedbackAnalysisResult } from '../types';
import TeamSelectorGrid from './satisfaction/TeamSelectorGrid';
import ComparisonMatrix from './satisfaction/ComparisonMatrix';
// 1. PRIDANÝ IMPORT KNIŽNICE A IKONY
import LZString from 'lz-string'; 
import { 
  RefreshCw, Search, BarChart4, ClipboardCheck, MapPin, UserCheck,
  Building2, Star, Target, Download, Link as LinkIcon, Check 
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

// ... (typy TabType, ViewMode atď. zostávajú rovnaké)

const SatisfactionDashboard: React.FC<Props> = ({ result, onReset }) => {
  const data = result.satisfaction;
  const scaleMax = result.reportMetadata?.scaleMax || 6;
  
  // 2. STAV PRE SPÄTNÚ VÄZBU O SKOPÍROVANÍ
  const [copyStatus, setCopyStatus] = useState(false);

  // 3. FUNKCIA NA GENEROVANIE MAGIC LINKU
  const generateShareLink = () => {
    try {
      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(result));
      const shareUrl = `${window.location.origin}${window.location.pathname}#report=${compressed}`;
      
      navigator.clipboard.writeText(shareUrl);
      
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 3000); // Po 3 sekundách vráti pôvodný text
    } catch (err) {
      console.error("Chyba pri generovaní linku:", err);
      alert("Nepodarilo sa vygenerovať odkaz.");
    }
  };

  // ... (pôvodné funkcie exportToJson, masterTeams atď. zostávajú)

  if (!data) return null;

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      {/* HLAVIČKA S TLAČIDLAMI */}
      <div className="bg-white rounded-[2.5rem] border border-black/5 p-8 shadow-2xl shadow-black/5 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center shadow-xl shadow-brand/20">
             <ClipboardCheck className="text-white w-8 h-8" />
           </div>
           <div>
             <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">{data.clientName || "Report"}</h1>
             <p className="text-black/40 font-bold uppercase tracking-widest text-[10px] mt-2">Dátum: {result.reportMetadata?.date}</p>
           </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 4. NOVÉ TLAČIDLO: ZDIEĽAŤ ODKAZ */}
          <button 
            onClick={generateShareLink}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all text-[10px] uppercase tracking-widest shadow-lg ${
              copyStatus 
                ? 'bg-green-500 text-white scale-105' 
                : 'bg-white border-2 border-brand text-brand hover:bg-brand hover:text-white'
            }`}
          >
            {copyStatus ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
            {copyStatus ? 'Odkaz skopírovaný!' : 'Zdieľať odkaz'}
          </button>

          <button 
            onClick={() => {
               const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result));
               const downloadAnchorNode = document.createElement('a');
               downloadAnchorNode.setAttribute("href", dataStr);
               downloadAnchorNode.setAttribute("download", `${data.clientName || 'report'}_analyza.json`);
               downloadAnchorNode.click();
            }}
            className="flex items-center gap-2 px-6 py-3 bg-brand text-white hover:bg-brand/90 rounded-full font-bold transition-all text-[10px] uppercase tracking-widest shadow-lg"
          >
            <Download className="w-4 h-4" /> Export JSON
          </button>
          
          <button onClick={onReset} className="flex items-center gap-2 px-6 py-3 bg-black/5 hover:bg-black hover:text-white rounded-full font-bold transition-all text-[10px] uppercase tracking-widest border border-black/5">
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>

      {/* ... Zvyšok komponentu (Taby, Grafy atď.) zostáva rovnaký ako predtým ... */}
    </div>
  );
};

export default SatisfactionDashboard;
