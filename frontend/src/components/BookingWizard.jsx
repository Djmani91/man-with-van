import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, ArrowRight, ArrowLeft, Check, Calendar, Clock, Upload, X,
} from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { getPromo, loadPromo, savePromo, clearPromo } from "@/lib/promo";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

const STEPS = ["Addresses", "Floors", "Date & time", "Van", "Photos & items", "Contact"];
const ACCESS = [{ v: "ground", l: "Ground" }, { v: "stairs", l: "Stairs" }, { v: "lift", l: "Lift" }];
const STAIR_FLOORS = [{ v: 1, l: "1st floor" }, { v: 2, l: "2nd floor" }, { v: 3, l: "3rd+ floor" }];
const DRAFT_KEY = "mwv_booking_draft";
const TIME_SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const fmtTime = (t) => { const hr = Number(t.split(":")[0]); const ap = hr >= 12 ? "PM" : "AM"; return `${hr % 12 || 12}:00 ${ap}`; };

const blank = {
  pickup: "", dropoff: "",
  pickup_access: "", dropoff_access: "",
  pickup_floor: 0, pickup_lift: false, dropoff_floor: 0, dropoff_lift: false,
  date: "", time: "", van_size: "",
  needs_helper: false, heavy_items: false, crew: "",
  items: "", photos: [], customer_name: "", customer_phone: "", notes: "", promo_code: "",
};

