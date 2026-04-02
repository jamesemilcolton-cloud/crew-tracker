import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Lock, ShieldAlert } from "lucide-react";

interface InviteData {
  candidateId: string;
  candidateName: string;
  firstName: string;
  lastName: string;
  token: string;
}

export default function Signup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, signUp } = useAuth();
  const token = searchParams.get("token");

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [invalidToken, setInvalidToken] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [crewName, setCrewName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [leaderId, setLeaderId] = useState<string>("none");
  const [leaders, setLeaders] = useState<{ id: string; full_name: string }[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate("/home", { replace: true });
  }, [user, authLoading, navigate]);

  // Validate token and fetch candidate data
  useEffect(() => {
    if (!token) {
      setInvalidToken(true);
      setLoadingInvite(false);
      return;
    }

    (async () => {
      const { data: invite, error: inviteError } = await supabase
        .from("invite_tokens")
        .select("candidate_id, token, used")
        .eq("token", token)
        .eq("used", false)
        .single();

      if (!invite || inviteError) {
        setInvalidToken(true);
        setLoadingInvite(false);
        return;
      }

      // Fetch candidate details
      const { data: candidate } = await supabase
        .from("candidates")
        .select("id, candidate_id, first_name, last_name, name")
        .eq("id", invite.candidate_id)
        .single();

      if (!candidate) {
        setInvalidToken(true);
        setLoadingInvite(false);
        return;
      }

      setInviteData({
        candidateId: candidate.candidate_id,
        candidateName: candidate.name,
        firstName: candidate.first_name || "",
        lastName: candidate.last_name || "",
        token: invite.token,
      });
      setFirstName(candidate.first_name || "");
      setLastName(candidate.last_name || "");
      setLoadingInvite(false);
    })();
  }, [token]);

  // Fetch leaders for dropdown
  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["leader", "manager"]);

      if (!roles || roles.length === 0) {
        setLeaders([]);
        return;
      }

      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, user_id")
        .in("user_id", userIds);

      setLeaders(profiles?.map((p) => ({ id: p.id, full_name: p.full_name })) || []);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) { setError("Username is required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (!inviteData) return;

    setSubmitting(true);

    // Check username uniqueness
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username.trim())
      .maybeSingle();

    if (existingUser) {
      setError("Username is already taken.");
      setSubmitting(false);
      return;
    }

    const selectedLeaderId = leaderId === "none" ? null : leaderId;

    // Find the candidate DB id from the invite
    const { data: candidateRow } = await supabase
      .from("candidates")
      .select("id")
      .eq("candidate_id", inviteData.candidateId)
      .single();

    const { error: signUpError } = await signUp(
      username.trim(),
      password,
      firstName,
      lastName,
      selectedLeaderId,
      crewName,
      candidateRow?.id || undefined
    );

    if (signUpError) {
      setError(signUpError.message || "Signup failed. Please try again.");
      setSubmitting(false);
      return;
    }

    // Mark invite token as used
    await supabase
      .from("invite_tokens")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("token", inviteData.token);

    setSubmitting(false);
    navigate("/home", { replace: true });
  };

  if (authLoading || loadingInvite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (invalidToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="glass-panel-elevated p-8 w-full max-w-md text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <ShieldAlert className="w-6 h-6 text-destructive" />
            <h1 className="text-lg font-semibold text-foreground">Access Denied</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Please use your invite link to create an account.
          </p>
          <div className="flex items-center gap-2 justify-center p-3 bg-muted/30 rounded-lg">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Signup is invite-only. Contact your leader for an invite link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="glass-panel-elevated p-8 w-full max-w-lg">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Create Your Account</h1>
        </div>

        {inviteData && (
          <div className="mb-6 p-3 bg-muted/30 rounded-lg text-center">
            <span className="text-xs text-muted-foreground">Candidate ID: </span>
            <span className="text-xs font-mono font-semibold text-foreground">{inviteData.candidateId}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Crew Name</Label>
            <Input value={crewName} onChange={(e) => setCrewName(e.target.value)} placeholder="Enter your crew name" />
          </div>

          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose a username" required autoComplete="username" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete="new-password" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Your Leader</Label>
            <Select value={leaderId} onValueChange={setLeaderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a leader" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">The Office (No Leader)</SelectItem>
                {leaders.map((leader) => (
                  <SelectItem key={leader.id} value={leader.id}>{leader.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating Account..." : "Create Account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
