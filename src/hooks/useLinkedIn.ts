import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LinkedInActivity, AdUpload, CVDownloadEntry } from "@/lib/types";

export function useLinkedIn() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<LinkedInActivity[]>([]);
  const [adUploads, setAdUploads] = useState<AdUpload[]>([]);
  const [cvDownloads, setCvDownloads] = useState<CVDownloadEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [actRes, adRes, cvRes] = await Promise.all([
      supabase.from("linkedin_activity").select("*").eq("user_id", user.id).order("activity_date", { ascending: true }),
      supabase.from("ad_uploads").select("*").eq("user_id", user.id).order("upload_date", { ascending: true }),
      supabase.from("cv_downloads").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
    ]);

    setActivities((actRes.data ?? []).map((a) => ({
      id: a.id, date: a.activity_date, freeAdsUploaded: a.free_ads_uploaded,
      paidAdsUploaded: a.paid_ads_uploaded, cvsDownloaded: a.cvs_downloaded,
      candidatesAttending2ndRound: a.candidates_attending_2nd_round,
    })));

    setAdUploads((adRes.data ?? []).map((a) => ({
      id: a.id, date: a.upload_date, type: a.ad_type as "free" | "paid",
      titleNumber: (a as any).title_number ?? 1, adNumber: (a as any).ad_number ?? 1,
    })));

    setCvDownloads((cvRes.data ?? []).map((c) => ({
      id: c.id, downloadDate: c.download_date, adUploadId: c.ad_upload_id, count: c.count,
    })));

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const logActivity = useCallback(async (type: "free" | "paid" | "attend", dateOverride?: string) => {
    if (!user) return;
    const today = dateOverride || new Date().toISOString().split("T")[0];

    if (type === "free" || type === "paid") {
      await supabase.from("ad_uploads").insert({
        user_id: user.id,
        upload_date: today,
        ad_type: type,
      });
    }

    // Upsert linkedin_activity
    const { data: existing } = await supabase
      .from("linkedin_activity")
      .select("*")
      .eq("user_id", user.id)
      .eq("activity_date", today)
      .single();

    if (existing) {
      const updates: any = {};
      if (type === "free") updates.free_ads_uploaded = existing.free_ads_uploaded + 1;
      if (type === "paid") updates.paid_ads_uploaded = existing.paid_ads_uploaded + 1;
      if (type === "attend") updates.candidates_attending_2nd_round = existing.candidates_attending_2nd_round + 1;
      await supabase.from("linkedin_activity").update(updates).eq("id", existing.id);
    } else {
      await supabase.from("linkedin_activity").insert({
        user_id: user.id,
        activity_date: today,
        free_ads_uploaded: type === "free" ? 1 : 0,
        paid_ads_uploaded: type === "paid" ? 1 : 0,
        cvs_downloaded: 0,
        candidates_attending_2nd_round: type === "attend" ? 1 : 0,
      });
    }

    await fetchAll();
  }, [user, fetchAll]);

  const logCvDownload = useCallback(async (adUploadId: string, count: number, downloadDate?: string) => {
    if (!user) return;
    const today = downloadDate || new Date().toISOString().split("T")[0];

    await supabase.from("cv_downloads").insert({
      user_id: user.id,
      ad_upload_id: adUploadId,
      download_date: today,
      count,
    });

    const { data: existing } = await supabase
      .from("linkedin_activity")
      .select("*")
      .eq("user_id", user.id)
      .eq("activity_date", today)
      .single();

    if (existing) {
      await supabase.from("linkedin_activity").update({
        cvs_downloaded: existing.cvs_downloaded + count,
      }).eq("id", existing.id);
    } else {
      await supabase.from("linkedin_activity").insert({
        user_id: user.id,
        activity_date: today,
        free_ads_uploaded: 0,
        paid_ads_uploaded: 0,
        cvs_downloaded: count,
        candidates_attending_2nd_round: 0,
      });
    }

    await fetchAll();
  }, [user, fetchAll]);

  return { activities, adUploads, cvDownloads, loading, logActivity, logCvDownload, refetch: fetchAll };
}

// Fetch ALL users' linkedin data for leaderboard
export function useLinkedInAll() {
  const [activities, setActivities] = useState<(LinkedInActivity & { user_id: string })[]>([]);
  const [adUploads, setAdUploads] = useState<(AdUpload & { user_id: string })[]>([]);
  const [cvDownloads, setCvDownloads] = useState<(CVDownloadEntry & { user_id: string })[]>([]);

  const fetchAll = useCallback(async () => {
    const [actRes, adRes, cvRes] = await Promise.all([
      supabase.from("linkedin_activity").select("*").order("activity_date"),
      supabase.from("ad_uploads").select("*").order("upload_date"),
      supabase.from("cv_downloads").select("*").order("created_at"),
    ]);

    setActivities((actRes.data ?? []).map((a) => ({
      id: a.id, user_id: a.user_id, date: a.activity_date,
      freeAdsUploaded: a.free_ads_uploaded, paidAdsUploaded: a.paid_ads_uploaded,
      cvsDownloaded: a.cvs_downloaded, candidatesAttending2ndRound: a.candidates_attending_2nd_round,
    })));

    setAdUploads((adRes.data ?? []).map((a) => ({
      id: a.id, user_id: a.user_id, date: a.upload_date, type: a.ad_type as "free" | "paid",
    })));

    setCvDownloads((cvRes.data ?? []).map((c) => ({
      id: c.id, user_id: c.user_id, downloadDate: c.download_date, adUploadId: c.ad_upload_id, count: c.count,
    })));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { activities, adUploads, cvDownloads };
}
