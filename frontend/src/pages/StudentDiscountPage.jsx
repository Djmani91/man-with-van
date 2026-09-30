import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap, Copy, Check, Sparkles, Star, ShieldCheck, PoundSterling, Clock,
  ArrowRight, MapPin, Boxes, Home, Users, BadgePercent,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Seo } from "@/components/Seo";
import { BookingWizard } from "@/components/BookingWizard";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { STUDENT_CODE, STUDENT_PCT, savePromo } from "@/lib/promo";
import { toast } from "sonner";

const SITE = process.env.REACT_APP_BACKEND_URL || "";
const PCT = Math.round(STUDENT_PCT * 100);

const FAQS = [
  { q: "How do students get 10% off a man and van?",
    a: `Use the code ${STUDENT_CODE} at checkout and you get ${PCT}% off your whole man and van booking. Tap "Apply student discount" on this page and the code is filled in for you automatically — you don't need to type anything. The ${PCT}% comes straight off your total before you pay.` },
  { q: "What is the cheapest man with a van for students?",
    a: `Our student man and van starts from just £15 per hour, and with the ${STUDENT_CODE} code you take a further ${PCT}% off — making it one of the cheapest ways to move as a student. You get an instant fixed quote, so you always know the price before you book, with no hidden fees.` },
  { q: "Can I get a man and van near me as a student?",
    a: "Yes — we have local, vetted drivers across every London area and any UK postcode, so there's usually a man with a van near you ready the same day. Enter your pickup postcode and we'll match you with the nearest available driver." },
  { q: "How much does a student man and van cost?",
    a: `A typical student move — a room in halls or a small flat — starts from around £15–£25 per hour depending on van size, and the ${STUDENT_CODE} code takes ${PCT}% off the total. You'll see your exact fixed price the moment you enter your addresses, van size and time.` },
  { q: "Do you move students between halls and houses?",
    a: "Absolutely. Moving out of halls, into a house share, or back home for summer are our most common student jobs. We handle single rooms, shared houses and everything in between, and can send a second person to help carry heavier items up and down stairs." },
  { q: "Can I book a cheap van with a man for just a few items?",
    a: `Yes — you don't need a full house move. A cheap van with a man is perfect for a mattress, a desk, a few boxes or a marketplace pickup. You still get the student ${PCT}% off with ${STUDENT_CODE}, and the driver helps you load and carry.` },
  { q: "Is there a student discount code for removals?",
    a: `Yes — the code is ${STUDENT_CODE} and it gives every student ${PCT}% off. It's reusable, so you can use it for your move out of halls, your move into a new flat, and every move after that.` },
  { q: "How quickly can a student get a man and van?",
    a: "In most areas a driver can reach you the same day, often within the hour during working times. Once your driver is assigned you can follow their live location and ETA on the tracking map right to your door." },
  { q: `Do I need to prove I'm a student to use ${STUDENT_CODE}?`,
    a: `No — just enter ${STUDENT_CODE} at checkout (or tap "Apply student discount" and it fills in automatically) and the ${PCT}% comes off. It's a simple, no-hassle student offer.` },
  { q: "Are your drivers insured for student moves?",
    a: "Every driver is vetted and fully insured, with licence, insurance and MOT verified before they can accept jobs, so your belongings are covered on every student move." },
  { q: "Can I get help carrying heavy things up stairs?",
    a: "Yes. When you book you can add a helper so two people load and carry — ideal for beds, sofas and boxes up to a flat or room with no lift. Just tell us the floors and whether there's a lift when you book." },
  { q: "When do I pay and is there a deposit?",
    a: `You can pay a small 15% deposit to confirm your driver and pay the rest on the day, or pay in full — either way the student ${PCT}% discount is already applied. Card payments are secure and you get an instant confirmation.` },
];

