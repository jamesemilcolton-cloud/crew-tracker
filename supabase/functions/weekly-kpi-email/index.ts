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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();
  const day = now.getUTCDay();
  const monday = new Date(now);
  const diffToMonday = day === 0 ? -6 : 1 - day;
  monday.setUTCDate(now.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const saturday = new Date(monday);
  saturday.setUTCDate(monday.getUTCDate() + 5);
  saturday.setUTCHours(23, 59, 59, 999);

  const mondayStr = monday.toISOString().slice(0, 10);
  const saturdayStr = saturday.toISOString().slice(0, 10);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, weekly_email_enabled");

  if (profilesErr) {
    console.error("Error fetching profiles:", profilesErr);
    return new Response(JSON.stringify({ error: profilesErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const enabledProfiles = (profiles || []).filter(
    (p: any) => p.weekly_email_enabled
  );

  let sentCount = 0;
  const errors: string[] = [];

  for (const profile of enabledProfiles) {
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(
        profile.user_id
      );
      if (!userData?.user?.email) continue;
      const email = userData.user.email;

      // --- PIPELINE DATA ---
      const { data: candidates } = await supabase
        .from("candidates")
        .select("id, stage, status, potential_start_date, created_at")
        .eq("user_id", profile.user_id);

      const { data: history } = await supabase
        .from("candidate_stage_history")
        .select("candidate_id, from_stage, to_stage, changed_at")
        .gte("changed_at", monday.toISOString())
        .lte("changed_at", saturday.toISOString());

      const userCandidateIds = new Set(
        (candidates || []).map((c: any) => c.id)
      );
      const userHistory = (history || []).filter((h: any) =>
        userCandidateIds.has(h.candidate_id)
      );

      const stageEntries: Record<string, number> = {
        obs: 0,
        final: 0,
        offered: 0,
        start: 0,
        solo: 0,
        promoted: 0,
      };

      for (const c of candidates || []) {
        const created = new Date(c.created_at);
        if (created >= monday && created <= saturday) {
          stageEntries["obs"]++;
        }
      }

      for (const h of userHistory) {
        if (stageEntries[h.to_stage] !== undefined) {
          stageEntries[h.to_stage]++;
        }
      }

      const activeCandidates = (candidates || []).filter(
        (c: any) => c.status !== "Dropped"
      );
      const totalTeam = activeCandidates.length;

      const stagesOrder = ["obs", "final", "offered", "start", "solo", "promoted"];
      const leaders = activeCandidates.filter(
        (c: any) => c.stage === "promoted"
      ).length;
      const bas = activeCandidates.filter((c: any) => {
        const idx = stagesOrder.indexOf(c.stage);
        return idx >= stagesOrder.indexOf("start") && c.stage !== "promoted";
      }).length;

      const obsCount = stageEntries["obs"];
      const starts = stageEntries["start"];
      const promotions = stageEntries["promoted"];
      const obsToStartPct =
        obsCount > 0
          ? ((starts / obsCount) * 100).toFixed(1)
          : "0.0";
      const startToPromotionPct =
        starts > 0
          ? ((promotions / starts) * 100).toFixed(1)
          : "0.0";

      // --- LINKEDIN DATA ---
      const { data: linkedin } = await supabase
        .from("linkedin_activity")
        .select("*")
        .eq("user_id", profile.user_id)
        .gte("activity_date", mondayStr)
        .lte("activity_date", saturdayStr);

      let freeAds = 0,
        paidAds = 0,
        cvs = 0,
        li2ndRounds = 0;
      for (const l of linkedin || []) {
        freeAds += l.free_ads_uploaded || 0;
        paidAds += l.paid_ads_uploaded || 0;
        cvs += l.cvs_downloaded || 0;
        li2ndRounds += l.candidates_attending_2nd_round || 0;
      }

      const html = buildEmailHTML({
        name: profile.full_name,
        weekStart: formatDate(monday),
        weekEnd: formatDate(saturday),
        pipeline: {
          obs: stageEntries["obs"],
          finals: stageEntries["final"],
          offered: stageEntries["offered"],
          starts,
          solos: stageEntries["solo"],
          promotions,
          obsToStartPct,
          startToPromotionPct,
          teamSize: totalTeam,
          totalLeaders: leaders,
          totalBAs: bas,
        },
        linkedin: {
          freeAds,
          paidAds,
          cvs,
          li2ndRounds,
        },
      });

      console.log(`[KPI Email] Would send to ${email}:`, {
        subject: `Weekly Recruitment Summary – ${formatDate(monday)} to ${formatDate(saturday)}`,
        htmlLength: html.length,
      });

      sentCount++;
    } catch (err) {
      console.error(`Error processing ${profile.full_name}:`, err);
      errors.push(profile.full_name);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      sent: sentCount,
      errors,
      week: `${mondayStr} to ${saturdayStr}`,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});

interface EmailData {
  name: string;
  weekStart: string;
  weekEnd: string;
  pipeline: {
    obs: number;
    finals: number;
    offered: number;
    starts: number;
    solos: number;
    promotions: number;
    obsToStartPct: string;
    startToPromotionPct: string;
    teamSize: number;
    totalLeaders: number;
    totalBAs: number;
  };
  linkedin: {
    freeAds: number;
    paidAds: number;
    cvs: number;
    li2ndRounds: number;
  };
}

function buildEmailHTML(data: EmailData): string {
  const { name, weekStart, weekEnd, pipeline: p, linkedin: l } = data;

  const row = (label: string, value: string | number) => `
    <tr>
      <td style="padding: 8px 16px; color: #94a3b8; font-size: 14px; border-bottom: 1px solid #1e293b;">${label}</td>
      <td style="padding: 8px 16px; color: #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #1e293b;">${value}</td>
    </tr>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background-color: #0f1729; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; padding: 32px 16px;">

    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #2dd4bf; font-size: 20px; margin: 0 0 4px 0;">Weekly Recruitment Summary</h1>
      <p style="color: #64748b; font-size: 13px; margin: 0;">${weekStart} – ${weekEnd}</p>
    </div>

    <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 24px;">Hi ${name},</p>

    <!-- Pipeline Section -->
    <div style="background: #1a2332; border-radius: 12px; border: 1px solid #1e293b; margin-bottom: 20px; overflow: hidden;">
      <div style="padding: 12px 16px; border-bottom: 1px solid #1e293b;">
        <h2 style="color: #2dd4bf; font-size: 14px; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">Recruitment Pipeline</h2>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        ${row("Obs", p.obs)}
        ${row("Finals", p.finals)}
        ${row("Offered", p.offered)}
        ${row("Starts", p.starts)}
        ${row("Solos", p.solos)}
        ${row("Promotions", p.promotions)}
        ${row("Obs → Start %", p.obsToStartPct + "%")}
        ${row("Start → Promotion %", p.startToPromotionPct + "%")}
        ${row("Current Team Size", p.teamSize)}
        ${row("Total Leaders", p.totalLeaders)}
        ${row("Total Brand Ambassadors", p.totalBAs)}
      </table>
    </div>

    <!-- LinkedIn Section -->
    <div style="background: #1a2332; border-radius: 12px; border: 1px solid #1e293b; margin-bottom: 24px; overflow: hidden;">
      <div style="padding: 12px 16px; border-bottom: 1px solid #1e293b;">
        <h2 style="color: #2dd4bf; font-size: 14px; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">LinkedIn Activity</h2>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        ${row("Free Ads Uploaded", l.freeAds)}
        ${row("Paid Ads Uploaded", l.paidAds)}
        ${row("CVs Downloaded", l.cvs)}
        ${row("Obs from LinkedIn", l.li2ndRounds)}
      </table>
    </div>

    <p style="color: #475569; font-size: 12px; text-align: center; margin: 0;">Mission Control – Automated Weekly Report</p>
  </div>
</body>
</html>`;
}
