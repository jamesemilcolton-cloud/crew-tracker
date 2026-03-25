import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, UserCheck, UserMinus, Trash2, CheckCircle, XCircle, Trophy, Flame, Star, Crown, Activity, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { subWeeks, format, subDays, startOfDay, endOfDay, isMonday } from "date-fns";
import { getCalendarWeekBounds } from "@/lib/utils";
import { OfficePerformanceOverview } from "@/components/manager/OfficePerformanceOverview";

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

interface PromotionQueueEntry {
  id: string;
  candidate_id: string;
  user_id: string;
  profile_id: string;
  leader_profile_id: string | null;
  status: string;
  created_at: string;
  candidate_name: string;
  leader_name: string;
  weekly_sales: number;
  rep_profit: number;
  crew_size: number;
  start_date: string | null;
}

interface LeaderboardEntry {
  name: string;
  value: number;
  rank: number;
}

interface DailyPerformer {
  name: string;
  sales_count: number;
  rep_profit: number;
}

interface PersonalBestEntry {
  id: string;
  name: string;
  weekly_sales: number;
  rep_profit: number;
  week_start: string;
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

  // New state for sections
  const [promotionQueue, setPromotionQueue] = useState<PromotionQueueEntry[]>([]);
  const [lastWeekIndividual, setLastWeekIndividual] = useState<LeaderboardEntry[]>([]);
  const [lastWeekCrew, setLastWeekCrew] = useState<LeaderboardEntry[]>([]);
  const [dailyPerformers, setDailyPerformers] = useState<DailyPerformer[]>([]);
  const [personalBests, setPersonalBests] = useState<PersonalBestEntry[]>([]);
  const [mondayPBs, setMondayPBs] = useState<PersonalBestEntry[]>([]);

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

  const fetchPromotionQueue = useCallback(async () => {
    const { data: queue } = await supabase
      .from("promotion_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!queue || queue.length === 0) {
      setPromotionQueue([]);
      return;
    }

    // Get profiles & sales data for enrichment
    const { data: allProfiles } = await supabase.from("profiles").select("id, user_id, full_name, leader_id");
    const profileMap = new Map<string, { full_name: string; user_id: string; leader_id: string | null }>();
    if (allProfiles) allProfiles.forEach(p => profileMap.set(p.id, p));

    const now = new Date();
    const { start: weekStart, end: weekEnd } = getCalendarWeekBounds(0);

    const entries: PromotionQueueEntry[] = [];

    for (const q of queue) {
      const profile = profileMap.get(q.profile_id);
      const leaderProfile = q.leader_profile_id ? profileMap.get(q.leader_profile_id) : null;

      // Get weekly sales for this user
      const { data: sales } = await supabase
        .from("sales_transactions")
        .select("isa_upfront")
        .eq("user_id", q.user_id)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));

      const weeklySales = sales?.length ?? 0;
      const repProfit = sales?.reduce((sum, s) => sum + Number(s.isa_upfront), 0) ?? 0;

      // Get crew size (direct reports count)
      const { count: crewSize } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("leader_id", q.profile_id);

      // Get candidate start date
      const { data: candidate } = await supabase
        .from("candidates")
        .select("potential_start_date")
        .eq("id", q.candidate_id)
        .single();

      entries.push({
        id: q.id,
        candidate_id: q.candidate_id,
        user_id: q.user_id,
        profile_id: q.profile_id,
        leader_profile_id: q.leader_profile_id,
        status: q.status,
        created_at: q.created_at,
        candidate_name: profile?.full_name ?? "Unknown",
        leader_name: leaderProfile?.full_name ?? "The Office",
        weekly_sales: weeklySales,
        rep_profit: repProfit,
        crew_size: crewSize ?? 0,
        start_date: candidate?.potential_start_date ?? null,
      });
    }

