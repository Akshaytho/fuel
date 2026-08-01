/** GDPR export (spec 0008): all the user's entries + profile, as CSV text. */
import type { LocalEntry, WaterEntry, WeighIn } from '@fuel/store';
import type { Profile, Targets } from '@fuel/domain';

export function buildExportCSV(
  profile: Profile, targets: Targets, entries: LocalEntry[],
  water: WaterEntry[] = [], weighIns: WeighIn[] = [],
): string {
  // B-22: a food named "=cmd|'/c calc'!A1" is a live formula when the CSV is
  // opened in Excel/Sheets. Prefixing with an apostrophe forces the cell to
  // text — the standard OWASP mitigation — and we still quote/escape normally.
  const esc = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [
    `# Fuel data export · ${new Date().toISOString()}`,
    `# profile: sex=${profile.sex} age=${profile.age_years} height_cm=${profile.height_cm} weight_kg=${profile.weight_kg} activity=${profile.activity} goal=${profile.goal}`,
    `# targets: kcal=${targets.kcal} protein_g=${targets.protein_g} carbs_g=${targets.carbs_g} fat_g=${targets.fat_g}`,
    'day,logged_at,food_name,meal,grams,kcal,protein_g,carbs_g,fat_g,source,synced',
  ];
  for (const e of entries) {
    lines.push([e.day, e.logged_at, esc(e.food_name), esc(e.meal), e.grams, e.kcal, e.protein_g, e.carbs_g, e.fat_g, e.source, e.synced].join(','));
  }
  if (water.length > 0) {
    lines.push('', '# water', 'day,logged_at,ml,synced');
    for (const e of water) lines.push([e.day, e.logged_at, e.ml, e.synced].join(','));
  }
  if (weighIns.length > 0) {
    lines.push('', '# weigh-ins', 'day,logged_at,weight_kg,synced');
    for (const e of weighIns) lines.push([e.day, e.logged_at, e.kg, e.synced].join(','));
  }
  return lines.join('\n');
}
