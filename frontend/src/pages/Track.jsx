import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Truck, Clock, CheckCircle2, Circle, MessageSquare, Lock, Star, UserX, XCircle, Search } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { ChatModal } from "@/components/ChatModal";
import { ReasonDialog } from "@/components/ReasonDialog";
import { TrackingMap } from "@/components/TrackingMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Track() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [chat, setChat] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const doCancel = async (reason) => {
    setBusy(true);
    try {
      const { data: res } = await api.post(`/bookings/${id}/cancel`, { reason });
      toast.success(res.refund_requested ? "Job cancelled — your refund has been requested." : "Job cancelled.");
      setCancelOpen(false); await load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const doChange = async (reason) => {
    setBusy(true);
    try {
      const { data: res } = await api.post(`/bookings/${id}/change-driver`, { reason });
      toast.success(res.message || "Finding you another driver.");
      setChangeOpen(false); await load();
      navigate("/jobs");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/bookings/${id}/track`);
      setData(data);
    } catch (e) {
      setErr("Could not load this booking.");
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (err) return (
    <div className="min-h-screen bg-slate-50"><Navbar />
      <div className="max-w-3xl mx-auto px-5 py-20 text-center text-slate-500">{err}</div>
    </div>
  );
  if (!data) return (
    <div className="min-h-screen bg-slate-50"><Navbar />
      <div className="max-w-3xl mx-auto px-5 py-20 text-center text-slate-400">Loading live tracking…</div>
    </div>
  );

  const live = !["completed", "cancelled"].includes(data.status);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="hidden sm:block"><Navbar /></div>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6">
        <Button variant="ghost" onClick={() => navigate("/jobs")} className="gap-2 mb-4" data-testid="track-back">
          <ArrowLeft className="h-4 w-4" /> Back to My Jobs
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-heading text-2xl font-bold text-slate-900">{data.booking_id}</h1>
                <p className="text-slate-500 text-sm mt-0.5">{data.pickup} → {data.dropoff}</p>
              </div>
              {live && (
                <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1.5" data-testid="track-live-badge">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE
                </Badge>
              )}
            </div>
            <TrackingMap pickup={data.pickup_coords} dropoff={data.dropoff_coords} driver={data.driver_position} />
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between" data-testid="track-status-bar">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900" data-testid="track-status-label">{data.status_label}</p>
                  <p className="text-xs text-slate-500">Move progress {Math.round(data.progress * 100)}%</p>
                </div>
              </div>
              {live && (
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase tracking-wide flex items-center gap-1 justify-end"><Clock className="h-3 w-3" /> ETA</p>
                  <p className="font-heading text-xl font-bold text-slate-900" data-testid="track-eta">{data.eta_minutes} min</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {data.driver ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5" data-testid="track-driver-card">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Your driver</h3>
                <p className="font-heading text-lg font-semibold text-slate-900 mt-2">{data.driver.name}</p>
                <p className="text-sm text-slate-500">{data.driver.vehicle}</p>
                {data.driver.rating != null && <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {data.driver.rating.toFixed(1)}</p>}
                {data.driver.phone ? (
                  <a href={`tel:${data.driver.phone}`} className="mt-3 inline-flex items-center gap-2 text-primary font-medium text-sm" data-testid="track-driver-phone"><Phone className="h-4 w-4" /> {data.driver.phone}</a>
                ) : (
                  <p className="mt-3 inline-flex items-center gap-2 text-slate-400 text-sm" data-testid="track-phone-locked"><Lock className="h-4 w-4" /> Phone shared after deposit</p>
                )}
                <Button variant="outline" size="sm" onClick={() => setChat(true)} className="mt-3 w-full gap-1.5" data-testid="track-message"><MessageSquare className="h-4 w-4" /> Message driver</Button>
                {data.payment?.status === "paid" && (
                  <div className="mt-3 pt-3 border-t border-slate-100 text-sm">
                    <p className="text-slate-500">Paid ({data.payment.type === "deposit" ? "15% deposit" : "in full"}): <span className="font-semibold text-slate-900">£{data.payment.amount.toFixed(2)}</span></p>
                    {data.payment.balance_due > 0 && <p className="text-slate-500">Cash to driver on day: <span className="font-semibold text-slate-900">£{data.payment.balance_due.toFixed(2)}</span></p>}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-sm text-slate-500" data-testid="track-no-driver">
                A driver will be assigned by dispatch shortly.
              </div>
            )}

            {data.status === "assigned" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-2" data-testid="track-manage">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">Manage job</h3>
                <Button variant="outline" onClick={() => setChangeOpen(true)} className="w-full gap-2" data-testid="track-change-driver"><UserX className="h-4 w-4" /> Change driver</Button>
                <Button variant="ghost" onClick={() => setCancelOpen(true)} className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50" data-testid="track-cancel"><XCircle className="h-4 w-4" /> Cancel job</Button>
                <p className="text-[11px] text-slate-400 text-center">Free cancellation &amp; refund any time before your move.</p>
              </div>
            )}

            {data.status === "quoting" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-2" data-testid="track-searching">
                <div className="flex items-center gap-2 text-slate-700"><Search className="h-4 w-4 text-primary" /><p className="text-sm font-medium">We're finding you a driver</p></div>
                <p className="text-xs text-slate-500">This isn't guaranteed and may take longer close to your move time. You can pick a driver yourself, or cancel for a refund.</p>
                <Button onClick={() => navigate("/jobs")} className="w-full bg-primary hover:bg-[#4C1D95] gap-2" data-testid="track-choose-driver"><Search className="h-4 w-4" /> Choose a driver</Button>
                <Button variant="ghost" onClick={() => setCancelOpen(true)} className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50" data-testid="track-cancel"><XCircle className="h-4 w-4" /> Cancel &amp; request refund</Button>
              </div>
            )}

            {data.status === "cancelled" && data.payment?.refund && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5" data-testid="track-refund-status">
                <p className="text-sm font-semibold text-amber-800">Refund {data.payment.refund.status === "refunded" ? "completed" : "requested"}</p>
                <p className="text-xs text-amber-700 mt-1">£{(data.payment.refund.amount || 0).toFixed(2)} {data.payment.refund.status === "refunded" ? "has been refunded to your card." : "— our team will process this back to your card shortly."}</p>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Timeline</h3>
              <ol className="space-y-4" data-testid="track-timeline">
                {data.timeline.map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{t.label}</p>
                      <p className="text-xs text-slate-400">{new Date(t.at).toLocaleString("en-GB")}</p>
                    </div>
                  </li>
                ))}
                {live && (
                  <li className="flex gap-3 opacity-50">
                    <Circle className="h-5 w-5 text-slate-300 shrink-0" />
                    <p className="text-sm text-slate-400">Awaiting next update…</p>
                  </li>
                )}
              </ol>
            </div>
          </div>
        </div>
      </div>
      {data.driver && <ChatModal bookingId={id} open={chat} onOpenChange={setChat} meRole="customer" />}
      <ReasonDialog open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel this job?"
        description="Full refund any time before your move. Tell us why so we can improve."
        confirmLabel="Cancel job & request refund" tone="danger" busy={busy}
        reasons={["Driver is late", "Driver not responding", "My plans changed", "Found it cheaper elsewhere", "Other"]}
        onConfirm={doCancel} />
      <ReasonDialog open={changeOpen} onOpenChange={setChangeOpen} title="Change your driver?"
        description="We'll find another driver at no extra cost. It's not guaranteed and may take longer close to your move time."
        confirmLabel="Yes, find another driver" busy={busy}
        reasons={["Driver not responding", "Driver is late", "Driver asked to cancel", "Not comfortable with driver", "Other"]}
        onConfirm={doChange} />
      <BottomNav />
    </div>
  );
}
