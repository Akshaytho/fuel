/** Log-flow strings — centralized until i18next (P0-12). */
export const logStr = {
  searchAny: 'Search any food',
  scan: 'Scan', describe: 'Describe', label: 'Label', saved: 'Saved',
  goTos: (meal: string) => `YOUR GO-TOS · ${meal.toUpperCase()}`,
  copyYesterday: 'Copy yesterday',
  copyYesterdayN: (n: number) => `Copy yesterday · ${n}`,
  goTosEmpty: 'Your usual foods appear here once you log a few — ranked by what you actually eat.',
  copiedTitle: 'Copied from yesterday',
  copiedBody: (n: number) => `${n} item${n === 1 ? '' : 's'} added to today.`,
  quickAddedTitle: 'Logged',
  quickAddedBody: (name: string, kcal: number) => `${name} · ${kcal} kcal, same as last time.`,
  tapHint: 'Tap + to log your usual amount · tap the food to adjust',
  searchCaption: 'Searches your food database · closest matches first',
  searchError: "Couldn't search right now — describe it instead below.",
  searching: 'Searching…',
  logOften: 'you log this often',
  cantFind: "Can't find it? Describe it instead",
  cantFindSub: '"paneer bhurji with 2 rotis" — we\'ll match it',
  editFood: 'Edit food',
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
  kcalCaps: 'KCAL', proteinCaps: 'PROTEIN', carbsCaps: 'CARBS', fatCaps: 'FAT',
  logTo: (meal: string, kcal: number) => `Log to ${meal} · ${kcal} kcal`,
  // spec 0014 — combinations the user actually repeats
  repeatsHeader: 'MEALS YOU REPEAT',
  repeatSubtitle: (items: number, kcal: number, days: number) =>
    `${items} items · ${kcal.toLocaleString('en-US')} kcal · ${days} days`,
  repeatLoggedTitle: 'Logged',
  repeatLoggedBody: (label: string, n: number, kcal: number) =>
    `${label} — ${n} items, ${kcal.toLocaleString('en-US')} kcal.`,
  // spec 0016 — Easy Day. The evidence: simplified logging doubled adherence
  // with identical outcomes. The copy never shames the shortcut.
  easyTitle: (label: string, complete: boolean) => complete ? 'Your usual day' : `Your usual ${label.toLowerCase()}`,
  easySubtitle: (label: string, kcal: number) =>
    `${label} · ~${kcal.toLocaleString('en-US')} kcal · one tap`,
  easyLoggedTitle: 'Logged your usual',
  easyLoggedBody: (label: string, kcal: number) =>
    `${label} — about ${kcal.toLocaleString('en-US')} kcal, from what you normally eat. Adjust anything by long-pressing it.`,
} as const;
