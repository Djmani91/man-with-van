import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck, Users, PoundSterling, Activity, CheckCircle2, Plus, LogOut, LayoutDashboard, UserCheck, Clock, Pencil,
} from "lucide-react";
import { api, formatApiError, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Seo } from "@/components/Seo";
import { TrackingMap } from "@/components/TrackingMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const STATUSES = ["confirmed", "assigned", "en_route_pickup", "loading", "in_transit", "completed", "cancelled"];
const STATUS_LABEL = { quoting: "Choosing driver", confirmed: "Confirmed", assigned: "Assigned", en_route_pickup: "En route", loading: "Loading", in_transit: "In transit", completed: "Completed", cancelled: "Cancelled" };
const STATUS_STYLE = { quoting: "bg-amber-100 text-amber-700", confirmed: "bg-violet-100 text-violet-700", assigned: "bg-blue-100 text-blue-700", en_route_pickup: "bg-amber-100 text-amber-700", loading: "bg-amber-100 text-amber-700", in_transit: "bg-emerald-100 text-emerald-700", completed: "bg-slate-200 text-slate-600", cancelled: "bg-red-100 text-red-700" };

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driverSearch, setDriverSearch] = useState("");
  const [job, setJob] = useState(null);
  const [manageDriver, setManageDriver] = useState(null);

  const load = useCallback(async () => {
    const [s, b, d] = await Promise.all([api.get("/admin/stats"), api.get("/admin/bookings"), api.get("/admin/drivers")]);
    setStats(s.data); setBookings(b.data); setDrivers(d.data);
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);

  const availableDrivers = drivers.filter((d) => d.status === "approved" && d.availability === "available");
  const pendingDrivers = drivers.filter((d) => d.status === "pending");
  const q = driverSearch.trim().toLowerCase();
  const filteredDrivers = q
    ? drivers.filter((d) => [d.name, d.email, d.phone, d.vehicle].some((v) => (v || "").toLowerCase().includes(q)))
    : drivers;

  const assign = async (id, driverId) => {
    try { await api.post(`/admin/bookings/${id}/assign`, { driver_id: driverId }); toast.success("Driver assigned"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const updateStatus = async (id, status) => {
    try { await api.post(`/admin/bookings/${id}/status`, { status }); toast.success("Status updated"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const approve = async (driverUserId) => {
    try { await api.post(`/admin/drivers/${driverUserId}/approve`); toast.success("Driver approved"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Seo title="Dispatch — Man With Van Admin" path="/admin" noindex />
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center"><LayoutDashboard className="h-5 w-5" /></div>
            <div><p className="font-heading font-bold leading-tight">Dispatch Command</p><p className="text-xs text-slate-400">Man With Van</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-slate-300 hover:text-white hover:bg-slate-800">Site</Button>
            <Button variant="ghost" size="sm" onClick={() => { logout(); navigate("/"); }} className="text-slate-300 hover:text-white hover:bg-slate-800 gap-1.5" data-testid="admin-logout"><LogOut className="h-4 w-4" /> Logout</Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" data-testid="admin-stats">
          <Stat icon={Activity} label="Total bookings" value={stats?.total_bookings ?? "—"} />
          <Stat icon={Truck} label="Active jobs" value={stats?.active_jobs ?? "—"} accent />
          <Stat icon={CheckCircle2} label="Completed" value={stats?.completed ?? "—"} />
          <Stat icon={PoundSterling} label="Revenue" value={stats ? `£${stats.revenue.toFixed(0)}` : "—"} />
          <Stat icon={Users} label="Drivers" value={stats?.drivers ?? "—"} />
        </div>

        <Tabs defaultValue="bookings" className="mt-6">
          <TabsList data-testid="admin-tabs">
            <TabsTrigger value="bookings" data-testid="tab-bookings">Bookings</TabsTrigger>
            <TabsTrigger value="drivers" data-testid="tab-drivers">Drivers {pendingDrivers.length > 0 && <span className="ml-1.5 h-5 min-w-5 px-1 rounded-full bg-amber-500 text-white text-xs inline-flex items-center justify-center">{pendingDrivers.length}</span>}</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="mt-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
              <Table data-testid="admin-bookings-table">
                <TableHeader><TableRow>
                  <TableHead>Ref</TableHead><TableHead>Route</TableHead><TableHead>When</TableHead><TableHead>Van</TableHead><TableHead>Price</TableHead><TableHead>Driver</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Update</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {bookings.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-slate-400 py-8">No bookings yet.</TableCell></TableRow>}
                  {bookings.map((b) => (
                    <TableRow key={b.booking_id} data-testid={`admin-row-${b.booking_id}`} onClick={() => setJob(b)} className="cursor-pointer hover:bg-slate-50">
                      <TableCell className="font-mono text-xs font-semibold">{b.booking_id}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{b.pickup} → {b.dropoff}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{b.date} {b.time}</TableCell>
                      <TableCell className="text-xs">{b.van_name}</TableCell>
                      <TableCell className="font-semibold text-sm">{b.price ? `£${b.price.toFixed(0)}` : "—"}</TableCell>
                      <TableCell className="text-xs" onClick={(e) => e.stopPropagation()}>
                        {b.driver ? b.driver.name : (
                          <Select onValueChange={(v) => assign(b.booking_id, v)}>
                            <SelectTrigger className="h-8 w-[140px] text-xs" data-testid={`assign-${b.booking_id}`}><SelectValue placeholder="Assign driver" /></SelectTrigger>
                            <SelectContent>
                              {availableDrivers.length === 0 && <div className="px-2 py-1.5 text-xs text-slate-400">No drivers free</div>}
                              {availableDrivers.map((d) => <SelectItem key={d.user_id} value={d.user_id}>{d.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell><Badge className={`${STATUS_STYLE[b.status]} border-0`}>{STATUS_LABEL[b.status]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Select value={b.status} onValueChange={(v) => updateStatus(b.booking_id, v)}>
                          <SelectTrigger className="h-8 w-[140px] text-xs ml-auto" data-testid={`status-${b.booking_id}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="drivers" className="mt-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
              <Input value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} placeholder="Search driver by name, email or phone…" className="sm:max-w-xs bg-white" data-testid="driver-search" />
              <AddDriverDialog onAdded={load} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
              <Table data-testid="admin-drivers-table">
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Vehicle</TableHead><TableHead>Docs</TableHead><TableHead>Approval</TableHead><TableHead>Availability</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredDrivers.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-slate-400 py-8">{drivers.length === 0 ? "No drivers yet." : "No drivers match your search."}</TableCell></TableRow>}
                  {filteredDrivers.map((d) => {
                    const docs = ["profile_photo", "van_photo", "licence_photo", "insurance_photo"].filter((k) => d[k]).length;
                    return (
                    <TableRow key={d.user_id} data-testid={`driver-row-${d.user_id}`}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm" data-testid={`driver-email-${d.user_id}`}>{d.email || "—"}</TableCell>
                      <TableCell className="text-sm">{d.phone}</TableCell>
                      <TableCell className="text-sm">{d.vehicle}</TableCell>
                      <TableCell><Badge className={docs === 4 ? "bg-emerald-100 text-emerald-700 border-0" : "bg-amber-100 text-amber-700 border-0"} data-testid={`docs-${d.user_id}`}>{docs}/4</Badge></TableCell>
                      <TableCell><Badge className={d.status === "approved" ? "bg-emerald-100 text-emerald-700 border-0" : "bg-amber-100 text-amber-700 border-0"}>{d.status === "approved" ? "Approved" : "Pending"}</Badge></TableCell>
                      <TableCell><Badge className={d.availability === "available" ? "bg-emerald-100 text-emerald-700 border-0" : "bg-slate-200 text-slate-600 border-0"}>{d.availability === "available" ? "Available" : d.availability === "on_job" ? "On job" : "Off"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {d.status === "pending" && <Button size="sm" onClick={() => approve(d.user_id)} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" data-testid={`approve-${d.user_id}`}><UserCheck className="h-4 w-4" /> Approve</Button>}
                          <Button size="sm" variant="outline" onClick={() => setManageDriver(d)} className="gap-1.5" data-testid={`manage-${d.user_id}`}><Pencil className="h-4 w-4" /> Manage</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
        {job && <AdminJobModal booking={job} onClose={() => setJob(null)} />}
        {manageDriver && <DriverManageDialog driver={manageDriver} onClose={() => setManageDriver(null)} onSaved={load} />}
      </div>
    </div>
  );
}

const Stat = ({ icon: Icon, label, value, accent }) => (
  <div className={`rounded-xl border p-4 ${accent ? "bg-primary text-white border-primary" : "bg-white border-slate-200"}`}>
    <div className="flex items-center justify-between">
      <span className={`text-xs font-medium uppercase tracking-wide ${accent ? "text-white/70" : "text-slate-500"}`}>{label}</span>
      <Icon className={`h-4 w-4 ${accent ? "text-white/70" : "text-slate-400"}`} />
    </div>
    <p className={`font-heading text-2xl font-bold mt-2 ${accent ? "text-white" : "text-slate-900"}`}>{value}</p>
  </div>
);

function AdminJobModal({ booking: b, onClose }) {
  const [messages, setMessages] = useState(null);
  const [refund, setRefund] = useState((b.payment || {}).refund || null);
  const [refunding, setRefunding] = useState(false);
  useEffect(() => {
    api.get(`/bookings/${b.booking_id}/messages`).then(({ data }) => setMessages(data)).catch(() => setMessages([]));
  }, [b.booking_id]);

  const markRefunded = async () => {
    setRefunding(true);
    try {
      const { data } = await api.post(`/admin/bookings/${b.booking_id}/refund`);
      setRefund(data.refund);
      toast.success("Marked as refunded. Remember to process it in your Square dashboard.");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setRefunding(false); }
  };

  const mid = b.pickup_coords && b.dropoff_coords
    ? { lat: (b.pickup_coords.lat + b.dropoff_coords.lat) / 2, lng: (b.pickup_coords.lng + b.dropoff_coords.lng) / 2 }
    : b.pickup_coords;
  const pay = b.payment || {};

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="admin-job-modal" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-base">{b.booking_id}
            <Badge className={`${STATUS_STYLE[b.status]} border-0`}>{STATUS_LABEL[b.status]}</Badge>
          </DialogTitle>
          <DialogDescription>{b.date} at {b.time} · {b.van_name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {b.pickup_coords && b.dropoff_coords && (
            <TrackingMap pickup={b.pickup_coords} dropoff={b.dropoff_coords} driver={mid} />
          )}

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Pickup</p><p className="text-slate-800">{b.pickup}{b.pickup_flat ? `, ${b.pickup_flat}` : ""}</p><p className="text-xs text-slate-500">Floor {b.pickup_floor ?? 0} · {b.pickup_lift ? "Lift" : "Stairs"}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Drop-off</p><p className="text-slate-800">{b.dropoff}</p><p className="text-xs text-slate-500">Floor {b.dropoff_floor ?? 0} · {b.dropoff_lift ? "Lift" : "Stairs"}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Customer</p><p className="text-slate-800">{b.customer_name}</p><p className="text-xs text-slate-500">{b.customer_phone} · {b.customer_email}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Driver</p><p className="text-slate-800">{b.driver ? b.driver.name : "Not assigned"}</p>{b.driver && <p className="text-xs text-slate-500">{b.driver.phone} · {b.driver.vehicle}</p>}</div>
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Price</p><p className="text-slate-800 font-semibold">{b.price ? `£${b.price.toFixed(2)}` : "—"}</p>{pay.status === "paid" && <p className="text-xs text-emerald-600">{pay.type === "deposit" ? "Deposit paid" : "Paid in full"}{pay.credit_applied ? ` · £${pay.credit_applied} credit` : ""}{b.promo_code ? ` · ${b.promo_code}` : ""}</p>}</div>
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Extras</p><p className="text-xs text-slate-600">{[b.needs_helper && "Helper", b.heavy_items && "Heavy items", b.mode].filter(Boolean).join(" · ") || "—"}</p></div>
          </div>

          {b.cancel_reason && <div className="text-sm rounded-lg bg-red-50 border border-red-100 p-3"><p className="text-xs uppercase tracking-wide text-red-400">Cancelled — reason</p><p className="text-red-700">{b.cancel_reason}</p></div>}

          {refund && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-3" data-testid="admin-refund-box">
              <div>
                <p className="text-sm font-semibold text-amber-800">Refund {refund.status === "refunded" ? "completed" : "requested"} · £{(refund.amount || 0).toFixed(2)}</p>
                <p className="text-xs text-amber-700">{refund.reason}</p>
              </div>
              {refund.status === "requested"
                ? <Button size="sm" onClick={markRefunded} disabled={refunding} className="bg-emerald-600 hover:bg-emerald-700 shrink-0" data-testid="admin-mark-refunded">{refunding ? "…" : "Mark refunded"}</Button>
                : <Badge className="bg-emerald-100 text-emerald-700 border-0">Refunded</Badge>}
            </div>
          )}

          {b.items && <div className="text-sm"><p className="text-xs uppercase tracking-wide text-slate-400">Items</p><p className="text-slate-700">{b.items}</p></div>}
          {b.notes && <div className="text-sm"><p className="text-xs uppercase tracking-wide text-slate-400">Notes</p><p className="text-slate-700">{b.notes}</p></div>}

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Customer ↔ Driver chat</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 max-h-64 overflow-y-auto space-y-2" data-testid="admin-chat-thread">
              {messages === null && <p className="text-xs text-slate-400 text-center py-4">Loading messages…</p>}
              {messages?.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No messages yet — chat opens once a driver is engaged.</p>}
              {messages?.map((m) => (
                <div key={m.id} className={`flex ${m.sender_role === "customer" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.sender_role === "customer" ? "bg-white border border-slate-200 text-slate-800" : "bg-primary text-white"}`}>
                    <p className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">{m.sender_name} · {m.sender_role}</p>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Contact details are auto-hidden in chat until the customer pays.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddDriverDialog({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", vehicle: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/admin/drivers", form);
      toast.success("Driver added & approved");
      setForm({ name: "", email: "", password: "", phone: "", vehicle: "" });
      setOpen(false); onAdded();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="bg-primary hover:bg-[#4C1D95] gap-2" data-testid="add-driver-btn"><Plus className="h-4 w-4" /> Add driver</Button></DialogTrigger>
      <DialogContent data-testid="add-driver-dialog">
        <DialogHeader><DialogTitle>Add a driver</DialogTitle><DialogDescription>Creates an approved driver account with login credentials.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={set("name")} placeholder="Dave Wilson" data-testid="driver-name" /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={set("email")} placeholder="dave@example.com" data-testid="driver-email" /></div>
          <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={set("password")} placeholder="Min 6 characters" data-testid="driver-password" /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={set("phone")} placeholder="07123 456789" data-testid="driver-phone" /></div>
          <div className="space-y-2"><Label>Vehicle</Label><Input value={form.vehicle} onChange={set("vehicle")} placeholder="Large Luton — AB12 CDE" data-testid="driver-vehicle" /></div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy || !form.name || !form.email || !form.password || !form.phone || !form.vehicle} className="bg-primary hover:bg-[#4C1D95]" data-testid="driver-save">{busy ? "Adding…" : "Add driver"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


const VAN_OPTS = [
  { id: "small", name: "Small Van" },
  { id: "medium", name: "Medium Van" },
  { id: "large", name: "Large Van" },
  { id: "xl", name: "XL / Luton" },
];
const PHOTO_FIELDS = [
  { key: "profile_photo", label: "Profile" },
  { key: "van_photo", label: "Van" },
  { key: "licence_photo", label: "Licence" },
  { key: "insurance_photo", label: "Insurance" },
];

function DriverManageDialog({ driver, onClose, onSaved }) {
  const p = driver.pricing || { rates: {}, stairs_fee: 0, helper_rate: 0 };
  const [form, setForm] = useState({
    name: driver.name || "", phone: driver.phone || "", vehicle: driver.vehicle || "",
    van_size: driver.van_size || "", home_postcode: driver.home_postcode || "",
    status: driver.status || "pending", availability: driver.availability || "available",
    rate_small: p.rates?.small ?? "", rate_medium: p.rates?.medium ?? "",
    rate_large: p.rates?.large ?? "", rate_xl: p.rates?.xl ?? "",
    stairs_fee: p.stairs_fee ?? "", helper_rate: p.helper_rate ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/admin/drivers/${driver.user_id}`, {
        name: form.name, phone: form.phone, vehicle: form.vehicle,
        van_size: form.van_size || null, home_postcode: form.home_postcode,
        status: form.status, availability: form.availability,
        pricing: {
          rates: {
            small: Number(form.rate_small) || 0, medium: Number(form.rate_medium) || 0,
            large: Number(form.rate_large) || 0, xl: Number(form.rate_xl) || 0,
          },
          stairs_fee: Number(form.stairs_fee) || 0, helper_rate: Number(form.helper_rate) || 0,
        },
      });
      toast.success("Driver updated");
      onClose(); onSaved();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!driver} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="driver-manage-dialog" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Manage driver — {driver.name}</DialogTitle>
          <DialogDescription>{driver.email || "—"}</DialogDescription>
        </DialogHeader>

        {/* Documents / photos */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Documents & photos</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PHOTO_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <p className="text-xs text-slate-500">{f.label}</p>
                {driver[f.key]
                  ? <a href={`${API}/files/${driver[f.key]}`} target="_blank" rel="noreferrer" data-testid={`driver-photo-${f.key}`}>
                      <img src={`${API}/files/${driver[f.key]}`} alt={f.label} className="w-full h-24 object-cover rounded-lg border border-slate-200 hover:opacity-90" />
                    </a>
                  : <div className="w-full h-24 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400" data-testid={`driver-photo-missing-${f.key}`}>Not uploaded</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Editable fields */}
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={set("name")} data-testid="edit-name" /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={set("phone")} data-testid="edit-phone" /></div>
          <div className="space-y-1.5"><Label>Vehicle</Label><Input value={form.vehicle} onChange={set("vehicle")} data-testid="edit-vehicle" /></div>
          <div className="space-y-1.5"><Label>Home postcode</Label><Input value={form.home_postcode} onChange={set("home_postcode")} data-testid="edit-postcode" /></div>
          <div className="space-y-1.5"><Label>Van size</Label>
            <Select value={form.van_size} onValueChange={set("van_size")}>
              <SelectTrigger data-testid="edit-vansize"><SelectValue placeholder="Any / not set" /></SelectTrigger>
              <SelectContent>{VAN_OPTS.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Status</Label>
            <Select value={form.status} onValueChange={set("status")}>
              <SelectTrigger data-testid="edit-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Availability</Label>
            <Select value={form.availability} onValueChange={set("availability")}>
              <SelectTrigger data-testid="edit-availability"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="on_job">On job</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-3">Hourly rates (£)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5"><Label className="text-xs">Small</Label><Input type="number" value={form.rate_small} onChange={set("rate_small")} data-testid="edit-rate-small" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Medium</Label><Input type="number" value={form.rate_medium} onChange={set("rate_medium")} data-testid="edit-rate-medium" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Large</Label><Input type="number" value={form.rate_large} onChange={set("rate_large")} data-testid="edit-rate-large" /></div>
          <div className="space-y-1.5"><Label className="text-xs">XL/Luton</Label><Input type="number" value={form.rate_xl} onChange={set("rate_xl")} data-testid="edit-rate-xl" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Stairs / floor</Label><Input type="number" value={form.stairs_fee} onChange={set("stairs_fee")} data-testid="edit-stairs" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Helper / hr</Label><Input type="number" value={form.helper_rate} onChange={set("helper_rate")} data-testid="edit-helper" /></div>
        </div>

        <DialogFooter className="mt-3">
          <Button onClick={save} disabled={busy} className="bg-primary hover:bg-[#4C1D95]" data-testid="driver-manage-save">{busy ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
