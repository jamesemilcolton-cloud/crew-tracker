import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, LogIn, UserPlus } from "lucide-react";

interface LeaderOption {
  id: string;
  full_name: string;
}

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [crewName, setCrewName] = useState("");
  const [leaderId, setLeaderId] = useState<string>("");
  const [leaders, setLeaders] = useState<LeaderOption[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signUp, signIn } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate("/");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (isSignUp) {
      const fetchLeaders = async () => {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["leader", "manager"]);

        if (roles && roles.length > 0) {
          const userIds = roles.map((r: any) => r.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("user_id", userIds);
          setLeaders(profiles ?? []);
        } else {
          setLeaders([]);
        }
      };
      fetchLeaders();
    }
  }, [isSignUp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    if (isSignUp) {
      if (!crewName.trim()) {
        setError("Crew Name is required.");
        setSubmitting(false);
        return;
      }
      if (!phone.trim()) {
        setError("Phone number is required.");
        setSubmitting(false);
        return;
      }
      if (!leaderId || leaderId === "none") {
        setError("You must select a leader.");
        setSubmitting(false);
        return;
      }

      // Check if phone number exists as a candidate in the pipeline
      const { data: matchingCandidates } = await supabase
        .from("candidates")
        .select("id, phone")
        .eq("phone", phone.trim())
        .is("archived_at", null);

      if (!matchingCandidates || matchingCandidates.length === 0) {
        setError("No pipeline record found with this phone number. You must be added to a recruitment pipeline before creating an account.");
        setSubmitting(false);
        return;
      }

      // Check if phone is already used by another profile
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", phone.trim());

      if (existingProfile && existingProfile.length > 0) {
        setError("An account with this phone number already exists.");
        setSubmitting(false);
        return;
      }

      const { error } = await signUp(email, password, fullName, leaderId, crewName.trim(), phone.trim());
      if (error) setError(error.message);
    } else {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="glass-panel-elevated p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Mission Control</h1>
        </div>

        <div className="flex items-center bg-muted/30 rounded-lg p-0.5 mb-6">
          <button
            onClick={() => { setIsSignUp(false); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${!isSignUp ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <LogIn className="w-4 h-4" /> Sign In
          </button>
          <button
            onClick={() => { setIsSignUp(true); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isSignUp ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <UserPlus className="w-4 h-4" /> Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 7700 900000" required />
                <p className="text-[11px] text-muted-foreground">Must match your phone number in an existing recruitment pipeline.</p>
              </div>
              <div className="space-y-2">
                <Label>Crew Name</Label>
                <Input value={crewName} onChange={(e) => setCrewName(e.target.value)} placeholder="e.g. Alpha Crew" required />
                <p className="text-[11px] text-muted-foreground">This will be displayed across the app alongside your name.</p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
          </div>

          {isSignUp && (
            <div className="space-y-2">
              <Label>Select Your Leader</Label>
              <Select value={leaderId} onValueChange={setLeaderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose your leader" />
                </SelectTrigger>
                <SelectContent>
                  {leaders.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Choose the leader you report to in the organisation hierarchy.</p>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
