export const REPORT_TYPE_VALUES = ['scam', 'impersonation', 'harassment', 'inappropriate_behavior', 'other'] as const;

export type ReportTypeValue = (typeof REPORT_TYPE_VALUES)[number];

export const DEFAULT_REPORT_TYPE: ReportTypeValue = 'scam';

const REPORT_TYPE_LABELS: Record<ReportTypeValue, string> = {
  scam: 'Scam',
  impersonation: 'Impersonation',
  harassment: 'Harassment',
  inappropriate_behavior: 'Inappropriate behavior',
  other: 'Other',
};

export const REPORT_TYPE_OPTIONS = REPORT_TYPE_VALUES.map(value => ({
  label: REPORT_TYPE_LABELS[value],
  value,
}));
