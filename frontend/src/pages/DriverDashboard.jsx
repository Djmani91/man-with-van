import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck, LogOut, MapPin, Calendar, Phone, CheckCircle2, PoundSterling, Package, Clock,
  ShieldCheck, ShieldAlert, Send, Hourglass, FileCheck2, Route,
} from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
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

  const sendQuote = async (id) => {
    try { await api.post(`/driver/jobs/${id}/quote`); toast.success("Quotation sent — awaiting confirmation"); load(); }
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
                  <Button onClick={() => sendQuote(j.booking_id)} className="w-full mt-3 bg-primary hover:bg-[#4C1D95] gap-2" data-testid={`quote-${j.booking_id}`}><Send className="h-4 w-4" /> Send quotation</Button>
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
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const JobCard = ({ job, children, showContact }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4" data-testid={`job-${job.booking_id}`}>
    <div className="flex items-center justify-between">
      <span className="font-heading font-semibold text-slate-900 text-sm">{job.booking_id}</span>
      <span className="font-heading text-lg font-bold text-primary flex items-center"><PoundSterling className="h-4 w-4" />{job.price.toFixed(0)}</span>
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
