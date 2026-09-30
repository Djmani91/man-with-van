import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_REASONS = ["Driver not responding", "Driver is late", "Driver asked to cancel", "My plans changed", "Other"];

export function ReasonDialog({ open, onOpenChange, title, description, confirmLabel, reasons = DEFAULT_REASONS, onConfirm, busy, tone = "primary" }) {
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const reason = choice === "Other" ? other.trim() : choice;

  const confirm = async () => {
    if (!reason) return;
    await onConfirm(reason);
    setChoice(""); setOther("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-testid="reason-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-2">
          {reasons.map((r) => (
            <button key={r} onClick={() => setChoice(r)} data-testid={`reason-${r.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className={`w-full text-left rounded-xl border-2 px-4 py-2.5 text-sm transition-all ${choice === r ? "border-primary bg-violet-50 font-medium text-slate-900" : "border-slate-200 text-slate-600 hover:border-violet-300"}`}>
              {r}
            </button>
          ))}
          {choice === "Other" && (
            <Textarea value={other} onChange={(e) => setOther(e.target.value)} placeholder="Tell us what happened…" className="mt-1" data-testid="reason-other-text" />
          )}
        </div>
        <Button onClick={confirm} disabled={!reason || busy}
          className={`w-full ${tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-[#4C1D95]"}`}
          data-testid="reason-confirm">
          {busy ? "Please wait…" : confirmLabel}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
