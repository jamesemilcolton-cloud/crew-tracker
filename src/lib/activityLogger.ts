import { supabase } from "@/integrations/supabase/client";

export async function logActivity(
  module: "recruitment" | "linkedin" | "sales",
  action: string,
  count: number = 1
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    await supabase.from("activity_log").insert({
      user_id: user.id,
      user_name: profile?.full_name ?? "Unknown",
      module,
      action,
      count,
    });
  } catch {
    // Silently fail — activity logging should never block user actions
  }
}
