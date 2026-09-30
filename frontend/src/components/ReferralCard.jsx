import { useEffect, useState } from "react";
import { Gift, Copy, Check, Users, PoundSterling, Share2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const ReferralCard = ({ variant = "light" }) => {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState("");

  useEffect(() => { api.get("/referral/me").then(({ data }) => setData(data)).catch(() => setData(null)); }, []);

  if (!data) return null;

  const link = `${window.location.origin}/register?ref=${data.code}`;
  const reward = data.reward_each ?? 5;

  const copy = async (text, key) => {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
    setCopied(key); setTimeout(() => setCopied(""), 1800);
    toast.success(key === "code" ? "Code copied" : "Invite link copied");
  };

  const share = async () => {
    const shareData = { title: "Man With Van", text: `Use my code ${data.code} and we both get £${reward} off a man & van move!`, url: link };
    if (navigator.share) { try { await navigator.share(shareData); return; } catch { /* fall through */ } }
    copy(link, "link");
  };

  const dark = variant === "dark";
  const base = dark ? "bg-white/10 border-white/25 text-white" : "bg-white border-slate-200";

  return (
    <div className={`rounded-2xl border shadow-sm p-6 ${dark ? "bg-transparent border-white/25 text-white" : "bg-white border-slate-200"}`} data-testid="referral-card">
      <div className="flex items-center gap-2">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${dark ? "bg-white/15" : "bg-violet-100"}`}><Gift className={`h-5 w-5 ${dark ? "text-white" : "text-primary"}`} /></div>
        <div>
          <h3 className={`font-heading text-lg font-semibold ${dark ? "text-white" : "text-slate-900"}`}>Refer a flatmate — you both get £{reward}</h3>
          <p className={`text-xs ${dark ? "text-white/70" : "text-slate-500"}`}>They get £{reward} off their first move, you get £{reward} when they book.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5">
        <div className={`rounded-xl p-3 text-center ${base} border`}>
          <PoundSterling className={`h-4 w-4 mx-auto ${dark ? "text-white/80" : "text-primary"}`} />
          <p className={`font-heading text-lg font-bold mt-1 ${dark ? "text-white" : "text-slate-900"}`} data-testid="referral-credit">£{(data.credit ?? 0).toFixed(2)}</p>
          <p className={`text-[10px] uppercase tracking-wide ${dark ? "text-white/60" : "text-slate-400"}`}>Your credit</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${base} border`}>
          <Users className={`h-4 w-4 mx-auto ${dark ? "text-white/80" : "text-primary"}`} />
          <p className={`font-heading text-lg font-bold mt-1 ${dark ? "text-white" : "text-slate-900"}`} data-testid="referral-count">{data.referred_count ?? 0}</p>
          <p className={`text-[10px] uppercase tracking-wide ${dark ? "text-white/60" : "text-slate-400"}`}>Invited</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${base} border`}>
          <Check className={`h-4 w-4 mx-auto ${dark ? "text-white/80" : "text-emerald-500"}`} />
          <p className={`font-heading text-lg font-bold mt-1 ${dark ? "text-white" : "text-slate-900"}`} data-testid="referral-rewarded">{data.rewarded_count ?? 0}</p>
          <p className={`text-[10px] uppercase tracking-wide ${dark ? "text-white/60" : "text-slate-400"}`}>Rewarded</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${base}`}>
          <div className="min-w-0">
            <p className={`text-[10px] uppercase tracking-wide ${dark ? "text-white/60" : "text-slate-400"}`}>Your code</p>
            <p className={`font-heading text-lg font-bold tracking-wider ${dark ? "text-white" : "text-primary"}`} data-testid="referral-code">{data.code}</p>
          </div>
          <button onClick={() => copy(data.code, "code")} data-testid="referral-copy-code"
            className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${dark ? "bg-white/15 hover:bg-white/25" : "bg-violet-100 hover:bg-violet-200"}`} aria-label="Copy code">
            {copied === "code" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className={`h-4 w-4 ${dark ? "text-white" : "text-primary"}`} />}
          </button>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => copy(link, "link")} data-testid="referral-copy-link" variant={dark ? "secondary" : "outline"} className="flex-1 gap-2">
            {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy link
          </Button>
          <Button onClick={share} data-testid="referral-share" className={dark ? "flex-1 gap-2 bg-white text-primary hover:bg-white/90" : "flex-1 gap-2 bg-primary hover:bg-[#4C1D95]"}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>
      </div>
    </div>
  );
};
