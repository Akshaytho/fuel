/** Weekly Report strings (spec 0010) — centralized until i18next. */
export const rp = {
  weekCaps: (n: number, range: string) => `WEEK ${n} · ${range}`,
  // verdict headlines — factual, zero shame (spec 0010)
  headOnPace: "You're on pace.",
  headFaster: 'Faster than planned.',
  headSlower: 'Slower than planned.',
  headLocked: 'Your report is almost ready.',
  narrative: (dir: 'down' | 'up' | 'flat', kg: string, verdict: string) =>
    dir === 'flat'
      ? `Weight held steady this week — ${verdict}`
      : `${dir === 'down' ? 'Down' : 'Up'} ${kg} kg this week — ${verdict}`,
  vOnPace: 'right in your target band.',
  vFaster: 'quicker than your plan expects. Worth watching, not worrying.',
  vSlower: 'a touch behind your plan. The recalibrated targets below account for it.',
  weightTrend: 'Weight trend',
  kgPerWk: 'kg/wk',
  burnTitle: 'Your burn, recalibrated',
  burnSub: 'From your logs + weigh-ins',
  daysLogged: 'Days logged',
  nextTargetsCaps: "NEXT WEEK'S TARGETS",
  kcalPerDay: 'kcal/day',
  proteinLabel: 'protein',
  weeklyGoal: 'weekly goal',
  accept: 'Accept new targets',
  adjust: 'Adjust manually',
  accepted: 'New targets locked in',
  acceptedBody: (kcal: string) => `Next week runs on ${kcal} kcal/day, tuned to your real burn.`,
  // locked state
  lockedBody: 'The weekly report is computed from your real logs and weigh-ins — it unlocks when a full week has enough of both.',
  needDays: (n: number) => `Log meals on ${n} more day${n === 1 ? '' : 's'} next week`,
  needSpan: (n: number) => `Weigh in ${n} more day${n === 1 ? '' : 's'} apart (start + end of week works)`,
  title: 'Report',
  // spec 0012 — half-recorded days, named out loud rather than silently used
  excludedTitle: (n: number) => n === 1
    ? 'One day looked half-logged'
    : `${n} days looked half-logged`,
  excludedBody: 'Left out of the maths, because counting a forgotten dinner as a light day would quietly cut your target.',
  excludedConfirm: 'That day is right',
  dayName: (d: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    return m ? new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!))
      .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : d;
  },
} as const;
