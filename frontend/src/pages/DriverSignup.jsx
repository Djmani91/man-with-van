import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Truck, ArrowLeft, Camera, Check } from "lucide-react";
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
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", vehicle: "", van_size: "large", licence_no: "", insurance_no: "", mot_expiry: "", home_postcode: "", address: "", rate_small: 35, rate_medium: 40, rate_large: 45, rate_xl: 50, stairs_fee: 5, helper_rate: 15 });
  const [files, setFiles] = useState({ profile_photo: null, van_photo: null, licence_photo: null, insurance_photo: null });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setFile = (k) => (e) => setFiles((f) => ({ ...f, [k]: e.target.files?.[0] || null }));

  const uploadOne = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
    return data.path;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const required = { name: "Full name", phone: "Phone", email: "Email", password: "Password", vehicle: "Vehicle", home_postcode: "Home base postcode", licence_no: "Licence number", insurance_no: "Insurance policy no." };
    const missing = Object.entries(required).filter(([k]) => !String(form[k] || "").trim()).map(([, label]) => label);
    if (missing.length) { setError(`Please fill: ${missing.join(", ")}`); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (String(form.password).length < 6) { setError("Password must be at least 6 characters."); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const imgLabels = { profile_photo: "Profile photo", van_photo: "Van photo", licence_photo: "Driving licence photo", insurance_photo: "Insurance photo" };
    const imgMissing = Object.entries(imgLabels).filter(([k]) => !files[k]).map(([, l]) => l);
    if (imgMissing.length) { setError(`Please add: ${imgMissing.join(", ")}`); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const num = (v, min) => { const n = Number(v); return Number.isFinite(n) ? n : min; };
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password,
        vehicle: form.vehicle.trim(), van_size: form.van_size, licence_no: form.licence_no.trim(), insurance_no: form.insurance_no.trim(),
        mot_expiry: form.mot_expiry || null, home_postcode: form.home_postcode.trim(), address: form.address.trim(),
        pricing: {
          rates: { small: num(form.rate_small, 35), medium: num(form.rate_medium, 40), large: num(form.rate_large, 45), xl: num(form.rate_xl, 50) },
          stairs_fee: num(form.stairs_fee, 5), helper_rate: num(form.helper_rate, 15),
        },
      };
      const { data } = await api.post("/auth/driver-register", payload);
      setUser(data);
      try {
        const docs = {};
        for (const k of ["profile_photo", "van_photo", "licence_photo", "insurance_photo"]) {
          if (files[k]) docs[k] = await uploadOne(files[k]);
        }
        if (Object.keys(docs).length) await api.post("/driver/documents", docs);
      } catch (up) {
        toast.warning("Account created, but a photo didn't upload — add it in Driver Hub → Settings.");
      }
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
          <div className="space-y-2">
            <Label>Your van size</Label>
            <select value={form.van_size} onChange={set("van_size")} data-testid="ds-van-size"
              className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-violet-500 outline-none">
              <option value="small">Small Van</option>
              <option value="medium">Medium Van (SWB)</option>
              <option value="large">Large Luton Van</option>
              <option value="xl">Luton XL</option>
            </select>
            <p className="text-xs text-slate-400">A bigger van can also take smaller jobs, so you'll get more work.</p>
          </div>
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

          <div className="pt-2 border-t border-slate-100">
            <p className="font-semibold text-slate-900 text-sm mb-1">Upload your documents</p>
            <p className="text-xs text-slate-500 mb-3">Clear photos help us approve you faster. All four are required.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <FileField label="Profile photo" hint="A clear photo of you" file={files.profile_photo} onChange={setFile("profile_photo")} testid="ds-file-profile" />
              <FileField label="Van photo" hint="Your vehicle" file={files.van_photo} onChange={setFile("van_photo")} testid="ds-file-van" />
              <FileField label="Driving licence" hint="Front of your licence" file={files.licence_photo} onChange={setFile("licence_photo")} testid="ds-file-licence" />
              <FileField label="Insurance" hint="Insurance certificate" file={files.insurance_photo} onChange={setFile("insurance_photo")} testid="ds-file-insurance" />
            </div>
          </div>

          <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-[#4C1D95]" data-testid="ds-submit">{busy ? "Submitting…" : "Submit application"}</Button>
          <p className="text-sm text-center text-slate-500">Already registered? <Link to="/driver/login" className="text-primary font-semibold" data-testid="ds-to-login">Driver login</Link></p>
        </form>
      </div>
    </div>
  );
}

function FileField({ label, hint, file, onChange, testid }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <label className="flex items-center gap-3 border border-dashed border-slate-300 rounded-lg px-3 py-2.5 cursor-pointer hover:border-violet-400 transition-colors">
        {file
          ? <img src={URL.createObjectURL(file)} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
          : <div className="h-10 w-10 rounded bg-violet-100 flex items-center justify-center shrink-0"><Camera className="h-5 w-5 text-primary" /></div>}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-700 truncate">{file ? file.name : "Tap to upload"}</p>
          <p className="text-[11px] text-slate-400 truncate">{hint}</p>
        </div>
        {file && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
        <input type="file" accept="image/*" className="hidden" onChange={onChange} data-testid={testid} />
      </label>
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
