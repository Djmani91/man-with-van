import { useEffect, useRef, useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ENV = process.env.REACT_APP_SQUARE_ENV || "sandbox";
const APP_ID = process.env.REACT_APP_SQUARE_APPLICATION_ID;
const LOCATION_ID = process.env.REACT_APP_SQUARE_LOCATION_ID;
const SDK_URL = ENV === "production"
  ? "https://web.squarecdn.com/v1/square.js"
  : "https://sandbox.web.squarecdn.com/v1/square.js";

let sdkPromise = null;
function loadSquareSdk() {
  if (window.Square) return Promise.resolve(window.Square);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => resolve(window.Square);
    s.onerror = () => reject(new Error("Could not load the secure payment form."));
    document.body.appendChild(s);
  });
  return sdkPromise;
}

export function SquarePaymentModal({ open, onOpenChange, amount, creditApplied = 0, payType, driverName, onToken }) {
  const cardRef = useRef(null);
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let cardInstance = null;
    setReady(false); setError("");
    (async () => {
      try {
        const Square = await loadSquareSdk();
        if (cancelled) return;
        const payments = Square.payments(APP_ID, LOCATION_ID);
        const card = await payments.card();
        if (cancelled) return;
        await card.attach(containerRef.current);
        cardInstance = card;
        cardRef.current = card;
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError(e.message || "Payment form failed to load.");
      }
    })();
    return () => {
      cancelled = true;
      try { cardInstance?.destroy?.(); } catch { /* noop */ }
      cardRef.current = null;
    };
  }, [open]);

  const pay = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true); setError("");
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        throw new Error(result.errors?.[0]?.message || "Please check your card details.");
      }
      await onToken(result.token);
    } catch (e) {
      setError(e.message || "Payment failed. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-testid="square-payment-modal" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {payType === "deposit" ? "Pay 15% deposit" : "Pay in full"}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-slate-500">
            <Lock className="h-3.5 w-3.5" /> Secure card payment{driverName ? ` to confirm ${driverName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-violet-50 border border-violet-100 p-3">
            <span className="text-sm text-slate-600">Amount to pay now</span>
            <span className="font-heading text-2xl font-bold text-primary" data-testid="square-amount">£{amount.toFixed(2)}</span>
          </div>

          {creditApplied > 0 && (
            <p className="text-xs font-medium text-emerald-600 -mt-2" data-testid="square-credit">
              £{creditApplied.toFixed(2)} referral credit applied
            </p>
          )}

          {!ready && !error && (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading secure card form…
            </div>
          )}

          <div ref={containerRef} id="square-card-container" data-testid="square-card-container"
            className={ready ? "min-h-[52px]" : "hidden"} />

          {error && <p className="text-sm text-red-600" data-testid="square-error">{error}</p>}

          <Button onClick={pay} disabled={!ready || busy} data-testid="square-pay-btn"
            className="w-full bg-primary hover:bg-[#4C1D95] h-11">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing…</> : `Pay £${amount.toFixed(2)}`}
          </Button>

          <p className="flex items-center gap-1.5 text-xs text-slate-400 justify-center">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Payments processed securely by Square
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
