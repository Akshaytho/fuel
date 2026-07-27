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

  return {
    get session() { return session; },

    /** Restore + refresh persisted session; null if none/invalid. */
    async init(): Promise<Session | null> {
      const raw = await kv.getItem(KEY);
      if (!raw) return null;
      const old = JSON.parse(raw) as Session;
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
