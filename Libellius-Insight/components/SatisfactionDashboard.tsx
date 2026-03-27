import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { FeedbackAnalysisResult } from '../types';
import EngagementBlock from './satisfaction/EngagementBlock';
import OpenQuestionsBlock from './satisfaction/OpenQuestionsBlock';
import AreaAnalysisBlock from './satisfaction/AreaAnalysisBlock';
import TopStatementsBlock from './satisfaction/TopStatementsBlock';
import RecommendationsBlock from './satisfaction/RecommendationsBlock';
import { encryptReportToUrlPayload } from '../utils/reportCrypto';
import { createSharedReport } from '../services/shareService';
import {
  Users,
  BarChart4,
  UserCheck,
  Building2,
  Download,
  Link as LinkIcon,
  Check,
  ArrowUpDown,
  MessageSquare,
  Target,
  Lightbulb,
} from 'lucide-react';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

type TabType = 'ENGAGEMENT' | 'OPEN_QUESTIONS' | string;
type ContextType = 'GLOBAL' | string;

interface GroupContext {
  id: string;
  label: string;
  source: any;
}

const normalizeContextLabel = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const normalizeTeamNames = (teams: unknown): string[] => {
  if (!Array.isArray(teams)) return [];
  return Array.from(
    new Set(
      teams
        .map((team) => String(team || '').trim())
        .filter(Boolean)
    )
  );
};

const MAX_SHARED_RESPONSES_PER_QUESTION = 80;
const MAX_SHARED_RESPONSE_TEXT_LENGTH = 320;

