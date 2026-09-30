import { useState } from "react";
import { GraduationCap, Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STUDENT_CODE, savePromo } from "@/lib/promo";
import { toast } from "sonner";

export const StudentDiscount = () => {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(STUDENT_CODE); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const applyDiscount = () => {
    savePromo(STUDENT_CODE);
    toast.success(`Student discount applied — code ${STUDENT_CODE} is ready at checkout`);
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#4C1D95] to-primary text-white p-8 sm:p-10" data-testid="student-discount-widget">
        <GraduationCap className="absolute -right-6 -bottom-8 h-52 w-52 text-white/10" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest bg-white/15 px-3 py-1.5 rounded-full">
              <Sparkles className="h-3.5 w-3.5" /> Student offer
            </span>
            <h2 className="mt-4 font-heading text-3xl sm:text-4xl font-bold">Students get 10% off every move</h2>
            <p className="mt-3 text-white/85 text-[15px] leading-relaxed">
              Moving in or out of halls, a house share or a new flat? Get 10% off your whole man &amp; van
              booking — no minimum, use it as many times as you like.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <div className="flex items-center gap-3 bg-white/10 border border-white/25 rounded-xl pl-4 pr-2 py-2" data-testid="student-code-box">
                <div className="leading-tight">
                  <p className="text-[10px] uppercase tracking-wide text-white/60">Your code</p>
                  <p className="font-heading text-xl font-bold tracking-wider" data-testid="student-code">{STUDENT_CODE}</p>
                </div>
                <button onClick={copyCode} data-testid="student-copy-code"
                  className="h-9 w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors" aria-label="Copy code">
                  {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <Button onClick={applyDiscount} data-testid="student-apply-btn"
              className="bg-white text-primary hover:bg-white/90 rounded-full px-7 h-12 gap-2 font-semibold">
              <GraduationCap className="h-5 w-5" /> Apply student discount
            </Button>
            <p className="text-xs text-white/60 mt-2 text-center">Auto-fills at checkout — no typing needed</p>
          </div>
        </div>
      </div>
    </section>
  );
};
