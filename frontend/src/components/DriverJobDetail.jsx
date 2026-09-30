import { useState } from "react";
import {
  ArrowLeft, Navigation, MapPin, Clock, Calendar, Users, ArrowUpDown, Building2,
  AlertCircle, FileText, Wallet, Send, CheckCircle2, Phone, AlertTriangle,
} from "lucide-react";
import { API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GMAPS_KEY = process.env.REACT_APP_GMAPS_KEY;

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function floorLabel(floor, lift) {
  if (lift) return "Lift";
  if (!floor || floor === 0) return "Ground floor";
  const n = Number(floor);
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix} floor (stairs)`;
}

function stairsWarning(job) {
  const pStairs = !job.pickup_lift && Number(job.pickup_floor) > 0;
  const dStairs = !job.dropoff_lift && Number(job.dropoff_floor) > 0;
  if (dStairs) return `Items must be carried up or down the stairs at drop-off (${floorLabel(job.dropoff_floor, false)}).`;
  if (pStairs) return `Items must be carried up or down the stairs at pickup (${floorLabel(job.pickup_floor, false)}).`;
  return null;
}

export function DriverJobDetail({ job, mode, onClose, onBid, onStatus, onChat, onCancel, onAccept, DRIVER_STEPS, LABEL }) {
  const [price, setPrice] = useState(job.my_bid || "");
  const dist = job.distance_mi ?? job.distance_miles;
  const hours = job.est_hours ?? job.estimated_hours;
  const warning = stairsWarning(job);
  const origin = encodeURIComponent(job.pickup_postcode || job.pickup || "");
  const dest = encodeURIComponent(job.dropoff_postcode || job.dropoff || "");
  const mapUrl = GMAPS_KEY && origin && dest
    ? `https://www.google.com/maps/embed/v1/directions?key=${GMAPS_KEY}&origin=${origin}&destination=${dest}&mode=driving`
    : null;

  const title = mode === "quotation" ? "Quote on job" : mode === "waiting" ? "Your quote" : "Job details";

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto" data-testid="driver-job-detail">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={onClose} className="p-1 -ml-1" data-testid="job-detail-back"><ArrowLeft className="h-6 w-6 text-slate-700" /></button>
          <h1 className="font-heading font-bold text-lg text-slate-900">{title}</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-10">
        {/* Date & time */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-500 mb-1">Date and time</p>
          <p className="flex items-center gap-2 text-slate-800 font-medium"><Calendar className="h-4 w-4 text-slate-400" /> {fmtDate(job.date)}, {job.time}</p>
        </div>

        {/* Pickup / dropoff chips */}
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3" data-testid="job-pickup">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-3 font-heading font-bold text-emerald-600"><span className="h-3 w-3 rounded-full bg-emerald-500" /> {job.pickup_postcode || job.pickup || "—"}</span>
              <Navigation className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5 ml-6"><MapPin className="h-3.5 w-3.5" /> {job.deposit_paid && job.pickup ? job.pickup : "Full address revealed after deposit payment"}</p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-white px-4 py-3" data-testid="job-dropoff">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-3 font-heading font-bold text-primary"><span className="h-3 w-3 rounded-full bg-primary" /> {job.dropoff_postcode || job.dropoff || "—"}</span>
              <Navigation className="h-5 w-5 text-primary" />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5 ml-6"><MapPin className="h-3.5 w-3.5" /> {job.deposit_paid && job.dropoff ? job.dropoff : "Full address revealed after deposit payment"}</p>
          </div>
        </div>

        {/* Map */}
        {mapUrl && (
          <iframe title="route" src={mapUrl} className="w-full h-56 rounded-xl border border-slate-200" loading="lazy" referrerPolicy="no-referrer-when-downgrade" data-testid="job-map" />
        )}

        {/* Duration / distance */}
        <div className="flex gap-2">
          {hours != null && <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"><Clock className="h-4 w-4" /> {hours}h</span>}
          {dist != null && <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"><MapPin className="h-4 w-4" /> {dist} mi</span>}
        </div>

        {/* Customer budget (bidding) / fixed price */}
        {mode === "quotation" && (
          job.fixed_price ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 flex items-start gap-3" data-testid="fixed-price-badge">
              <Wallet className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-heading font-bold text-emerald-800">Fixed price: £{(job.customer_pays || 0).toFixed(0)}</p>
                <p className="text-sm text-emerald-700">Priority job — no bidding. First driver to accept gets it.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3" data-testid="customer-budget">
              <Wallet className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-heading font-bold text-emerald-800">Customer's budget: £{(job.customer_pays || 0).toFixed(0)}</p>
                <p className="text-sm text-emerald-700">Tailor your quote to win this job</p>
              </div>
            </div>
          )
        )}

        {/* Crew required */}
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 flex items-center gap-3" data-testid="crew-required">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0"><Users className="h-5 w-5 text-white" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Crew required</p>
            <p className="font-heading font-bold text-slate-900">{job.needs_helper ? "Driver + helper needed" : "Driver + customer (customer will assist)"}</p>
          </div>
        </div>

        {/* Floors */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-700"><ArrowUpDown className="h-4 w-4 text-primary" /> Pickup</span>
            <span className="font-medium text-slate-900">{floorLabel(job.pickup_floor, job.pickup_lift)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-700"><Building2 className="h-4 w-4 text-slate-400" /> Drop-off</span>
            <span className="font-medium text-slate-900">{floorLabel(job.dropoff_floor, job.dropoff_lift)}</span>
          </div>
        </div>

        {/* Important requirement */}
        {warning && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3" data-testid="important-requirement">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-heading font-bold text-amber-800">Important requirement</p>
              <p className="text-sm text-amber-700">{warning}</p>
            </div>
          </div>
        )}

        {job.congestion_charge && (
          <div className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 flex items-center gap-2" data-testid="job-congestion">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-800">Central London congestion charge zone — factor in the daily charge.</p>
          </div>
        )}

        {/* Notes & photos */}
        {(job.items || job.photos?.length > 0) && (
          <div>
            <p className="flex items-center gap-2 font-heading font-bold text-primary mb-2"><FileText className="h-4 w-4" /> Notes &amp; photo</p>
            {job.items && <p className="text-slate-700 whitespace-pre-line text-sm">{job.items}</p>}
            {job.photos?.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-3" data-testid="job-detail-photos">
                {job.photos.map((p, i) => (
                  <a key={i} href={`${API}/files/${p}`} target="_blank" rel="noreferrer">
                    <img src={`${API}/files/${p}`} alt={`Item ${i + 1}`} className="h-28 w-28 object-cover rounded-lg border border-slate-200" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Earnings breakdown */}
        {(mode !== "quotation" || job.fixed_price) && (
          <div className="border-t border-slate-200 pt-4" data-testid="earnings-breakdown">
            <p className="text-sm text-slate-500 mb-2">Earnings breakdown</p>
            <div className="flex items-center justify-between">
              <span className="font-heading font-bold text-slate-900">Customer pays</span>
              <span className="font-heading font-bold text-slate-900">£{(job.customer_pays || 0).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="font-heading font-bold text-emerald-600">Your earnings</span>
              <span className="font-heading font-bold text-emerald-600">£{(job.your_earnings || 0).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        {mode === "quotation" && (
          job.fixed_price ? (
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => onAccept(job.booking_id)} className="bg-primary hover:bg-[#4C1D95] h-12" data-testid="job-detail-accept"><CheckCircle2 className="h-4 w-4 mr-2" /> Accept job</Button>
                <Button onClick={onClose} variant="outline" className="h-12" data-testid="job-detail-decline">Decline</Button>
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1.5">Your quote (you keep {Math.round((1 - (job.commission_rate ?? 0.15)) * 100)}% — £{((Number(price) || 0) * (1 - (job.commission_rate ?? 0.15))).toFixed(2)})</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">£</span>
                  <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="pl-7 h-12 text-lg" data-testid="job-detail-quote-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => { onBid(job.booking_id, price); onClose(); }} disabled={!price} className="bg-primary hover:bg-[#4C1D95] h-12" data-testid="job-detail-submit-quote"><Send className="h-4 w-4 mr-2" /> Submit quote</Button>
                <Button onClick={onClose} variant="outline" className="h-12" data-testid="job-detail-decline">Decline</Button>
              </div>
            </div>
          )
        )}

        {mode === "waiting" && (
          <div className="border-t border-slate-200 pt-4 flex items-center gap-2 text-amber-600 font-medium"><Clock className="h-4 w-4" /> Waiting for the customer to confirm your quote</div>
        )}

        {mode === "accepted" && (
          <div className="border-t border-slate-200 pt-4 space-y-3">
            {job.customer_phone && <p className="flex items-center gap-2 text-slate-700"><Phone className="h-4 w-4 text-slate-400" /> {job.customer_name} · {job.customer_phone}</p>}
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Update job status</p>
              <div className="grid grid-cols-2 gap-2">
                {DRIVER_STEPS.map((s) => (
                  <Button key={s.v} variant={job.status === s.v ? "default" : "outline"} onClick={() => onStatus(job.booking_id, s.v)} className={job.status === s.v ? "bg-primary hover:bg-[#4C1D95]" : ""} data-testid={`detail-status-${s.v}`}>
                    {job.status === s.v && <CheckCircle2 className="h-4 w-4 mr-1.5" />}{s.l}
                  </Button>
                ))}
              </div>
            </div>
            <Button onClick={() => onChat(job.booking_id)} variant="outline" className="w-full h-11" data-testid="job-detail-chat"><Send className="h-4 w-4 mr-2" /> Message customer</Button>
            <Button onClick={() => onCancel(job)} variant="ghost" className="w-full h-11 text-red-600 hover:text-red-700 hover:bg-red-50" data-testid="job-detail-cancel">Cancel this job</Button>
          </div>
        )}
      </div>
    </div>
  );
}
