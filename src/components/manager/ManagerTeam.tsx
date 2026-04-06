import { useState } from "react";
import { Search, ChevronDown, ChevronRight, UserCheck, UserMinus, Trash2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ManagedUser {
  user_id: string;
  full_name: string;
  leader_id: string | null;
  leader_name: string | null;
  role: string;
  super_admin: boolean;
  stage: string | null;
}

interface ManagerTeamProps {
  users: ManagedUser[];
  loading: boolean;
  currentUserId: string | undefined;
  actionLoading: string | null;
  onPromote: (u: ManagedUser) => void;
  onDemote: (u: ManagedUser) => void;
  onResetPassword: (u: ManagedUser) => void;
  onDisable: (u: ManagedUser) => void;
}

const roleLabel = (role: string) => {
  const labels: Record<string, string> = { brand_ambassador: "Brand Ambassador", leader: "Leader", manager: "Manager" };
  return labels[role] ?? role;
};

const roleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
  if (role === "manager") return "default";
  if (role === "leader") return "secondary";
  return "outline";
};

export function ManagerTeam({ users, loading, currentUserId, actionLoading, onPromote, onDemote, onResetPassword, onDisable }: ManagerTeamProps) {
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ leaders: true, bas: false, managers: false, unassigned: false });

  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const filtered = users.filter(u => u.full_name.toLowerCase().includes(search.toLowerCase()));

  const sections = [
    { key: "leaders", label: "Leaders", users: filtered.filter(u => u.role === "leader") },
    { key: "bas", label: "Brand Ambassadors", users: filtered.filter(u => u.role === "brand_ambassador" && u.leader_id !== null) },
    { key: "managers", label: "Managers", users: filtered.filter(u => u.role === "manager") },
    { key: "unassigned", label: "Unassigned / Office", users: filtered.filter(u => u.leader_id === null && u.role === "brand_ambassador") },
  ];

  if (loading) return <div className="text-center text-muted-foreground py-8">Loading users...</div>;

  const renderTable = (userList: ManagedUser[]) => (
    <div className="overflow-x-auto">
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
            const isSelf = u.user_id === currentUserId;
            const isBA = u.role === "brand_ambassador";
            const isLeader = u.role === "leader";
            return (
              <TableRow key={u.user_id}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell><Badge variant={roleBadgeVariant(u.role)}>{roleLabel(u.role)}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{u.leader_name ?? "The Office"}</TableCell>
                <TableCell>
                  {!isSelf && isBA && (
                    <Button variant="outline" size="sm" onClick={() => onPromote(u)} disabled={actionLoading === u.user_id}>
                      <UserCheck className="w-4 h-4 mr-1" /> Promote
                    </Button>
                  )}
                  {!isSelf && isLeader && (
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => onDemote(u)} disabled={actionLoading === u.user_id}>
                      <UserMinus className="w-4 h-4 mr-1" /> {actionLoading === u.user_id ? "Checking…" : "Demote"}
                    </Button>
                  )}
                  {(isSelf || u.role === "manager") && <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {!isSelf && (
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10" onClick={() => onResetPassword(u)} disabled={actionLoading === u.user_id} title="Reset Password">
                      <KeyRound className="w-4 h-4" />
                    </Button>
                  )}
                  {!isSelf && !u.super_admin && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDisable(u)} disabled={actionLoading === u.user_id}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search users by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {sections.map((section) => {
        if (section.users.length === 0) return null;
        const isOpen = openSections[section.key] ?? false;
        return (
          <Collapsible key={section.key} open={isOpen} onOpenChange={() => toggleSection(section.key)}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center gap-2 py-2 cursor-pointer">
                {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <h3 className="text-sm font-semibold text-foreground">{section.label}</h3>
                <Badge variant="outline" className="ml-auto">{section.users.length}</Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="glass-panel overflow-hidden mt-1">
                {renderTable(section.users)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
