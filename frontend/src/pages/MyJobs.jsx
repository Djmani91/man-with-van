import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin, Star, MessageSquare, Truck, ShieldCheck, Zap, Gavel, Calendar, ArrowRight, PackageOpen, Loader2, Radio,
} from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { ChatModal } from "@/components/ChatModal";
import { SquarePaymentModal } from "@/components/SquarePaymentModal";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const initials = (n) => (n?.split(" ").map((p) => p[0]).slice(0, 2).join("") || "D").toUpperCase();
const STATUS_LABEL = { assigned: "Driver assigned", en_route_pickup: "En route", loading: "Loading", in_transit: "In transit", completed: "Completed", quoting: "Choosing driver" };

export default function MyJobs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState(null);
  const [payType, setPayType] = useState("deposit");
  const [offers, setOffers] = useState(null);
  const [bids, setBids] = useState([]);
  const [mode, setMode] = useState("instant");
  const [chat, setChat] = useState(null);
  const [profile, setProfile] = useState(null);
  const [accepting, setAccepting] = useState(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [payFor, setPayFor] = useState(null); // { driverId, price }

  const load = useCallback(async () => {
    const { data } = await api.get("/bookings");
    setBookings(data);
    return data;
  }, []);

  useEffect(() => { load().catch(() => setBookings([])); }, [load]);

  const active = bookings?.find((b) => b.status === "quoting");
  const promoPct = active?.promo_discount_pct || 0;
  const promoCode = active?.promo_code;

  const loadOffers = useCallback(async (id) => {
    try { const { data } = await api.get(`/bookings/${id}/instant-offers`); setOffers(data); } catch { setOffers({ offers: [] }); }
  }, []);
  const loadBids = useCallback(async (id) => {
    try { const { data } = await api.get(`/bookings/${id}/bids`); setBids(data); } catch { setBids([]); }
  }, []);

  useEffect(() => {
    if (active) { loadOffers(active.booking_id); if (active.mode === "bidding") { setMode("bidding"); loadBids(active.booking_id); } }
  }, [active, loadOffers, loadBids]);

  const broadcast = async () => {
    if (!active) return;
    setBroadcasting(true);
    try {
      const { data } = await api.post(`/bookings/${active.booking_id}/broadcast`);
      toast.success(`Sent to ${data.notified_drivers} drivers within ${data.radius_mi} miles`);
      setMode("bidding"); loadBids(active.booking_id);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBroadcasting(false); }
  };

  const accept = (driverId, price) => {
    setPayFor({ driverId, price });
  };

  const payAmount = payFor ? (() => {
    const eff = payFor.price * (1 - promoPct);
    return payType === "deposit" ? eff * 0.15 : eff;
  })() : 0;

  const handleToken = async (sourceId) => {
    if (!payFor || !active) return;
    setAccepting(payFor.driverId);
    try {
      await api.post(`/bookings/${active.booking_id}/select-driver`, {
        driver_id: payFor.driverId, payment_type: payType, source_id: sourceId,
      });
      toast.success(payType === "deposit" ? "15% deposit paid — driver confirmed!" : "Paid in full — driver confirmed!");
      setPayFor(null);
      const fresh = await load();
      const b = fresh.find((x) => x.booking_id === active.booking_id);
      if (b) navigate(`/track/${b.booking_id}`);
    } catch (e) {
      setAccepting(null);
      throw new Error(formatApiError(e.response?.data?.detail));
    }
  };

  const others = bookings?.filter((b) => b.status !== "quoting") || [];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Seo title="My Jobs — Man With Van" path="/jobs" noindex />
      <div className="hidden sm:block"><Navbar /></div>
      <div className="max-w-2xl mx-auto px-4 pt-5">
        <h1 className="font-heading text-2xl font-bold text-slate-900 mb-4">My Jobs</h1>

        {bookings === null && <p className="text-slate-400">Loading…</p>}

        {/* Active job needing a driver */}
        {active && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <p className="font-heading font-semibold text-slate-900">{active.booking_id}</p>
                <Badge className="bg-amber-100 text-amber-700 border-0">Choosing driver</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {active.pickup} → {active.dropoff}</p>
              <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {active.date} at {active.time} · {active.van_name}</p>
            </div>

            {/* Payment choice */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">How would you like to pay? <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Required</span></p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <button onClick={() => setPayType("deposit")} data-testid="pay-deposit" className={`text-left p-3 rounded-xl border-2 transition-all ${payType === "deposit" ? "border-primary bg-violet-50" : "border-slate-200"}`}>
                  <p className="font-semibold text-slate-900 text-sm">15% deposit</p>
                  <p className="text-xs text-slate-500 mt-0.5">Balance in cash to driver</p>
                </button>
                <button onClick={() => setPayType("full")} data-testid="pay-full" className={`text-left p-3 rounded-xl border-2 transition-all ${payType === "full" ? "border-primary bg-violet-50" : "border-slate-200"}`}>
                  <p className="font-semibold text-slate-900 text-sm">Pay in full</p>
                  <p className="text-xs text-slate-500 mt-0.5">Nothing to pay on the day</p>
                </button>
              </div>
              <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 p-3 flex gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                <div><p className="text-sm font-semibold text-slate-900">Refund guarantee</p><p className="text-xs text-slate-600">Cancel at least 6 hours before your scheduled time for a full refund.</p></div>
              </div>
              {promoCode && (
                <div className="mt-3 rounded-xl bg-violet-50 border border-violet-200 p-3 flex items-center gap-2" data-testid="promo-applied-banner">
                  <span className="text-xs font-bold uppercase tracking-wide bg-primary text-white px-2 py-1 rounded">{promoCode}</span>
                  <p className="text-sm text-slate-700 font-medium">{Math.round(promoPct * 100)}% student discount applied — prices below already include it.</p>
                </div>
              )}
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2">
              <button onClick={() => setMode("instant")} data-testid="mode-instant" className={`flex-1 rounded-xl p-3 border-2 text-left transition-all ${mode === "instant" ? "border-amber-400 bg-gradient-to-br from-amber-50 to-violet-50" : "border-slate-200 bg-white"}`}>
                <p className="font-semibold text-slate-900 text-sm flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-500" /> Instant quotes</p>
                <p className="text-xs text-slate-500 mt-0.5">Nearby drivers, book now</p>
              </button>
              <button onClick={() => { setMode("bidding"); if (active.mode !== "bidding") broadcast(); }} data-testid="mode-bidding" className={`flex-1 rounded-xl p-3 border-2 text-left transition-all ${mode === "bidding" ? "border-primary bg-violet-50" : "border-slate-200 bg-white"}`}>
                <p className="font-semibold text-slate-900 text-sm flex items-center gap-1.5"><Gavel className="h-4 w-4 text-primary" /> Bidding</p>
                <p className="text-xs text-slate-500 mt-0.5">Wait a little for more offers</p>
              </button>
            </div>

            {/* Offers list */}
            {mode === "instant" ? (
              <OfferList offers={offers?.offers} loading={offers === null} note={offers && !offers.exact_radius ? "Nearest drivers (just outside 5 miles)" : `Drivers within ${offers?.radius_mi || 5} miles`}
                onAccept={accept} onChat={setChat} onProfile={setProfile} accepting={accepting} payType={payType} promoPct={promoPct} />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Incoming bids (within 30 mi)</p>
                  <Button size="sm" variant="outline" onClick={broadcast} disabled={broadcasting} data-testid="rebroadcast" className="h-8 gap-1.5"><Radio className="h-3.5 w-3.5" /> {broadcasting ? "Sending…" : "Notify drivers"}</Button>
                </div>
                {bids.length === 0
                  ? <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400" data-testid="no-bids">Bids will appear here as drivers respond — this can take a little while.</div>
                  : <OfferList offers={bids} onAccept={accept} onChat={setChat} onProfile={setProfile} accepting={accepting} payType={payType} promoPct={promoPct} />}
              </div>
            )}
          </div>
        )}

        {/* Other bookings */}
        {(!active || others.length > 0) && (
          <div className={`space-y-3 ${active ? "mt-8" : ""}`} data-testid="jobs-list">
            {active && others.length > 0 && <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your bookings</p>}
            {!active && others.length === 0 && bookings !== null && (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <PackageOpen className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-slate-500 mt-3">No jobs yet.</p>
                <Button onClick={() => navigate("/book")} className="mt-4 bg-primary hover:bg-[#4C1D95]" data-testid="jobs-empty-cta">Book a move</Button>
              </div>
            )}
            {others.map((b) => (
              <div key={b.booking_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4" data-testid={`job-${b.booking_id}`}>
                <div className="flex items-center justify-between">
                  <p className="font-heading font-semibold text-slate-900">{b.booking_id}</p>
                  <Badge className="bg-violet-100 text-violet-700 border-0">{STATUS_LABEL[b.status] || b.status}</Badge>
                </div>
                <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {b.pickup} → {b.dropoff}</p>
                <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {b.date} at {b.time}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="font-heading text-lg font-bold text-slate-900">£{(b.price || 0).toFixed(2)}</span>
                  <div className="flex gap-2">
                    {b.driver && <Button size="sm" variant="outline" onClick={() => setChat(b.booking_id)} data-testid={`chat-${b.booking_id}`} className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Message</Button>}
                    <Button size="sm" onClick={() => navigate(`/track/${b.booking_id}`)} className="bg-primary hover:bg-[#4C1D95] gap-1.5" data-testid={`track-${b.booking_id}`}>Track <ArrowRight className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {chat && <ChatModal bookingId={chat} open={!!chat} onOpenChange={(o) => !o && setChat(null)} meRole="customer" />}
      {payFor && (
        <SquarePaymentModal
          open={!!payFor}
          onOpenChange={(o) => { if (!o) { setPayFor(null); setAccepting(null); } }}
          amount={payAmount}
          payType={payType}
          driverName={(offers?.offers || bids)?.find((o) => o.driver_id === payFor.driverId)?.name}
          onToken={handleToken}
        />
      )}
      <ProfileModal profile={profile} onClose={() => setProfile(null)} />
      <BottomNav />
    </div>
  );
}

function OfferList({ offers, loading, note, onAccept, onChat, onProfile, accepting, payType, promoPct = 0 }) {
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!offers || offers.length === 0) return <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400" data-testid="no-offers">No drivers available right now. Try bidding to reach more drivers.</div>;
  return (
    <div className="space-y-3">
      {note && <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{note}</p>}
      {offers.map((o) => (
        <div key={o.driver_id} className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-4 data-[best=true]:border-emerald-300" data-best={o.tags?.includes("cheapest")} data-testid={`offer-${o.driver_id}`}>
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-full bg-violet-100 text-primary font-bold flex items-center justify-center shrink-0">{initials(o.name)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900 truncate">{o.name}</p>
                {promoPct > 0
                  ? <span className="shrink-0 text-right"><span className="text-sm text-slate-400 line-through mr-1.5">£{o.price.toFixed(2)}</span><span className="font-heading text-xl font-bold text-slate-900">£{(o.price * (1 - promoPct)).toFixed(2)}</span></span>
                  : <span className="font-heading text-xl font-bold text-slate-900 shrink-0">£{o.price.toFixed(2)}</span>}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {o.tags?.includes("closest") && <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1"><MapPin className="h-3 w-3" /> Closest</Badge>}
                {o.tags?.includes("cheapest") && <Badge className="bg-amber-100 text-amber-700 border-0">Cheapest</Badge>}
                <span className="text-sm text-slate-500 flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {o.rating?.toFixed(1)}</span>
                <span className="text-sm text-slate-400">· {o.distance_mi} mi away</span>
                <button onClick={() => onProfile(o)} className="text-sm text-primary hover:underline" data-testid={`profile-${o.driver_id}`}>· View profile</button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Button variant="outline" onClick={() => onChat && onChatUnavailable()} disabled className="gap-1.5 opacity-60" title="Chat opens after you accept" data-testid={`offer-msg-${o.driver_id}`}><MessageSquare className="h-4 w-4" /> Message</Button>
            <Button onClick={() => onAccept(o.driver_id, o.price)} disabled={accepting === o.driver_id} className="bg-primary hover:bg-[#4C1D95]" data-testid={`accept-${o.driver_id}`}>
              {accepting === o.driver_id ? "Processing…" : `Accept — £${((payType === "deposit" ? o.price * 0.15 : o.price) * (1 - promoPct)).toFixed(2)}`}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
function onChatUnavailable() {}

function ProfileModal({ profile, onClose }) {
  return (
    <Dialog open={!!profile} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="profile-modal">
        <DialogHeader><DialogTitle>{profile?.name}</DialogTitle></DialogHeader>
        {profile && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-violet-100 text-primary font-bold text-xl flex items-center justify-center">{initials(profile.name)}</div>
              <div>
                <p className="flex items-center gap-1 text-slate-900 font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {profile.rating?.toFixed(1)} <span className="text-slate-400 font-normal text-sm">({profile.reviews} reviews)</span></p>
                <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1"><Truck className="h-4 w-4" /> {profile.vehicle}</p>
                <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5"><MapPin className="h-4 w-4" /> {profile.distance_mi} mi away</p>
              </div>
            </div>
            <p className="text-sm text-slate-500">Vetted &amp; insured Man With Van driver. Contact details are shared once you pay your deposit.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