const trimResponseText = (text: unknown): string => {
  const normalized = String(text || '').trim();
  if (normalized.length <= MAX_SHARED_RESPONSE_TEXT_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_SHARED_RESPONSE_TEXT_LENGTH).trim()}...`;
};

const buildCompactOpenQuestions = (openQuestions: any) => {
  if (!Array.isArray(openQuestions)) return openQuestions;

  return openQuestions.map((teamItem: any) => ({
    teamName: String(teamItem?.teamName || '').trim(),
    questions: Array.isArray(teamItem?.questions)
      ? teamItem.questions.map((question: any) => ({
          questionText: String(question?.questionText || '').trim(),
          themeCloud: Array.isArray(question?.themeCloud)
            ? question.themeCloud
            : [],
          responses: Array.isArray(question?.responses)
            ? question.responses
                .slice(0, MAX_SHARED_RESPONSES_PER_QUESTION)
                .map((response: any) => ({
                  text: trimResponseText(response?.text),
                  theme: response?.theme ? String(response.theme).trim() : undefined,
                }))
                .filter((response: any) => response.text.length > 0)
            : [],
        }))
      : [],
  }));
};

const buildMinimalSurveyGroups = (surveyGroups: any) => {
  if (Array.isArray(surveyGroups)) {
    return surveyGroups.map((group: any, index: number) => ({
      id: String(group?.id || group?.key || group?.name || group?.title || `group_${index + 1}`),
      label: String(group?.label || group?.name || group?.title || `Skupina ${index + 1}`),
      masterTeams: normalizeTeamNames(group?.masterTeams),
    }));
  }

  if (surveyGroups && typeof surveyGroups === 'object') {
    return Object.entries(surveyGroups).map(([groupId, groupValue], index) => {
      const group = groupValue as any;
      return {
        id: String(group?.id || group?.key || groupId || `group_${index + 1}`),
        label: String(group?.label || group?.name || group?.title || groupId || `Skupina ${index + 1}`),
        masterTeams: normalizeTeamNames(group?.masterTeams),
      };
    });
  }

  return surveyGroups;
};

const buildShareableReport = (report: FeedbackAnalysisResult) => {
  const shareable = {
    ...report,
    satisfaction: report.satisfaction
      ? {
          ...report.satisfaction,
          openQuestions: buildCompactOpenQuestions(report.satisfaction.openQuestions),
          surveyGroups: buildMinimalSurveyGroups(report.satisfaction.surveyGroups),
        }
      : report.satisfaction,
  };

  return shareable;
};

const TOP_STATEMENTS_CONTEXT_ID = 'TOP_STATEMENTS_GLOBAL';
const RECOMMENDATIONS_CONTEXT_ID = 'RECOMMENDATIONS_GLOBAL';

const SatisfactionDashboard: React.FC<Props> = ({ result, onReset }) => {
  const data = result.satisfaction || (result as any);
  const scaleMax = 5;
  const isPathSharedView =
    typeof window !== 'undefined' && /\/r\/[^/?#]+/.test(window.location.pathname);
  const isSharedView =
    typeof window !== 'undefined' &&
    (window.location.hash.includes('report=') || isPathSharedView);

  const [activeTab, setActiveTab] = useState<TabType>('ENGAGEMENT');
  const [activeContext, setActiveContext] = useState<ContextType>('GLOBAL');
  const [copyStatus, setCopyStatus] = useState(false);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);

  const generateShareLink = async () => {
    try {
      const password = window.prompt('Zadajte heslo pre report (min. 6 znakov):');
      if (!password) return;
      if (password.trim().length < 6) {
        return alert('Heslo musí mať aspoň 6 znakov.');
      }

      const shareableReport = buildShareableReport(result);
      const encryptedPayload = await encryptReportToUrlPayload(shareableReport, password.trim());
      const clientMeta = data.clientName || 'Klient';
      const surveyMeta = data.surveyName || 'Prieskum spokojnosti';
      const issuedMeta =
        result.reportMetadata?.date || new Date().toLocaleDateString('sk-SK')
      ;

      const { shareId } = await createSharedReport(encryptedPayload, {
        client: clientMeta,
        survey: surveyMeta,
        issued: issuedMeta,
      });

      const currentPath = window.location.pathname || '/';
      const withoutSharedSegment = currentPath.replace(/\/r\/[^/?#]+$/, '');
      const basePath = withoutSharedSegment === '' ? '' : withoutSharedSegment.replace(/\/$/, '');
      const shareUrl = `${window.location.origin}${basePath}/r/${encodeURIComponent(
        shareId
      )}`;

      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopyStatus(true);
        setTimeout(() => setCopyStatus(false), 2000);
        alert('Odkaz bol skopírovaný. Heslo pošlite používateľovi zvlášť.');
      } catch (clipboardErr) {
        window.prompt('Skopírujte odkaz manuálne (Cmd+C):', shareUrl);
        setCopyStatus(true);
        setTimeout(() => setCopyStatus(false), 2000);
      }
    } catch (err: any) {
      alert(
        err?.message || 'Chyba pri vytváraní zabezpečeného odkazu.'
      );
    }
  };

  const exportToJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(result));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);

    const fileBaseName = `${data.clientName || 'firma'}_${data.surveyName || 'prieskum'}`
      .replace(/\s+/g, '_')
      .replace(/[^\w\-]/g, '');

    downloadAnchorNode.setAttribute('download', `${fileBaseName}_analyza.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const masterTeams = useMemo(() => {
    if (!data?.teamEngagement) return [];

    return data.teamEngagement
      .map((t: any) => t.name)
      .filter(
        (name: string) => name && !['total', 'celkom'].includes(name.toLowerCase())
      )
      .sort((a: string, b: string) => {
        if (a.toLowerCase().includes('priemer')) return -1;
        if (b.toLowerCase().includes('priemer')) return 1;
        return a.localeCompare(b);
      });
  }, [data]);

  const groupContexts = useMemo<GroupContext[]>(() => {
    const rawExplicitGroups =
      (data as any)?.surveyGroups ||
      (data as any)?.groups ||
      (data as any)?.subSurveys ||
      (data as any)?.groupReports;

    if (Array.isArray(rawExplicitGroups) && rawExplicitGroups.length > 0) {
      return rawExplicitGroups.map((group: any, index: number) => {
        const rawId =
          group?.id ||
          group?.key ||
          group?.name ||
          group?.title ||
          `group_${index + 1}`;
        const rawLabel = group?.label || group?.name || group?.title || `Skupina ${index + 1}`;

        return {
          id: String(rawId),
          label: String(rawLabel),
          source: group,
        };
      });
    }

    if (
      rawExplicitGroups &&
      typeof rawExplicitGroups === 'object' &&
      !Array.isArray(rawExplicitGroups)
    ) {
      return Object.entries(rawExplicitGroups).map(([groupId, groupValue], index) => {
        const group = groupValue as any;
        const rawLabel = group?.label || group?.name || group?.title || groupId || `Skupina ${index + 1}`;

        return {
          id: String(groupId),
          label: String(rawLabel),
          source: group,
        };
      });
    }

    return [];
  }, [data]);

  const hasGroupedSurvey = groupContexts.length > 0;

  useEffect(() => {
    if (!hasGroupedSurvey) {
      if (activeContext !== 'GLOBAL') setActiveContext('GLOBAL');
      return;
    }

    const isGlobalContext =
      activeContext === 'GLOBAL' ||
      activeContext === TOP_STATEMENTS_CONTEXT_ID ||
      activeContext === RECOMMENDATIONS_CONTEXT_ID;

    if (isGlobalContext) return;

    if (!groupContexts.some((ctx) => ctx.id === activeContext)) {
      setActiveContext('GLOBAL');
    }
  }, [groupContexts, activeContext, hasGroupedSurvey]);

  if (!data) return null;

  const activeGroupContext = hasGroupedSurvey
    ? groupContexts.find((ctx) => ctx.id === activeContext)
    : null;

  const scopedMasterTeams = useMemo(() => {
    if (!hasGroupedSurvey || activeContext === 'GLOBAL') return masterTeams;
    if (!activeGroupContext) return [];

    const source = activeGroupContext.source || {};

    if (Array.isArray(source.masterTeams) && source.masterTeams.length > 0) {
      return source.masterTeams.map((team: any) => String(team || '').trim()).filter(Boolean);
    }

    if (Array.isArray(source.teamEngagement) && source.teamEngagement.length > 0) {
      return source.teamEngagement
        .map((team: any) => String(team?.name || '').trim())
        .filter(Boolean);
    }

    if (Array.isArray(source.openQuestions) && source.openQuestions.length > 0) {
      return source.openQuestions
        .map((team: any) => String(team?.teamName || '').trim())
        .filter(Boolean);
    }

    if (Array.isArray(source.areas) && source.areas.length > 0) {
      const teamNames = source.areas.flatMap((area: any) =>
        Array.isArray(area?.teams)
          ? area.teams
              .map((team: any) => String(team?.teamName || '').trim())
              .filter(Boolean)
          : []
      );
      return Array.from(new Set(teamNames));
    }

    if (typeof source.teamName === 'string' && source.teamName.trim()) {
      return [source.teamName.trim()];
    }

    return [];
  }, [activeContext, activeGroupContext, hasGroupedSurvey, masterTeams]);

  const scopedOpenQuestions = useMemo(() => {
    const globalOpenQuestions = data.openQuestions || [];
    if (!hasGroupedSurvey || activeContext === 'GLOBAL') return globalOpenQuestions;
    if (!activeGroupContext) return [];

    const source = activeGroupContext.source || {};
    if (Array.isArray(source.openQuestions)) return source.openQuestions;

    if (scopedMasterTeams.length === 0) return [];
    return globalOpenQuestions.filter((team: any) =>
      scopedMasterTeams.includes(String(team?.teamName || '').trim())
    );
  }, [activeContext, activeGroupContext, data.openQuestions, hasGroupedSurvey, scopedMasterTeams]);

  const scopedAreas = useMemo(() => {
    const allAreas = data.areas || [];

    if (!hasGroupedSurvey) {
      return allAreas.map((area: any, idx: number) => ({
        ...area,
        id: String(area?.id || `global_area_${idx + 1}`),
      }));
    }

    if (activeContext === 'GLOBAL') {
      return [];
    }

    if (!activeGroupContext) return [];
    const source = activeGroupContext.source || {};

    if (Array.isArray(source.areas) && source.areas.length > 0) {
      return source.areas.map((area: any, idx: number) => ({
        ...area,
        id: String(area?.id || `${activeGroupContext.id}_area_${idx + 1}`),
      }));
    }

    if (scopedMasterTeams.length === 0) return [];
    const allowedTeams = new Set(scopedMasterTeams);

    return allAreas
      .map((area: any, idx: number) => {
        const teamRows = Array.isArray(area?.teams)
          ? area.teams.filter((team: any) =>
              allowedTeams.has(String(team?.teamName || '').trim())
            )
          : [];

        const hasAnyScore = teamRows.some((team: any) =>
          (team?.metrics || []).some((metric: any) => Number(metric?.score ?? 0) > 0)
        );

        if (!hasAnyScore) return null;

        return {
          ...area,
          id: String(area?.id || `${activeGroupContext.id}_area_${idx + 1}`),
          teams: teamRows,
        };
      })
      .filter(Boolean);
  }, [activeContext, activeGroupContext, data.areas, hasGroupedSurvey, scopedMasterTeams]);

  const areaTabs = scopedAreas.map((area: any, idx: number) => {
    const icons = [BarChart4, UserCheck, Users, Building2];
    return {
      id: area.id,
      icon: icons[idx % icons.length],
      label: area.title,
    };
  });

  const groupedSurveyTabs = [
    { id: 'OPEN_QUESTIONS', icon: MessageSquare, label: 'Otvorené otázky' },
    ...areaTabs,
  ];

  const legacyTabs = [
    { id: 'ENGAGEMENT', icon: Users, label: 'Zapojenie' },
    { id: 'OPEN_QUESTIONS', icon: MessageSquare, label: 'Otvorené otázky' },
    ...areaTabs,
    { id: 'TOP_STATEMENTS', icon: Target, label: 'Top tvrdenia' },
    { id: 'RECOMMENDATIONS', icon: Lightbulb, label: 'Odporúčania' },
  ];

  const orderedGroupContexts = useMemo(() => {
    if (!hasGroupedSurvey) return [];

    return [...groupContexts]
      .map((ctx) => {
        const normalized = normalizeContextLabel(ctx.label);
        if (normalized.includes('tpp') || normalized.includes('thp')) {
          return { ...ctx, displayLabel: 'THP', order: 1, icon: Building2 };
        }
        if (normalized.includes('vedenie') || normalized.includes('dispec')) {
          return { ...ctx, displayLabel: 'Vedenie a dispečing', order: 2, icon: UserCheck };
        }
        if (normalized.includes('vodic') || normalized.includes('opravar')) {
          return { ...ctx, displayLabel: 'Vodiči a opravári', order: 3, icon: Users };
        }
        return { ...ctx, displayLabel: ctx.label, order: 10, icon: Building2 };
      })
      .sort(
        (a, b) =>
          a.order - b.order || a.displayLabel.localeCompare(b.displayLabel, 'sk')
      );
  }, [groupContexts, hasGroupedSurvey]);

  const topContextTabs = useMemo(() => {
    if (!hasGroupedSurvey) return [];
    return [
      {
        id: 'GLOBAL',
        label: 'Zapojenie účastníkov',
        icon: Users,
      },
      ...orderedGroupContexts.map((ctx: any) => ({
        id: ctx.id,
        label: ctx.displayLabel,
        icon: ctx.icon || Building2,
      })),
      {
        id: TOP_STATEMENTS_CONTEXT_ID,
        label: 'Top tvrdenia',
        icon: Target,
      },
      {
        id: RECOMMENDATIONS_CONTEXT_ID,
        label: 'Odporúčania',
        icon: Lightbulb,
      },
    ];
  }, [hasGroupedSurvey, orderedGroupContexts]);

  const isEngagementOverviewContext = hasGroupedSurvey && activeContext === 'GLOBAL';
  const isTopStatementsOverviewContext =
    hasGroupedSurvey && activeContext === TOP_STATEMENTS_CONTEXT_ID;
  const isRecommendationsOverviewContext =
    hasGroupedSurvey && activeContext === RECOMMENDATIONS_CONTEXT_ID;
  const isGroupSurveyContext = hasGroupedSurvey && Boolean(activeGroupContext);

  const allTabs = hasGroupedSurvey
    ? isGroupSurveyContext
      ? groupedSurveyTabs
      : []
    : legacyTabs;

  const showSecondaryTabs = !hasGroupedSurvey || isGroupSurveyContext;
  const currentDetailTeams = isGroupSurveyContext ? scopedMasterTeams : masterTeams;

  const scopedAreaForActiveTab = useMemo(
    () => scopedAreas.find((area: any) => area.id === activeTab) || null,
    [scopedAreas, activeTab]
  );

  const globalTopStatementsTeams = useMemo(() => {
    const mergedTeams = new Set<string>(
      (masterTeams || []).map((team) => String(team || '').trim()).filter(Boolean)
    );

    (data.areas || []).forEach((area: any) => {
      (area?.teams || []).forEach((team: any) => {
        const name = String(team?.teamName || '').trim();
        if (name) mergedTeams.add(name);
      });
    });

    return Array.from(mergedTeams).sort((a, b) => a.localeCompare(b, 'sk'));
  }, [data.areas, masterTeams]);

  const scopedTopStatementsAreas = isGroupSurveyContext ? scopedAreas : data.areas || [];
  const scopedTopStatementsTeams = isGroupSurveyContext
    ? scopedMasterTeams
    : globalTopStatementsTeams;

  const scopedTeamEngagement = useMemo(() => {
    if (!isGroupSurveyContext) return data.teamEngagement || [];

    const source = activeGroupContext?.source || {};
    if (Array.isArray(source.teamEngagement) && source.teamEngagement.length > 0) {
      return source.teamEngagement;
    }

    if (scopedMasterTeams.length === 0) return [];

    return (data.teamEngagement || []).filter((team: any) =>
      scopedMasterTeams.includes(String(team?.name || '').trim())
    );
  }, [isGroupSurveyContext, data.teamEngagement, activeGroupContext, scopedMasterTeams]);

  const scopedRecommendationsData = useMemo(() => {
    if (!isGroupSurveyContext) return data;

    const sent = scopedTeamEngagement.reduce(
      (sum: number, team: any) => sum + (Number(team?.totalSent ?? team?.sent ?? 0) || 0),
      0
    );
    const received = scopedTeamEngagement.reduce(
      (sum: number, team: any) => sum + (Number(team?.count ?? 0) || 0),
      0
    );
    const successRate = sent > 0 ? `${((received / sent) * 100).toFixed(1)}%` : '0%';

    return {
      ...data,
      totalSent: sent,
      totalReceived: received,
      successRate,
      teamEngagement: scopedTeamEngagement,
      areas: scopedAreas,
    };
  }, [isGroupSurveyContext, data, scopedTeamEngagement, scopedAreas]);

  useEffect(() => {
    const tabExists = allTabs.some((tab) => tab.id === activeTab);
    if (!tabExists && allTabs.length > 0) {
      setActiveTab(allTabs[0].id as TabType);
    }
  }, [allTabs, activeTab]);

  const updateTabsScrollState = useCallback(() => {
    const container = tabsScrollRef.current;
    if (!container) {
      setCanScrollTabsLeft(false);
      setCanScrollTabsRight(false);
      return;
    }

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const hasOverflow = maxScrollLeft > 2;

    setCanScrollTabsLeft(container.scrollLeft > 1);
    setCanScrollTabsRight(hasOverflow && container.scrollLeft < maxScrollLeft - 1);
  }, []);

  useEffect(() => {
    const container = tabsScrollRef.current;
    if (!container) return;

    updateTabsScrollState();
    container.addEventListener('scroll', updateTabsScrollState, { passive: true });
    window.addEventListener('resize', updateTabsScrollState);

    const timer = window.setTimeout(updateTabsScrollState, 0);

    return () => {
      container.removeEventListener('scroll', updateTabsScrollState);
      window.removeEventListener('resize', updateTabsScrollState);
      window.clearTimeout(timer);
    };
  }, [updateTabsScrollState, allTabs.length]);

  return (
    <div className="min-h-screen flex flex-col px-4 sm:px-6 lg:px-8">
      
      <div className="flex-1 w-full max-w-[1600px] 2xl:max-w-[1800px] mx-auto flex flex-col">
        <div className="space-y-6 sm:space-y-8 animate-fade-in pb-10 sm:pb-12">
          
          {/* HLAVIČKA */}
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 p-5 sm:p-8 md:p-10 lg:p-12 shadow-2xl flex flex-col xl:flex-row justify-between items-start gap-6 sm:gap-8 relative overflow-hidden print:hidden">
            <div className="flex flex-col gap-4 sm:gap-6 relative z-10 w-full xl:w-auto min-w-0">
              <div className="space-y-2 sm:space-y-3">
                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-brand/5 rounded-full border border-brand/10 w-fit">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                    Next-gen Analytics
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tighter uppercase">
                    Libellius <span className="text-brand">InsightHub</span>
                  </h2>
                </div>
              </div>

              <div className="w-16 h-1 bg-black/5 rounded-full"></div>

              <div className="space-y-2 sm:space-y-3 min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl xl:text-5xl font-black tracking-tighter uppercase leading-none text-black break-words max-w-4xl">
                  {data.surveyName || 'Prieskum spokojnosti'}
                </h1>

                <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-black/5 rounded-lg border border-black/5 min-w-0">
                    <Building2 className="w-4 h-4 text-black/40 shrink-0" />
                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-black/60 truncate">
                      {data.clientName || 'Názov firmy'}
                    </span>
                  </div>

                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-black/30">
                    Vydané:{' '}
                    {result.reportMetadata?.date || new Date().getFullYear().toString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-2 sm:gap-3 relative z-10 w-full xl:w-auto xl:min-w-[220px] xl:items-end shrink-0 pt-1 sm:pt-2 md:pt-4 xl:pt-0">
              
              {/* Tlačidlá (Zdieľať a Export) sa nezobrazia v Shared View */}
              {!isSharedView && (
                <>
                  <button
                    onClick={generateShareLink}
                    className={`w-full xl:w-[220px] flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black transition-all text-[10px] sm:text-[11px] uppercase tracking-widest shadow-xl ${
                      copyStatus
                        ? 'bg-green-600 text-white scale-105'
                        : 'bg-white border-2 border-brand text-brand hover:bg-brand hover:text-white'
                    }`}
                  >
                    {copyStatus ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <LinkIcon className="w-4 h-4" />
                    )}
                    {copyStatus ? 'Skopírované!' : 'Zdieľať'}
                  </button>

                  <button
                    onClick={exportToJson}
                    className="w-full xl:w-[220px] flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-black text-white hover:bg-brand rounded-xl sm:rounded-2xl font-black transition-all text-[10px] sm:text-[11px] uppercase tracking-widest shadow-2xl"
                  >
                    <Download className="w-4 h-4" /> Export
                  </button>
                </>
              )}

              <button
                onClick={onReset}
                className="w-full xl:w-[220px] flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-black/5 hover:bg-black hover:text-white rounded-xl sm:rounded-2xl font-black transition-all text-[10px] sm:text-[11px] uppercase tracking-widest border border-black/5 group mt-auto"
              >
                <ArrowUpDown className="w-4 h-4 text-black/40 group-hover:text-white" />
                {isSharedView ? 'Zavrieť report' : 'Zavrieť'}
              </button>
            </div>

            <div className="absolute top-[-20%] right-[-10%] w-72 sm:w-96 h-72 sm:h-96 bg-brand/5 rounded-full blur-[100px] pointer-events-none -z-0"></div>
          </div>

          {/* TABY */}
          {hasGroupedSurvey && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 print:hidden">
              {topContextTabs.map((tab: any) => {
                const isActive = activeContext === tab.id;
                const isGlobalTab = tab.id === 'GLOBAL';
                const isGlobalInsightTab =
                  tab.id === TOP_STATEMENTS_CONTEXT_ID ||
                  tab.id === RECOMMENDATIONS_CONTEXT_ID;

                const activeClasses = isGlobalTab || isGlobalInsightTab
                  ? 'bg-black text-white border-black shadow-[0_18px_34px_-18px_rgba(0,0,0,0.85)]'
                  : 'bg-brand text-white border-brand shadow-[0_18px_34px_-18px_rgba(184,21,71,0.85)]';

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveContext(tab.id)}
                    className={`group w-full min-h-[78px] rounded-[1.6rem] border px-4 sm:px-5 py-3.5 flex items-center gap-3 text-left transition-all duration-300 ${
                      isActive
                        ? `${activeClasses} -translate-y-[1px]`
                        : 'bg-white border-black/5 text-black/50 shadow-[0_14px_30px_-24px_rgba(0,0,0,0.55)] hover:text-black/80 hover:bg-black/[0.02] hover:-translate-y-[1px]'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-white/15' : 'bg-black/[0.04]'}`}>
                      <tab.icon className={`w-4 h-4 ${isActive ? 'opacity-95' : 'opacity-55 group-hover:opacity-75'} transition-opacity`} />
                    </span>
                    <span className="font-black uppercase tracking-[0.12em] text-[11px] sm:text-xs leading-tight">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {showSecondaryTabs && (
            <div className="relative w-full mx-auto print:hidden">
              <div
                ref={tabsScrollRef}
                className="flex gap-2.5 bg-white p-2.5 rounded-[1.4rem] sm:rounded-[1.7rem] w-full overflow-x-auto no-scrollbar border border-black/5 whitespace-nowrap shadow-[0_18px_42px_-30px_rgba(0,0,0,0.65)]"
              >
                {allTabs.map((t) => (
                  (() => {
                    const isActive = activeTab === t.id;
                    const isAreaTab = areaTabs.some((areaTab) => areaTab.id === t.id);
                    const isDarkActiveTab = t.id === 'RECOMMENDATIONS' || t.id === 'TOP_STATEMENTS';

                    const activeClasses = isDarkActiveTab
                      ? 'bg-black text-white border-black shadow-[0_12px_26px_-14px_rgba(0,0,0,0.85)]'
                      : isAreaTab
                      ? 'bg-brand text-white border-brand shadow-[0_12px_26px_-14px_rgba(184,21,71,0.8)]'
                      : 'bg-white text-black border-black/10 shadow-[0_10px_22px_-16px_rgba(0,0,0,0.65)]';

                    return (
                      <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id as TabType)}
                        className={`group shrink-0 min-w-max inline-flex items-center justify-center gap-2.5 py-3 sm:py-4 lg:py-4.5 px-5 sm:px-6 lg:px-7 rounded-2xl border font-black text-[11px] sm:text-sm uppercase tracking-[0.1em] transition-all duration-300 whitespace-nowrap ${
                          isActive
                            ? activeClasses
                            : 'border-transparent text-black/45 hover:text-black/80 hover:bg-black/[0.04]'
                        }`}
                      >
                        <t.icon className={`w-[18px] h-[18px] shrink-0 transition-opacity ${isActive ? 'opacity-95' : 'opacity-40 group-hover:opacity-65'}`} />
                        <span className="leading-none">{t.label}</span>
                      </button>
                    );
                  })()
                ))}
              </div>
              <div
                aria-hidden="true"
                className={`hidden sm:block absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none transition-opacity ${
                  canScrollTabsLeft ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <div
                aria-hidden="true"
                className={`hidden sm:block absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none transition-opacity ${
                  canScrollTabsRight ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>
          )}

          {/* VYKRESLENIE SEKCII PODĽA AKTÍVNEHO TABU */}
          {(isEngagementOverviewContext || (!hasGroupedSurvey && activeTab === 'ENGAGEMENT')) && (
            <EngagementBlock data={data} masterTeams={masterTeams} />
          )}

          {isTopStatementsOverviewContext && (
            <TopStatementsBlock
              areas={data.areas || []}
              masterTeams={globalTopStatementsTeams}
            />
          )}

          {isRecommendationsOverviewContext && <RecommendationsBlock data={data} />}

          {showSecondaryTabs && activeTab === 'OPEN_QUESTIONS' && (
            <OpenQuestionsBlock
              openQuestions={scopedOpenQuestions}
              masterTeams={currentDetailTeams}
            />
          )}

          {!hasGroupedSurvey && showSecondaryTabs && activeTab === 'TOP_STATEMENTS' && (
            <TopStatementsBlock
              areas={scopedTopStatementsAreas}
              masterTeams={scopedTopStatementsTeams}
            />
          )}

          {!hasGroupedSurvey && showSecondaryTabs && activeTab === 'RECOMMENDATIONS' && (
            <RecommendationsBlock data={scopedRecommendationsData} />
          )}

          {showSecondaryTabs && scopedAreaForActiveTab && (
            <AreaAnalysisBlock
              area={scopedAreaForActiveTab}
              masterTeams={currentDetailTeams}
              scaleMax={scaleMax}
            />
          )}

          {/* PÄTIČKA */}
          <div className="mt-12 sm:mt-16 pt-8 sm:pt-10 border-t border-black/10 flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6 text-black/40 pb-4 sm:pb-6 print:hidden">
            <div className="flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Libellius"
                className="h-14 sm:h-20 lg:h-24 w-auto object-contain"
              />
            </div>

            <div className="text-center md:text-right">
              <p className="text-xs font-bold text-black/60">
                © {new Date().getFullYear()} Libellius. Všetky práva vyhradené.
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-1">
                Generované pomocou umelej inteligencie
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SatisfactionDashboard;
