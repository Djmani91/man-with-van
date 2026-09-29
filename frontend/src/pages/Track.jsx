import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Truck, Clock, CheckCircle2, Circle } from "lucide-react";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { TrackingMap } from "@/components/TrackingMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Track() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

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
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        <Button variant="ghost" onClick={() => navigate("/account")} className="gap-2 mb-4" data-testid="track-back">
          <ArrowLeft className="h-4 w-4" /> Back to bookings
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
                <a href={`tel:${data.driver.phone}`} className="mt-3 inline-flex items-center gap-2 text-primary font-medium text-sm" data-testid="track-driver-phone">
                  <Phone className="h-4 w-4" /> {data.driver.phone}
                </a>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-sm text-slate-500" data-testid="track-no-driver">
                A driver will be assigned by dispatch shortly.
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
    </div>
  );
}
