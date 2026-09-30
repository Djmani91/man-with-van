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
  const googleRef = useRef(null);
  const googlePayRef = useRef(null);
  const applePayRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hasGoogle, setHasGoogle] = useState(false);
  const [hasApple, setHasApple] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let cardInstance = null;
    setReady(false); setError(""); setHasGoogle(false); setHasApple(false);
    (async () => {
      try {
        const Square = await loadSquareSdk();
        if (cancelled) return;
        const payments = Square.payments(APP_ID, LOCATION_ID);

        // Digital wallets — each is optional and hidden if the device/browser isn't eligible.
        try {
          const req = payments.paymentRequest({
            countryCode: "GB",
            currencyCode: "GBP",
            total: { amount: amount.toFixed(2), label: "Man With Van" },
          });
          try {
            const gp = await payments.googlePay(req);
            if (!cancelled && googleRef.current) {
              await gp.attach(googleRef.current);
              googlePayRef.current = gp;
              setHasGoogle(true);
            }
          } catch (e) { /* Google Pay unavailable */ }
          try {
            const ap = await payments.applePay(req);
            if (!cancelled) { applePayRef.current = ap; setHasApple(true); }
          } catch (e) { /* Apple Pay unavailable */ }
        } catch (e) { /* paymentRequest unsupported */ }

        // Card form (always available)
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
      try { googlePayRef.current?.destroy?.(); } catch { /* noop */ }
      cardRef.current = null;
      googlePayRef.current = null;
      applePayRef.current = null;
    };
  }, [open, amount]);

  const chargeWith = async (instance) => {
    if (!instance || busy) return;
    setBusy(true); setError("");
    try {
      const result = await instance.tokenize();
      if (result.status !== "OK") {
        throw new Error(result.errors?.[0]?.message || "Payment could not be completed.");
      }
      await onToken(result.token);
    } catch (e) {
      setError(e.message || "Payment failed. Please try again.");
      setBusy(false);
    }
  };

  const pay = () => chargeWith(cardRef.current);
  const payGoogle = () => chargeWith(googlePayRef.current);
  const payApple = () => chargeWith(applePayRef.current);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-testid="square-payment-modal" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {payType === "deposit" ? "Pay 15% deposit" : "Pay in full"}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-slate-500">
            <Lock className="h-3.5 w-3.5" /> Secure payment{driverName ? ` to confirm ${driverName}` : ""}
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
              <Loader2 className="h-4 w-4 animate-spin" /> Loading secure payment form…
            </div>
          )}

          {/* Digital wallets */}
          <div className={ready ? "space-y-2" : "hidden"}>
            <div ref={googleRef} className={hasGoogle ? "min-h-[44px]" : "hidden"} data-testid="square-google-pay" />
            {hasApple && (
              <button type="button" onClick={payApple} disabled={busy}
                className="apple-pay-button w-full" aria-label="Pay with Apple Pay" data-testid="square-apple-pay" />
            )}
            {(hasGoogle || hasApple) && (
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">or pay by card</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            )}
          </div>

          <div ref={containerRef} id="square-card-container" data-testid="square-card-container"
            className={ready ? "min-h-[52px]" : "hidden"} />

          {error && <p className="text-sm text-red-600" data-testid="square-error">{error}</p>}

          <Button onClick={pay} disabled={!ready || busy} data-testid="square-pay-btn"
            className="w-full bg-primary hover:bg-[#4C1D95] h-11">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing…</> : `Pay £${amount.toFixed(2)} by card`}
          </Button>

          <p className="flex items-center gap-1.5 text-xs text-slate-400 justify-center">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Payments processed securely by Square
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
