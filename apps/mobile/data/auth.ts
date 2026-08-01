/** Minimal Supabase email auth over REST (spec 0007). Session persisted in kv. */

export interface KV {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
}

export interface Session { access_token: string; refresh_token: string; user_id: string; email: string }

const KEY = 'fuel.session.v1';

export function createAuth(url: string, anonKey: string, kv: KV) {
  let session: Session | null = null;

  async function call(path: string, payload: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(`${url}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const msg = (body.msg ?? body.error_description ?? body.message ?? `auth ${res.status}`) as string;
      throw new Error(msg);
    }
    return body;
  }

  function adopt(body: Record<string, unknown>): Session {
    const user = body.user as { id: string; email: string };
    session = {
      access_token: body.access_token as string,
      refresh_token: body.refresh_token as string,
      user_id: user.id, email: user.email,
    };
    void kv.setItem(KEY, JSON.stringify(session));
    return session;
  }

  // B-14: one in-flight refresh at a time. Without this, a burst of 401s
  // (sync pushes several entries) would fire N parallel refreshes and the
  // losers would invalidate the winner's rotated refresh_token.
  let refreshing: Promise<Session | null> | null = null;

  return {
    get session() { return session; },

    /**
     * B-14: exchange the refresh token for a fresh access token. Access tokens
     * expire in ~1 h, so ANY session older than that used to 401 into the
     * silent catch in sync() — the app looked online and simply never synced.
     */
    async refresh(): Promise<Session | null> {
      if (refreshing) return refreshing;
      refreshing = (async () => {
        try {
          // RC-6 (D-9): a failed BOOT refresh used to null the session for the
          // whole run — "tap to retry" could never succeed. The durable truth
          // is the kv-persisted refresh token; fall back to it.
          let token = session?.refresh_token;
          if (!token) {
            const raw = await kv.getItem(KEY);
            token = raw ? (JSON.parse(raw) as Session | null)?.refresh_token : undefined;
          }
          if (!token) return null;
          return adopt(await call('token?grant_type=refresh_token', { refresh_token: token }));
        } catch {
          return null;              // refresh token itself is dead → caller re-auths
        } finally {
          refreshing = null;
        }
      })();
      return refreshing;
    },

    /** Restore + refresh persisted session; null if none/invalid. */
    async init(): Promise<Session | null> {
      const raw = await kv.getItem(KEY);
      if (!raw) return null;
      const old = JSON.parse(raw) as Session;
      if (!old?.refresh_token) return null;
      try {
        return adopt(await call('token?grant_type=refresh_token', { refresh_token: old.refresh_token }));
      } catch { return null; }
    },

    async signUp(email: string, password: string): Promise<Session> {
      const body = await call('signup', { email, password });
      if (!body.access_token) { // project requires confirmation
        return adopt(await call('token?grant_type=password', { email, password }));
      }
      return adopt(body);
    },

    async signIn(email: string, password: string): Promise<Session> {
      return adopt(await call('token?grant_type=password', { email, password }));
    },

    async signOut(): Promise<void> { session = null; await kv.setItem(KEY, ''); },
  };
}

export type Auth = ReturnType<typeof createAuth>;
