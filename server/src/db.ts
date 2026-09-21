import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy server/.env.example to server/.env and fill in your project's values (Supabase dashboard → Project Settings → API)."
  );
}

// Supabase's realtime client expects a native `WebSocket` global, which only
// exists from Node 22 onward. On Node 20 it throws at client creation unless
// a WebSocket implementation is handed to it explicitly — this app doesn't
// use realtime subscriptions at all, but the client still needs to construct
// without crashing.
export const supabase = createClient(url, key, {
  auth: { persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
});