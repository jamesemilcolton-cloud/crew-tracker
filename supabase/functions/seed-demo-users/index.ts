import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

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
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleCheck } = await admin
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

    // James Colton's profile ID (leader for Grace)
    const jamesProfileId = "eefe7afb-65c2-4537-8b03-39c500fb7811";

    const demoUsers = [
      { email: "grace.turner@demo.local", password: "DemoPass123!", firstName: "Grace", lastName: "Turner", phone: "07700100001", crewName: "Team Grace", role: "leader", leaderId: jamesProfileId },
      { email: "luke.adams@demo.local", password: "DemoPass123!", firstName: "Luke", lastName: "Adams", phone: "07700100002", crewName: "", role: "brand_ambassador", leaderId: null }, // will set to Grace's profile id
      { email: "ore.daniels@demo.local", password: "DemoPass123!", firstName: "Ore", lastName: "Daniels", phone: "07700100003", crewName: "", role: "brand_ambassador", leaderId: null },
      { email: "sophie.reed@demo.local", password: "DemoPass123!", firstName: "Sophie", lastName: "Reed", phone: "07700100004", crewName: "", role: "brand_ambassador", leaderId: null },
      { email: "rob.harris@demo.local", password: "DemoPass123!", firstName: "Rob", lastName: "Harris", phone: "07700100005", crewName: "", role: "brand_ambassador", leaderId: null },
    ];

    const results: any[] = [];
    let graceProfileId: string | null = null;

    for (const u of demoUsers) {
      // Check if user already exists
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id, user_id")
        .eq("phone", u.phone)
        .single();

      if (existingProfile) {
        results.push({ name: `${u.firstName} ${u.lastName}`, status: "already_exists", profileId: existingProfile.id });
        if (u.firstName === "Grace") graceProfileId = existingProfile.id;
        continue;
      }

      // Create auth user
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });

      if (authError) {
        results.push({ name: `${u.firstName} ${u.lastName}`, status: "auth_error", error: authError.message });
        continue;
      }

      const userId = authData.user.id;

      // Determine leader_id
      let leaderId = u.leaderId;
      if (u.firstName !== "Grace" && graceProfileId) {
        leaderId = graceProfileId;
      }

      // Create profile
      const { data: profileData, error: profileError } = await admin.from("profiles").upsert({
        user_id: userId,
        first_name: u.firstName,
        last_name: u.lastName,
        full_name: `${u.firstName} ${u.lastName}`,
        phone: u.phone,
        crew_name: u.crewName,
        leader_id: leaderId,
      }, { onConflict: "user_id" }).select("id").single();

      if (profileError) {
        results.push({ name: `${u.firstName} ${u.lastName}`, status: "profile_error", error: profileError.message });
        continue;
      }

      if (u.firstName === "Grace") {
        graceProfileId = profileData.id;
      }

      // Set role
      if (u.role !== "brand_ambassador") {
        await admin.from("user_roles").update({ role: u.role }).eq("user_id", userId);
      }

      results.push({ name: `${u.firstName} ${u.lastName}`, status: "created", userId, profileId: profileData.id });
    }

    return new Response(JSON.stringify({ success: true, results, graceProfileId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
