import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    // ===== GENERATE TOKEN (Manager only) =====
    if (action === "generate_token") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
      if (authError || !caller) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify super_admin
      const { data: roleCheck } = await adminClient
        .from("user_roles")
        .select("super_admin")
        .eq("user_id", caller.id)
        .eq("role", "manager")
        .eq("super_admin", true)
        .single();

      if (!roleCheck) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { target_user_id } = body;
      if (!target_user_id || typeof target_user_id !== "string") {
        return new Response(JSON.stringify({ error: "target_user_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check for existing unused token — reuse it
      const { data: existing } = await adminClient
        .from("password_reset_tokens")
        .select("token")
        .eq("user_id", target_user_id)
        .eq("used", false)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ token: existing.token }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new token
      const { data: newToken, error: insertErr } = await adminClient
        .from("password_reset_tokens")
        .insert({ user_id: target_user_id, created_by: caller.id })
        .select("token")
        .single();

      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({ token: newToken.token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== RESET PASSWORD (Public, token-based) =====
    if (action === "reset_password") {
      const { token: resetToken, new_password } = body;

      if (!resetToken || typeof resetToken !== "string") {
        return new Response(JSON.stringify({ error: "Token is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!new_password || typeof new_password !== "string" || new_password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Look up valid token
      const { data: tokenRecord, error: tokenErr } = await adminClient
        .from("password_reset_tokens")
        .select("id, user_id, used")
        .eq("token", resetToken)
        .single();

      if (tokenErr || !tokenRecord) {
        return new Response(JSON.stringify({ error: "Invalid or expired reset link" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (tokenRecord.used) {
        return new Response(JSON.stringify({ error: "This reset link has already been used" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update the user's password
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(
        tokenRecord.user_id,
        { password: new_password }
      );

      if (updateErr) throw updateErr;

      // Mark token as used
      await adminClient
        .from("password_reset_tokens")
        .update({ used: true, used_at: new Date().toISOString() })
        .eq("id", tokenRecord.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
