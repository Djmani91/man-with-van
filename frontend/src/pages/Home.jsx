import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Truck, Clock, ShieldCheck, Star, Zap, PoundSterling, MapPin,
  PackageCheck, Building2, FileCheck2, User, Play, CheckCircle2, Quote, Timer, Sofa,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Seo } from "@/components/Seo";
import { BookingWizard } from "@/components/BookingWizard";
import { StudentDiscount } from "@/components/StudentDiscount";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const IMG = {
  hero: "https://images.unsplash.com/photo-1665521032636-e8d2f6927053?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
  couple: "https://images.unsplash.com/photo-1758523671087-b256bbbca475?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
  room: "https://images.unsplash.com/photo-1649083048269-8bfb755e7b87?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
};

const AREAS = ["London", "Manchester", "Birmingham", "Leeds", "Bristol", "Liverpool", "Glasgow", "Sheffield", "Edinburgh", "Cardiff", "Nottingham", "Newcastle"];

const REVIEWS = [
  { name: "Sarah T.", city: "London", text: "Driver arrived 10 minutes after I booked. Watched the whole move on the map — genuinely impressive.", rating: 5 },
  { name: "James P.", city: "Manchester", text: "Fixed price, no surprises. Two lads did my 2-bed flat in under three hours. Booking again.", rating: 5 },
  { name: "Aisha K.", city: "Birmingham", text: "Booked at 8am, moving by 10am. Same-day availability actually meant same day.", rating: 5 },
];

