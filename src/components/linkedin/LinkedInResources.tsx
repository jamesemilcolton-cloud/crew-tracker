import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Save, Plus, CalendarIcon, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ActiveAd {
  id: string;
  user_id: string;
  title_number: number;
  ad_number: number;
  ad_type: string;
  upload_date: string;
  is_active: boolean;
  created_at: string;
}

interface ResourceSlot {
  id: string;
  slot_number: number;
  content: string;
  updated_at: string;
}

interface ProfileInfo {
  user_id: string;
  full_name: string;
  crew_name: string;
}

export function LinkedInResources() {
  const { user, userRole } = useAuth();
  const isOwner = userRole?.role === "manager" && userRole?.super_admin;

  const [activeAds, setActiveAds] = useState<ActiveAd[]>([]);
  const [titles, setTitles] = useState<ResourceSlot[]>([]);
  const [ads, setAds] = useState<ResourceSlot[]>([]);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [editingTitle, setEditingTitle] = useState<Record<number, string>>({});
  const [editingAd, setEditingAd] = useState<Record<number, string>>({});
  const [copiedSlot, setCopiedSlot] = useState<string | null>(null);

  // New ad form state
  const [showForm, setShowForm] = useState(false);
  const [newTitleNum, setNewTitleNum] = useState("");
  const [newAdNum, setNewAdNum] = useState("");
  const [newAdType, setNewAdType] = useState("free");
  const [newUploadDate, setNewUploadDate] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    const [adsRes, titlesRes, libRes, profilesRes] = await Promise.all([
      supabase.from("active_linkedin_ads").select("*").order("created_at", { ascending: false }),
      supabase.from("linkedin_titles").select("*").order("slot_number"),
      supabase.from("linkedin_ads_library").select("*").order("slot_number"),
      supabase.from("profiles").select("user_id, full_name, crew_name"),
    ]);
    if (adsRes.data) setActiveAds(adsRes.data as ActiveAd[]);
    if (titlesRes.data) setTitles(titlesRes.data as ResourceSlot[]);
    if (libRes.data) setAds(libRes.data as ResourceSlot[]);
    if (profilesRes.data) setProfiles(profilesRes.data);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getProfileName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p ? p.full_name : "Unknown";
  };
  const getCrewName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p ? p.crew_name : "";
  };

  const handleLogActiveAd = async () => {
    if (!user || !newTitleNum || !newAdNum) {
      toast.error("Please fill in all fields");
      return;
    }
    // Deactivate previous active ad
    await supabase
      .from("active_linkedin_ads")
      .update({ is_active: false } as any)
      .eq("user_id", user.id)
      .eq("is_active", true);

    const { error } = await supabase.from("active_linkedin_ads").insert({
      user_id: user.id,
      title_number: parseInt(newTitleNum),
      ad_number: parseInt(newAdNum),
      ad_type: newAdType,
      upload_date: format(newUploadDate, "yyyy-MM-dd"),
      is_active: true,
    } as any);

    if (error) {
      toast.error("Failed to log active ad");
    } else {
      toast.success("Active ad logged — previous ad deactivated");
      setShowForm(false);
      setNewTitleNum("");
      setNewAdNum("");
      setNewAdType("free");
      setNewUploadDate(new Date());
      fetchAll();
    }
  };

  const handleSaveTitle = async (slot: ResourceSlot) => {
    const newContent = editingTitle[slot.slot_number];
    if (newContent === undefined) return;
    const { error } = await supabase
      .from("linkedin_titles")
      .update({ content: newContent, updated_by: user?.id, updated_at: new Date().toISOString() } as any)
      .eq("id", slot.id);
    if (error) toast.error("Failed to save title");
    else {
      toast.success(`Title ${slot.slot_number} saved`);
      setEditingTitle((prev) => { const n = { ...prev }; delete n[slot.slot_number]; return n; });
      fetchAll();
    }
  };

  const handleSaveAd = async (slot: ResourceSlot) => {
    const newContent = editingAd[slot.slot_number];
    if (newContent === undefined) return;
    const { error } = await supabase
      .from("linkedin_ads_library")
      .update({ content: newContent, updated_by: user?.id, updated_at: new Date().toISOString() } as any)
      .eq("id", slot.id);
    if (error) toast.error("Failed to save ad");
    else {
      toast.success(`Ad ${slot.slot_number} saved`);
      setEditingAd((prev) => { const n = { ...prev }; delete n[slot.slot_number]; return n; });
      fetchAll();
    }
  };

  const handleCopy = async (text: string, slotKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSlot(slotKey);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedSlot(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const numbers = Array.from({ length: 15 }, (_, i) => i + 1);

  return (
    <div className="space-y-8">
      {/* SECTION 1 — Active LinkedIn Ads */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Active LinkedIn Ads</h2>
          <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Log New Ad
          </Button>
        </div>

        {showForm && (
          <Card className="p-4 mb-4 border-primary/30 bg-card/80">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Title Number</label>
                <Select value={newTitleNum} onValueChange={setNewTitleNum}>
                  <SelectTrigger><SelectValue placeholder="Title #" /></SelectTrigger>
                  <SelectContent>{numbers.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ad Number</label>
                <Select value={newAdNum} onValueChange={setNewAdNum}>
                  <SelectTrigger><SelectValue placeholder="Ad #" /></SelectTrigger>
                  <SelectContent>{numbers.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ad Type</label>
                <Select value={newAdType} onValueChange={setNewAdType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Upload Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                      {format(newUploadDate, "dd MMM yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newUploadDate} onSelect={(d) => d && setNewUploadDate(d)} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button size="sm" onClick={handleLogActiveAd}>Submit</Button>
          </Card>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground text-xs">
                <th className="text-left py-2 px-2">Name</th>
                <th className="text-left py-2 px-2">Crew</th>
                <th className="text-center py-2 px-2">Title #</th>
                <th className="text-center py-2 px-2">Ad #</th>
                <th className="text-center py-2 px-2">Type</th>
                <th className="text-center py-2 px-2">Uploaded</th>
                <th className="text-center py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeAds.map((ad) => (
                <tr
                  key={ad.id}
                  className={cn(
                    "border-b border-border/20 transition-opacity",
                    !ad.is_active && "opacity-40"
                  )}
                >
                  <td className="py-2 px-2 text-foreground">{getProfileName(ad.user_id)}</td>
                  <td className="py-2 px-2 text-muted-foreground">{getCrewName(ad.user_id)}</td>
                  <td className="py-2 px-2 text-center">{ad.title_number}</td>
                  <td className="py-2 px-2 text-center">{ad.ad_number}</td>
                  <td className="py-2 px-2 text-center">
                    <Badge variant={ad.ad_type === "paid" ? "default" : "secondary"} className="text-[10px] capitalize">
                      {ad.ad_type}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 text-center text-muted-foreground">{format(new Date(ad.upload_date), "dd MMM")}</td>
                  <td className="py-2 px-2 text-center">
                    {ad.is_active ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">ACTIVE</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] opacity-60">INACTIVE</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {activeAds.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground text-xs">No active ads logged yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 2 — LinkedIn Titles Library */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">LinkedIn Titles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {titles.map((slot) => {
            const isEditing = editingTitle[slot.slot_number] !== undefined;
            const displayContent = isEditing ? editingTitle[slot.slot_number] : slot.content;
            return (
              <Card key={slot.id} className="p-3 bg-card/60 border-border/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-primary">Title {slot.slot_number}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleCopy(slot.content, `t-${slot.slot_number}`)}
                      disabled={!slot.content}
                    >
                      {copiedSlot === `t-${slot.slot_number}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleSaveTitle(slot)}
                        disabled={!isEditing}
                      >
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {isOwner ? (
                  <Textarea
                    value={displayContent}
                    onChange={(e) => setEditingTitle((prev) => ({ ...prev, [slot.slot_number]: e.target.value }))}
                    onFocus={() => {
                      if (editingTitle[slot.slot_number] === undefined) {
                        setEditingTitle((prev) => ({ ...prev, [slot.slot_number]: slot.content }));
                      }
                    }}
                    placeholder="Enter title text…"
                    className="min-h-[60px] text-xs bg-background/50 resize-none"
                  />
                ) : (
                  <p className="text-xs text-foreground/80 min-h-[60px] whitespace-pre-wrap">
                    {slot.content || <span className="text-muted-foreground italic">Empty</span>}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* SECTION 3 — LinkedIn Ads Library */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">LinkedIn Ads</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {ads.map((slot) => {
            const isEditing = editingAd[slot.slot_number] !== undefined;
            const displayContent = isEditing ? editingAd[slot.slot_number] : slot.content;
            return (
              <Card key={slot.id} className="p-3 bg-card/60 border-border/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-accent-foreground">Ad {slot.slot_number}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleCopy(slot.content, `a-${slot.slot_number}`)}
                      disabled={!slot.content}
                    >
                      {copiedSlot === `a-${slot.slot_number}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleSaveAd(slot)}
                        disabled={!isEditing}
                      >
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {isOwner ? (
                  <Textarea
                    value={displayContent}
                    onChange={(e) => setEditingAd((prev) => ({ ...prev, [slot.slot_number]: e.target.value }))}
                    onFocus={() => {
                      if (editingAd[slot.slot_number] === undefined) {
                        setEditingAd((prev) => ({ ...prev, [slot.slot_number]: slot.content }));
                      }
                    }}
                    placeholder="Enter ad text…"
                    className="min-h-[80px] text-xs bg-background/50 resize-none"
                  />
                ) : (
                  <p className="text-xs text-foreground/80 min-h-[80px] whitespace-pre-wrap">
                    {slot.content || <span className="text-muted-foreground italic">Empty</span>}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
