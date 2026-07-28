import { defineConfig } from 'vitest/config';

// Pin a UTC+5:30 zone for the domain suite. The local-day bug (entries filed
// under the UTC date) is invisible on a UTC runner — CI is ubuntu-latest, which
// is UTC, which is exactly why it survived to the device. Fuel's first users are
// in IST; the tests must run where the bug lives.
export default defineConfig({
  test: { env: { TZ: 'Asia/Kolkata' } },
});
