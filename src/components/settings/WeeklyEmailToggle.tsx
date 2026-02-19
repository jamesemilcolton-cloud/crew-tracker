import { useState, useEffect } from "react";
import { Mail } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function WeeklyEmailToggle() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("weekly_email_enabled")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setEnabled(data.weekly_email_enabled);
        setLoading(false);
      });
  }, [user]);

  const toggle = async (val: boolean) => {
    if (!user) return;
    setEnabled(val);
    const { error } = await supabase
      .from("profiles")
      .update({ weekly_email_enabled: val })
      .eq("user_id", user.id);
    if (error) {
      setEnabled(!val);
      toast.error("Failed to update preference");
    } else {
      toast.success(val ? "Weekly emails enabled" : "Weekly emails disabled");
    }
  };

  if (loading) return null;

  return (
    <div className="flex items-center gap-2">
      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Weekly Report</span>
      <Switch checked={enabled} onCheckedChange={toggle} className="scale-75" />
    </div>
  );
}
