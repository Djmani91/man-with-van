import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck, LogOut, MapPin, Calendar, Phone, CheckCircle2, PoundSterling,
  ShieldCheck, ShieldAlert, Send, Hourglass, FileCheck2, Route, Loader2, AlertTriangle,
  MessageSquare, Settings, ClipboardList,
} from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Seo } from "@/components/Seo";
import { ChatModal } from "@/components/ChatModal";
import { DriverJobDetail } from "@/components/DriverJobDetail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const DRIVER_STEPS = [
  { v: "en_route_pickup", l: "En route to pickup" },
  { v: "loading", l: "Loading" },
  { v: "in_transit", l: "In transit" },
  { v: "completed", l: "Completed" },
];
const LABEL = { assigned: "Assigned", en_route_pickup: "En route", loading: "Loading", in_transit: "In transit", completed: "Completed", confirmed: "Confirmed" };

function fmtCardDate(d) {
  if (!d) return { wd: "—", day: "" };
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return { wd: "", day: d };
  return { wd: dt.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase(), day: dt.toLocaleDateString("en-GB", { day: "2-digit" }) };
}

export default function DriverDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [available, setAvailable] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [accepted, setAccepted] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [chat, setChat] = useState(null);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState("quotation");
  const [qsub, setQsub] = useState("open");
  const [dayFilter, setDayFilter] = useState("all");

  const approved = profile?.status === "approved";

  const load = useCallback(async () => {
    const p = await api.get("/driver/profile").then((r) => r.data).catch(() => null);
    setProfile(p);
    const acc = await api.get("/driver/jobs").then((r) => r.data).catch(() => []);
    setAccepted(acc);
    const conv = await api.get("/driver/conversations").then((r) => r.data).catch(() => []);
    setConversations(conv);
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
  const withdrawQuote = async (id) => {
    if (!window.confirm("Withdraw your quote? The job goes back to the quotation page. You can re-quote once more (2 quotes max per job).")) return;
    try { const { data } = await api.post(`/driver/jobs/${id}/withdraw`); toast.success(data.message || "Quote withdrawn"); setDetail(null); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const acceptJob = async (id) => {
    try { const { data } = await api.post(`/driver/jobs/${id}/accept`); toast.success(data.message || "Job accepted"); setDetail(null); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); load(); }
  };
  const setStatus = async (id, status) => {
    try { await api.post(`/driver/jobs/${id}/status`, { status }); toast.success("Status updated"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const cancelJob = async (job) => {
    const warn = paid => paid
      ? "The customer has PAID a deposit for this job.\n\nCancelling now counts against you:\n• 1st time: warning\n• 2nd time: blocked from jobs for 24 hours\n• 3rd time: blocked for 48 hours\n\nAre you sure you want to cancel?"
      : "Are you sure you want to cancel this job? It will be offered to other drivers.";
    if (!window.confirm(warn(job.deposit_paid))) return;
    try {
      const { data } = await api.post(`/driver/jobs/${job.booking_id}/cancel`);
      setDetail(null);
      if (data.blocked_until) toast.error(data.message, { duration: 9000 });
      else if (data.penalised) toast.warning(data.message, { duration: 9000 });
      else toast.success(data.message);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const toggleAvailability = async (v) => {
    try { const { data } = await api.post("/driver/availability", { available: v }); setProfile((p) => ({ ...p, availability: data.availability })); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const activeAccepted = accepted.filter((j) => j.status !== "completed" && j.status !== "cancelled");

  const dayOptions = useMemo(() => {
    const arr = [{ key: "all", top: "All", bot: "" }];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      arr.push({
        key: d.toISOString().split("T")[0],
        top: d.toLocaleDateString("en-GB", { weekday: "short" }),
        bot: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      });
    }
    return arr;
  }, []);
  const byDay = (list) => (dayFilter === "all" ? list : list.filter((j) => j.date === dayFilter));
  const filteredAvailable = byDay(available);
  const filteredWaiting = byDay(waiting);

  const NAV = [
    { v: "quotation", l: "Quotation", icon: ClipboardList, badge: available.length },
    { v: "accepted", l: "Accepted", icon: CheckCircle2, badge: activeAccepted.length },
    { v: "message", l: "Message", icon: MessageSquare, badge: 0 },
    { v: "settings", l: "Settings", icon: Settings, badge: 0 },
  ];

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

      <div className="max-w-2xl mx-auto px-4 py-5 pb-28">
        {!approved && (
          <div className="rounded-xl p-4 mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200" data-testid="driver-pending-banner">
            <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0" />
            <div><p className="font-semibold text-slate-900 text-sm">Application under review</p><p className="text-xs text-slate-600">We're verifying your documents. You'll be able to quote for jobs once approved.</p></div>
          </div>
        )}

        {profile?.blocked_until && profile.blocked_until > new Date().toISOString() && (
          <div className="rounded-xl p-4 mb-4 flex items-center gap-3 bg-red-50 border border-red-200" data-testid="driver-blocked-banner">
            <ShieldAlert className="h-6 w-6 text-red-600 shrink-0" />
            <div><p className="font-semibold text-slate-900 text-sm">Temporarily blocked from new jobs</p><p className="text-xs text-slate-600">You cancelled a paid job. You can take new jobs again after {new Date(profile.blocked_until).toLocaleString("en-GB")}.</p></div>
          </div>
        )}

        {/* QUOTATION */}
        {tab === "quotation" && (
          <div className="space-y-4" data-testid="driver-quotation">
            {/* Day filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" data-testid="driver-day-filter">
              {dayOptions.map((d) => (
                <button key={d.key} onClick={() => setDayFilter(d.key)} data-testid={`day-${d.key}`}
                  className={`shrink-0 rounded-xl px-3 py-2 text-center border-2 transition-all ${dayFilter === d.key ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-600 hover:border-violet-300"}`}>
                  <p className="text-xs font-bold leading-tight">{d.top}</p>
                  {d.bot && <p className="text-[10px] leading-tight opacity-80">{d.bot}</p>}
                </button>
              ))}
            </div>

            {/* Sub tabs */}
            <div className="grid grid-cols-2 gap-1 bg-slate-200/70 p-1 rounded-xl">
              <button onClick={() => setQsub("open")} data-testid="qsub-open"
                className={`rounded-lg py-2 text-sm font-semibold transition-all ${qsub === "open" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}>
                Quotation {filteredAvailable.length > 0 && <span className="ml-1 text-primary font-bold">{filteredAvailable.length}</span>}
              </button>
              <button onClick={() => setQsub("waiting")} data-testid="qsub-waiting"
                className={`rounded-lg py-2 text-sm font-semibold transition-all ${qsub === "waiting" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}>
                Quotation accepted {filteredWaiting.length > 0 && <span className="ml-1 text-amber-600 font-bold">{filteredWaiting.length}</span>}
              </button>
            </div>

            {qsub === "open" ? (
              <div className="space-y-3" data-testid="driver-available-list">
                {!approved ? <Empty icon={ShieldAlert} text="Available jobs unlock after approval." />
                  : filteredAvailable.length === 0 ? <Empty icon={Route} text={dayFilter === "all" ? "No open jobs right now. Check back soon." : "No open jobs on this day. Try another day."} />
                  : filteredAvailable.map((j) => (
                    <JobCard key={j.booking_id} job={j} testid={`available-${j.booking_id}`} onOpen={() => setDetail({ job: j, mode: "quotation" })} />
                  ))}
              </div>
            ) : (
              <div className="space-y-3" data-testid="driver-waiting-list">
                {filteredWaiting.length === 0 ? <Empty icon={Hourglass} text={dayFilter === "all" ? "No quotations awaiting a decision." : "No pending quotes on this day."} />
                  : filteredWaiting.map((j) => (
                    <JobCard key={j.booking_id} job={j} testid={`waiting-${j.booking_id}`} onOpen={() => setDetail({ job: j, mode: "waiting" })}>
                      <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 font-medium"><Hourglass className="h-4 w-4" /> Waiting for confirmation</div>
                    </JobCard>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ACCEPTED */}
        {tab === "accepted" && (
          <div className="space-y-3" data-testid="driver-accepted-list">
            {activeAccepted.length === 0 ? <Empty icon={CheckCircle2} text="No accepted jobs yet." />
              : activeAccepted.map((j) => (
                <JobCard key={j.booking_id} job={j} showContact testid={`accepted-${j.booking_id}`} onOpen={() => setDetail({ job: j, mode: "accepted" })}>
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
          </div>
        )}

        {/* MESSAGE */}
        {tab === "message" && (
          <div className="space-y-3" data-testid="driver-message-list">
            {conversations.length === 0 ? <Empty icon={MessageSquare} text="No conversations yet. Messages from customers will appear here." />
              : conversations.map((c) => (
                <button key={c.booking_id} onClick={() => setChat(c.booking_id)} data-testid={`conversation-${c.booking_id}`}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 hover:border-violet-300 transition-colors">
                  <div className="h-11 w-11 rounded-full bg-violet-100 text-primary font-bold flex items-center justify-center shrink-0">
                    {(c.customer_name || "?").trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900 truncate">{c.customer_name || "Customer"}</p>
                      <span className="text-xs text-slate-400 shrink-0">{c.booking_id}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.pickup_postcode || "—"} → {c.dropoff_postcode || "—"}</p>
                    <p className="text-xs text-slate-400 truncate">{c.last_text ? c.last_text : `${c.date || ""} · ${LABEL[c.status] || c.status}`}</p>
                  </div>
                  <MessageSquare className="h-5 w-5 text-primary shrink-0" />
                </button>
              ))}
          </div>
        )}

        {/* SETTINGS */}
        {tab === "settings" && (
          <div data-testid="driver-settings">
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
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200" data-testid="driver-bottom-nav">
        <div className="max-w-2xl mx-auto grid grid-cols-4">
          {NAV.map((n) => {
            const Icon = n.icon;
            const isActive = tab === n.v;
            return (
              <button key={n.v} onClick={() => setTab(n.v)} data-testid={`dnav-${n.v}`}
                className={`relative flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${isActive ? "text-primary" : "text-slate-400"}`}>
                <Icon className="h-5 w-5" />
                {n.l}
                {n.badge > 0 && <span className="absolute top-1.5 right-1/2 translate-x-4 h-4 min-w-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{n.badge}</span>}
                {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </nav>
      {chat && <ChatModal bookingId={chat} open={!!chat} onOpenChange={(o) => !o && setChat(null)} meRole="driver" />}
      {detail && (
        <DriverJobDetail
          job={detail.job} mode={detail.mode}
          onClose={() => setDetail(null)}
          onBid={sendQuote} onStatus={setStatus} onChat={(id) => { setDetail(null); setChat(id); }} onCancel={cancelJob} onAccept={acceptJob} onWithdraw={withdrawQuote}
          DRIVER_STEPS={DRIVER_STEPS} LABEL={LABEL}
        />
      )}
    </div>
  );
}

const JobCard = ({ job, children, showContact, onOpen }) => {
  const amount = job.my_bid ?? job.customer_pays ?? job.price;
  const bd = fmtCardDate(job.date);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4" data-testid={`job-${job.booking_id}`}>
      {job.congestion_charge && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-100 border border-amber-300 px-3 py-2" data-testid={`congestion-warning-${job.booking_id}`}>
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-800">Congestion charge zone — Central London. Factor in the daily charge.</p>
        </div>
      )}
      <div onClick={onOpen} className={onOpen ? "cursor-pointer" : ""} data-testid={`open-${job.booking_id}`}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-14 rounded-xl bg-violet-50 border border-violet-100 text-center py-1.5" data-testid={`job-date-${job.booking_id}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary leading-none">{bd.wd}</p>
            <p className="font-heading text-2xl font-bold text-slate-900 leading-tight">{bd.day}</p>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-heading font-semibold text-slate-900 text-sm truncate">{job.booking_id}</span>
              {amount != null && amount > 0 && <span className="font-heading text-lg font-bold text-primary flex items-center shrink-0"><PoundSterling className="h-4 w-4" />{amount.toFixed(0)}</span>}
            </div>
            <div className="mt-2 space-y-1.5 text-sm text-slate-600">
              <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> {job.pickup || job.pickup_postcode}</p>
              <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary shrink-0" /> {job.dropoff || job.dropoff_postcode}</p>
              <p className="flex items-center gap-2 text-slate-500"><Calendar className="h-3.5 w-3.5 shrink-0" /> {job.time} · {job.distance_mi ?? job.distance_miles} mi</p>
              <p className="flex items-center gap-2 text-slate-500"><Truck className="h-3.5 w-3.5 shrink-0" /> {job.van_name}</p>
              {showContact && job.customer_phone && <p className="flex items-center gap-2 text-slate-500"><Phone className="h-3.5 w-3.5 shrink-0" /> {job.customer_name} · {job.customer_phone}</p>}
            </div>
          </div>
        </div>
        {onOpen && <p className="text-xs text-primary font-medium mt-2">Tap for full details →</p>}
      </div>
      {children}
    </div>
  );
};

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
