import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables for server");
}

// Server-side client with service key (for admin operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Server-side client that respects user authentication
export function createServerClient() {
  const cookieStore = cookies();

  return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
    },
  });
}

// Legacy function for backward compatibility
export async function getSupabaseServerClient() {
  const cookieStore = cookies();

  const supabase = createClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
      },
    },
  );

  const authHeader = cookieStore.get("sb-auth-token")?.value;
  if (authHeader) {
    await supabase.auth.setSession({
      access_token: authHeader,
      refresh_token: "",
    });
  }

  return supabase;
}
