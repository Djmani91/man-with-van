import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, MapPin, PackageOpen } from "lucide-react";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { ChatModal } from "@/components/ChatModal";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";

export default function Messages() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState(null);
  const [chat, setChat] = useState(null);

  useEffect(() => { api.get("/bookings").then(({ data }) => setBookings(data.filter((b) => b.driver))).catch(() => setBookings([])); }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Seo title="Messages — Man With Van" path="/messages" noindex />
      <div className="hidden sm:block"><Navbar /></div>
      <div className="max-w-2xl mx-auto px-4 pt-5">
        <h1 className="font-heading text-2xl font-bold text-slate-900 mb-4">Messages</h1>
        {bookings === null && <p className="text-slate-400">Loading…</p>}
        {bookings?.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <PackageOpen className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-slate-500 mt-3">No conversations yet. Chat opens once a driver is engaged.</p>
            <Button onClick={() => navigate("/book")} className="mt-4 bg-primary hover:bg-[#4C1D95]">Book a move</Button>
          </div>
        )}
        <div className="space-y-3" data-testid="messages-list">
          {bookings?.map((b) => (
            <button key={b.booking_id} onClick={() => setChat(b.booking_id)} data-testid={`msg-${b.booking_id}`}
              className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-violet-300 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-violet-100 text-primary flex items-center justify-center"><MessageSquare className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">{b.driver.name}</p>
                  <p className="text-sm text-slate-500 truncate flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {b.pickup} → {b.dropoff}</p>
                </div>
                <span className="text-xs text-slate-400">{b.booking_id}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      {chat && <ChatModal bookingId={chat} open={!!chat} onOpenChange={(o) => !o && setChat(null)} meRole="customer" />}
      <BottomNav />
    </div>
  );
}
