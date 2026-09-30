import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, MapPin, Calendar, ArrowRight, Plus, PackageOpen, Bell } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { ReferralCard } from "@/components/ReferralCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const STATUS_STYLE = {
  confirmed: "bg-violet-100 text-violet-700",
  assigned: "bg-blue-100 text-blue-700",
  en_route_pickup: "bg-amber-100 text-amber-700",
  loading: "bg-amber-100 text-amber-700",
  in_transit: "bg-emerald-100 text-emerald-700",
  completed: "bg-slate-200 text-slate-600",
  cancelled: "bg-red-100 text-red-700",
};
const STATUS_LABEL = {
  confirmed: "Confirmed", assigned: "Driver assigned", en_route_pickup: "En route",
  loading: "Loading", in_transit: "In transit", completed: "Completed", cancelled: "Cancelled",
};

export default function Account() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState(null);
  const [prefs, setPrefs] = useState(user?.notify_prefs || { booking_confirmation: true, status_update: true });
  const [savingPref, setSavingPref] = useState(null);

  useEffect(() => { api.get("/bookings").then(({ data }) => setBookings(data)).catch(() => setBookings([])); }, []);
  useEffect(() => { if (user?.notify_prefs) setPrefs(user.notify_prefs); }, [user]);

  const savePref = async (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSavingPref(key);
    try {
      const { data } = await api.put("/account/notifications", next);
      setPrefs(data.notify_prefs);
      if (setUser && user) setUser({ ...user, notify_prefs: data.notify_prefs });
      toast.success("Notification settings saved");
    } catch {
      setPrefs(prefs);
      toast.error("Couldn't save — please try again");
    } finally {
      setSavingPref(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="hidden sm:block"><Navbar /></div>
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900">Hi {user?.name?.split(" ")[0] || "there"} 👋</h1>
            <p className="text-slate-500 mt-1">Your account and booking history.</p>
          </div>
          <Button onClick={() => navigate("/book")} className="bg-primary hover:bg-[#4C1D95] gap-2" data-testid="account-new-booking">
            <Plus className="h-4 w-4" /> New booking
          </Button>
        </div>

        <div className="mt-8"><ReferralCard /></div>

        <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6" data-testid="notification-settings">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-slate-900">Email notifications</h2>
              <p className="text-sm text-slate-500">Choose which emails we send you.</p>
            </div>
          </div>
          <div className="mt-5 divide-y divide-slate-100">
            <div className="flex items-center justify-between py-3">
              <div className="pr-4">
                <p className="text-sm font-medium text-slate-800">Booking confirmations</p>
                <p className="text-xs text-slate-500">When a driver is assigned and your move is confirmed.</p>
              </div>
              <Switch
                checked={prefs.booking_confirmation}
                disabled={savingPref === "booking_confirmation"}
                onCheckedChange={(v) => savePref("booking_confirmation", v)}
                data-testid="pref-booking-confirmation"
              />
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="pr-4">
                <p className="text-sm font-medium text-slate-800">Move status updates</p>
                <p className="text-xs text-slate-500">En route, loading, in transit, completed and more.</p>
              </div>
              <Switch
                checked={prefs.status_update}
                disabled={savingPref === "status_update"}
                onCheckedChange={(v) => savePref("status_update", v)}
                data-testid="pref-status-update"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-4" data-testid="bookings-list">
          {bookings === null && <p className="text-slate-400">Loading…</p>}
          {bookings?.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
              <PackageOpen className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-slate-500 mt-3">No bookings yet.</p>
              <Button onClick={() => navigate("/book")} className="mt-4 bg-primary hover:bg-[#4C1D95]" data-testid="account-empty-cta">Book your first move</Button>
            </div>
          )}
          {bookings?.map((b) => (
            <div key={b.booking_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 hover:shadow-md transition-shadow" data-testid={`booking-${b.booking_id}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-semibold text-slate-900">{b.booking_id}</span>
                      <Badge className={`${STATUS_STYLE[b.status]} border-0`} data-testid={`booking-status-${b.booking_id}`}>{STATUS_LABEL[b.status] || b.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {b.pickup} → {b.dropoff}</p>
                    <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {b.date} at {b.time} · {b.van_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-heading text-xl font-bold text-slate-900">{b.price ? `£${b.price.toFixed(2)}` : "—"}</p>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/track/${b.booking_id}`)} className="mt-2 gap-1.5" data-testid={`track-${b.booking_id}`}>
                    Track <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
