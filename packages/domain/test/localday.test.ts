import { describe, it, expect } from 'vitest';
import { localDayISO } from '../src/index';

const pad = (n: number) => String(n).padStart(2, '0');
const localParts = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * P0 regression. `log_entries.day` buckets a user's food by calendar day, and
 * the Today header renders the LOCAL date. Deriving the bucket from
 * `toISOString()` (UTC) makes the two disagree east of Greenwich: food logged
 * at 01:00 IST files under yesterday, then vanishes from Today at 05:30 when
 * the UTC date rolls over.
 */
describe('localDayISO — day bucketing follows the LOCAL calendar', () => {
  it('uses the local day for an after-midnight instant (the reported bug)', () => {
    // 19:30Z on 28 Jul is 01:00 on 29 Jul in IST.
    const d = new Date(Date.UTC(2026, 6, 28, 19, 30));
    expect(localDayISO(d)).toBe('2026-07-29');
    // ...and this is precisely what the old implementation returned:
    expect(d.toISOString().slice(0, 10)).toBe('2026-07-28');
  });

  it('agrees with the local calendar at every instant tested', () => {
    for (const iso of [
      '2026-07-28T19:30:00Z', // after local midnight
      '2026-01-01T00:00:00Z', // new year in UTC, still 05:30 on 1 Jan IST
      '2026-12-31T18:29:59Z', // one second before local new year
      '2026-12-31T18:30:00Z', // local new year
      '2026-03-14T23:59:59Z',
    ]) {
      const d = new Date(iso);
      expect(localDayISO(d)).toBe(localParts(d));
    }
  });

  it('zero-pads month and day', () => {
    expect(localDayISO(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
    expect(localDayISO(new Date(2026, 10, 9, 12, 0))).toBe('2026-11-09');
  });

  it('defaults to now', () => {
    expect(localDayISO()).toBe(localParts(new Date()));
  });
});