const FAQS = [
  { q: "How much does a man and van cost?", a: "Prices start from just £15 per hour for a small van. You get an instant fixed quote based on your van size, distance, floors and time — no hidden fees, and you pay after your move." },
  { q: "How quickly can a driver pick up?", a: "In most areas a driver can be with you on the same day, often within the hour during working times. You'll see your driver's live location and ETA on the tracking map once they're assigned." },
  { q: "Do you cover the whole UK?", a: "Yes. We started in London and now cover any UK postcode — from single-item deliveries to full house and office relocations, local or long-distance." },
  { q: "Are your drivers insured?", a: "Every driver is vetted and fully insured, with licence, insurance and MOT verified before they can accept jobs. Your belongings are covered on every move." },
  { q: "When and how do I pay?", a: "You pay after your move is complete — no deposit needed to book. Your fixed quote is locked in when you confirm, so the price you see is the price you pay." },
  { q: "Can I track my move live?", a: "Absolutely. Once dispatch assigns your driver you can follow their location on a live map, see a status timeline and an accurate ETA from pickup to drop-off." },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vans, setVans] = useState([]);

  useEffect(() => { api.get("/vansizes").then(({ data }) => setVans(data)).catch(() => {}); }, []);

  return (
    <div className="bg-slate-50 min-h-screen">
      <Seo title="Man With Van — Book a Local Man & Van in Minutes | From £15/hour"
        description="Book a trusted local man and van in minutes from just £15/hour. Instant fixed quotes, fully insured drivers, same-day availability and live move tracking across the UK." path="/" />
      <Navbar />

      {/* HERO + booking */}
      <section id="book" className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 pb-16 grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="lg:pt-6">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary bg-violet-100 px-3 py-1.5 rounded-full">
            <Zap className="h-3.5 w-3.5" /> Same-day · From £15/hour
          </span>
          <h1 className="mt-5 font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.05] text-slate-900">
            Book a local<br /><span className="text-primary">man &amp; van</span> in minutes
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-lg leading-relaxed">
            Instant fixed quotes, vetted &amp; insured drivers and live move tracking — across any UK postcode. No deposit, pay after your move.
          </p>

          <div className="flex items-center gap-2 mt-6">
            <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-emerald-500 text-emerald-500" />)}</div>
            <span className="font-semibold text-slate-900">4.9 out of 5</span>
            <span className="text-slate-500 text-sm">from 2,000+ reviews</span>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 mt-6">
            {[{ i: Truck, t: "Trusted local drivers" }, { i: ShieldCheck, t: "Fully insured" }, { i: Timer, t: "Same-day availability" }].map((b) => (
              <span key={b.t} className="flex items-center gap-2 text-sm font-medium text-slate-700"><b.i className="h-4 w-4 text-primary" /> {b.t}</span>
            ))}
          </div>

          <div className="hidden lg:block mt-10 rounded-3xl overflow-hidden shadow-xl border border-slate-200">
            <img src={IMG.hero} alt="Man with van driving through a UK city" className="w-full h-[240px] object-cover" loading="lazy" />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <BookingWizard />
        </motion.div>
      </section>

      {/* SERVICES */}
      <section id="services" className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
        <SectionHead eyebrow="Services" title="Whatever you're moving, there's a van for it" sub="From a single sofa to a full office relocation — all with the same trusted drivers and live tracking." />
        <div className="grid md:grid-cols-3 gap-6 mt-10">
          {[
            { icon: Sofa, t: "Single item & furniture", d: "Sofas, beds, fridges, marketplace pickups — delivered the same day with a driver who helps you carry." },
            { icon: PackageCheck, t: "Home removals", d: "Studio flats to 4-bed houses. Right-sized vans, optional two-person crews and careful, insured handling." },
            { icon: Building2, t: "Office & business", d: "Desks, IT and stock moved out of hours to keep your business running. Scheduled slots and receipts." },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 hover:-translate-y-1 hover:shadow-md hover:border-violet-300 transition-all duration-200">
              <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4"><s.icon className="h-6 w-6 text-primary" /></div>
              <h3 className="font-heading text-xl font-semibold text-slate-900">{s.t}</h3>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
        <SectionHead eyebrow="How it works" title="Three steps from quote to doorstep" />
        <div className="grid md:grid-cols-3 gap-6 mt-10">
          {[
            { icon: MapPin, t: "1. Get an instant quote", d: "Enter pickup & drop-off, van size, floors and time for a fixed, transparent price in seconds." },
            { icon: CheckCircle2, t: "2. Confirm your slot", d: "Pick a date and time, add photos of your items and confirm — no deposit, pay after your move." },
            { icon: Truck, t: "3. Track it live", d: "We assign a vetted driver and you follow the whole move on the live map, right to the door." },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 relative overflow-hidden">
              <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4"><s.icon className="h-6 w-6 text-primary" /></div>
              <h3 className="font-heading text-xl font-semibold text-slate-900">{s.t}</h3>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
        <SectionHead eyebrow="Pricing" title="Simple pricing, from £15/hour" sub="Transparent hourly rates by van size, plus a fixed quote at checkout. No hidden fees, ever." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
          {vans.map((v, i) => (
            <div key={v.id} className={`rounded-2xl border shadow-sm p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${i === 2 ? "bg-primary text-white border-primary" : "bg-white border-slate-200 hover:border-violet-300"}`} data-testid={`price-card-${v.id}`}>
              <div className="flex items-center justify-between">
                <Truck className={`h-8 w-8 ${i === 2 ? "text-white" : "text-primary"}`} />
                {i === 2 && <span className="text-[10px] font-bold uppercase tracking-wide bg-white/20 px-2 py-1 rounded-full">Popular</span>}
              </div>
              <h3 className={`font-heading text-lg font-semibold mt-4 ${i === 2 ? "text-white" : "text-slate-900"}`}>{v.name}</h3>
              <p className={`text-sm mt-1 min-h-[56px] ${i === 2 ? "text-white/80" : "text-slate-500"}`}>{v.desc}</p>
              <div className={`mt-4 pt-4 border-t ${i === 2 ? "border-white/20" : "border-slate-100"}`}>
                <span className={`text-xs uppercase tracking-wide ${i === 2 ? "text-white/70" : "text-slate-400"}`}>from</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-heading text-3xl font-bold">£{v.hourly}</span>
                  <span className={`text-sm ${i === 2 ? "text-white/70" : "text-slate-400"}`}>/hour</span>
                </div>
                <p className={`text-xs mt-1 ${i === 2 ? "text-white/70" : "text-slate-400"}`}>{v.dimensions}</p>
              </div>
              <Button onClick={() => document.getElementById("book")?.scrollIntoView({ behavior: "smooth" })}
                className={`w-full mt-5 ${i === 2 ? "bg-white text-primary hover:bg-white/90" : "bg-primary hover:bg-[#4C1D95]"}`} data-testid={`price-book-${v.id}`}>
                Get a quote
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* CUSTOMER / DRIVER SPLIT */}
      <StudentDiscount />

      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-8 grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Customers</p>
          <h3 className="font-heading text-2xl font-bold text-slate-900 mt-1">{user ? "Welcome back" : "Move with us"}</h3>
          <ul className="mt-5 space-y-3 text-slate-700">
            <li className="flex items-center gap-2 text-sm"><PackageCheck className="h-4 w-4 text-primary" /> Book a move in a couple of minutes</li>
            <li className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-primary" /> Track your driver live on the day</li>
          </ul>
          {user && <p className="text-sm text-slate-400 mt-5">Signed in as {user.email}</p>}
          <Button onClick={() => navigate(user ? "/account" : "/register")} className="mt-6 bg-primary hover:bg-[#4C1D95] rounded-full px-6 gap-2" data-testid="split-customer-cta">
            {user ? "My moves" : "Create an account"} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="rounded-3xl bg-primary text-white shadow-sm p-8 relative overflow-hidden">
          <Truck className="absolute -right-6 -bottom-6 h-48 w-48 text-white/10" />
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">Drivers</p>
          <h3 className="font-heading text-2xl font-bold mt-1">Got a van? Drive with us</h3>
          <ul className="mt-5 space-y-3">
            <li className="flex items-center gap-2 text-sm"><PoundSterling className="h-4 w-4" /> Pick the local jobs that suit you</li>
            <li className="flex items-center gap-2 text-sm"><FileCheck2 className="h-4 w-4" /> Upload licence, insurance &amp; MOT</li>
            <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4" /> Get approved and start earning</li>
          </ul>
          <div className="flex items-center gap-4 mt-6 relative z-10">
            <Button onClick={() => navigate("/driver/signup")} className="bg-white text-primary hover:bg-white/90 rounded-full px-6 gap-2" data-testid="split-driver-signup">
              Sign up as a driver <ArrowRight className="h-4 w-4" />
            </Button>
            <button onClick={() => navigate("/driver/login")} className="text-sm font-semibold underline underline-offset-2" data-testid="split-driver-login">Already registered? Driver login</button>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section id="reviews" className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
        <SectionHead eyebrow="Reviews" title="Rated 4.9/5 by 2,000+ movers" />
        <div className="grid md:grid-cols-3 gap-6 mt-10">
          {REVIEWS.map((r, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7">
              <Quote className="h-7 w-7 text-violet-200" />
              <div className="flex mt-3">{[...Array(r.rating)].map((_, j) => <Star key={j} className="h-4 w-4 fill-emerald-500 text-emerald-500" />)}</div>
              <p className="text-slate-700 mt-3 text-sm leading-relaxed">“{r.text}”</p>
              <p className="mt-4 font-semibold text-slate-900 text-sm">{r.name} <span className="text-slate-400 font-normal">· {r.city}</span></p>
            </div>
          ))}
        </div>
      </section>

      {/* AREAS */}
      <section id="areas" className="max-w-7xl mx-auto px-5 sm:px-8 py-16 grid lg:grid-cols-3 gap-8 items-center">
        <div className="lg:col-span-1">
          <SectionHead eyebrow="Coverage" title="Covering any UK postcode" sub="Local moves and long-distance relocations, in these cities and everywhere between." align="left" />
          <Link to="/man-and-van" className="inline-flex items-center gap-2 mt-5 text-primary font-semibold text-sm hover:underline" data-testid="home-all-areas-link">
            Browse man &amp; van by London area <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {AREAS.map((a) => (
            <div key={a} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-2 text-sm font-medium text-slate-700 hover:border-violet-300 transition-colors" data-testid={`area-${a.toLowerCase()}`}>
              <MapPin className="h-4 w-4 text-primary" /> {a}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
        <SectionHead eyebrow="FAQ" title="Questions, answered" />
        <Accordion type="single" collapsible className="mt-8" data-testid="faq-accordion">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-b border-slate-200">
              <AccordionTrigger className="text-left font-heading font-semibold text-slate-900 hover:text-primary" data-testid={`faq-q-${i}`}>{f.q}</AccordionTrigger>
              <AccordionContent className="text-slate-600 leading-relaxed">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* READY TO MOVE */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-8">
        <div className="rounded-3xl bg-primary text-white p-8 sm:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold">Ready to move?</h2>
            <p className="text-white/80 mt-2 text-lg">Book a local driver in minutes and track your move live.</p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => document.getElementById("book")?.scrollIntoView({ behavior: "smooth" })} className="bg-white text-primary hover:bg-white/90 rounded-full px-7 h-12 gap-2" data-testid="ready-book">
              Book a van now <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 bg-black rounded-xl px-4 py-2.5" data-testid="google-play-badge">
              <Play className="h-6 w-6 text-white fill-white" />
              <div className="leading-tight">
                <p className="text-[10px] text-white/70 uppercase">Get it on</p>
                <p className="text-sm font-semibold text-white">Google Play</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

const SectionHead = ({ eyebrow, title, sub, align = "center" }) => (
  <div className={align === "center" ? "text-center max-w-2xl mx-auto" : "text-left"}>
    <p className="text-sm font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
    <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-slate-900 mt-2">{title}</h2>
    {sub && <p className="text-slate-600 mt-3">{sub}</p>}
  </div>
);