export const BookingWizard = ({ compact = true }) => {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [vans, setVans] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("register");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const h = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  const [form, setForm] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) { sessionStorage.removeItem(DRAFT_KEY); return { ...blank, ...JSON.parse(saved) }; }
    } catch {}
    return { ...blank };
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const setCrew = (v) => setForm((f) => ({ ...f, crew: v, needs_helper: v === "helper" }));

  const setAccess = (which, v) => {
    setForm((f) => {
      const upd = { ...f, [`${which}_access`]: v };
      if (v === "ground") { upd[`${which}_floor`] = 0; upd[`${which}_lift`] = false; }
      else if (v === "lift") { upd[`${which}_floor`] = 0; upd[`${which}_lift`] = true; }
      else if (v === "stairs") { upd[`${which}_floor`] = 0; upd[`${which}_lift`] = false; }
      return upd;
    });
  };

  // Pre-fill a promo saved by the student-discount widget (once, if the form has none).
  useEffect(() => {
    const saved = loadPromo();
    if (saved && !form.promo_code) set("promo_code", saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const promo = getPromo(form.promo_code);

  useEffect(() => {
    api.get("/vansizes").then(({ data }) => setVans(data)).catch(() => {});
    if (user?.name && !form.customer_name) set("customer_name", user.name);
    if (user?.phone && !form.customer_phone) set("customer_phone", user.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const stepValid = useMemo(() => {
    if (step === 0) return form.pickup && form.dropoff;
    if (step === 1) {
      const okP = form.pickup_access && (form.pickup_access !== "stairs" || form.pickup_floor >= 1);
      const okD = form.dropoff_access && (form.dropoff_access !== "stairs" || form.dropoff_floor >= 1);
      return okP && okD;
    }
    if (step === 2) return form.date && form.time;
    if (step === 3) return form.van_size;
    if (step === 4) return form.items.trim() && previews.length > 0 && form.crew;
    if (step === 5) return form.customer_name.trim() && form.customer_phone.trim() && form.notes.trim();
    return true;
  }, [step, form, previews]);

  const allValid = form.pickup && form.dropoff
    && form.pickup_access && (form.pickup_access !== "stairs" || form.pickup_floor >= 1)
    && form.dropoff_access && (form.dropoff_access !== "stairs" || form.dropoff_floor >= 1)
    && form.date && form.time && form.van_size
    && form.items.trim() && previews.length > 0 && form.crew
    && form.customer_name.trim() && form.customer_phone.trim() && form.notes.trim();

  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPreviews((p) => [
      ...p,
      ...files.map((file) => ({ id: `${Date.now()}-${Math.random()}`, url: URL.createObjectURL(file), file })),
    ]);
    e.target.value = "";
  };

  const removePhoto = (id) => {
    setPreviews((p) => {
      const found = p.find((x) => x.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return p.filter((x) => x.id !== id);
    });
  };

  const next = () => setStep((s) => Math.min(s + 1, 5));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const uploadPhotos = async () => {
    const paths = [];
    for (const p of previews) {
      const fd = new FormData();
      fd.append("file", p.file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      paths.push(data.path);
    }
    return paths;
  };

  const submitBooking = async () => {
    setSubmitting(true);
    try {
      const photos = await uploadPhotos();
      await api.post("/bookings", { ...form, photos });
      toast.success("Booking created — now choose your driver.");
      navigate(`/jobs`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not create booking");
    } finally { setSubmitting(false); }
  };

  const confirm = () => {
    if (!user) {
      setAuthErr("");
      setAuthForm((a) => ({ ...a, name: a.name || form.customer_name, phone: a.phone || form.customer_phone }));
      setShowAuth(true);
      return;
    }
    submitBooking();
  };

  const doAuth = async () => {
    setAuthErr("");
    if (authMode === "register" && (!authForm.name.trim() || !authForm.phone.trim())) {
      setAuthErr("Please enter your name and phone number."); return;
    }
    if (!authForm.email.trim() || !authForm.password) {
      setAuthErr("Please enter your email and password."); return;
    }
    setAuthBusy(true);
    try {
      if (authMode === "login") {
        await login(authForm.email.trim(), authForm.password);
      } else {
        await register({
          name: authForm.name.trim(), email: authForm.email.trim(),
          password: authForm.password, phone: authForm.phone.trim(),
        });
      }
      setShowAuth(false);
      await submitBooking();
    } catch (err) {
      setAuthErr(formatApiError(err.response?.data?.detail) || "Could not sign in. Please try again.");
    } finally { setAuthBusy(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-5 sm:p-7 w-full min-w-0" data-testid="booking-wizard">
      <h2 className="font-heading text-2xl font-bold text-slate-900">Book your man &amp; van</h2>
      <p className="text-sm text-slate-500 mt-1">Takes about a minute — pay after your move.</p>

      {/* Stepper (desktop only) */}
      {!isMobile && (
      <div className="mt-5" data-testid="wizard-stepper">
        <div className="flex gap-1.5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1 min-w-0">
              <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-slate-200"}`} />
              <p className={`hidden sm:block text-[11px] mt-1.5 font-medium truncate ${i === step ? "text-primary" : i < step ? "text-slate-700" : "text-slate-400"}`}>{label}</p>
            </div>
          ))}
        </div>
      </div>
      )}

      <div className={isMobile ? "mt-5" : "mt-5 min-h-[240px]"}>
        <AnimatePresence mode="wait">
          <motion.div key={isMobile ? "all" : step} className={isMobile ? "space-y-4" : ""} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
            {(isMobile || step === 0) && (
              <Section n={1} hideNum={isMobile} title="Pickup &amp; Drop-off" hint="Type a postcode and pick your full address from the list.">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Pickup address</Label>
                    <AddressAutocomplete value={form.pickup} onChange={(v) => set("pickup", v)} placeholder="Search by postcode or street…" testid="wizard-pickup" />
                  </div>
                  <div className="space-y-2">
                    <Label>Drop-off address</Label>
                    <AddressAutocomplete value={form.dropoff} onChange={(v) => set("dropoff", v)} placeholder="Search by postcode or street (any UK)…" testid="wizard-dropoff" />
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed" data-testid="coverage-note">Pickup must be within 20 miles of London, Oxford, Birmingham, Manchester, Liverpool, or Blackpool. Drop-off can be anywhere in the UK.</p>
                </div>
              </Section>
            )}

            {(isMobile || step === 1) && (
              <Section n={2} hideNum={isMobile} title="Floors &amp; access" hint="Tell us how we reach each address.">
                <div className="space-y-5">
                  <AccessPicker label="Pickup access" access={form.pickup_access} floor={form.pickup_floor} onAccess={(v) => setAccess("pickup", v)} onFloor={(v) => set("pickup_floor", v)} testid="pickup" />
                  <AccessPicker label="Drop-off access" access={form.dropoff_access} floor={form.dropoff_floor} onAccess={(v) => setAccess("dropoff", v)} onFloor={(v) => set("dropoff_floor", v)} testid="dropoff" />
                </div>
              </Section>
            )}

            {(isMobile || step === 2) && (
              <Section n={3} hideNum={isMobile} title="When do you need the van?" hint="Choose your date and time slot.">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                      <Input type="date" min={new Date().toISOString().split("T")[0]} value={form.date} onChange={(e) => set("date", e.target.value)} className="pl-9 focus:ring-2 focus:ring-violet-500" data-testid="wizard-date" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Select value={form.time || ""} onValueChange={(v) => set("time", v)}>
                      <SelectTrigger className="focus:ring-2 focus:ring-violet-500" data-testid="wizard-time">
                        <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /><SelectValue placeholder="Pick a time" /></span>
                      </SelectTrigger>
                      <SelectContent>{TIME_SLOTS.map((t) => <SelectItem key={t} value={t}>{fmtTime(t)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </Section>
            )}

            {(isMobile || step === 3) && (
              <Section n={4} hideNum={isMobile} title="Which van do you need?" hint="Pick the size that fits your move.">
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
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {(isMobile || step === 4) && (
              <Section n={5} hideNum={isMobile} title="Photos &amp; items" hint="Add photos and a list so your driver arrives prepared.">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>What are we moving? <span className="text-rose-500">*</span></Label>
                    <Textarea value={form.items} onChange={(e) => set("items", e.target.value)} placeholder="e.g. Double bed, 3-seat sofa, washing machine, 10 boxes" className="focus:ring-2 focus:ring-violet-500" data-testid="wizard-items" />
                  </div>
                  <div className="space-y-2">
                    <Label>Who will carry the items? <span className="text-rose-500">*</span></Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setCrew("me")} data-testid="crew-me"
                        className={`rounded-xl border-2 px-3 py-3 text-left transition-all ${form.crew === "me" ? "border-primary bg-violet-50" : "border-slate-200 hover:border-violet-300"}`}>
                        <span className="block text-sm font-semibold text-slate-900">Driver + me</span>
                        <span className="block text-xs text-slate-500">I'll help carry</span>
                      </button>
                      <button type="button" onClick={() => setCrew("helper")} data-testid="crew-helper"
                        className={`rounded-xl border-2 px-3 py-3 text-left transition-all ${form.crew === "helper" ? "border-primary bg-violet-50" : "border-slate-200 hover:border-violet-300"}`}>
                        <span className="block text-sm font-semibold text-slate-900">Driver + 1 helper</span>
                        <span className="block text-xs text-slate-500">Bring an extra person</span>
                      </button>
                    </div>
                  </div>
                  <button type="button" onClick={() => set("heavy_items", !form.heavy_items)} data-testid="wizard-heavy"
                    className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all ${form.heavy_items ? "border-primary bg-violet-50" : "border-slate-200 hover:border-violet-300"}`}>
                    <span><span className="block text-sm font-semibold text-slate-900">Heavy / bulky items?</span><span className="block text-xs text-slate-500">e.g. piano, appliances</span></span>
                    <Check className={`h-5 w-5 ${form.heavy_items ? "text-primary" : "text-transparent"}`} />
                  </button>
                  <div className="space-y-2">
                    <Label>Photos <span className="text-rose-500">*</span> <span className="text-slate-400 font-normal">(at least one)</span></Label>
                    <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-6 cursor-pointer hover:border-violet-400 transition-colors text-sm text-slate-500" data-testid="wizard-photo-label">
                      <Upload className="h-5 w-5" />
                      Tap to upload photos
                      <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} data-testid="wizard-photo-input" />
                    </label>
                    {previews.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {previews.map((p) => (
                          <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                            <img src={p.url} alt="item" className="w-full h-full object-cover" />
                            <button type="button" onClick={() => removePhoto(p.id)} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center" data-testid="wizard-photo-remove">
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

            {(isMobile || step === 5) && (
              <Section n={6} hideNum={isMobile} title="Your details" hint="So your driver can reach you on the day.">
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Full name</Label><Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="Jane Smith" className="focus:ring-2 focus:ring-violet-500" data-testid="wizard-name" /></div>
                  <div className="space-y-2"><Label>Phone number</Label><Input value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} placeholder="07123 456789" className="focus:ring-2 focus:ring-violet-500" data-testid="wizard-phone" /></div>
                  <div className="space-y-2"><Label>Notes <span className="text-rose-500">*</span></Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Parking is tight; call on arrival" className="focus:ring-2 focus:ring-violet-500" data-testid="wizard-notes" /></div>
                  <div className="space-y-2">
                    <Label>Promo code <span className="text-slate-400 font-normal">(optional)</span></Label>
                    <Input value={form.promo_code}
                      onChange={(e) => { const v = e.target.value.toUpperCase(); set("promo_code", v); if (getPromo(v)) savePromo(v); else if (!v) clearPromo(); }}
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

      {isMobile ? (
        <Button onClick={confirm} disabled={submitting || !allValid} className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 h-12 gap-2" data-testid="mobile-confirm">
          {submitting ? "Confirming…" : <>Confirm booking <Check className="h-4 w-4" /></>}
        </Button>
      ) : (
      <div className="flex justify-between mt-5 pt-4 border-t border-slate-100">
        <Button variant="ghost" onClick={back} disabled={step === 0} className="gap-2" data-testid="wizard-back">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < 5 ? (
          <Button onClick={next} disabled={!stepValid} className="bg-primary hover:bg-[#4C1D95] gap-2" data-testid="wizard-next">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={confirm} disabled={submitting || !stepValid} className="bg-emerald-600 hover:bg-emerald-700 gap-2" data-testid="wizard-confirm">
            {submitting ? "Confirming…" : <>Confirm booking <Check className="h-4 w-4" /></>}
          </Button>
        )}
      </div>
      )}

      <Dialog open={showAuth} onOpenChange={(o) => { if (!authBusy) setShowAuth(o); }}>
        <DialogContent className="sm:max-w-md" data-testid="booking-auth-modal">
          <DialogHeader>
            <DialogTitle className="font-heading">{authMode === "login" ? "Sign in to confirm" : "Create your account to confirm"}</DialogTitle>
            <DialogDescription>Your move details and photos are saved — just {authMode === "login" ? "sign in" : "register"} to place your booking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {authMode === "register" && (
              <>
                <div className="space-y-1.5"><Label>Full name</Label><Input value={authForm.name} onChange={(e) => setAuthForm((a) => ({ ...a, name: e.target.value }))} placeholder="Jane Smith" data-testid="auth-name" /></div>
                <div className="space-y-1.5"><Label>Phone number</Label><Input value={authForm.phone} onChange={(e) => setAuthForm((a) => ({ ...a, phone: e.target.value }))} placeholder="07123 456789" data-testid="auth-phone" /></div>
              </>
            )}
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={authForm.email} onChange={(e) => setAuthForm((a) => ({ ...a, email: e.target.value }))} placeholder="you@example.com" data-testid="auth-email" /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={authForm.password} onChange={(e) => setAuthForm((a) => ({ ...a, password: e.target.value }))} placeholder="••••••••" data-testid="auth-password" /></div>
            {authErr && <p className="text-sm text-rose-600" data-testid="auth-error">{authErr}</p>}
            <Button onClick={doAuth} disabled={authBusy} className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="auth-submit">
              {authBusy ? "Please wait…" : authMode === "login" ? "Sign in & confirm booking" : "Create account & confirm booking"}
            </Button>
            <p className="text-center text-sm text-slate-500">
              {authMode === "login" ? "New here? " : "Already have an account? "}
              <button type="button" onClick={() => { setAuthErr(""); setAuthMode((m) => (m === "login" ? "register" : "login")); }} className="text-primary font-semibold" data-testid="auth-toggle">
                {authMode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Section = ({ n, title, hint, hideNum, children }) => (
  <div>
    <div className="flex items-center gap-3 mb-1">
      {!hideNum && <span className="h-8 w-8 rounded-full bg-violet-100 text-primary font-bold flex items-center justify-center text-sm">{n}</span>}
      <h3 className="font-heading text-xl font-semibold text-slate-900">{title}</h3>
    </div>
    <p className={`text-sm text-slate-500 mb-5 ${hideNum ? "" : "ml-11"}`}>{hint}</p>
    <div className={hideNum ? "" : "ml-0 sm:ml-11"}>{children}</div>
  </div>
);

const AccessPicker = ({ label, access, floor, onAccess, onFloor, testid }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
    <p className="text-sm font-medium text-slate-700 mb-3">{label}</p>
    <div className="grid grid-cols-3 gap-2">
      {ACCESS.map((a) => (
        <button key={a.v} type="button" onClick={() => onAccess(a.v)} data-testid={`access-${a.v}-${testid}`}
          className={`rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all ${access === a.v ? "border-primary bg-primary text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-violet-300"}`}>
          {a.l}
        </button>
      ))}
    </div>
    {access === "stairs" && (
      <Select value={floor >= 1 ? String(floor) : ""} onValueChange={(v) => onFloor(Number(v))}>
        <SelectTrigger className="bg-white mt-3" data-testid={`floor-${testid}`}><SelectValue placeholder="Which floor?" /></SelectTrigger>
        <SelectContent>
          {STAIR_FLOORS.map((f) => <SelectItem key={f.v} value={String(f.v)}>{f.l}</SelectItem>)}
        </SelectContent>
      </Select>
    )}
  </div>
);
