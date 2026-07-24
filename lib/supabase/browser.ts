"use client";

import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | undefined;

export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Brak publicznej konfiguracji Supabase.");
  client ??= createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return client;
}
