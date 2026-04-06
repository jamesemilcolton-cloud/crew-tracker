import { Crown, Flame, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { isMonday } from "date-fns";

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

interface PersonalBestEntry {
  id: string;
  name: string;
  weekly_sales: number;
  rep_profit: number;
  week_start: string;
}

interface ManagerApprovalsProps {
  promotionQueue: PromotionQueueEntry[];
  personalBests: PersonalBestEntry[];
  mondayPBs: PersonalBestEntry[];
  actionLoading: string | null;
  onApprove: (entry: PromotionQueueEntry) => void;
  onReject: (entry: PromotionQueueEntry) => void;
  onDismissPBs: () => void;
}

export function ManagerApprovals({
  promotionQueue, personalBests, mondayPBs, actionLoading,
  onApprove, onReject, onDismissPBs,
}: ManagerApprovalsProps) {
  return (
    <div className="space-y-6">
      {/* Promotion Queue */}
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
            <div className="overflow-x-auto">
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
                        <Button size="sm" onClick={() => onApprove(entry)} disabled={actionLoading === entry.id} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onReject(entry)} disabled={actionLoading === entry.id} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personal Best Announcements */}
      {personalBests.length > 0 && (
        <Card className="glass-panel border-amber-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" /> 🔥 Personal Best Achieved
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={onDismissPBs} className="text-xs text-muted-foreground">
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
      )}

      {/* Monday Recognition */}
      {mondayPBs.length > 0 && isMonday(new Date()) && (
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
      )}
    </div>
  );
}
