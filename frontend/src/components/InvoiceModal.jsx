import { useRef, useState } from "react";
import { Download, Loader2, CheckCircle2 } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const gbp = (n) => `£${(Number(n) || 0).toFixed(2)}`;

export function InvoiceModal({ booking, open, onOpenChange }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  if (!booking) return null;

  const p = booking.payment || {};
  const subtotal = p.original_price ?? booking.price ?? 0;
  const discount = p.discount || 0;
  const orderTotal = booking.price ?? Math.max(0, subtotal - discount);
  const credit = p.credit_applied || 0;
  const paidNow = p.amount ?? 0;
  const cardCharged = p.card_charged ?? Math.max(0, paidNow - credit);
  const balance = p.balance_due ?? Math.max(0, orderTotal - paidNow);
  const isDeposit = p.type === "deposit";
  const invNo = `INV-${booking.booking_id}`;
  const paidAt = p.paid_at ? new Date(p.paid_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const downloadPdf = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pw) / canvas.width;
      let y = 0;
      if (imgH <= ph) {
        pdf.addImage(img, "PNG", 0, 0, pw, imgH);
      } else {
        // paginate tall invoices
        let remaining = imgH;
        while (remaining > 0) {
          pdf.addImage(img, "PNG", 0, y, pw, imgH);
          remaining -= ph;
          if (remaining > 0) { pdf.addPage(); y -= ph; }
        }
      }
      pdf.save(`${invNo}.pdf`);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="invoice-modal">
        <DialogHeader>
          <DialogTitle className="font-heading">Your invoice</DialogTitle>
          <DialogDescription>Receipt for booking {booking.booking_id}</DialogDescription>
        </DialogHeader>

        {/* Printable invoice */}
        <div ref={ref} className="bg-white p-6 text-[#0f172a]" data-testid="invoice-body">
          <div className="flex items-start justify-between border-b border-[#e2e8f0] pb-4">
            <div>
              <p className="text-xl font-bold text-[#4C1D95]">Man With Van</p>
              <p className="text-xs text-[#64748b]">manwithvanapp.co.uk</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{invNo}</p>
              <p className="text-xs text-[#64748b]">Date paid: {paidAt}</p>
              <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-[11px] font-bold text-[#15803d]" data-testid="invoice-paid-badge"><CheckCircle2 className="h-3 w-3" /> PAID</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4 text-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">Billed to</p>
              <p className="font-semibold">{booking.customer_name || "Customer"}</p>
              {booking.customer_phone && <p className="text-[#64748b]">{booking.customer_phone}</p>}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">Driver</p>
              <p className="font-semibold">{booking.driver?.name || "—"}</p>
              <p className="text-[#64748b]">{booking.driver?.vehicle || booking.van_name || ""}</p>
            </div>
          </div>

          <div className="rounded-lg bg-[#f8fafc] border border-[#e2e8f0] p-3 text-sm mb-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8] mb-1">Move details</p>
            <p><span className="text-[#64748b]">From:</span> {booking.pickup}</p>
            <p><span className="text-[#64748b]">To:</span> {booking.dropoff}</p>
            <p className="mt-1"><span className="text-[#64748b]">When:</span> {booking.date} at {booking.time}</p>
          </div>

          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-[#f1f5f9]">
                <td className="py-2">Move service {booking.van_name ? `(${booking.van_name})` : ""}</td>
                <td className="py-2 text-right">{gbp(subtotal)}</td>
              </tr>
              {discount > 0 && (
                <tr className="border-b border-[#f1f5f9] text-[#15803d]">
                  <td className="py-2">Promo discount {p.promo_code ? `(${p.promo_code})` : ""}</td>
                  <td className="py-2 text-right">−{gbp(discount)}</td>
                </tr>
              )}
              <tr className="border-b border-[#e2e8f0] font-semibold">
                <td className="py-2">Order total</td>
                <td className="py-2 text-right" data-testid="invoice-order-total">{gbp(orderTotal)}</td>
              </tr>
              {credit > 0 && (
                <tr className="border-b border-[#f1f5f9] text-[#15803d]">
                  <td className="py-2">Referral credit applied</td>
                  <td className="py-2 text-right">−{gbp(credit)}</td>
                </tr>
              )}
              <tr className="border-b border-[#f1f5f9]">
                <td className="py-2">Amount paid now ({isDeposit ? "15% deposit" : "full payment"})</td>
                <td className="py-2 text-right font-semibold" data-testid="invoice-paid-now">{gbp(paidNow)}</td>
              </tr>
              <tr>
                <td className="py-2 text-[#64748b]">Paid by card</td>
                <td className="py-2 text-right text-[#64748b]">{gbp(cardCharged)}</td>
              </tr>
            </tbody>
          </table>

          {isDeposit ? (
            <div className="mt-4 rounded-lg bg-[#fffbeb] border border-[#fde68a] p-3" data-testid="invoice-balance-note">
              <p className="text-sm font-bold text-[#92400e]">Deposit paid — remaining balance {gbp(balance)} payable to the driver on moving day.</p>
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-[#dcfce7] border border-[#bbf7d0] p-3" data-testid="invoice-fullypaid-note">
              <p className="text-sm font-bold text-[#15803d]">Paid in full — nothing further to pay. Extra charges may apply only for changes on the day.</p>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-[#e2e8f0] text-[11px] text-[#94a3b8]">
            <p>Payment reference: {p.transaction_id || "—"} · Processed securely by Square.</p>
            <p>Thank you for booking with Man With Van.</p>
          </div>
        </div>

        <Button onClick={downloadPdf} disabled={busy} className="w-full bg-[#4C1D95] hover:bg-[#3b1675] h-11" data-testid="invoice-download-btn">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Preparing PDF…</> : <><Download className="h-4 w-4 mr-2" /> Download PDF</>}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
