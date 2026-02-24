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

    // Verify caller is super_admin
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

    // Check super_admin
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

    const body = await req.json();
    const { action, target_user_id, role, queue_id } = body;

    // Prevent self-modification (except queue actions)
    if (target_user_id === caller.id && !["approve_promotion", "reject_promotion"].includes(action)) {
      return new Response(JSON.stringify({ error: "Cannot modify own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve_promotion") {
      // Get queue entry
      const { data: queueEntry, error: qErr } = await adminClient
        .from("promotion_queue")
        .select("*")
        .eq("id", queue_id)
        .eq("status", "pending")
        .single();

      if (qErr || !queueEntry) {
        return new Response(JSON.stringify({ error: "Queue entry not found or already resolved" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upgrade role to leader
      const { error: roleErr } = await adminClient
        .from("user_roles")
        .update({ role: "leader" })
        .eq("user_id", queueEntry.user_id)
        .eq("role", "brand_ambassador");

      if (roleErr) throw roleErr;

      // Mark queue entry as approved
      const { error: updateErr } = await adminClient
        .from("promotion_queue")
        .update({ status: "approved", resolved_at: new Date().toISOString(), resolved_by: caller.id })
        .eq("id", queue_id);

      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject_promotion") {
      // Get queue entry
      const { data: queueEntry, error: qErr } = await adminClient
        .from("promotion_queue")
        .select("*")
        .eq("id", queue_id)
        .eq("status", "pending")
        .single();

      if (qErr || !queueEntry) {
        return new Response(JSON.stringify({ error: "Queue entry not found or already resolved" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Revert candidate stage back to solo
      const { error: candErr } = await adminClient
        .from("candidates")
        .update({ stage: "solo" })
        .eq("id", queueEntry.candidate_id);

      if (candErr) throw candErr;

      // Mark queue entry as rejected
      const { error: updateErr } = await adminClient
        .from("promotion_queue")
        .update({ status: "rejected", resolved_at: new Date().toISOString(), resolved_by: caller.id })
        .eq("id", queue_id);

      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "mark_pb_displayed") {
      const { pb_ids } = body;
      if (pb_ids && pb_ids.length > 0) {
        const { error } = await adminClient
          .from("personal_best_log")
          .update({ displayed: true })
          .in("id", pb_ids);
        if (error) throw error;
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ban_user") {
      // First reassign recruits upward before banning
      await adminClient.rpc("reassign_recruits_upward", { _deleted_user_id: target_user_id });
      
      const { error } = await adminClient.auth.admin.updateUserById(target_user_id, {
        ban_duration: "876000h",
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unban_user") {
      const { error } = await adminClient.auth.admin.updateUserById(target_user_id, {
        ban_duration: "none",
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_crew") {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("user_id", target_user_id)
        .single();

      if (!profile) {
        return new Response(JSON.stringify({ has_crew: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: directReports, error: drError } = await adminClient
        .from("profiles")
        .select("id")
        .eq("leader_id", profile.id)
        .limit(1);

      if (drError) throw drError;

      const { data: recruits, error: rcError } = await adminClient
        .from("candidates")
        .select("id")
        .eq("recruited_by", profile.id)
        .is("archived_at", null)
        .limit(1);

      if (rcError) throw rcError;

      const hasCrew = (directReports && directReports.length > 0) || (recruits && recruits.length > 0);

      return new Response(JSON.stringify({ has_crew: hasCrew }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      const { error } = await adminClient
        .from("user_roles")
        .update({ role })
        .eq("user_id", target_user_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_user") {
      const { error } = await adminClient.auth.admin.deleteUser(target_user_id);
      if (error) throw error;
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
