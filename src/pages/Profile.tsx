import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProfileDropdown } from "@/components/ProfileDropdown";

export default function Profile() {
  const navigate = useNavigate();
  const { profile, user, userRole } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [crewName, setCrewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setCrewName(profile.crew_name || "");
    }
  }, [profile]);

  const isManager = userRole?.role === "manager" && !!userRole?.super_admin;

  const handleSave = async () => {
    if (!user || !profile) return;
    setSaving(true);
    try {
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      const fullName = `${trimmedFirst} ${trimmedLast}`.trim();

      // Update profile
      const { error } = await supabase.from("profiles").update({
        first_name: trimmedFirst,
        last_name: trimmedLast,
        full_name: fullName,
        crew_name: crewName.trim(),
      }).eq("user_id", user.id);
      if (error) throw error;

      // Sync name to linked candidate records (matched by phone) — only for non-managers
      if (!isManager && profile.phone) {
        await supabase.from("candidates").update({
          name: fullName,
          first_name: trimmedFirst,
          last_name: trimmedLast,
        }).eq("phone", profile.phone);
      }

      toast.success("Profile updated");
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const roleName = userRole?.role
    ? userRole.role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "—";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/home")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" /> Modules
              </Button>
              <h1 className="text-sm font-semibold text-foreground tracking-tight">Profile</h1>
            </div>
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        <div className="glass-panel p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crewName">Crew Name</Label>
              <Input id="crewName" value={crewName} onChange={e => setCrewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isManager ? "Email (ID)" : "Phone Number (ID)"}</Label>
              <Input value={isManager ? (user?.email || "—") : (profile?.phone || "—")} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={roleName} disabled className="opacity-60" />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </main>
    </div>
  );
}
