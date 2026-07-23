import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let client: ReturnType<typeof createClient> | undefined;

export function supabaseAdmin() {
  const env = serverEnv();
  client ??= createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  return client;
}
