import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Candidate, PipelineStage, StageChange } from "@/lib/types";

function rowToCandidate(row: any, history: any[]): Candidate {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    notes: row.notes,
    source: row.source as any,
    stage: row.stage as PipelineStage,
    status: row.status as any,
    potentialStartDate: row.potential_start_date,
    hasSalesPitchAccess: row.has_sales_pitch_access,
    hasEvoAppAccess: row.has_evo_app_access,
    recruitedBy: row.recruited_by,
    archivedAt: row.archived_at,
    history: history.map((h) => ({
      from: h.from_stage as PipelineStage,
      to: h.to_stage as PipelineStage,
      date: h.changed_at?.split("T")[0] ?? "",
      note: h.note,
    })),
    createdAt: row.created_at,
  };
}

export function useCandidates(scope: "own" | "all" = "own") {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCandidates = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase.from("candidates").select("*");
    if (scope === "own") {
      query = query.eq("user_id", user.id);
    }
    // Exclude archived candidates from active views
    query = query.is("archived_at", null);
    const { data: rows } = await query.order("created_at", { ascending: true });

    if (!rows) { setLoading(false); return; }

    const ids = rows.map((r) => r.id);
    let historyRows: any[] = [];
    if (ids.length > 0) {
      const { data } = await supabase
        .from("candidate_stage_history")
        .select("*")
        .in("candidate_id", ids)
        .order("changed_at", { ascending: true });
      historyRows = data ?? [];
    }

    const historyMap: Record<string, any[]> = {};
    (historyRows ?? []).forEach((h) => {
      if (!historyMap[h.candidate_id]) historyMap[h.candidate_id] = [];
      historyMap[h.candidate_id].push(h);
    });

    setCandidates(rows.map((r) => rowToCandidate(r, historyMap[r.id] ?? [])));
    setLoading(false);
  }, [user, scope]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  const addCandidate = useCallback(async (candidate: Omit<Candidate, "id" | "history" | "createdAt">) => {
    if (!user) return;
    const { data, error } = await supabase.from("candidates").insert({
      user_id: user.id,
      name: candidate.name,
      phone: candidate.phone,
      notes: candidate.notes,
      source: candidate.source,
      stage: candidate.stage,
      status: candidate.status || null,
      potential_start_date: candidate.potentialStartDate || null,
      has_sales_pitch_access: candidate.hasSalesPitchAccess,
      has_evo_app_access: candidate.hasEvoAppAccess,
      recruited_by: candidate.recruitedBy || null,
    }).select().single();

    if (data) {
      setCandidates((prev) => [...prev, rowToCandidate(data, [])]);
    }
    return { data, error };
  }, [user]);

  const updateCandidate = useCallback(async (id: string, updates: Partial<Candidate>, stageChange?: StageChange) => {
    if (!user) return;

    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.stage !== undefined) dbUpdates.stage = updates.stage;
    if (updates.status !== undefined) dbUpdates.status = updates.status || null;
    if (updates.potentialStartDate !== undefined) dbUpdates.potential_start_date = updates.potentialStartDate || null;
    if (updates.hasSalesPitchAccess !== undefined) dbUpdates.has_sales_pitch_access = updates.hasSalesPitchAccess;
    if (updates.hasEvoAppAccess !== undefined) dbUpdates.has_evo_app_access = updates.hasEvoAppAccess;
    if (updates.recruitedBy !== undefined) dbUpdates.recruited_by = updates.recruitedBy || null;
    if (updates.archivedAt !== undefined) dbUpdates.archived_at = updates.archivedAt;

    await supabase.from("candidates").update(dbUpdates).eq("id", id);

    if (stageChange) {
      await supabase.from("candidate_stage_history").insert({
        candidate_id: id,
        from_stage: stageChange.from,
        to_stage: stageChange.to,
        note: stageChange.note || null,
      });
    }

    await fetchCandidates();
  }, [user, fetchCandidates]);

  const archiveCandidate = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from("candidates").update({ archived_at: new Date().toISOString() }).eq("id", id);
    await fetchCandidates();
  }, [user, fetchCandidates]);

  return { candidates, loading, addCandidate, updateCandidate, archiveCandidate, refetch: fetchCandidates };
}
