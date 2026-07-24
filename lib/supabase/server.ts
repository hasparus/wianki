import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

let client: ReturnType<typeof createClient<Database>> | undefined;

export function supabaseAdmin() {
  const env = serverEnv();
  client ??= createClient<Database>(
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
