import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, UserCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ManagedUser {
  user_id: string;
  full_name: string;
  phone: string;
  leader_id: string | null;
  leader_name: string | null;
  role: string;
  super_admin: boolean;
  stage: string | null;
}

export default function Manager() {
  const navigate = useNavigate();
  const { user, userRole, session } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Server-side check already handled by RLS + route guard, but double check
  useEffect(() => {
    if (userRole && !(userRole.role === "manager" && userRole.super_admin)) {
      navigate("/home", { replace: true });
    }
  }, [userRole, navigate]);

  const fetchUsers = async () => {
    setLoading(true);

    // Get all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone, leader_id");

    // Get all roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role, super_admin");

    // Get latest stage per user from candidates (their own pipeline stage as a recruit)
    // Actually the "stage" here means the candidate's own pipeline stage if they are also a candidate
    // Let's get the latest candidate stage where recruited_by links to their profile
    // Actually per the spec: "Current pipeline stage" - this is their stage as a candidate in someone's pipeline
    const { data: candidates } = await supabase
      .from("candidates")
      .select("name, stage, recruited_by")
      .is("archived_at", null);

    // Get all profiles for leader name mapping
    const profileMap = new Map<string, { full_name: string; user_id: string }>();
    const profileByUserId = new Map<string, string>();
    if (profiles) {
      for (const p of profiles) {
        profileMap.set(p.user_id, { full_name: p.full_name, user_id: p.user_id });
        profileByUserId.set(p.user_id, p.full_name);
      }
    }

    // Build leader name lookup by profile id
    const leaderNameById = new Map<string, string>();
    if (profiles) {
      for (const p of profiles) {
        // Need profile.id -> full_name mapping
      }
    }
    // We need profile.id too
    const { data: profilesWithId } = await supabase
      .from("profiles")
      .select("id, user_id, full_name");
    const profileIdToName = new Map<string, string>();
    if (profilesWithId) {
      for (const p of profilesWithId) {
        profileIdToName.set(p.id, p.full_name);
      }
    }

    const roleMap = new Map<string, { role: string; super_admin: boolean }>();
    if (roles) {
      for (const r of roles) {
        roleMap.set(r.user_id, { role: r.role, super_admin: r.super_admin });
      }
    }

    // Find candidate stage for each user by matching their name
    // This is approximate - match by profile name to candidate name
    const stageByName = new Map<string, string>();
    if (candidates) {
      for (const c of candidates) {
        stageByName.set(c.name.toLowerCase().trim(), c.stage);
      }
    }

    const managed: ManagedUser[] = (profiles ?? []).map((p) => {
      const r = roleMap.get(p.user_id) ?? { role: "brand_ambassador", super_admin: false };
      const leaderName = p.leader_id ? profileIdToName.get(p.leader_id) ?? null : null;
      const candidateStage = stageByName.get(p.full_name.toLowerCase().trim()) ?? null;
      return {
        user_id: p.user_id,
        full_name: p.full_name,
        phone: p.phone ?? "",
        leader_id: p.leader_id,
        leader_name: leaderName,
        role: r.role,
        super_admin: r.super_admin,
        stage: candidateStage,
      };
    });

    setUsers(managed);
    setLoading(false);
  };

  useEffect(() => {
    if (userRole?.role === "manager" && userRole?.super_admin) {
      fetchUsers();
    }
  }, [userRole]);

  const handlePromoteToggle = async (targetUser: ManagedUser) => {
    const newRole = targetUser.role === "brand_ambassador" ? "leader" : "brand_ambassador";
    setActionLoading(targetUser.user_id);

    try {
      const { error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "update_role", target_user_id: targetUser.user_id, role: newRole },
      });
      if (error) throw error;
      toast.success(`${targetUser.full_name} ${newRole === "leader" ? "promoted to Leader" : "demoted to Brand Ambassador"}`);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanUser = async () => {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.user_id);

    try {
      const { error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "ban_user", target_user_id: deleteTarget.user_id },
      });
      if (error) throw error;
      toast.success(`${deleteTarget.full_name}'s account has been disabled`);
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to disable account");
    } finally {
      setActionLoading(null);
    }
  };

  const stageLabel = (stage: string | null) => {
    if (!stage) return "—";
    const labels: Record<string, string> = {
      obs: "Obs", final: "Final", offered: "Offered",
      start: "Start", solo: "Solo", promoted: "Promoted",
    };
    return labels[stage] ?? stage;
  };

  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      brand_ambassador: "Brand Ambassador",
      leader: "Leader",
      manager: "Manager",
    };
    return labels[role] ?? role;
  };

  const roleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    if (role === "manager") return "default";
    if (role === "leader") return "secondary";
    return "outline";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex items-center gap-3 h-14">
            <Button variant="ghost" size="sm" onClick={() => navigate("/home")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Modules
            </Button>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(270 60% 50% / 0.2)" }}>
              <Shield className="w-4 h-4" style={{ color: "hsl(270 60% 50%)" }} />
            </div>
            <h1 className="text-sm font-semibold text-foreground tracking-tight">User Management</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 lg:px-6 py-6">
        <div className="glass-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Pipeline Stage</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned Leader</TableHead>
                <TableHead>Promote</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const isSelf = u.user_id === user?.id;
                  const isBA = u.role === "brand_ambassador";
                  const isLeader = u.role === "leader";
                  const canToggle = isBA || isLeader;

                  return (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                      <TableCell>{stageLabel(u.stage)}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(u.role)}>
                          {roleLabel(u.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.leader_name ?? "—"}</TableCell>
                      <TableCell>
                        {!isSelf && canToggle ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={u.role === "leader"}
                              onCheckedChange={() => handlePromoteToggle(u)}
                              disabled={actionLoading === u.user_id}
                            />
                            <span className="text-xs text-muted-foreground">
                              {u.role === "leader" ? "Leader" : "BA"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isSelf && !u.super_admin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(u)}
                            disabled={actionLoading === u.user_id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will disable login access for <strong>{deleteTarget?.full_name}</strong>. Their pipeline data and historical records will be preserved. This action can be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBanUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disable Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