    setPromotionQueue(entries);
  }, []);

  const fetchLastWeekLeaderboard = useCallback(async () => {
    const { start: prevWeekStart, end: prevWeekEnd } = getCalendarWeekBounds(-1);

    const { data: allProfiles } = await supabase.from("profiles").select("id, user_id, full_name, leader_id");
    const { data: allRoles } = await supabase.from("user_roles").select("user_id, role, super_admin");

    const roleMap = new Map<string, { role: string; super_admin: boolean }>();
    if (allRoles) allRoles.forEach(r => roleMap.set(r.user_id, r));

    // Exclude managers
    const eligibleProfiles = (allProfiles ?? []).filter(p => {
      const r = roleMap.get(p.user_id);
      return r && !(r.role === "manager" && r.super_admin);
    });

    const { data: transactions } = await supabase
      .from("sales_transactions")
      .select("user_id, isa_upfront, total_wire")
      .gte("date", format(prevWeekStart, "yyyy-MM-dd"))
      .lte("date", format(prevWeekEnd, "yyyy-MM-dd"));

    // Individual Rep Profit (isa_upfront)
    const indivMap = new Map<string, number>();
    const crewWireMap = new Map<string, number>();

    if (transactions) {
      for (const t of transactions) {
        const r = roleMap.get(t.user_id);
        if (r && r.role === "manager" && r.super_admin) continue;
        indivMap.set(t.user_id, (indivMap.get(t.user_id) ?? 0) + Number(t.isa_upfront));
        crewWireMap.set(t.user_id, (crewWireMap.get(t.user_id) ?? 0) + Number(t.total_wire));
      }
    }

    const profileByUserId = new Map<string, { id: string; full_name: string; leader_id: string | null }>();
    if (allProfiles) allProfiles.forEach(p => profileByUserId.set(p.user_id, p));

    // Individual top 3
    const indivSorted = [...indivMap.entries()]
      .map(([uid, val]) => ({ name: profileByUserId.get(uid)?.full_name ?? "Unknown", value: val }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    // Assign ranks with standard competition ranking
    const rankedIndiv: LeaderboardEntry[] = [];
    let rank = 1;
    for (let i = 0; i < indivSorted.length; i++) {
      if (i > 0 && indivSorted[i].value < indivSorted[i - 1].value) rank = i + 1;
      rankedIndiv.push({ ...indivSorted[i], rank });
    }
    setLastWeekIndividual(rankedIndiv);

    // Crew Profit = sum of total_wire for leader + all recursive descendants
    // Build descendant map
    const childrenMap = new Map<string, string[]>();
    if (allProfiles) {
      for (const p of allProfiles) {
        if (p.leader_id) {
          const arr = childrenMap.get(p.leader_id) ?? [];
          arr.push(p.id);
          childrenMap.set(p.leader_id, arr);
        }
      }
    }

    const getDescendants = (pid: string): Set<string> => {
      const result = new Set<string>();
      const stack = [pid];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const child of (childrenMap.get(cur) ?? [])) {
          if (!result.has(child)) {
            result.add(child);
            stack.push(child);
          }
        }
      }
      return result;
    };

    // Only leaders (not managers) qualify for crew profit
    const leaderProfiles = eligibleProfiles.filter(p => {
      const r = roleMap.get(p.user_id);
      return r?.role === "leader";
    });

    const crewProfitEntries: { name: string; value: number }[] = [];
    for (const lp of leaderProfiles) {
      const descendants = getDescendants(lp.id);
      descendants.add(lp.id);
      // Sum total_wire for all members
      let total = 0;
      for (const [uid, val] of crewWireMap) {
        const prof = profileByUserId.get(uid);
        if (prof && descendants.has(prof.id)) total += val;
      }
      crewProfitEntries.push({ name: lp.full_name, value: total });
    }

    const crewSorted = crewProfitEntries.sort((a, b) => b.value - a.value).slice(0, 3);
    const rankedCrew: LeaderboardEntry[] = [];
    rank = 1;
    for (let i = 0; i < crewSorted.length; i++) {
      if (i > 0 && crewSorted[i].value < crewSorted[i - 1].value) rank = i + 1;
      rankedCrew.push({ ...crewSorted[i], rank });
    }
    setLastWeekCrew(rankedCrew);
  }, []);

  const fetchDailyRecognition = useCallback(async () => {
    const yesterday = subDays(new Date(), 1);
    const dateStr = format(yesterday, "yyyy-MM-dd");

    const { data: transactions } = await supabase
      .from("sales_transactions")
      .select("user_id, isa_upfront")
      .eq("date", dateStr);

    if (!transactions || transactions.length === 0) {
      setDailyPerformers([]);
      return;
    }

    const { data: allRoles } = await supabase.from("user_roles").select("user_id, role, super_admin");
    const roleMap = new Map<string, { role: string; super_admin: boolean }>();
    if (allRoles) allRoles.forEach(r => roleMap.set(r.user_id, r));

    // Aggregate per user
    const userStats = new Map<string, { count: number; profit: number }>();
    for (const t of transactions) {
      const r = roleMap.get(t.user_id);
      if (r && r.role === "manager" && r.super_admin) continue;
      const existing = userStats.get(t.user_id) ?? { count: 0, profit: 0 };
      existing.count += 1;
      existing.profit += Number(t.isa_upfront);
      userStats.set(t.user_id, existing);
    }

    // Filter 2+ sales
    const qualified = [...userStats.entries()].filter(([, s]) => s.count >= 2);

    if (qualified.length === 0) {
      setDailyPerformers([]);
      return;
    }

    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
    const nameMap = new Map<string, string>();
    if (profiles) profiles.forEach(p => nameMap.set(p.user_id, p.full_name));

    const performers: DailyPerformer[] = qualified
      .map(([uid, s]) => ({
        name: nameMap.get(uid) ?? "Unknown",
        sales_count: s.count,
        rep_profit: s.profit,
      }))
      .sort((a, b) => b.rep_profit - a.rep_profit);

    setDailyPerformers(performers);
  }, []);

  const fetchPersonalBests = useCallback(async () => {
    // Fetch undisplayed personal best entries
    const { data: pbs } = await supabase
      .from("personal_best_log")
      .select("*")
      .eq("displayed", false)
      .order("created_at", { ascending: false });

    if (!pbs || pbs.length === 0) {
      setPersonalBests([]);
      return;
    }

    const { data: profiles } = await supabase.from("profiles").select("id, full_name");
    const nameMap = new Map<string, string>();
    if (profiles) profiles.forEach(p => nameMap.set(p.id, p.full_name));

    setPersonalBests(pbs.map(pb => ({
      id: pb.id,
      name: nameMap.get(pb.profile_id) ?? "Unknown",
      weekly_sales: pb.weekly_sales,
      rep_profit: Number(pb.rep_profit),
      week_start: pb.week_start,
    })));
  }, []);

  const fetchMondayPBs = useCallback(async () => {
    const now = new Date();
    if (!isMonday(now)) {
      setMondayPBs([]);
      return;
    }

    const { start: prevWeekStart, end: prevWeekEnd } = getCalendarWeekBounds(-1);

    const { data: pbs } = await supabase
      .from("personal_best_log")
      .select("*")
      .gte("week_start", format(prevWeekStart, "yyyy-MM-dd"))
      .lte("week_start", format(prevWeekEnd, "yyyy-MM-dd"));

    if (!pbs || pbs.length === 0) {
      setMondayPBs([]);
      return;
    }

    const { data: profiles } = await supabase.from("profiles").select("id, full_name");
    const nameMap = new Map<string, string>();
    if (profiles) profiles.forEach(p => nameMap.set(p.id, p.full_name));

    setMondayPBs(pbs.map(pb => ({
      id: pb.id,
      name: nameMap.get(pb.profile_id) ?? "Unknown",
      weekly_sales: pb.weekly_sales,
      rep_profit: Number(pb.rep_profit),
      week_start: pb.week_start,
    })));
  }, []);

  useEffect(() => {
    if (userRole?.role === "manager" && userRole?.super_admin) {
      fetchUsers();
      fetchPromotionQueue();
      fetchLastWeekLeaderboard();
      fetchDailyRecognition();
      fetchPersonalBests();
      fetchMondayPBs();
    }
  }, [userRole]);

  const handleApprovePromotion = async (entry: PromotionQueueEntry) => {
    setActionLoading(entry.id);
    try {
      const { error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "approve_promotion", queue_id: entry.id },
      });
      if (error) throw error;
      toast.success(`${entry.candidate_name} promoted to Leader`);
      await fetchPromotionQueue();
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve promotion");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPromotion = async (entry: PromotionQueueEntry) => {
    setActionLoading(entry.id);
    try {
      const { error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "reject_promotion", queue_id: entry.id },
      });
      if (error) throw error;
      toast.success(`${entry.candidate_name} returned to Solo stage`);
      await fetchPromotionQueue();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject promotion");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismissPBs = async () => {
    const ids = personalBests.map(pb => pb.id);
    if (ids.length === 0) return;
    try {
      await supabase.functions.invoke("admin-manage-user", {
        body: { action: "mark_pb_displayed", pb_ids: ids },
      });
      setPersonalBests([]);
    } catch {
      // silently fail
    }
  };

  const handlePromoteClick = (targetUser: ManagedUser) => {
    setRoleAction({ type: "promote", user: targetUser });
  };

  const handleDemoteClick = async (targetUser: ManagedUser) => {
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
    const labels: Record<string, string> = { brand_ambassador: "Brand Ambassador", leader: "Leader", manager: "Manager" };
    return labels[role] ?? role;
  };

  const roleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    if (role === "manager") return "default";
    if (role === "leader") return "secondary";
    return "outline";
  };

  const rankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
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
                <Badge variant={roleBadgeVariant(u.role)}>{roleLabel(u.role)}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{u.leader_name ?? "The Office"}</TableCell>
              <TableCell>
                {!isSelf && isBA && (
                  <Button variant="outline" size="sm" onClick={() => handlePromoteClick(u)} disabled={actionLoading === u.user_id}>
                    <UserCheck className="w-4 h-4 mr-1" /> Promote
                  </Button>
                )}
                {!isSelf && isLeader && (
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleDemoteClick(u)} disabled={actionLoading === u.user_id}>
                    <UserMinus className="w-4 h-4 mr-1" /> {actionLoading === u.user_id ? "Checking crew…" : "Demote"}
                  </Button>
                )}
                {(isSelf || u.role === "manager") && <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-right">
                {!isSelf && !u.super_admin ? (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(u)} disabled={actionLoading === u.user_id}>
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
            <h1 className="text-sm font-semibold text-foreground tracking-tight">Manager Dashboard</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 lg:px-6 py-6 space-y-6">

        {/* ===== PROMOTION APPROVAL QUEUE ===== */}
        <section>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" /> Promotion Approval Queue
                {promotionQueue.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{promotionQueue.length} pending</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {promotionQueue.length === 0 ? (
                <p className="text-xs text-muted-foreground">No pending promotions.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Leader</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Weekly Sales</TableHead>
                      <TableHead>Rep Profit</TableHead>
                      <TableHead>Crew Size</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promotionQueue.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.candidate_name}</TableCell>
                        <TableCell className="text-muted-foreground">{entry.leader_name}</TableCell>
                        <TableCell className="text-muted-foreground">{entry.start_date ?? "—"}</TableCell>
                        <TableCell>{entry.weekly_sales}</TableCell>
                        <TableCell>£{entry.rep_profit.toFixed(2)}</TableCell>
                        <TableCell>{entry.crew_size}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" onClick={() => handleApprovePromotion(entry)} disabled={actionLoading === entry.id} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <CheckCircle className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectPromotion(entry)} disabled={actionLoading === entry.id} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                            <XCircle className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ===== PERSONAL BEST ANNOUNCEMENTS ===== */}
        {personalBests.length > 0 && (
          <section>
            <Card className="glass-panel border-amber-500/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" /> 🔥 Personal Best Achieved
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={handleDismissPBs} className="text-xs text-muted-foreground">
                    Dismiss
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {personalBests.map((pb) => (
                    <div key={pb.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <div>
                        <p className="font-medium text-sm">{pb.name}</p>
                        <p className="text-xs text-muted-foreground">Week of {pb.week_start}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{pb.weekly_sales} sales</p>
                        <p className="text-xs text-muted-foreground">£{pb.rep_profit.toFixed(2)} rep profit</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ===== MONDAY WEEKLY RECOGNITION ===== */}
        {mondayPBs.length > 0 && isMonday(new Date()) && (
          <section>
            <Card className="glass-panel border-yellow-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  🏆 Weekly Personal Best Achievers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mondayPBs.map((pb) => (
                    <div key={pb.id} className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                      <div>
                        <p className="font-medium text-sm">{pb.name}</p>
                        <p className="text-xs text-muted-foreground">Week of {pb.week_start}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{pb.weekly_sales} sales</p>
                        <p className="text-xs text-muted-foreground">£{pb.rep_profit.toFixed(2)} rep profit</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ===== DAILY RECOGNITION (YESTERDAY) ===== */}
        <section>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" /> Yesterday's Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyPerformers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No one logged 2+ sales yesterday.</p>
              ) : (
                <div className="space-y-2">
                  {dailyPerformers.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                      <p className="font-medium text-sm">{p.name}</p>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{p.sales_count} sales</p>
                        <p className="text-xs text-muted-foreground">£{p.rep_profit.toFixed(2)} rep profit</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ===== LAST WEEK RESULTS ===== */}
        <section>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" /> Last Week Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Individual */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top Individual Profit (Rep Profit)</h4>
                  {lastWeekIndividual.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data for last week.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {lastWeekIndividual.map((e, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30">
                          <span className="text-sm">
                            <span className="mr-2">{rankEmoji(e.rank)}</span>
                            {e.name}
                          </span>
                          <span className="text-sm font-semibold">£{e.value.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Crew */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top Crew Profit (Total Wire)</h4>
                  {lastWeekCrew.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data for last week.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {lastWeekCrew.map((e, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30">
                          <span className="text-sm">
                            <span className="mr-2">{rankEmoji(e.rank)}</span>
                            {e.name}
                          </span>
                          <span className="text-sm font-semibold">£{e.value.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ===== OFFICE PERFORMANCE OVERVIEW ===== */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Office Performance Overview
          </h2>
          <OfficePerformanceOverview />
        </section>

        {/* ===== USER MANAGEMENT TABLES ===== */}
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No users found.</div>
        ) : (
          <>
            {(() => {
              const officeUsers = users.filter(u => u.leader_id === null && u.role === "brand_ambassador");
              if (officeUsers.length === 0) return null;
              return (
                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-2">Unassigned / Office</h2>
                  <div className="glass-panel overflow-hidden">{renderUserTable(officeUsers)}</div>
                </section>
              );
            })()}
            {(() => {
              const leaders = users.filter(u => u.role === "leader");
              if (leaders.length === 0) return null;
              return (
                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-2">Leaders</h2>
                  <div className="glass-panel overflow-hidden">{renderUserTable(leaders)}</div>
                </section>
              );
            })()}
            {(() => {
              const assignedBAs = users.filter(u => u.leader_id !== null && u.role === "brand_ambassador");
              if (assignedBAs.length === 0) return null;
              return (
                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-2">Brand Ambassadors</h2>
                  <div className="glass-panel overflow-hidden">{renderUserTable(assignedBAs)}</div>
                </section>
              );
            })()}
            {(() => {
              const managers = users.filter(u => u.role === "manager");
              if (managers.length === 0) return null;
              return (
                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-2">Managers</h2>
                  <div className="glass-panel overflow-hidden">{renderUserTable(managers)}</div>
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
                <>Are you sure you want to promote <strong>{roleAction?.user.full_name}</strong> to Leader?<br /><br />This will unlock Recruitment and Leaderboards access.</>
              ) : (
                <>Are you sure you want to demote <strong>{roleAction?.user.full_name}</strong>?<br /><br />This will remove Recruitment and Leaderboards access.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRoleChange} className={roleAction?.type === "demote" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}>
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
              <strong>{crewWarning?.full_name}</strong> has active crew members.<br /><br />Reassign or remove their crew before demotion.
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
            <AlertDialogAction onClick={handleBanUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disable Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
