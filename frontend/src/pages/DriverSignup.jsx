import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Truck, ArrowLeft } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function DriverSignup() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", vehicle: "", licence_no: "", insurance_no: "", mot_expiry: "", home_postcode: "", address: "", rate_small: 35, rate_medium: 40, rate_large: 45, rate_xl: 50, stairs_fee: 5, helper_rate: 15 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const required = { name: "Full name", phone: "Phone", email: "Email", password: "Password", vehicle: "Vehicle", home_postcode: "Home base postcode", licence_no: "Licence number", insurance_no: "Insurance policy no." };
    const missing = Object.entries(required).filter(([k]) => !String(form[k] || "").trim()).map(([, label]) => label);
    if (missing.length) { setError(`Please fill: ${missing.join(", ")}`); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (String(form.password).length < 6) { setError("Password must be at least 6 characters."); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const num = (v, min) => { const n = Number(v); return Number.isFinite(n) ? n : min; };
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password,
        vehicle: form.vehicle.trim(), licence_no: form.licence_no.trim(), insurance_no: form.insurance_no.trim(),
        mot_expiry: form.mot_expiry || null, home_postcode: form.home_postcode.trim(), address: form.address.trim(),
        pricing: {
          rates: { small: num(form.rate_small, 35), medium: num(form.rate_medium, 40), large: num(form.rate_large, 45), xl: num(form.rate_xl, 50) },
          stairs_fee: num(form.stairs_fee, 5), helper_rate: num(form.helper_rate, 15),
        },
      };
      const { data } = await api.post("/auth/driver-register", payload);
      setUser(data);
      toast.success("Application submitted! Awaiting approval.");
      navigate("/driver", { replace: true });
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || "Could not submit — please try again.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Seo title="Drive with Man With Van — Driver Sign Up" description="Become a Man With Van driver. Pick local jobs that suit you, upload your licence, insurance and MOT, get approved and start earning." path="/driver/signup" />
      <div className="max-w-xl w-full mx-auto px-5 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary mb-6" data-testid="driver-signup-home"><ArrowLeft className="h-4 w-4" /> Back to site</Link>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center"><Truck className="h-5 w-5 text-white" /></div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Drive with us</h1>
        </div>
        <p className="text-slate-500 mb-8">Pick the local jobs that suit you and get paid. Approval is quick once your documents check out.</p>

        <form onSubmit={submit} noValidate className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4" data-testid="driver-signup-form">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2" data-testid="driver-signup-error">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Full name</Label><Input value={form.name} onChange={set("name")} data-testid="ds-name" /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={set("phone")} data-testid="ds-phone" placeholder="07123 456789" /></div>
          </div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={set("email")} data-testid="ds-email" /></div>
          <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={set("password")} data-testid="ds-password" /></div>
          <div className="space-y-2"><Label>Vehicle</Label><Input value={form.vehicle} onChange={set("vehicle")} placeholder="Large Luton — AB12 CDE" data-testid="ds-vehicle" /></div>
          <div className="space-y-2"><Label>Home base postcode</Label><Input value={form.home_postcode} onChange={set("home_postcode")} placeholder="e.g. M1 1AA — used to find jobs near you" data-testid="ds-home" /></div>
          <div className="space-y-2"><Label>Home address <span className="text-slate-400 font-normal">(optional)</span></Label><Input value={form.address} onChange={set("address")} placeholder="Street, city" data-testid="ds-address" /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Licence number</Label><Input value={form.licence_no} onChange={set("licence_no")} data-testid="ds-licence" /></div>
            <div className="space-y-2"><Label>Insurance policy no.</Label><Input value={form.insurance_no} onChange={set("insurance_no")} data-testid="ds-insurance" /></div>
          </div>
          <div className="space-y-2"><Label>MOT expiry <span className="text-slate-400 font-normal">(optional)</span></Label><Input type="date" value={form.mot_expiry} onChange={set("mot_expiry")} data-testid="ds-mot" /></div>

          <div className="pt-2 border-t border-slate-100">
            <p className="font-semibold text-slate-900 text-sm mb-1">Your hourly rates</p>
            <p className="text-xs text-slate-500 mb-3">Set your rate within each band — you only receive jobs you can price.</p>
            <div className="grid grid-cols-2 gap-3">
              <RateField label="Small (£35–45)" min={35} max={45} value={form.rate_small} onChange={set("rate_small")} testid="ds-rate-small" />
              <RateField label="Medium (£40–50)" min={40} max={50} value={form.rate_medium} onChange={set("rate_medium")} testid="ds-rate-medium" />
              <RateField label="Large (£45–55)" min={45} max={55} value={form.rate_large} onChange={set("rate_large")} testid="ds-rate-large" />
              <RateField label="Luton XL (£50–60)" min={50} max={60} value={form.rate_xl} onChange={set("rate_xl")} testid="ds-rate-xl" />
              <RateField label="Stairs / floor (£5–15)" min={5} max={15} value={form.stairs_fee} onChange={set("stairs_fee")} testid="ds-stairs" />
              <RateField label="Helper /hr (£15–25)" min={15} max={25} value={form.helper_rate} onChange={set("helper_rate")} testid="ds-helper" />
            </div>
          </div>

          <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-[#4C1D95]" data-testid="ds-submit">{busy ? "Submitting…" : "Submit application"}</Button>
          <p className="text-sm text-center text-slate-500">Already registered? <Link to="/driver/login" className="text-primary font-semibold" data-testid="ds-to-login">Driver login</Link></p>
        </form>
      </div>
    </div>
  );
}

function RateField({ label, min, max, value, onChange, testid }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={min} max={max} value={value} onChange={onChange} data-testid={testid} />
    </div>
  );
}
