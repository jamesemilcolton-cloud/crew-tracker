import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, UserCheck, UserMinus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type RoleAction = { type: "promote" | "demote"; user: ManagedUser } | null;

export default function Manager() {
  const navigate = useNavigate();
  const { user, userRole, session } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [roleAction, setRoleAction] = useState<RoleAction>(null);
  const [crewWarning, setCrewWarning] = useState<ManagedUser | null>(null);

  useEffect(() => {
    if (userRole && !(userRole.role === "manager" && userRole.super_admin)) {
      navigate("/home", { replace: true });
    }
  }, [userRole, navigate]);

  const fetchUsers = async () => {
    setLoading(true);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone, leader_id");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role, super_admin");

    const { data: candidates } = await supabase
      .from("candidates")
      .select("name, stage, recruited_by")
      .is("archived_at", null);

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

  const handlePromoteClick = (targetUser: ManagedUser) => {
    setRoleAction({ type: "promote", user: targetUser });
  };

  const handleDemoteClick = async (targetUser: ManagedUser) => {
    // Check for crew before showing demotion dialog
    setActionLoading(targetUser.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "check_crew", target_user_id: targetUser.user_id },
      });
      if (error) throw error;

      if (data?.has_crew) {
        setCrewWarning(targetUser);
      } else {
        setRoleAction({ type: "demote", user: targetUser });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to check crew status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!roleAction) return;
    const { type, user: targetUser } = roleAction;
    const newRole = type === "promote" ? "leader" : "brand_ambassador";

    setActionLoading(targetUser.user_id);
    setRoleAction(null);

    try {
      const { error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "update_role", target_user_id: targetUser.user_id, role: newRole },
      });
      if (error) throw error;
      toast.success(
        type === "promote"
          ? `${targetUser.full_name} promoted to Leader`
          : `${targetUser.full_name} demoted to Brand Ambassador`
      );
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${type} user`);
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

  const renderUserTable = (userList: ManagedUser[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Leader</TableHead>
          <TableHead>Promote / Demote</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {userList.map((u) => {
          const isSelf = u.user_id === user?.id;
          const isBA = u.role === "brand_ambassador";
          const isLeader = u.role === "leader";

          return (
            <TableRow key={u.user_id}>
              <TableCell className="font-medium">{u.full_name}</TableCell>
              <TableCell>
                <Badge variant={roleBadgeVariant(u.role)}>
                  {roleLabel(u.role)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{u.leader_name ?? "The Office"}</TableCell>
              <TableCell>
                {!isSelf && isBA && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePromoteClick(u)}
                    disabled={actionLoading === u.user_id}
                  >
                    <UserCheck className="w-4 h-4 mr-1" />
                    Promote
                  </Button>
                )}
                {!isSelf && isLeader && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => handleDemoteClick(u)}
                    disabled={actionLoading === u.user_id}
                  >
                    <UserMinus className="w-4 h-4 mr-1" />
                    {actionLoading === u.user_id ? "Checking crew…" : "Demote"}
                  </Button>
                )}
                {(isSelf || u.role === "manager") && (
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
        })}
      </TableBody>
    </Table>
  );

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

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 lg:px-6 py-6 space-y-6">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No users found.</div>
        ) : (
          <>
            {/* Unassigned / Office Users */}
            {(() => {
              const officeUsers = users.filter(u => u.leader_id === null && u.role === "brand_ambassador");
              if (officeUsers.length === 0) return null;
              return (
                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-2">Unassigned / Office</h2>
                  <div className="glass-panel overflow-hidden">
                    {renderUserTable(officeUsers)}
                  </div>
                </section>
              );
            })()}

            {/* Leaders */}
            {(() => {
              const leaders = users.filter(u => u.role === "leader");
              if (leaders.length === 0) return null;
              return (
                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-2">Leaders</h2>
                  <div className="glass-panel overflow-hidden">
                    {renderUserTable(leaders)}
                  </div>
                </section>
              );
            })()}

            {/* Assigned Brand Ambassadors */}
            {(() => {
              const assignedBAs = users.filter(u => u.leader_id !== null && u.role === "brand_ambassador");
              if (assignedBAs.length === 0) return null;
              return (
                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-2">Brand Ambassadors</h2>
                  <div className="glass-panel overflow-hidden">
                    {renderUserTable(assignedBAs)}
                  </div>
                </section>
              );
            })()}

            {/* Managers */}
            {(() => {
              const managers = users.filter(u => u.role === "manager");
              if (managers.length === 0) return null;
              return (
                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-2">Managers</h2>
                  <div className="glass-panel overflow-hidden">
                    {renderUserTable(managers)}
                  </div>
                </section>
              );
            })()}
          </>
        )}
      </main>

      {/* Promote / Demote Confirmation */}
      <AlertDialog open={!!roleAction} onOpenChange={(open) => !open && setRoleAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {roleAction?.type === "promote" ? "Promote to Leader" : "Demote to Brand Ambassador"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {roleAction?.type === "promote" ? (
                <>
                  Are you sure you want to promote <strong>{roleAction?.user.full_name}</strong> to Leader?
                  <br /><br />
                  This will unlock Recruitment and Leaderboards access.
                </>
              ) : (
                <>
                  Are you sure you want to demote <strong>{roleAction?.user.full_name}</strong>?
                  <br /><br />
                  This will remove Recruitment and Leaderboards access.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRoleChange}
              className={
                roleAction?.type === "demote"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {roleAction?.type === "promote" ? "Confirm Promotion" : "Confirm Demotion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Crew Warning */}
      <AlertDialog open={!!crewWarning} onOpenChange={(open) => !open && setCrewWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Demote</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{crewWarning?.full_name}</strong> has active crew members.
              <br /><br />
              Reassign or remove their crew before demotion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>OK</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disable Account */}
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
