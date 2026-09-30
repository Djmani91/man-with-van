import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck, Users, PoundSterling, Activity, CheckCircle2, Plus, LogOut, LayoutDashboard, UserCheck, Clock,
} from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Seo } from "@/components/Seo";
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
                    <TableRow key={b.booking_id} data-testid={`admin-row-${b.booking_id}`}>
                      <TableCell className="font-mono text-xs font-semibold">{b.booking_id}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{b.pickup} → {b.dropoff}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{b.date} {b.time}</TableCell>
                      <TableCell className="text-xs">{b.van_name}</TableCell>
                      <TableCell className="font-semibold text-sm">{b.price ? `£${b.price.toFixed(0)}` : "—"}</TableCell>
                      <TableCell className="text-xs">
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
                    const docs = ["profile_photo", "licence_photo", "insurance_photo"].filter((k) => d[k]).length;
                    return (
                    <TableRow key={d.user_id} data-testid={`driver-row-${d.user_id}`}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm" data-testid={`driver-email-${d.user_id}`}>{d.email || "—"}</TableCell>
                      <TableCell className="text-sm">{d.phone}</TableCell>
                      <TableCell className="text-sm">{d.vehicle}</TableCell>
                      <TableCell><Badge className={docs === 3 ? "bg-emerald-100 text-emerald-700 border-0" : "bg-amber-100 text-amber-700 border-0"} data-testid={`docs-${d.user_id}`}>{docs}/3</Badge></TableCell>
                      <TableCell><Badge className={d.status === "approved" ? "bg-emerald-100 text-emerald-700 border-0" : "bg-amber-100 text-amber-700 border-0"}>{d.status === "approved" ? "Approved" : "Pending"}</Badge></TableCell>
                      <TableCell><Badge className={d.availability === "available" ? "bg-emerald-100 text-emerald-700 border-0" : "bg-slate-200 text-slate-600 border-0"}>{d.availability === "available" ? "Available" : d.availability === "on_job" ? "On job" : "Off"}</Badge></TableCell>
                      <TableCell className="text-right">
                        {d.status === "pending" && <Button size="sm" onClick={() => approve(d.user_id)} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" data-testid={`approve-${d.user_id}`}><UserCheck className="h-4 w-4" /> Approve</Button>}
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
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
