/** Today screen strings — centralized per CLAUDE.md until i18next (P0-12). */
export const str = {
  today: 'Today',
  kcalLeft: 'kcal left',
  overBy: (n: number) => `over by ${n}`,
  offline: 'Offline — your log will sync',
  emptyTitle: 'Nothing logged yet',
  emptyBody: 'Your day starts with the first entry. Scan, search, or just describe your meal.',
  emptyCta: 'Log your first meal',
  protein: 'Protein', carbs: 'Carbs', fat: 'Fat',
  meals: { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snacks', dinner: 'Dinner' } as const,
  tabs: ['Today', 'Trends', 'You'] as const,
};
