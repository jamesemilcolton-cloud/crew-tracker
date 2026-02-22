import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AGE_BANDS, AgeBand, getAskAmounts, calculateCommission } from "@/lib/commission";
import { Check } from "lucide-react";

interface SaleTransactionModalProps {
  open: boolean;
  onConfirm: (data: {
    ageBand: AgeBand;
    askAmount: number;
    isaUpfront: number;
    ownerUpfront: number;
    totalWire: number;
    qualityPending: number;
  }) => void;
  onCancel: () => void;
  saleNumber: number;
  totalSales: number;
}

export function SaleTransactionModal({ open, onConfirm, onCancel, saleNumber, totalSales }: SaleTransactionModalProps) {
  const [ageBand, setAgeBand] = useState<AgeBand | "">("");
  const [askAmount, setAskAmount] = useState<number | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const askAmounts = ageBand ? getAskAmounts(ageBand as AgeBand) : [];
  const commission = ageBand && askAmount !== null ? calculateCommission(ageBand as AgeBand, askAmount) : null;

  // Reset ask amount when age band changes
  useEffect(() => {
    setAskAmount(null);
  }, [ageBand]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setAgeBand("");
      setAskAmount(null);
      setShowConfirmation(false);
      setHasInteracted(false);
    }
  }, [open]);

  // Track user interaction
  useEffect(() => {
    if (ageBand || askAmount !== null) {
      setHasInteracted(true);
    }
  }, [ageBand, askAmount]);

  const resetForm = useCallback(() => {
    setAgeBand("");
    setAskAmount(null);
    setHasInteracted(false);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!commission || !ageBand || askAmount === null) return;

    // Safety: prevent submission if user hasn't interacted since last reset
    if (!hasInteracted) return;

    onConfirm({
      ageBand: ageBand as AgeBand,
      askAmount,
      isaUpfront: commission.isa,
      ownerUpfront: commission.owner,
      totalWire: commission.totalWire,
      qualityPending: commission.qualityPending,
    });

    // Show confirmation then reset
    setShowConfirmation(true);
    setTimeout(() => {
      setShowConfirmation(false);
      resetForm();
    }, 700);
  }, [commission, ageBand, askAmount, hasInteracted, onConfirm, resetForm]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Sale {saleNumber} of {totalSales}
          </DialogTitle>
        </DialogHeader>

        {/* Success confirmation overlay */}
        {showConfirmation && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-medium animate-in fade-in zoom-in duration-200" style={{ color: "hsl(142 70% 45%)" }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "hsl(142 70% 45% / 0.15)" }}>
                <Check className="w-4 h-4" />
              </div>
              Sale Added
            </div>
          </div>
        )}

        <div className="space-y-3">
          {/* Age Band */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Age Band</label>
            <Select value={ageBand} onValueChange={(v) => setAgeBand(v as AgeBand)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select age band" />
              </SelectTrigger>
              <SelectContent>
                {AGE_BANDS.map((band) => (
                  <SelectItem key={band} value={band}>{band}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ask Amount */}
          {ageBand && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ask Amount (£)</label>
              <Select
                value={askAmount !== null ? String(askAmount) : ""}
                onValueChange={(v) => setAskAmount(Number(v))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select amount" />
                </SelectTrigger>
                <SelectContent>
                  {askAmounts.map((amt) => (
                    <SelectItem key={amt} value={String(amt)}>£{amt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Calculated values */}
          {commission && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30">
              <div className="bg-muted/30 rounded-md p-2 text-center">
                <div className="text-[9px] uppercase text-muted-foreground">ISA Upfront</div>
                <div className="text-sm font-bold text-foreground">£{commission.isa.toFixed(2)}</div>
              </div>
              <div className="bg-[hsl(var(--module-sales)/0.1)] rounded-md p-2 text-center">
                <div className="text-[9px] uppercase text-muted-foreground">Total Wire</div>
                <div className="text-sm font-bold text-[hsl(var(--module-sales))]">£{commission.totalWire.toFixed(2)}</div>
              </div>
              <div className="bg-muted/20 rounded-md p-2 text-center opacity-60">
                <div className="text-[9px] uppercase text-muted-foreground">Quality (30%)</div>
                <div className="text-sm font-bold text-muted-foreground">£{commission.qualityPending.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button
            size="sm"
            disabled={!commission || !hasInteracted || showConfirmation}
            onClick={handleConfirm}
            className="bg-[hsl(var(--module-sales))] hover:bg-[hsl(var(--module-sales)/0.85)] text-foreground"
          >
            {showConfirmation ? "Added" : "Add Sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
