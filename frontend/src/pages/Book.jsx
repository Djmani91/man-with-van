import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, MapPinned, Truck, ArrowRight, ArrowLeft, Check, Calendar, Clock } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const STEPS = ["Route", "Van & Time", "Details", "Review"];

export default function Book() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [vans, setVans] = useState([]);
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    pickup: location.state?.pickup || "",
    dropoff: location.state?.dropoff || "",
    van_size: "",
    date: "",
    time: "",
    customer_name: user?.name || "",
    customer_phone: user?.phone || "",
    notes: "",
  });

  useEffect(() => { api.get("/vansizes").then(({ data }) => setVans(data)).catch(() => {}); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const canQuote = form.pickup && form.dropoff && form.van_size && form.date && form.time;

  useEffect(() => {
    if (!canQuote) { setQuote(null); return; }
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/quote", {
          pickup: form.pickup, dropoff: form.dropoff, van_size: form.van_size, date: form.date, time: form.time,
        });
        setQuote(data);
      } catch { setQuote(null); } finally { setQuoting(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [form.pickup, form.dropoff, form.van_size, form.date, form.time, canQuote]);

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const stepValid = useMemo(() => {
    if (step === 0) return form.pickup && form.dropoff;
    if (step === 1) return form.van_size && form.date && form.time && quote;
    if (step === 2) return form.customer_name && form.customer_phone;
    return true;
  }, [step, form, quote]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      const { data } = await api.post("/bookings", form);
      toast.success("Booking confirmed! Confirmation email sent.");
      navigate(`/track/${data.booking_id}`, { replace: true });
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not create booking");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Stepper step={step} />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 mt-6 min-h-[380px]">
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                {step === 0 && <RouteStep form={form} set={set} />}
                {step === 1 && <VanStep form={form} set={set} vans={vans} quoting={quoting} quote={quote} />}
                {step === 2 && <DetailsStep form={form} set={set} />}
                {step === 3 && <ReviewStep form={form} quote={quote} />}
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
              <Button variant="ghost" onClick={back} disabled={step === 0} data-testid="book-back" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              {step < 3 ? (
                <Button onClick={next} disabled={!stepValid} className="bg-primary hover:bg-[#4C1D95] gap-2" data-testid="book-next">
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={confirm} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 gap-2" data-testid="book-confirm">
                  {submitting ? "Confirming…" : <>Confirm booking <Check className="h-4 w-4" /></>}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sticky summary */}
        <div className="lg:sticky lg:top-24 h-fit">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6" data-testid="quote-summary">
            <h3 className="font-heading text-lg font-semibold text-slate-900">Your quote</h3>
            {quote ? (
              <div className="mt-4 space-y-2 text-sm">
                <Row label="Van" value={quote.van_name} />
                <Row label="Distance" value={`${quote.distance_miles} mi`} />
                <Row label="Base" value={`£${quote.base_price.toFixed(2)}`} />
                <Row label="Mileage" value={`£${quote.mileage_price.toFixed(2)}`} />
                {quote.surcharges.map((s, i) => <Row key={i} label={s.label} value={`£${s.amount.toFixed(2)}`} />)}
                <div className="pt-3 mt-2 border-t border-slate-100 flex items-baseline justify-between">
                  <span className="text-slate-500">Total</span>
                  <span className="font-heading text-2xl font-bold text-primary" data-testid="quote-total">£{quote.total.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 mt-4">Fill in your route, van and time to see a live price.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-3">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-slate-900 text-right">{value}</span>
  </div>
);

function Stepper({ step }) {
  return (
    <div className="flex items-center gap-2" data-testid="booking-stepper">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${i < step ? "bg-primary text-white" : i === step ? "bg-primary text-white ring-4 ring-violet-100" : "bg-slate-200 text-slate-500"}`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm font-medium hidden sm:inline ${i <= step ? "text-slate-900" : "text-slate-400"}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 rounded ${i < step ? "bg-primary" : "bg-slate-200"}`} />}
        </div>
      ))}
    </div>
  );
}

function RouteStep({ form, set }) {
  return (
    <div>
      <h2 className="font-heading text-2xl font-semibold text-slate-900">Where are we moving?</h2>
      <p className="text-slate-500 mt-1 mb-6">Enter your pickup and drop-off postcodes or addresses.</p>
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Pickup address</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={form.pickup} onChange={(e) => set("pickup", e.target.value)} placeholder="e.g. 10 Downing St, SW1A 2AA" className="pl-9 focus:ring-2 focus:ring-violet-500" data-testid="book-pickup" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Drop-off address</Label>
          <div className="relative">
            <MapPinned className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={form.dropoff} onChange={(e) => set("dropoff", e.target.value)} placeholder="e.g. 20 Brick Lane, E1 6RF" className="pl-9 focus:ring-2 focus:ring-violet-500" data-testid="book-dropoff" />
          </div>
        </div>
      </div>
    </div>
  );
}

function VanStep({ form, set, vans, quoting, quote }) {
  return (
    <div>
      <h2 className="font-heading text-2xl font-semibold text-slate-900">Choose your van & time</h2>
      <p className="text-slate-500 mt-1 mb-6">Pick the size that fits and when you need it.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {vans.map((v) => (
          <button key={v.id} type="button" onClick={() => set("van_size", v.id)} data-testid={`book-van-${v.id}`}
            className={`text-left p-4 rounded-xl border-2 transition-all duration-200 hover:-translate-y-0.5 ${form.van_size === v.id ? "border-primary bg-violet-50 shadow-md" : "border-slate-200 bg-white hover:border-violet-300"}`}>
            <div className="flex items-center justify-between">
              <Truck className={`h-6 w-6 ${form.van_size === v.id ? "text-primary" : "text-slate-400"}`} />
              {form.van_size === v.id && <Check className="h-5 w-5 text-primary" />}
            </div>
            <p className="font-semibold text-slate-900 mt-2 text-sm">{v.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{v.capacity}</p>
            <p className="text-xs text-slate-400 mt-1">from £{v.base}</p>
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <div className="space-y-2">
          <Label>Date</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input type="date" value={form.date} min={new Date().toISOString().split("T")[0]} onChange={(e) => set("date", e.target.value)} className="pl-9 focus:ring-2 focus:ring-violet-500" data-testid="book-date" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Time</Label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} className="pl-9 focus:ring-2 focus:ring-violet-500" data-testid="book-time" />
          </div>
        </div>
      </div>
      {quoting && <p className="text-sm text-slate-400 mt-4">Calculating price…</p>}
      {quote && !quoting && <p className="text-sm text-emerald-600 mt-4 font-medium" data-testid="book-quote-inline">Live quote: £{quote.total.toFixed(2)} for {quote.distance_miles} miles</p>}
    </div>
  );
}

function DetailsStep({ form, set }) {
  return (
    <div>
      <h2 className="font-heading text-2xl font-semibold text-slate-900">Contact details</h2>
      <p className="text-slate-500 mt-1 mb-6">So the driver can reach you on the day.</p>
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Full name</Label>
          <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="Jane Smith" className="focus:ring-2 focus:ring-violet-500" data-testid="book-name" />
        </div>
        <div className="space-y-2">
          <Label>Phone number</Label>
          <Input value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} placeholder="07123 456789" className="focus:ring-2 focus:ring-violet-500" data-testid="book-phone" />
        </div>
        <div className="space-y-2">
          <Label>Notes for the driver <span className="text-slate-400 font-normal">(optional)</span></Label>
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. 2nd floor, no lift; fragile items" className="focus:ring-2 focus:ring-violet-500" data-testid="book-notes" />
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ form, quote }) {
  return (
    <div>
      <h2 className="font-heading text-2xl font-semibold text-slate-900">Review & confirm</h2>
      <p className="text-slate-500 mt-1 mb-6">Check everything looks right before you book.</p>
      <div className="space-y-3 text-sm">
        <Row label="Pickup" value={form.pickup} />
        <Row label="Drop-off" value={form.dropoff} />
        <Row label="Van" value={quote?.van_name || form.van_size} />
        <Row label="Date & time" value={`${form.date} at ${form.time}`} />
        <Row label="Name" value={form.customer_name} />
        <Row label="Phone" value={form.customer_phone} />
        {form.notes && <Row label="Notes" value={form.notes} />}
        {quote && (
          <div className="pt-4 mt-3 border-t border-slate-100 flex items-baseline justify-between">
            <span className="text-slate-500">Total to pay on completion</span>
            <span className="font-heading text-2xl font-bold text-primary">£{quote.total.toFixed(2)}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-6">No payment is taken now — payment is collected separately. A confirmation email will be sent to your account email.</p>
    </div>
  );
}
