import React from 'react';
import type { Feedback360FrequencyDistribution } from '../../types';

export type FrequencyBucketKey = keyof Feedback360FrequencyDistribution;

interface FrequencyBucketDefinition {
  key: FrequencyBucketKey;
  label: string;
  color: string;
  textColor: string;
}

export interface Feedback360FrequencyChartBucket extends FrequencyBucketDefinition {
  count: number;
  pct: number;
}

export interface Feedback360FrequencyChartRow {
  id: string;
  code: string;
  statement: string;
  total: number;
  buckets: Feedback360FrequencyChartBucket[];
}

export const FEEDBACK360_FREQUENCY_BUCKETS: FrequencyBucketDefinition[] = [
  { key: 'na', label: 'N/A', color: '#111111', textColor: '#FFFFFF' },
  { key: 'one', label: '1', color: '#4A081C', textColor: '#FFFFFF' },
  { key: 'two', label: '2', color: '#7D0E30', textColor: '#FFFFFF' },
  { key: 'three', label: '3', color: '#B81547', textColor: '#FFFFFF' },
  { key: 'four', label: '4', color: '#CB446D', textColor: '#FFFFFF' },
  { key: 'five', label: '5', color: '#E88AA6', textColor: '#111111' },
  { key: 'six', label: '6', color: '#F5B9CB', textColor: '#111111' },
  { key: 'seven', label: '7', color: '#FCE8EE', textColor: '#111111' },
];

const truncate = (value: string, max = 76) =>
  value.length > max ? `${value.slice(0, max - 1).trim()}...` : value;

export const buildFeedback360FrequencyChartRows = (
  rows: Array<{
    id: string;
    statement: string;
    frequencyDistribution?: Feedback360FrequencyDistribution;
  }>
): Feedback360FrequencyChartRow[] =>
  rows
    .map((row, index) => {
      const total = FEEDBACK360_FREQUENCY_BUCKETS.reduce(
        (sum, bucket) => sum + (Number(row.frequencyDistribution?.[bucket.key]) || 0),
        0
      );

      return {
        id: row.id,
        code: `${index + 1}.`,
        statement: row.statement,
        total,
        buckets: FEEDBACK360_FREQUENCY_BUCKETS.map((bucket) => {
          const count = Number(row.frequencyDistribution?.[bucket.key]) || 0;
          return {
            ...bucket,
            count,
            pct: total > 0 ? (count / total) * 100 : 0,
          };
        }),
      };
    })
    .filter((row) => row.total > 0);

interface Props {
  rows: Feedback360FrequencyChartRow[];
  selectedBucket?: FrequencyBucketKey | null;
}

const Feedback360FrequencyChart: React.FC<Props> = ({
  rows,
  selectedBucket = null,
}) => {
  const hasRows = rows.length > 0;

  if (!hasRows) {
    return null;
  }

  return (
    <>
      <div className="space-y-7">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-1 xl:grid-cols-[minmax(260px,430px)_1fr] gap-4 xl:gap-8 items-center"
          >
            <div className="min-w-0">
              <p
                className="text-sm sm:text-base font-black text-black leading-snug"
                title={row.statement}
              >
                {truncate(row.statement)}
              </p>
            </div>
            <div>
              <div className="h-10 sm:h-12 w-full rounded-2xl overflow-hidden bg-white border border-black/5 flex shadow-sm shadow-black/5">
                {row.buckets.map((bucket) =>
                  bucket.count > 0 ? (
                    <div
                      key={`${row.id}-${bucket.key}`}
                      className="h-full flex items-center justify-center text-[10px] sm:text-xs font-black transition-opacity hover:opacity-85"
                      style={{
                        width: `${bucket.pct}%`,
                        backgroundColor:
                          !selectedBucket || selectedBucket === bucket.key
                            ? bucket.color
                            : '#D4D4D8',
                        color:
                          !selectedBucket || selectedBucket === bucket.key
                            ? bucket.textColor
                            : '#3F3F46',
                      }}
                      title={`${bucket.label}: ${bucket.count} (${bucket.pct.toFixed(1)}%)`}
                    >
                      {bucket.pct >= 8 ? bucket.count : ''}
                    </div>
                  ) : null
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 sm:mt-10 flex flex-wrap gap-2 sm:gap-3 justify-end">
        {FEEDBACK360_FREQUENCY_BUCKETS.map((bucket) => (
          <div
            key={`legend-${bucket.key}`}
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-black/10 bg-white"
          >
            <span
              className="w-3.5 h-3.5 rounded-sm"
              style={{
                backgroundColor:
                  !selectedBucket || selectedBucket === bucket.key
                    ? bucket.color
                    : '#D4D4D8',
              }}
            />
            <span className="text-[11px] sm:text-xs font-black tracking-wide text-black/75">
              {bucket.label}
            </span>
          </div>
        ))}
      </div>
    </>
  );
};

export default Feedback360FrequencyChart;
