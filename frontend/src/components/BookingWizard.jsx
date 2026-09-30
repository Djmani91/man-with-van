import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, ArrowRight, ArrowLeft, Check, Calendar, Clock, Upload, X, Building2, Loader2,
} from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { getPromo, loadPromo, savePromo } from "@/lib/promo";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const STEPS = ["Addresses", "Floors", "Date & time", "Van", "Photos & items", "Contact"];
const FLOORS = [{ v: 0, l: "Ground" }, { v: 1, l: "1st floor" }, { v: 2, l: "2nd floor" }, { v: 3, l: "3rd+ floor" }];
const DRAFT_KEY = "mwv_booking_draft";

const blank = {
  pickup: "", pickup_flat: "", dropoff: "",
  pickup_floor: 0, pickup_lift: true, dropoff_floor: 0, dropoff_lift: true,
  date: "", time: "", van_size: "",
  items: "", photos: [], customer_name: "", customer_phone: "", notes: "", promo_code: "",
};

export const BookingWizard = ({ compact = true }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [vans, setVans] = useState([]);
  const [quote, setQuote] = useState(null);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) { sessionStorage.removeItem(DRAFT_KEY); return { ...blank, ...JSON.parse(saved) }; }
    } catch {}
    return { ...blank };
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Pre-fill a promo saved by the student-discount widget (once, if the form has none).
  useEffect(() => {
    const saved = loadPromo();
    if (saved && !form.promo_code) set("promo_code", saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const promo = getPromo(form.promo_code);
  const discountAmount = promo && quote ? +(quote.total * promo.pct).toFixed(2) : 0;
  const discountedTotal = quote ? +(quote.total - discountAmount).toFixed(2) : 0;

  useEffect(() => {
    api.get("/vansizes").then(({ data }) => setVans(data)).catch(() => {});
    if (user?.name && !form.customer_name) set("customer_name", user.name);
    if (user?.phone && !form.customer_phone) set("customer_phone", user.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const canQuote = form.pickup && form.dropoff && form.van_size && form.date && form.time;
  useEffect(() => {
    if (!canQuote) { setQuote(null); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/quote", {
          pickup: form.pickup, dropoff: form.dropoff, van_size: form.van_size, date: form.date, time: form.time,
          pickup_floor: form.pickup_floor, dropoff_floor: form.dropoff_floor,
          pickup_lift: form.pickup_lift, dropoff_lift: form.dropoff_lift,
        });
        setQuote(data);
      } catch { setQuote(null); }
    }, 300);
    return () => clearTimeout(t);
  }, [form.pickup, form.dropoff, form.van_size, form.date, form.time, form.pickup_floor, form.dropoff_floor, form.pickup_lift, form.dropoff_lift, canQuote]);

  const stepValid = useMemo(() => {
    if (step === 0) return form.pickup && form.dropoff;
    if (step === 2) return form.date && form.time;
    if (step === 3) return form.van_size;
    if (step === 5) return form.customer_name && form.customer_phone;
    return true;
  }, [step, form]);

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (!user) { toast.info("Sign in to add photos — you can still book without them."); return; }
    setUploading(true);
    for (const file of files) {
      const localUrl = URL.createObjectURL(file);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        setForm((f) => ({ ...f, photos: [...f.photos, data.path] }));
        setPreviews((p) => [...p, { url: localUrl, path: data.path }]);
      } catch (err) {
        toast.error("Photo upload failed");
        URL.revokeObjectURL(localUrl);
      }
    }
    setUploading(false);
    e.target.value = "";
  };

  const removePhoto = (path) => {
    setForm((f) => ({ ...f, photos: f.photos.filter((p) => p !== path) }));
    setPreviews((p) => p.filter((x) => x.path !== path));
  };

  const next = () => setStep((s) => Math.min(s + 1, 5));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const confirm = async () => {
    if (!user) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, photos: [] }));
      toast.info("Please sign in to confirm your booking");
      navigate("/login", { state: { from: "/book" } });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/bookings", form);
      toast.success("Booking created — now choose your driver.");
      navigate(`/jobs`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not create booking");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-5 sm:p-7" data-testid="booking-wizard">
      <h2 className="font-heading text-2xl font-bold text-slate-900">Book your man &amp; van</h2>
      <p className="text-sm text-slate-500 mt-1">Takes about a minute — pay after your move.</p>

      {/* Stepper */}
      <div className="flex gap-1 mt-5 overflow-x-auto pb-1" data-testid="wizard-stepper">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1 min-w-[70px]">
            <div className={`h-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-slate-200"}`} />
            <p className={`text-[11px] mt-1.5 font-medium whitespace-nowrap ${i === step ? "text-primary" : i < step ? "text-slate-700" : "text-slate-400"}`}>{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 min-h-[240px]">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
            {step === 0 && (
              <Section n={1} title="Pickup & Drop-off" hint="Type a postcode and pick your full address from the list.">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Pickup address</Label>
                    <AddressAutocomplete value={form.pickup} onChange={(v) => set("pickup", v)} placeholder="Search by postcode or street…" testid="wizard-pickup" />
                  </div>
                  <div className="space-y-2">
                    <Label>Flat / house number &amp; street <span className="text-slate-400 font-normal">(optional)</span></Label>
                    <Input value={form.pickup_flat} onChange={(e) => set("pickup_flat", e.target.value)} placeholder="e.g. Flat 4, 12 Ashford Road" className="focus:ring-2 focus:ring-violet-500" data-testid="wizard-pickup-flat" />
                  </div>
                  <div className="space-y-2">
                    <Label>Drop-off address</Label>
                    <AddressAutocomplete value={form.dropoff} onChange={(v) => set("dropoff", v)} placeholder="Search by postcode or street (any UK)…" testid="wizard-dropoff" />
                  </div>
                </div>
              </Section>
            )}

            {step === 1 && (
              <Section n={2} title="Floors & access" hint="Stairs take longer — tell us about floors and lifts.">
                <div className="grid sm:grid-cols-2 gap-5">
                  <FloorPicker label="Pickup floor" floor={form.pickup_floor} lift={form.pickup_lift} onFloor={(v) => set("pickup_floor", v)} onLift={(v) => set("pickup_lift", v)} testid="pickup" />
                  <FloorPicker label="Drop-off floor" floor={form.dropoff_floor} lift={form.dropoff_lift} onFloor={(v) => set("dropoff_floor", v)} onLift={(v) => set("dropoff_lift", v)} testid="dropoff" />
                </div>
              </Section>
            )}

            {step === 2 && (
              <Section n={3} title="Date & time" hint="When would you like your move?">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <Input type="date" min={new Date().toISOString().split("T")[0]} value={form.date} onChange={(e) => set("date", e.target.value)} className="pl-9 focus:ring-2 focus:ring-violet-500" data-testid="wizard-date" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} className="pl-9 focus:ring-2 focus:ring-violet-500" data-testid="wizard-time" />
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {step === 3 && (
              <Section n={4} title="Choose your van" hint="Pick the size that fits your move.">
                <div className="grid sm:grid-cols-2 gap-3">
                  {vans.map((v) => (
                    <button key={v.id} type="button" onClick={() => set("van_size", v.id)} data-testid={`wizard-van-${v.id}`}
                      className={`text-left p-4 rounded-xl border-2 transition-all duration-200 hover:-translate-y-0.5 ${form.van_size === v.id ? "border-primary bg-violet-50 shadow-md" : "border-slate-200 hover:border-violet-300"}`}>
                      <div className="flex items-center justify-between">
                        <Truck className={`h-6 w-6 ${form.van_size === v.id ? "text-primary" : "text-slate-400"}`} />
                        {form.van_size === v.id && <Check className="h-5 w-5 text-primary" />}
                      </div>
                      <p className="font-semibold text-slate-900 mt-2 text-sm">{v.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{v.capacity}</p>
                      <p className="text-xs text-primary font-semibold mt-1">from £{v.hourly}/hr</p>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {step === 4 && (
              <Section n={5} title="Photos & items" hint="Add photos and a list so your driver arrives prepared.">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>What are we moving?</Label>
                    <Textarea value={form.items} onChange={(e) => set("items", e.target.value)} placeholder="e.g. Double bed, 3-seat sofa, washing machine, 10 boxes" className="focus:ring-2 focus:ring-violet-500" data-testid="wizard-items" />
                  </div>
                  <div className="space-y-2">
                    <Label>Photos <span className="text-slate-400 font-normal">(optional)</span></Label>
                    <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-6 cursor-pointer hover:border-violet-400 transition-colors text-sm text-slate-500" data-testid="wizard-photo-label">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                      {uploading ? "Uploading…" : "Tap to upload photos"}
                      <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} data-testid="wizard-photo-input" />
                    </label>
                    {previews.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {previews.map((p) => (
                          <div key={p.path} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                            <img src={p.url} alt="item" className="w-full h-full object-cover" />
                            <button type="button" onClick={() => removePhoto(p.path)} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center" data-testid="wizard-photo-remove">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            )}

            {step === 5 && (
              <Section n={6} title="Your details" hint="So your driver can reach you on the day.">
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Full name</Label><Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="Jane Smith" className="focus:ring-2 focus:ring-violet-500" data-testid="wizard-name" /></div>
                  <div className="space-y-2"><Label>Phone number</Label><Input value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} placeholder="07123 456789" className="focus:ring-2 focus:ring-violet-500" data-testid="wizard-phone" /></div>
                  <div className="space-y-2"><Label>Notes <span className="text-slate-400 font-normal">(optional)</span></Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Parking is tight; call on arrival" className="focus:ring-2 focus:ring-violet-500" data-testid="wizard-notes" /></div>
                  <div className="space-y-2">
                    <Label>Promo code <span className="text-slate-400 font-normal">(optional)</span></Label>
                    <Input value={form.promo_code}
                      onChange={(e) => { const v = e.target.value.toUpperCase(); set("promo_code", v); if (getPromo(v)) savePromo(v); }}
                      placeholder="e.g. STUDENT10" className="focus:ring-2 focus:ring-violet-500 uppercase" data-testid="wizard-promo" />
                    {form.promo_code && (promo
                      ? <p className="text-xs font-medium text-emerald-600 flex items-center gap-1" data-testid="wizard-promo-valid"><Check className="h-3.5 w-3.5" /> {promo.label} applied — {Math.round(promo.pct * 100)}% off your total</p>
                      : <p className="text-xs text-slate-400" data-testid="wizard-promo-invalid">Enter a valid code to get a discount.</p>)}
                  </div>
                </div>
              </Section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Live price */}
      {quote && (
        <div className="bg-violet-50 rounded-xl px-4 py-3 mt-2" data-testid="wizard-price">
          {promo ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 line-through">£{quote.total.toFixed(2)}</span>
                <span className="text-emerald-600 font-semibold" data-testid="wizard-discount">− £{discountAmount.toFixed(2)} ({promo.label})</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-slate-600">Your price · {quote.distance_miles} mi</span>
                <span className="font-heading text-xl font-bold text-primary" data-testid="wizard-total">£{discountedTotal.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Estimated fixed price · {quote.distance_miles} mi</span>
              <span className="font-heading text-xl font-bold text-primary" data-testid="wizard-total">£{quote.total.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between mt-5 pt-4 border-t border-slate-100">
        <Button variant="ghost" onClick={back} disabled={step === 0} className="gap-2" data-testid="wizard-back">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < 5 ? (
          <Button onClick={next} disabled={!stepValid} className="bg-primary hover:bg-[#4C1D95] gap-2" data-testid="wizard-next">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={confirm} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 gap-2" data-testid="wizard-confirm">
            {submitting ? "Confirming…" : <>Confirm booking <Check className="h-4 w-4" /></>}
          </Button>
        )}
      </div>
    </div>
  );
};

const Section = ({ n, title, hint, children }) => (
  <div>
    <div className="flex items-center gap-3 mb-1">
      <span className="h-8 w-8 rounded-full bg-violet-100 text-primary font-bold flex items-center justify-center text-sm">{n}</span>
      <h3 className="font-heading text-xl font-semibold text-slate-900">{title}</h3>
    </div>
    <p className="text-sm text-slate-500 mb-5 ml-11">{hint}</p>
    <div className="ml-0 sm:ml-11">{children}</div>
  </div>
);

const FloorPicker = ({ label, floor, lift, onFloor, onLift, testid }) => (
  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
    <Label className="flex items-center gap-2 mb-3"><Building2 className="h-4 w-4 text-slate-400" /> {label}</Label>
    <Select value={String(floor)} onValueChange={(v) => onFloor(Number(v))}>
      <SelectTrigger className="bg-white" data-testid={`floor-${testid}`}><SelectValue /></SelectTrigger>
      <SelectContent>
        {FLOORS.map((f) => <SelectItem key={f.v} value={String(f.v)}>{f.l}</SelectItem>)}
      </SelectContent>
    </Select>
    <label className="flex items-center gap-2 mt-3 text-sm text-slate-600 cursor-pointer">
      <Checkbox checked={lift} onCheckedChange={(v) => onLift(!!v)} data-testid={`lift-${testid}`} /> Lift available
    </label>
  </div>
);
