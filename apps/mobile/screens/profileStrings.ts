import type { Goal } from '@fuel/domain';
/** Profile strings — centralized until i18next (P0-12). */
export const pf = {
  currentGoal: 'CURRENT GOAL',
  goalTitle: (g: Goal) => g === 'lose' ? 'Lose fat · −0.4 kg/week' : g === 'gain' ? 'Build muscle · lean surplus' : 'Maintain · steady',
  change: 'Change',
  adapts: 'adapts Sundays',
  reminders: 'Reminders',
  units: 'Units',
  health: 'Apple Health',
  export: 'Export my data',
  help: 'Help & FAQ',
  signOut: 'Sign out',
  deleteAccount: 'Delete account & data',
  footer: 'Fuel 1.0 · your data stays yours',
  deleteConfirmTitle: 'Delete everything?',
  deleteConfirmBody: 'This permanently erases your account, your logs, and your plan from Fuel — on this device and our servers. There is no undo.',
  deleteConfirmCta: 'Yes, delete everything',
  cancel: 'Cancel',
  exportedTitle: 'Export ready',
  exportedBody: (n: number) => `${n} entries exported as CSV.`,
} as const;
