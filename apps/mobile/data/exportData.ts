/** GDPR export (spec 0008): all the user's entries + profile, as CSV text. */
import type { LocalEntry } from '@fuel/store';
import type { Profile, Targets } from '@fuel/domain';

export function buildExportCSV(profile: Profile, targets: Targets, entries: LocalEntry[]): string {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [
    `# Fuel data export · ${new Date().toISOString()}`,
    `# profile: sex=${profile.sex} age=${profile.age_years} height_cm=${profile.height_cm} weight_kg=${profile.weight_kg} activity=${profile.activity} goal=${profile.goal}`,
    `# targets: kcal=${targets.kcal} protein_g=${targets.protein_g} carbs_g=${targets.carbs_g} fat_g=${targets.fat_g}`,
    'day,logged_at,food_name,grams,kcal,protein_g,carbs_g,fat_g,source,synced',
  ];
  for (const e of entries) {
    lines.push([e.day, e.logged_at, esc(e.food_name), e.grams, e.kcal, e.protein_g, e.carbs_g, e.fat_g, e.source, e.synced].join(','));
  }
  return lines.join('\n');
}
