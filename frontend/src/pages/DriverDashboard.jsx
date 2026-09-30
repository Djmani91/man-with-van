import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck, LogOut, MapPin, Calendar, Phone, CheckCircle2, PoundSterling, Package, Clock,
  ShieldCheck, ShieldAlert, Send, Hourglass, FileCheck2, Route, Loader2,
} from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Seo } from "@/components/Seo";
import { ChatModal } from "@/components/ChatModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const DRIVER_STEPS = [
  { v: "en_route_pickup", l: "En route to pickup" },
  { v: "loading", l: "Loading" },
  { v: "in_transit", l: "In transit" },
  { v: "completed", l: "Completed" },
];
const LABEL = { assigned: "Assigned", en_route_pickup: "En route", loading: "Loading", in_transit: "In transit", completed: "Completed", confirmed: "Confirmed" };

export default function DriverDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [available, setAvailable] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [accepted, setAccepted] = useState([]);
  const [chat, setChat] = useState(null);

  const approved = profile?.status === "approved";

  const load = useCallback(async () => {
    const p = await api.get("/driver/profile").then((r) => r.data).catch(() => null);
    setProfile(p);
    const acc = await api.get("/driver/jobs").then((r) => r.data).catch(() => []);
    setAccepted(acc);
    if (p?.status === "approved") {
      const [av, wt] = await Promise.all([
        api.get("/driver/available").then((r) => r.data).catch(() => []),
        api.get("/driver/requests").then((r) => r.data).catch(() => []),
      ]);
      setAvailable(av); setWaiting(wt);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const sendQuote = async (id, price) => {
    try { await api.post(`/driver/jobs/${id}/bid`, { price: Number(price) }); toast.success("Bid sent — awaiting customer decision"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const setStatus = async (id, status) => {
    try { await api.post(`/driver/jobs/${id}/status`, { status }); toast.success("Status updated"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const toggleAvailability = async (v) => {
    try { const { data } = await api.post("/driver/availability", { available: v }); setProfile((p) => ({ ...p, availability: data.availability })); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const activeAccepted = accepted.filter((j) => j.status !== "completed" && j.status !== "cancelled");

  return (
    <div className="min-h-screen bg-slate-100">
      <Seo title="Driver Hub — Man With Van" path="/driver" noindex />
      {/* App top bar */}
      <header className="bg-slate-900 text-white sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center"><Truck className="h-4 w-4" /></div>
            <p className="font-heading font-bold text-sm">Driver Hub</p>
          </div>
          <button onClick={() => { logout(); navigate("/"); }} className="flex items-center gap-1.5 text-slate-300 text-sm" data-testid="driver-logout"><LogOut className="h-4 w-4" /> Logout</button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {!approved && (
          <div className="rounded-xl p-4 mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200" data-testid="driver-pending-banner">
            <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0" />
            <div><p className="font-semibold text-slate-900 text-sm">Application under review</p><p className="text-xs text-slate-600">We're verifying your documents. You'll be able to quote for jobs once approved.</p></div>
          </div>
        )}

        <Tabs defaultValue="quotation" className="w-full">
          <TabsList className="grid grid-cols-4 w-full" data-testid="driver-tabs">
            <TabsTrigger value="quotation" data-testid="dtab-quotation" className="text-xs">Quotation {available.length > 0 && <span className="ml-1 text-primary font-bold">{available.length}</span>}</TabsTrigger>
            <TabsTrigger value="waiting" data-testid="dtab-waiting" className="text-xs">Waiting {waiting.length > 0 && <span className="ml-1 text-amber-600 font-bold">{waiting.length}</span>}</TabsTrigger>
            <TabsTrigger value="accepted" data-testid="dtab-accepted" className="text-xs">Accepted {activeAccepted.length > 0 && <span className="ml-1 text-emerald-600 font-bold">{activeAccepted.length}</span>}</TabsTrigger>
            <TabsTrigger value="settings" data-testid="dtab-settings" className="text-xs">Settings</TabsTrigger>
          </TabsList>

          {/* QUOTATION (available jobs) */}
          <TabsContent value="quotation" className="mt-4 space-y-3" data-testid="driver-available-list">
            {!approved ? <Empty icon={ShieldAlert} text="Available jobs unlock after approval." />
              : available.length === 0 ? <Empty icon={Route} text="No open jobs right now. Check back soon." />
              : available.map((j) => (
                <JobCard key={j.booking_id} job={j} testid={`available-${j.booking_id}`}>
                  <BidRow job={j} onBid={sendQuote} />
                </JobCard>
              ))}
          </TabsContent>

          {/* WAITING */}
          <TabsContent value="waiting" className="mt-4 space-y-3" data-testid="driver-waiting-list">
            {waiting.length === 0 ? <Empty icon={Hourglass} text="No quotations awaiting a decision." />
              : waiting.map((j) => (
                <JobCard key={j.booking_id} job={j} testid={`waiting-${j.booking_id}`}>
                  <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 font-medium"><Hourglass className="h-4 w-4" /> Waiting for confirmation</div>
                </JobCard>
              ))}
          </TabsContent>

          {/* ACCEPTED */}
          <TabsContent value="accepted" className="mt-4 space-y-3" data-testid="driver-accepted-list">
            {activeAccepted.length === 0 ? <Empty icon={CheckCircle2} text="No accepted jobs yet." />
              : activeAccepted.map((j) => (
                <JobCard key={j.booking_id} job={j} showContact testid={`accepted-${j.booking_id}`}>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-700 border-0">{LABEL[j.status] || j.status}</Badge>
                    <Select value={DRIVER_STEPS.find((s) => s.v === j.status)?.v || ""} onValueChange={(v) => setStatus(j.booking_id, v)}>
                      <SelectTrigger className="h-9 flex-1 text-sm" data-testid={`driver-status-${j.booking_id}`}><SelectValue placeholder="Update status" /></SelectTrigger>
                      <SelectContent>{DRIVER_STEPS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setChat(j.booking_id)} className="mt-2 w-full gap-1.5" data-testid={`driver-chat-${j.booking_id}`}><Send className="h-3.5 w-3.5" /> Message customer</Button>
                </JobCard>
              ))}
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="mt-4" data-testid="driver-settings">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="font-semibold text-slate-900">{profile?.name}</p><p className="text-sm text-slate-500">{user?.email}</p></div>
                <Badge className={approved ? "bg-emerald-100 text-emerald-700 border-0" : "bg-amber-100 text-amber-700 border-0"}>{approved ? "Approved" : "Pending"}</Badge>
              </div>
              <Row icon={Truck} label="Vehicle" value={profile?.vehicle} />
              <Row icon={FileCheck2} label="Licence" value={profile?.licence_no} />
              <Row icon={ShieldCheck} label="Insurance" value={profile?.insurance_no} />
              <Row icon={Calendar} label="MOT expiry" value={profile?.mot_expiry || "—"} />
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div><p className="font-medium text-slate-900 text-sm">Available for jobs</p><p className="text-xs text-slate-500">Turn off to stop receiving new work</p></div>
                <Switch checked={profile?.availability === "available"} onCheckedChange={toggleAvailability} disabled={!approved} data-testid="driver-availability-toggle" />
              </div>
              <PricingEditor profile={profile} onSaved={load} />
              <DocumentsUploader profile={profile} onSaved={load} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
      {chat && <ChatModal bookingId={chat} open={!!chat} onOpenChange={(o) => !o && setChat(null)} meRole="driver" />}
    </div>
  );
}

const JobCard = ({ job, children, showContact }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4" data-testid={`job-${job.booking_id}`}>
    <div className="flex items-center justify-between">
      <span className="font-heading font-semibold text-slate-900 text-sm">{job.booking_id}</span>
      <span className="font-heading text-lg font-bold text-primary flex items-center"><PoundSterling className="h-4 w-4" />{(job.my_bid ?? job.suggested_price ?? job.price ?? 0).toFixed(0)}</span>
    </div>
    <div className="mt-2 space-y-1.5 text-sm text-slate-600">
      <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> {job.pickup}</p>
      <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary shrink-0" /> {job.dropoff}</p>
      <p className="flex items-center gap-2 text-slate-500"><Calendar className="h-3.5 w-3.5 shrink-0" /> {job.date} at {job.time} · {job.distance_miles} mi</p>
      <p className="flex items-center gap-2 text-slate-500"><Truck className="h-3.5 w-3.5 shrink-0" /> {job.van_name}</p>
      {job.items && <p className="flex items-start gap-2 text-slate-500"><Package className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {job.items}</p>}
      {showContact && <p className="flex items-center gap-2 text-slate-500"><Phone className="h-3.5 w-3.5 shrink-0" /> {job.customer_name} · {job.customer_phone}</p>}
    </div>
    {children}
  </div>
);

const Empty = ({ icon: Icon, text }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
    <Icon className="h-9 w-9 text-slate-300 mx-auto" />
    <p className="text-slate-400 mt-3 text-sm">{text}</p>
  </div>
);

const Row = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="flex items-center gap-2 text-slate-500"><Icon className="h-4 w-4" /> {label}</span>
    <span className="font-medium text-slate-900">{value}</span>
  </div>
);

function BidRow({ job, onBid }) {
  const [price, setPrice] = useState(job.suggested_price || "");
  return (
    <div className="mt-3">
      <p className="text-xs text-slate-500 mb-1.5">Suggested from your rates: £{(job.suggested_price || 0).toFixed(2)} · {job.est_hours}h · {job.distance_mi} mi</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">£</span>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="pl-7" data-testid={`bid-input-${job.booking_id}`} />
        </div>
        <Button onClick={() => onBid(job.booking_id, price)} disabled={!price} className="bg-primary hover:bg-[#4C1D95] gap-1.5" data-testid={`quote-${job.booking_id}`}><Send className="h-4 w-4" /> Bid</Button>
      </div>
    </div>
  );
}

const BANDS = { small: [35, 45], medium: [40, 50], large: [45, 55], xl: [50, 60] };
const VAN_LABEL = { small: "Small", medium: "Medium", large: "Large", xl: "Luton XL" };

function PricingEditor({ profile, onSaved }) {
  const p = profile?.pricing || {};
  const [rates, setRates] = useState({ small: p.rates?.small ?? 35, medium: p.rates?.medium ?? 40, large: p.rates?.large ?? 45, xl: p.rates?.xl ?? 50 });
  const [stairs, setStairs] = useState(p.stairs_fee ?? 5);
  const [helper, setHelper] = useState(p.helper_rate ?? 15);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try { await api.post("/driver/pricing", { rates: { small: Number(rates.small), medium: Number(rates.medium), large: Number(rates.large), xl: Number(rates.xl) }, stairs_fee: Number(stairs), helper_rate: Number(helper) }); toast.success("Pricing saved"); onSaved && onSaved(); }
    catch (e) { toast.error("Could not save pricing"); }
    finally { setBusy(false); }
  };

  return (
    <div className="pt-4 border-t border-slate-100" data-testid="pricing-editor">
      <p className="font-semibold text-slate-900 text-sm mb-3">Your hourly rates</p>
      <div className="grid grid-cols-2 gap-3">
        {Object.keys(BANDS).map((v) => (
          <div key={v} className="space-y-1">
            <Label className="text-xs">{VAN_LABEL[v]} (£{BANDS[v][0]}–{BANDS[v][1]})</Label>
            <Input type="number" min={BANDS[v][0]} max={BANDS[v][1]} value={rates[v]} onChange={(e) => setRates((r) => ({ ...r, [v]: e.target.value }))} data-testid={`rate-${v}`} />
          </div>
        ))}
        <div className="space-y-1"><Label className="text-xs">Stairs/floor (£5–15)</Label><Input type="number" min={5} max={15} value={stairs} onChange={(e) => setStairs(e.target.value)} data-testid="rate-stairs" /></div>
        <div className="space-y-1"><Label className="text-xs">Helper /hr (£15–25)</Label><Input type="number" min={15} max={25} value={helper} onChange={(e) => setHelper(e.target.value)} data-testid="rate-helper" /></div>
      </div>
      <Button onClick={save} disabled={busy} className="mt-3 w-full bg-primary hover:bg-[#4C1D95]" data-testid="save-pricing">{busy ? "Saving…" : "Save pricing"}</Button>
    </div>
  );
}

function DocView({ label, field, value, onUpload, uploading }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-4 cursor-pointer hover:border-violet-400 transition-colors text-xs text-slate-500 overflow-hidden" data-testid={`doc-label-${field}`}>
        {uploading === field ? <Loader2 className="h-4 w-4 animate-spin" /> : value ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Send className="h-4 w-4" />}
        {uploading === field ? "Uploading…" : value ? "Uploaded ✓ — replace" : "Tap to upload"}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(field, e)} data-testid={`doc-input-${field}`} />
      </label>
    </div>
  );
}

function DocumentsUploader({ profile, onSaved }) {
  const [uploading, setUploading] = useState(null);
  const upload = async (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await api.post("/driver/documents", { [field]: data.path });
      toast.success("Document uploaded");
      onSaved && onSaved();
    } catch (err) { toast.error("Upload failed"); }
    finally { setUploading(null); e.target.value = ""; }
  };
  return (
    <div className="pt-4 border-t border-slate-100" data-testid="documents-uploader">
      <p className="font-semibold text-slate-900 text-sm mb-1">Documents</p>
      <p className="text-xs text-slate-500 mb-3">Upload these to get approved: profile photo, van photo, driving licence &amp; insurance.</p>
      <div className="grid grid-cols-1 gap-3">
        <DocView label="Profile picture" field="profile_photo" value={profile?.profile_photo} onUpload={upload} uploading={uploading} />
        <DocView label="Van photo" field="van_photo" value={profile?.van_photo} onUpload={upload} uploading={uploading} />
        <DocView label="Driving licence" field="licence_photo" value={profile?.licence_photo} onUpload={upload} uploading={uploading} />
        <DocView label="Insurance certificate" field="insurance_photo" value={profile?.insurance_photo} onUpload={upload} uploading={uploading} />
      </div>
    </div>
  );
}
