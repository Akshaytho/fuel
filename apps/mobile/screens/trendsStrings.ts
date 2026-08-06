/** Trends screen strings (spec 0009) — centralized until i18next. */
export const tr = {
  title: 'Progress',
  segWeek: 'Week',
  streakCaps: 'STREAK',
  weekWeighRow: 'Weigh-ins feed next week\u2019s targets',
  // E-05 (spec 0017): appears at 3+ logged days, absent below — never a
  // countdown, never "only N of 3" (harm rules).
  weeklyFloor: '3+ days a week is the level research links to lasting results \u2014 you\u2019re there.',
  segWeight: 'Weight',
  segEnergy: 'Energy',
  segConsistency: 'Consistency',
  // weight
  trendToday: 'trend weight today',
  kg: 'kg',
  since: (d: string) => `since ${d}`,
  kgPerWeek: 'kg/week',
  logWeight: '+ Log weight',
  weightSheetTitle: "Today's weight",
  weightSheetHint: 'Same scale, same time of day beats a fancy scale.',
  weightSave: 'Save weight',
  weightEmptyHead: 'Your weight trend starts with one number.',
  weightEmptyBody: 'Log a weigh-in and the chart builds itself — the smoothed line needs a few days to appear.',
  noSlope: '—',
  today: 'Today',
  // energy
  avgEaten: 'avg eaten/day',
  targetKcal: 'target kcal',
  daysLogged: 'days logged',
  energyTitle: 'Calories eaten, last 14 days',
  energyTarget: (n: string) => `line = your ${n} kcal target`,
  energyEmptyHead: 'Log meals and your energy story shows up here.',
  energyEmptyBody: 'Every day you log becomes a bar against your target.',
  // consistency
  proteinWeeks: 'Protein days hit, by week',
  weeksLabel: (n: number) => `${n} weeks`,
  bestYet: (n: number) => n >= 7 ? `${n} of 7 last week — your best yet.` : `${n} of 7 last week.`,
  consistencyEmptyHead: 'Consistency charts earn themselves.',
  consistencyEmptyBody: 'Hit your protein target on logged days and the weekly bars fill in.',
} as const;
