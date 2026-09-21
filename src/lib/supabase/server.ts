import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const memoryCookieStore = new Map<string, { name: string; value: string; options?: Record<string, unknown> }>();

export async function createClient() {
  let cookieStore: Awaited<ReturnType<typeof cookies>> | null = null;
  try {
    cookieStore = await cookies();
  } catch {
    // Outside request scope (e.g. CLI scripts, cron jobs, tests)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  // Use service role key only when strictly outside web request scope (CLI scripts, cron jobs, tests)
  const supabaseKey =
    !cookieStore && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? process.env.SUPABASE_SERVICE_ROLE_KEY
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          if (cookieStore) return cookieStore.getAll();
          return Array.from(memoryCookieStore.values()).map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          if (cookieStore) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore!.set(name, value, options)
              );
            } catch {
            }
          } else {
            cookiesToSet.forEach((c) => memoryCookieStore.set(c.name, c));
          }
        },
      },
    }
  );
}
