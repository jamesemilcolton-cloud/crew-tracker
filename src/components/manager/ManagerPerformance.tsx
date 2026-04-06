import { Star, Trophy, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OfficePerformanceOverview } from "./OfficePerformanceOverview";

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

interface ManagerPerformanceProps {
  dailyPerformers: DailyPerformer[];
  lastWeekIndividual: LeaderboardEntry[];
  lastWeekCrew: LeaderboardEntry[];
}

const rankEmoji = (rank: number) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
};

export function ManagerPerformance({ dailyPerformers, lastWeekIndividual, lastWeekCrew }: ManagerPerformanceProps) {
  return (
    <div className="space-y-6">
      {/* Yesterday's Top Performers */}
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

      {/* Last Week Results */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" /> Last Week Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top Individual Profit (Rep Profit)</h4>
              {lastWeekIndividual.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data for last week.</p>
              ) : (
                <div className="space-y-1.5">
                  {lastWeekIndividual.map((e, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30">
                      <span className="text-sm"><span className="mr-2">{rankEmoji(e.rank)}</span>{e.name}</span>
                      <span className="text-sm font-semibold">£{e.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top Crew Profit (Total Wire)</h4>
              {lastWeekCrew.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data for last week.</p>
              ) : (
                <div className="space-y-1.5">
                  {lastWeekCrew.map((e, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30">
                      <span className="text-sm"><span className="mr-2">{rankEmoji(e.rank)}</span>{e.name}</span>
                      <span className="text-sm font-semibold">£{e.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Office Performance Overview */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Office Performance Overview
        </h2>
        <OfficePerformanceOverview />
      </section>
    </div>
  );
}
