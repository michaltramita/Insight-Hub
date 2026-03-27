import React, { useEffect, useMemo, useState } from 'react';
import TeamSelectorGrid from './TeamSelectorGrid';
import { Star, Target, Filter } from 'lucide-react';

interface MetricLike {
  category: string;
  score: number;
}

interface TeamLike {
  teamName: string;
  metrics?: MetricLike[];
}

interface AreaLike {
  title: string;
  teams?: TeamLike[];
}

interface StatementScoreItem {
  key: string;
  statement: string;
  area: string;
  score: number;
  teamName: string;
}

interface Props {
  areas: AreaLike[];
  masterTeams: string[];
}

const ALL_TEAMS_OPTION = '__ALL_TEAMS__';
const ALL_TEAMS_LABEL = 'Všetky tímy';
const STATEMENTS_LIMIT = 7;
const IMPROVEMENT_THRESHOLD = 3;
const IMPROVEMENT_FALLBACK_THRESHOLD = 3.5;
const IMPROVEMENT_FALLBACK_LIMIT = 3;

const TopStatementsBlock: React.FC<Props> = ({ areas, masterTeams }) => {
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  const availableTeams = useMemo(() => {
    if (masterTeams.length > 0) return masterTeams;

    const fromAreas = new Set<string>();
    (areas || []).forEach((area) => {
      (area.teams || []).forEach((team) => {
        const name = String(team.teamName || '').trim();
        if (name) fromAreas.add(name);
      });
    });

    return Array.from(fromAreas).sort((a, b) => a.localeCompare(b, 'sk'));
  }, [areas, masterTeams]);

  const teamOptions = useMemo(
    () => [ALL_TEAMS_OPTION, ...availableTeams],
    [availableTeams]
  );

  useEffect(() => {
    setSelectedTeams((prev) => prev.filter((team) => teamOptions.includes(team)));
  }, [teamOptions]);

  const statementsAnimationKey = useMemo(
    () => `statements-${selectedTeams.slice().sort().join('|') || 'none'}`,
    [selectedTeams]
  );

  const isAllTeamsSelected = selectedTeams.includes(ALL_TEAMS_OPTION);
  const selectedNamedTeams = selectedTeams.filter((team) => team !== ALL_TEAMS_OPTION);
  const hasSelection = isAllTeamsSelected || selectedNamedTeams.length > 0;

  const effectiveTeams = useMemo(
    () => (isAllTeamsSelected ? availableTeams : selectedNamedTeams),
    [isAllTeamsSelected, availableTeams, selectedNamedTeams]
  );

  const statementScores = useMemo(() => {
    if (!hasSelection) return [] as StatementScoreItem[];

    const items: StatementScoreItem[] = [];

    (areas || []).forEach((area, areaIndex) => {
      const safeTitle = String(area?.title || 'Nezaradená oblasť').trim();

      (area.teams || []).forEach((team, teamIndex) => {
        const teamName = String(team?.teamName || '').trim();
        if (!teamName || !effectiveTeams.includes(teamName)) return;

        (team.metrics || []).forEach((metric, metricIndex) => {
          const statement = String(metric?.category || '').trim();
          const score = Number(metric?.score ?? 0);

          if (!statement || !Number.isFinite(score) || score <= 0) return;

          items.push({
            key: `${areaIndex}-${teamIndex}-${metricIndex}-${statement}`,
            statement,
            area: safeTitle,
            score,
            teamName,
          });
        });
      });
    });

    return items.sort((a, b) => b.score - a.score);
  }, [areas, effectiveTeams, hasSelection]);

  const topPositive = statementScores.slice(0, STATEMENTS_LIMIT);
  const selectedPositiveKeys = new Set(topPositive.map((item) => item.key));
  const improvementCandidates = [...statementScores]
    .filter((item) => !selectedPositiveKeys.has(item.key))
    .filter((item) => item.score < IMPROVEMENT_THRESHOLD)
    .sort((a, b) => a.score - b.score);
  const fallbackImprovementCandidates = [...statementScores]
    .filter((item) => !selectedPositiveKeys.has(item.key))
    .filter((item) => item.score < IMPROVEMENT_FALLBACK_THRESHOLD)
    .sort((a, b) => a.score - b.score);
  const topImprovement =
    improvementCandidates.length > 0
      ? improvementCandidates.slice(0, STATEMENTS_LIMIT)
      : fallbackImprovementCandidates.slice(0, IMPROVEMENT_FALLBACK_LIMIT);

  const renderList = (
    items: StatementScoreItem[],
    type: 'POSITIVE' | 'IMPROVEMENT'
  ) => {
    const isPositive = type === 'POSITIVE';

    return (
      <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl">
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div
            className={`p-3 rounded-2xl ${
              isPositive ? 'bg-brand/10 text-brand' : 'bg-black/10 text-black'
            }`}
          >
            {isPositive ? (
              <Star className="w-6 h-6" />
            ) : (
              <Target className="w-6 h-6" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl lg:text-2xl font-black uppercase tracking-tight text-black">
              {isPositive
                ? 'Najpozitívnejšie vnímané tvrdenia'
                : 'Tvrdenia s najväčším priestorom na zlepšenie'}
            </h3>
          </div>
        </div>

        <div className="space-y-3">
          {!hasSelection ? (
            <div className="p-8 sm:p-10 rounded-2xl border border-dashed border-black/15 text-center">
              <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-black/35">
                Najprv vyberte konkrétny tím alebo možnosť Všetky tímy.
              </p>
            </div>
          ) : items.length > 0 ? (
            items.map((item, index) => (
              <div
                key={item.key}
                className={`p-4 sm:p-5 rounded-2xl border ${
                  isPositive
                    ? 'bg-brand/[0.03] border-brand/10'
                    : 'bg-black/[0.03] border-black/10'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                          isPositive
                            ? 'bg-brand text-white'
                            : 'bg-black text-white'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm sm:text-base font-black leading-snug text-black break-words">
                          {item.statement}
                        </p>
                        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-black/35 mt-2">
                          Oblasť: {item.area}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`text-2xl sm:text-3xl font-black leading-none ${
                        isPositive ? 'text-brand' : 'text-black'
                      }`}
                    >
                      {item.score.toFixed(2)}
                    </p>
                    <p className="text-[10px] sm:text-xs font-bold text-black/55 mt-2 leading-snug max-w-[200px] whitespace-normal break-words">
                      {item.teamName}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 sm:p-10 rounded-2xl border border-dashed border-black/15 text-center">
              <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-black/35">
                Pre vybrané tímy sa nenašli tvrdenia pre túto kategóriu.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 sm:space-y-10 animate-fade-in">
      <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/5 rounded-full text-[10px] font-black uppercase text-brand tracking-[0.2em]">
            <Filter className="w-3 h-3" /> Filter tímov
          </div>
          <h2 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none break-words text-black">
            Výber tímov pre TOP tvrdenia
          </h2>
          <p className="mt-3 text-xs sm:text-sm font-bold text-black/40 max-w-3xl">
            Vyberte tímy, pre ktoré chcete zobraziť prehľad tvrdení.
          </p>
        </div>

        <TeamSelectorGrid
          availableTeams={teamOptions}
          selectedTeams={selectedTeams}
          optionLabels={{ [ALL_TEAMS_OPTION]: ALL_TEAMS_LABEL }}
          onToggleTeam={(team) => {
            setSelectedTeams((prev) => {
              const hasTeam = prev.includes(team);

              if (team === ALL_TEAMS_OPTION) {
                return hasTeam ? [] : [ALL_TEAMS_OPTION];
              }

              const withoutAllTeams = prev.filter(
                (existing) => existing !== ALL_TEAMS_OPTION
              );

              return withoutAllTeams.includes(team)
                ? withoutAllTeams.filter((existing) => existing !== team)
                : [...withoutAllTeams, team];
            });
          }}
          onClear={() => setSelectedTeams([])}
        />
      </div>

      <div
        key={statementsAnimationKey}
        className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8 lg:gap-10 items-start animate-fade-in"
      >
        {renderList(topPositive, 'POSITIVE')}
        {renderList(topImprovement, 'IMPROVEMENT')}
      </div>
    </div>
  );
};

export default TopStatementsBlock;
