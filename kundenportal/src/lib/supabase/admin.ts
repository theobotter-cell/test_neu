import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Service-Role-Client – umgeht RLS!
 * Ausschließlich serverseitig verwenden für:
 *  - Auth-Administration (Einladen, Sperren von Logins)
 *  - Cron-Jobs (E-Mail-Versand, periodische Berichte)
 * "server-only" verhindert, dass dieses Modul je im Browser-Bundle landet.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt");
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
