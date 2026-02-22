import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Trash2, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function ProfileDropdown() {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAllData = async () => {
    if (!user || deleteConfirm !== "DELETE") return;
    setDeleting(true);
    try {
      // Delete cv_downloads linked to user's ad_uploads
      const { data: myAds } = await supabase.from("ad_uploads").select("id").eq("user_id", user.id);
      const adIds = (myAds ?? []).map(a => a.id);
      if (adIds.length > 0) {
        await supabase.from("cv_downloads").delete().in("ad_upload_id", adIds);
      }
      await supabase.from("cv_downloads").delete().eq("user_id", user.id);

      // Delete candidate stage history
      const { data: myCandidates } = await supabase.from("candidates").select("id").eq("user_id", user.id);
      const candidateIds = (myCandidates ?? []).map(c => c.id);
      if (candidateIds.length > 0) {
        await supabase.from("candidate_stage_history").delete().in("candidate_id", candidateIds);
      }

      // Delete candidates
      await supabase.from("candidates").delete().eq("user_id", user.id);

      // Delete linkedin activity
      await supabase.from("linkedin_activity").delete().eq("user_id", user.id);

      // Delete ad uploads
      await supabase.from("ad_uploads").delete().eq("user_id", user.id);

      // Delete sales data
      await supabase.from("sales_entries").delete().eq("user_id", user.id);
      await supabase.from("sales_transactions").delete().eq("user_id", user.id);

      toast.success("All your data has been deleted.");
      setDeleteOpen(false);
      setDeleteConfirm("");
      // Navigate home to refresh everything
      navigate("/home");
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete data.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            {profile?.full_name ?? "Account"}
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover z-50 w-48">
          <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2">
            <User className="w-4 h-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
            Delete All My Data
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeleteConfirm(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All My Data</DialogTitle>
            <DialogDescription>
              This will permanently remove all your recruitment and sales data and reset your account as if it was newly created.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm:
            </p>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== "DELETE" || deleting}
              onClick={handleDeleteAllData}
            >
              {deleting ? "Deleting…" : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
