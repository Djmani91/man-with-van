import { useEffect, useRef, useState } from "react";
import { Send, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const ChatModal = ({ bookingId, driverId, open, onOpenChange, meRole = "customer" }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const qs = driverId ? `?driver_id=${driverId}` : "";

  const load = async () => {
    try { const { data } = await api.get(`/bookings/${bookingId}/messages${qs}`); setMessages(data); } catch {}
  };
  useEffect(() => {
    if (!open) return;
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingId, driverId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await api.post(`/bookings/${bookingId}/messages${qs}`, { text }); setText(""); load(); } catch {}
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden" data-testid="chat-modal">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Chat</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-amber-600 text-xs"><ShieldAlert className="h-3.5 w-3.5" /> For your safety, phone numbers, emails & addresses are automatically hidden.</DialogDescription>
        </DialogHeader>
        <div className="h-72 overflow-y-auto px-5 py-3 space-y-2 bg-slate-50" data-testid="chat-messages">
          {messages.length === 0 && <p className="text-center text-sm text-slate-400 mt-8">No messages yet. Say hello 👋</p>}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_role === meRole ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender_role === meRole ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-700"}`}>
                {m.text}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 p-3 border-t border-slate-200">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" data-testid="chat-input" />
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-[#4C1D95] shrink-0" data-testid="chat-send"><Send className="h-4 w-4" /></Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