export default function StudentDiscountPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(STUDENT_CODE); } catch { /* noop */ }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  const applyDiscount = () => {
    savePromo(STUDENT_CODE);
    toast.success(`Student discount applied — ${STUDENT_CODE} is ready at checkout`);
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth" });
  };

  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "Service",
      serviceType: "Student man and van removals", name: "Student man and van — 10% off",
      provider: { "@type": "LocalBusiness", name: "Man With Van" },
      areaServed: { "@type": "Country", name: "United Kingdom" },
      description: `Student man and van removals from £15/hour with ${PCT}% off using code ${STUDENT_CODE}. Cheap man with a van for students moving in and out of halls, house shares and flats across the UK.`,
      offers: { "@type": "Offer", name: `Student ${PCT}% discount`, priceCurrency: "GBP", price: "15",
        description: `${PCT}% off every student move with code ${STUDENT_CODE}` },
    },
    {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Student Discount", item: SITE + "/student-discount" },
      ],
    },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      <Seo
        title={`Student Man & Van — ${PCT}% Off with ${STUDENT_CODE} | Cheap Man With a Van`}
        description={`Cheap man with a van for students from £15/hour. Get ${PCT}% off every move with code ${STUDENT_CODE} — halls, house shares & flats. Instant quote, insured local drivers & live tracking. Book a man and van near you today.`}
        path="/student-discount"
        keywords={`student man and van, man with a van, cheap van with man, van with man near me, student removals, student discount removals, cheap man with a van, ${STUDENT_CODE}, uni move, halls to house move`}
        jsonLd={jsonLd} />
      <Navbar />

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 pb-10 grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary bg-violet-100 px-3 py-1.5 rounded-full">
            <BadgePercent className="h-3.5 w-3.5" /> Student offer · {PCT}% off
          </span>
          <h1 className="mt-5 font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.05] text-slate-900" data-testid="student-page-h1">
            Student <span className="text-primary">man &amp; van</span> — {PCT}% off every move
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-lg leading-relaxed">
            The cheap man with a van students actually trust. Moving out of halls, into a house share or a new flat?
            Get a fixed quote from £15/hour, an insured local driver near you, and {PCT}% off your whole booking.
          </p>

          {/* code box */}
          <div className="flex flex-wrap items-center gap-3 mt-7">
            <div className="flex items-center gap-3 bg-white border-2 border-violet-200 rounded-xl pl-4 pr-2 py-2 shadow-sm" data-testid="student-page-code-box">
              <div className="leading-tight">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">Your code</p>
                <p className="font-heading text-xl font-bold tracking-wider text-primary" data-testid="student-page-code">{STUDENT_CODE}</p>
              </div>
              <button onClick={copyCode} data-testid="student-page-copy" className="h-9 w-9 rounded-lg bg-violet-100 hover:bg-violet-200 flex items-center justify-center transition-colors" aria-label="Copy code">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-primary" />}
              </button>
            </div>
            <Button onClick={applyDiscount} data-testid="student-page-apply" className="bg-primary hover:bg-[#4C1D95] rounded-full px-6 h-12 gap-2 font-semibold">
              <GraduationCap className="h-5 w-5" /> Apply &amp; book
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-2">Auto-fills at checkout — no typing needed. Reusable on every move.</p>

          <div className="flex items-center gap-2 mt-6">
            <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-emerald-500 text-emerald-500" />)}</div>
            <span className="font-semibold text-slate-900">4.9 / 5</span>
            <span className="text-slate-500 text-sm">loved by students</span>
          </div>
        </motion.div>

        <motion.div id="book" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <BookingWizard />
        </motion.div>
      </section>

      {/* WHY STUDENTS */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 text-center">Why students choose our man with a van</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {[
            { icon: PoundSterling, t: `${PCT}% off + from £15/hour`, d: `A genuinely cheap van with a man — student prices start at £15/hour and ${STUDENT_CODE} takes another ${PCT}% off the total.` },
            { icon: MapPin, t: "A driver near you", d: "Local, vetted drivers across every London area and any UK postcode — usually a man with a van near you the same day." },
            { icon: ShieldCheck, t: "Insured & tracked", d: "Fully insured drivers and live tracking from pickup to drop-off, so your stuff — and your deposit — are safe." },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 hover:-translate-y-1 hover:shadow-md hover:border-violet-300 transition-all duration-200">
              <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4"><s.icon className="h-6 w-6 text-primary" /></div>
              <h3 className="font-heading text-xl font-semibold text-slate-900">{s.t}</h3>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 text-center">How the student discount works</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {[
            { icon: Copy, t: `1. Grab code ${STUDENT_CODE}`, d: `Copy the code above or just tap "Apply & book" — we save it for you.` },
            { icon: Sparkles, t: "2. It auto-fills at checkout", d: "The promo box on the booking form is already filled in — you don't type a thing." },
            { icon: BadgePercent, t: `3. Get ${PCT}% off instantly`, d: "Your total drops by 10% before you pay. Simple." },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7">
              <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4"><s.icon className="h-6 w-6 text-primary" /></div>
              <h3 className="font-heading text-xl font-semibold text-slate-900">{s.t}</h3>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT WE MOVE */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 text-center">Student moves we do every day</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {[
            { icon: Home, t: "Halls & house shares", d: "Moving out of halls or into a shared house — rooms, boxes, beds and desks, carried up and down stairs." },
            { icon: Boxes, t: "Single items & marketplace", d: "A cheap van with a man for one sofa, a mattress or a Facebook Marketplace pickup — same-day and stress-free." },
            { icon: Users, t: "Group & flat moves", d: "Splitting a van with flatmates? Add a helper and move the whole flat together for less each." },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 hover:-translate-y-1 hover:shadow-md hover:border-violet-300 transition-all duration-200">
              <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4"><s.icon className="h-6 w-6 text-primary" /></div>
              <h3 className="font-heading text-xl font-semibold text-slate-900">{s.t}</h3>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-12">
        <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 text-center">Student man &amp; van — your questions answered</h2>
        <p className="text-slate-500 text-center mt-3">Everything students ask about a cheap man with a van and the {STUDENT_CODE} discount.</p>
        <Accordion type="single" collapsible className="mt-8" data-testid="student-faq">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-b border-slate-200">
              <AccordionTrigger className="text-left font-heading font-semibold text-slate-900 hover:text-primary" data-testid={`student-faq-q-${i}`}>{f.q}</AccordionTrigger>
              <AccordionContent className="text-slate-600 leading-relaxed">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-8">
        <div className="rounded-3xl bg-primary text-white p-8 sm:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold">Move for {PCT}% less</h2>
            <p className="text-white/80 mt-2 text-lg">Book your student man &amp; van in minutes with code {STUDENT_CODE}.</p>
          </div>
          <Button onClick={applyDiscount} className="bg-white text-primary hover:bg-white/90 rounded-full px-7 h-12 gap-2" data-testid="student-cta-book">
            Get my student quote <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
