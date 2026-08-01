/**
 * Authenticated fetch with one automatic token refresh on 401 (B-14).
 *
 * Supabase access tokens expire in about an hour. Every authenticated call in
 * the app used to send whatever token boot happened to fetch, so a session
 * older than that got 401 — and in sync() that 401 disappeared into
 * `catch { break }`. The app looked online, the pill said "offline", and
 * nothing ever reached the server again until a cold start.
 */
import type { Session } from './auth';

export interface AuthContext {
  session: Session | null;
  refresh(): Promise<Session | null>;
}

export async function authedFetch(
  ctx: AuthContext,
  url: string,
  init: (s: Session) => RequestInit,
): Promise<Response> {
  // RC-6 (D-9): if boot's refresh failed transiently, the in-memory session is
  // null but the kv refresh token is still valid — recover it here instead of
  // failing every push for the rest of the run.
  const s = ctx.session ?? await ctx.refresh();
  if (!s) throw new Error('no session');
  const first = await fetch(url, init(s));
  if (first.status !== 401 && first.status !== 403) return first;

  const fresh = await ctx.refresh();
  if (!fresh) return first;                // refresh token dead — surface the 401
  return fetch(url, init(fresh));
}

/** Standard PostgREST headers for a user-scoped call. */
export function restHeaders(anonKey: string, s: Session, extra: Record<string, string> = {}) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${s.access_token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}
