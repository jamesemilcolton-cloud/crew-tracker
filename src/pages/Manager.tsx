import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Home, Trophy, Linkedin, Users, ClipboardCheck, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, subDays, isMonday } from "date-fns";
import { getCalendarWeekBounds } from "@/lib/utils";

import { ManagerHome } from "@/components/manager/ManagerHome";
import { ManagerApprovals } from "@/components/manager/ManagerApprovals";
import { ManagerPerformance } from "@/components/manager/ManagerPerformance";
import { ManagerLinkedIn } from "@/components/manager/ManagerLinkedIn";
import { ManagerTeam } from "@/components/manager/ManagerTeam";
import { ManagerActivityLog } from "@/components/manager/ManagerActivityLog";

interface ManagedUser {
  user_id: string;
  full_name: string;
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
type TabKey = "home" | "performance" | "linkedin" | "team" | "approvals" | "activity";


const TABS: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "approvals", label: "Approvals", icon: ClipboardCheck },
  { key: "performance", label: "Performance", icon: Trophy },
  { key: "linkedin", label: "LinkedIn Intel", icon: Linkedin },
  { key: "team", label: "Team", icon: Users },
  { key: "activity", label: "Activity", icon: ScrollText },
];

export default function Manager() {
  const navigate = useNavigate();
  const { user, userRole, session } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [activityUserId, setActivityUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [roleAction, setRoleAction] = useState<RoleAction>(null);
  const [crewWarning, setCrewWarning] = useState<ManagedUser | null>(null);

  const [promotionQueue, setPromotionQueue] = useState<PromotionQueueEntry[]>([]);
  const [lastWeekIndividual, setLastWeekIndividual] = useState<LeaderboardEntry[]>([]);
  const [lastWeekCrew, setLastWeekCrew] = useState<LeaderboardEntry[]>([]);
  const [dailyPerformers, setDailyPerformers] = useState<DailyPerformer[]>([]);
  const [personalBests, setPersonalBests] = useState<PersonalBestEntry[]>([]);
  const [mondayPBs, setMondayPBs] = useState<PersonalBestEntry[]>([]);
  const [totalSalesToday, setTotalSalesToday] = useState(0);
  const [totalCvsThisWeek, setTotalCvsThisWeek] = useState(0);

  useEffect(() => {
    if (userRole && !(userRole.role === "manager" && userRole.super_admin)) {
      navigate("/home", { replace: true });
    }
  }, [userRole, navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, leader_id, username");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role, super_admin");
    const { data: candidates } = await supabase.from("candidates").select("name, stage, recruited_by").is("archived_at", null);
    const { data: profilesWithId } = await supabase.from("profiles").select("id, user_id, full_name");

    const profileIdToName = new Map<string, string>();
    if (profilesWithId) for (const p of profilesWithId) profileIdToName.set(p.id, p.full_name);

    const roleMap = new Map<string, { role: string; super_admin: boolean }>();
    if (roles) for (const r of roles) roleMap.set(r.user_id, { role: r.role, super_admin: r.super_admin });

    const stageByName = new Map<string, string>();
    if (candidates) for (const c of candidates) stageByName.set(c.name.toLowerCase().trim(), c.stage);

    const managed: ManagedUser[] = (profiles ?? []).map((p) => {
      const r = roleMap.get(p.user_id) ?? { role: "brand_ambassador", super_admin: false };
      const leaderName = p.leader_id ? profileIdToName.get(p.leader_id) ?? null : null;
      const candidateStage = stageByName.get(p.full_name.toLowerCase().trim()) ?? null;
      return { user_id: p.user_id, full_name: p.full_name, leader_id: p.leader_id, leader_name: leaderName, role: r.role, super_admin: r.super_admin, stage: candidateStage };
    });

    setUsers(managed);
    setLoading(false);
  };

  const fetchPromotionQueue = useCallback(async () => {
    const { data: queue } = await supabase.from("promotion_queue").select("*").eq("status", "pending").order("created_at", { ascending: true });
    if (!queue || queue.length === 0) { setPromotionQueue([]); return; }

    const { data: allProfiles } = await supabase.from("profiles").select("id, user_id, full_name, leader_id");
    const profileMap = new Map<string, { full_name: string; user_id: string; leader_id: string | null }>();
    if (allProfiles) allProfiles.forEach(p => profileMap.set(p.id, p));

    const { start: weekStart, end: weekEnd } = getCalendarWeekBounds(0);
    const entries: PromotionQueueEntry[] = [];

    for (const q of queue) {
      const profile = profileMap.get(q.profile_id);
      const leaderProfile = q.leader_profile_id ? profileMap.get(q.leader_profile_id) : null;
      const { data: sales } = await supabase.from("sales_transactions").select("isa_upfront").eq("user_id", q.user_id).gte("date", format(weekStart, "yyyy-MM-dd")).lte("date", format(weekEnd, "yyyy-MM-dd"));
      const weeklySales = sales?.length ?? 0;
      const repProfit = sales?.reduce((sum, s) => sum + Number(s.isa_upfront), 0) ?? 0;
      const { count: crewSize } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("leader_id", q.profile_id);
      const { data: candidate } = await supabase.from("candidates").select("potential_start_date").eq("id", q.candidate_id).single();
      entries.push({ id: q.id, candidate_id: q.candidate_id, user_id: q.user_id, profile_id: q.profile_id, leader_profile_id: q.leader_profile_id, status: q.status, created_at: q.created_at, candidate_name: profile?.full_name ?? "Unknown", leader_name: leaderProfile?.full_name ?? "The Office", weekly_sales: weeklySales, rep_profit: repProfit, crew_size: crewSize ?? 0, start_date: candidate?.potential_start_date ?? null });
    }
    setPromotionQueue(entries);
  }, []);

  const fetchLastWeekLeaderboard = useCallback(async () => {
    const { start: prevWeekStart, end: prevWeekEnd } = getCalendarWeekBounds(-1);
    const { data: allProfiles } = await supabase.from("profiles").select("id, user_id, full_name, leader_id");
    const { data: allRoles } = await supabase.from("user_roles").select("user_id, role, super_admin");
    const roleMap = new Map<string, { role: string; super_admin: boolean }>();
    if (allRoles) allRoles.forEach(r => roleMap.set(r.user_id, r));
    const eligibleProfiles = (allProfiles ?? []).filter(p => { const r = roleMap.get(p.user_id); return r && !(r.role === "manager" && r.super_admin); });
    const { data: transactions } = await supabase.from("sales_transactions").select("user_id, isa_upfront, total_wire").gte("date", format(prevWeekStart, "yyyy-MM-dd")).lte("date", format(prevWeekEnd, "yyyy-MM-dd"));

    const indivMap = new Map<string, number>();
    const crewWireMap = new Map<string, number>();
    if (transactions) for (const t of transactions) { const r = roleMap.get(t.user_id); if (r && r.role === "manager" && r.super_admin) continue; indivMap.set(t.user_id, (indivMap.get(t.user_id) ?? 0) + Number(t.isa_upfront)); crewWireMap.set(t.user_id, (crewWireMap.get(t.user_id) ?? 0) + Number(t.total_wire)); }

    const profileByUserId = new Map<string, { id: string; full_name: string; leader_id: string | null }>();
    if (allProfiles) allProfiles.forEach(p => profileByUserId.set(p.user_id, p));

    const indivSorted = [...indivMap.entries()].map(([uid, val]) => ({ name: profileByUserId.get(uid)?.full_name ?? "Unknown", value: val })).sort((a, b) => b.value - a.value).slice(0, 3);
    const rankedIndiv: LeaderboardEntry[] = [];
    let rank = 1;
    for (let i = 0; i < indivSorted.length; i++) { if (i > 0 && indivSorted[i].value < indivSorted[i - 1].value) rank = i + 1; rankedIndiv.push({ ...indivSorted[i], rank }); }
    setLastWeekIndividual(rankedIndiv);

    const childrenMap = new Map<string, string[]>();
    if (allProfiles) for (const p of allProfiles) { if (p.leader_id) { const arr = childrenMap.get(p.leader_id) ?? []; arr.push(p.id); childrenMap.set(p.leader_id, arr); } }
    const getDescendants = (pid: string): Set<string> => { const result = new Set<string>(); const stack = [pid]; while (stack.length) { const cur = stack.pop()!; for (const child of (childrenMap.get(cur) ?? [])) { if (!result.has(child)) { result.add(child); stack.push(child); } } } return result; };
    const leaderProfiles = eligibleProfiles.filter(p => { const r = roleMap.get(p.user_id); return r?.role === "leader"; });
    const crewProfitEntries: { name: string; value: number }[] = [];
    for (const lp of leaderProfiles) { const descendants = getDescendants(lp.id); descendants.add(lp.id); let total = 0; for (const [uid, val] of crewWireMap) { const prof = profileByUserId.get(uid); if (prof && descendants.has(prof.id)) total += val; } crewProfitEntries.push({ name: lp.full_name, value: total }); }
    const crewSorted = crewProfitEntries.sort((a, b) => b.value - a.value).slice(0, 3);
    const rankedCrew: LeaderboardEntry[] = [];
    rank = 1;
    for (let i = 0; i < crewSorted.length; i++) { if (i > 0 && crewSorted[i].value < crewSorted[i - 1].value) rank = i + 1; rankedCrew.push({ ...crewSorted[i], rank }); }
    setLastWeekCrew(rankedCrew);
  }, []);

  const fetchDailyRecognition = useCallback(async () => {
    const yesterday = subDays(new Date(), 1);
    const dateStr = format(yesterday, "yyyy-MM-dd");
    const { data: transactions } = await supabase.from("sales_transactions").select("user_id, isa_upfront").eq("date", dateStr);
    if (!transactions || transactions.length === 0) { setDailyPerformers([]); return; }
    const { data: allRoles } = await supabase.from("user_roles").select("user_id, role, super_admin");
    const roleMap = new Map<string, { role: string; super_admin: boolean }>();
    if (allRoles) allRoles.forEach(r => roleMap.set(r.user_id, r));
    const userStats = new Map<string, { count: number; profit: number }>();
    for (const t of transactions) { const r = roleMap.get(t.user_id); if (r && r.role === "manager" && r.super_admin) continue; const existing = userStats.get(t.user_id) ?? { count: 0, profit: 0 }; existing.count += 1; existing.profit += Number(t.isa_upfront); userStats.set(t.user_id, existing); }
    const qualified = [...userStats.entries()].filter(([, s]) => s.count >= 2);
    if (qualified.length === 0) { setDailyPerformers([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
    const nameMap = new Map<string, string>();
    if (profiles) profiles.forEach(p => nameMap.set(p.user_id, p.full_name));
    setDailyPerformers(qualified.map(([uid, s]) => ({ name: nameMap.get(uid) ?? "Unknown", sales_count: s.count, rep_profit: s.profit })).sort((a, b) => b.rep_profit - a.rep_profit));
  }, []);

  const fetchPersonalBests = useCallback(async () => {
    const { data: pbs } = await supabase.from("personal_best_log").select("*").eq("displayed", false).order("created_at", { ascending: false });
    if (!pbs || pbs.length === 0) { setPersonalBests([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("id, full_name");
    const nameMap = new Map<string, string>();
    if (profiles) profiles.forEach(p => nameMap.set(p.id, p.full_name));
    setPersonalBests(pbs.map(pb => ({ id: pb.id, name: nameMap.get(pb.profile_id) ?? "Unknown", weekly_sales: pb.weekly_sales, rep_profit: Number(pb.rep_profit), week_start: pb.week_start })));
  }, []);

  const fetchMondayPBs = useCallback(async () => {
    if (!isMonday(new Date())) { setMondayPBs([]); return; }
    const { start: prevWeekStart, end: prevWeekEnd } = getCalendarWeekBounds(-1);
    const { data: pbs } = await supabase.from("personal_best_log").select("*").gte("week_start", format(prevWeekStart, "yyyy-MM-dd")).lte("week_start", format(prevWeekEnd, "yyyy-MM-dd"));
    if (!pbs || pbs.length === 0) { setMondayPBs([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("id, full_name");
    const nameMap = new Map<string, string>();
    if (profiles) profiles.forEach(p => nameMap.set(p.id, p.full_name));
    setMondayPBs(pbs.map(pb => ({ id: pb.id, name: nameMap.get(pb.profile_id) ?? "Unknown", weekly_sales: pb.weekly_sales, rep_profit: Number(pb.rep_profit), week_start: pb.week_start })));
  }, []);

  const fetchQuickStats = useCallback(async () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const { count: salesCount } = await supabase.from("sales_transactions").select("id", { count: "exact", head: true }).eq("date", todayStr);
    setTotalSalesToday(salesCount ?? 0);

    const { start, end } = getCalendarWeekBounds(0);
    const { data: cvs } = await supabase.from("cv_downloads").select("count").gte("download_date", format(start, "yyyy-MM-dd")).lte("download_date", format(end, "yyyy-MM-dd"));
    setTotalCvsThisWeek(cvs?.reduce((s, c) => s + c.count, 0) ?? 0);
  }, []);

  useEffect(() => {
    if (userRole?.role === "manager" && userRole?.super_admin) {
      fetchUsers();
      fetchPromotionQueue();
      fetchLastWeekLeaderboard();
      fetchDailyRecognition();
      fetchPersonalBests();
      fetchMondayPBs();
      fetchQuickStats();
    }
  }, [userRole]);

  const handleApprovePromotion = async (entry: PromotionQueueEntry) => {
    setActionLoading(entry.id);
    try { const { error } = await supabase.functions.invoke("admin-manage-user", { body: { action: "approve_promotion", queue_id: entry.id } }); if (error) throw error; toast.success(`${entry.candidate_name} promoted to Leader`); await fetchPromotionQueue(); await fetchUsers(); } catch (err: any) { toast.error(err.message || "Failed to approve promotion"); } finally { setActionLoading(null); }
  };

  const handleRejectPromotion = async (entry: PromotionQueueEntry) => {
    setActionLoading(entry.id);
    try { const { error } = await supabase.functions.invoke("admin-manage-user", { body: { action: "reject_promotion", queue_id: entry.id } }); if (error) throw error; toast.success(`${entry.candidate_name} returned to Solo stage`); await fetchPromotionQueue(); } catch (err: any) { toast.error(err.message || "Failed to reject promotion"); } finally { setActionLoading(null); }
  };

  const handleDismissPBs = async () => {
    const ids = personalBests.map(pb => pb.id);
    if (ids.length === 0) return;
    try { await supabase.functions.invoke("admin-manage-user", { body: { action: "mark_pb_displayed", pb_ids: ids } }); setPersonalBests([]); } catch { /* silently fail */ }
  };

  const handlePromoteClick = (targetUser: ManagedUser) => { setRoleAction({ type: "promote", user: targetUser }); };

  const handleDemoteClick = async (targetUser: ManagedUser) => {
    setActionLoading(targetUser.user_id);
    try { const { data, error } = await supabase.functions.invoke("admin-manage-user", { body: { action: "check_crew", target_user_id: targetUser.user_id } }); if (error) throw error; if (data?.has_crew) { setCrewWarning(targetUser); } else { setRoleAction({ type: "demote", user: targetUser }); } } catch (err: any) { toast.error(err.message || "Failed to check crew status"); } finally { setActionLoading(null); }
  };

  const handleConfirmRoleChange = async () => {
    if (!roleAction) return;
    const { type, user: targetUser } = roleAction;
    const newRole = type === "promote" ? "leader" : "brand_ambassador";
    setActionLoading(targetUser.user_id);
    setRoleAction(null);
    try { const { error } = await supabase.functions.invoke("admin-manage-user", { body: { action: "update_role", target_user_id: targetUser.user_id, role: newRole } }); if (error) throw error; toast.success(type === "promote" ? `${targetUser.full_name} promoted to Leader` : `${targetUser.full_name} demoted to Brand Ambassador`); await fetchUsers(); } catch (err: any) { toast.error(err.message || `Failed to ${type} user`); } finally { setActionLoading(null); }
  };

  const handleBanUser = async () => {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.user_id);
    try { const { error } = await supabase.functions.invoke("admin-manage-user", { body: { action: "ban_user", target_user_id: deleteTarget.user_id } }); if (error) throw error; toast.success(`${deleteTarget.full_name}'s account has been disabled`); setDeleteTarget(null); await fetchUsers(); } catch (err: any) { toast.error(err.message || "Failed to disable account"); } finally { setActionLoading(null); }
  };

  const handleResetPassword = async (targetUser: ManagedUser) => {
    setActionLoading(targetUser.user_id);
    try { const { data, error } = await supabase.functions.invoke("reset-password", { body: { action: "generate_token", target_user_id: targetUser.user_id } }); if (error) throw error; if (data?.error) throw new Error(data.error); const resetLink = `${window.location.origin}/reset-password?token=${data.token}`; await navigator.clipboard.writeText(resetLink); toast.success(`Reset link for ${targetUser.full_name} copied to clipboard`); } catch (err: any) { toast.error(err.message || "Failed to generate reset link"); } finally { setActionLoading(null); }
  };

  const renderTab = () => {
    switch (activeTab) {
      case "home":
        return <ManagerHome promotionCount={promotionQueue.length} personalBestCount={personalBests.length} totalSalesToday={totalSalesToday} totalCvsThisWeek={totalCvsThisWeek} onNavigate={(tab) => setActiveTab(tab as TabKey)} />;
      case "approvals":
        return <ManagerApprovals promotionQueue={promotionQueue} personalBests={personalBests} mondayPBs={mondayPBs} actionLoading={actionLoading} onApprove={handleApprovePromotion} onReject={handleRejectPromotion} onDismissPBs={handleDismissPBs} />;
      case "performance":
        return <ManagerPerformance dailyPerformers={dailyPerformers} lastWeekIndividual={lastWeekIndividual} lastWeekCrew={lastWeekCrew} />;
      case "linkedin":
        return <ManagerLinkedIn />;
      case "team":
        return <ManagerTeam users={users} loading={loading} currentUserId={user?.id} actionLoading={actionLoading} onPromote={handlePromoteClick} onDemote={handleDemoteClick} onResetPassword={handleResetPassword} onDisable={setDeleteTarget} />;
      case "activity":
        return <ManagerActivityLog />;
      default:
        return null;
    }
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
            <h1 className="text-sm font-semibold text-foreground tracking-tight">Manager Dashboard</h1>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-14 z-40 overflow-x-auto">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 lg:px-6 py-6">
        {renderTab()}
      </main>

      {/* Promote / Demote Confirmation */}
      <AlertDialog open={!!roleAction} onOpenChange={(open) => !open && setRoleAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{roleAction?.type === "promote" ? "Promote to Leader" : "Demote to Brand Ambassador"}</AlertDialogTitle>
            <AlertDialogDescription>
              {roleAction?.type === "promote" ? (<>Are you sure you want to promote <strong>{roleAction?.user.full_name}</strong> to Leader?<br /><br />This will unlock Recruitment and Leaderboards access.</>) : (<>Are you sure you want to demote <strong>{roleAction?.user.full_name}</strong>?<br /><br />This will remove Recruitment and Leaderboards access.</>)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRoleChange} className={roleAction?.type === "demote" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}>{roleAction?.type === "promote" ? "Confirm Promotion" : "Confirm Demotion"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Crew Warning */}
      <AlertDialog open={!!crewWarning} onOpenChange={(open) => !open && setCrewWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Demote</AlertDialogTitle>
            <AlertDialogDescription><strong>{crewWarning?.full_name}</strong> has active crew members.<br /><br />Reassign or remove their crew before demotion.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>OK</AlertDialogCancel></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disable Account */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Account</AlertDialogTitle>
            <AlertDialogDescription>This will disable login access for <strong>{deleteTarget?.full_name}</strong>. Their pipeline data and historical records will be preserved. This action can be reversed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBanUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Disable Account</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
