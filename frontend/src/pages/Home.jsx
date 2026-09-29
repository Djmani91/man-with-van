import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MapPin, ArrowRight, Truck, Clock, ShieldCheck, MapPinned, Star,
  Zap, PackageCheck, Building2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const IMAGES = {
  hero: "https://images.unsplash.com/photo-1665521032636-e8d2f6927053?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwzfHx3aGl0ZSUyMGNvbW1lcmNpYWwlMjB2YW58ZW58MHx8fHwxNzkwNzIzMDMzfDA&ixlib=rb-4.1.0&q=85",
  couple: "https://images.unsplash.com/photo-1758523671087-b256bbbca475?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwzfHxkZWxpdmVyeSUyMGRyaXZlciUyMHNtaWxpbmclMjBob2xkaW5nJTIwYm94fGVufDB8fHx8MTc5MDcyMzAyMHww&ixlib=rb-4.1.0&q=85",
  room: "https://images.unsplash.com/photo-1649083048269-8bfb755e7b87?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHwzfHxtb3ZpbmclMjBib3hlcyUyMGluJTIwbW9kZXJuJTIwaG9tZXxlbnwwfHx8fDE3OTA3MjMwMjB8MA&ixlib=rb-4.1.0&q=85",
};

export default function Home() {
  const navigate = useNavigate();
  const [vans, setVans] = useState([]);
  const [form, setForm] = useState({ pickup: "", dropoff: "" });

  useEffect(() => { api.get("/vansizes").then(({ data }) => setVans(data)).catch(() => {}); }, []);

  const startQuote = (e) => {
    e.preventDefault();
    navigate("/book", { state: { pickup: form.pickup, dropoff: form.dropoff } });
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-14 pb-20 grid lg:grid-cols-12 gap-12 items-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="lg:col-span-7">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary bg-violet-100 px-3 py-1.5 rounded-full">
            <Zap className="h-3.5 w-3.5" /> Instant quotes · Any UK postcode
          </span>
          <h1 className="mt-5 font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-none text-slate-900">
            A van and a driver,<br /><span className="text-primary">booked in 60 seconds.</span>
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-xl leading-relaxed">
            Enter your pickup and drop-off, pick a van size, and get a fixed price instantly.
            Track your move live from door to door.
          </p>

          <form onSubmit={startQuote} className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 max-w-xl" data-testid="hero-quote-form">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pickup</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input required value={form.pickup} onChange={(e) => setForm({ ...form, pickup: e.target.value })} placeholder="e.g. SW1A 1AA" className="pl-9 focus:ring-2 focus:ring-violet-500" data-testid="hero-pickup" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Drop-off</Label>
                <div className="relative">
                  <MapPinned className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input required value={form.dropoff} onChange={(e) => setForm({ ...form, dropoff: e.target.value })} placeholder="e.g. E1 6AN" className="pl-9 focus:ring-2 focus:ring-violet-500" data-testid="hero-dropoff" />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full mt-4 h-12 text-base bg-primary hover:bg-[#4C1D95] gap-2" data-testid="hero-get-quote">
              Get my instant quote <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="flex items-center gap-6 mt-6 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> 4.9/5 rating</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Fully insured</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.15 }} className="lg:col-span-5 relative">
          <div className="rounded-3xl overflow-hidden shadow-xl border border-slate-200">
            <img src={IMAGES.hero} alt="Man with van" className="w-full h-[420px] object-cover" />
          </div>
          <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl shadow-lg border border-slate-200 p-4 flex items-center gap-3 max-w-[220px]">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Truck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Driver en route</p>
              <p className="text-xs text-slate-500">Arriving in 12 min</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
        <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-slate-900">How it works</h2>
        <p className="text-slate-600 mt-2 max-w-xl">Three simple steps from quote to doorstep.</p>
        <div className="grid md:grid-cols-3 gap-6 mt-10">
          {[
            { icon: MapPin, title: "1. Enter your route", desc: "Add pickup and drop-off postcodes to get a fixed, transparent price instantly." },
            { icon: PackageCheck, title: "2. Pick van & time", desc: "Choose the right van size and a date/time that suits you, then confirm." },
            { icon: Truck, title: "3. Track it live", desc: "We assign a vetted driver and you follow the whole move on the live map." },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 hover:-translate-y-1 hover:shadow-md transition-all duration-200">
              <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <s.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-heading text-xl font-semibold text-slate-900">{s.title}</h3>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Vans */}
      <section id="vans" className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-slate-900">Our vans</h2>
            <p className="text-slate-600 mt-2 max-w-xl">From a single sofa to a full house move — there's a van for it.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/book")} data-testid="vans-book-cta" className="gap-2">
            Book now <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
          {vans.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:-translate-y-1 hover:border-violet-300 hover:shadow-md transition-all duration-200" data-testid={`van-card-${v.id}`}>
              <Truck className="h-8 w-8 text-primary" />
              <h3 className="font-heading text-lg font-semibold text-slate-900 mt-4">{v.name}</h3>
              <p className="text-sm text-slate-500 mt-1 min-h-[40px]">{v.desc}</p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-xs text-slate-400 uppercase tracking-wide">from</span>
                <span className="font-heading text-xl font-bold text-slate-900">£{v.base}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why + coverage bento */}
      <section id="coverage" className="max-w-7xl mx-auto px-5 sm:px-8 py-16 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden grid sm:grid-cols-2">
          <img src={IMAGES.couple} alt="Happy movers" className="h-full w-full object-cover min-h-[260px]" />
          <div className="p-8 flex flex-col justify-center">
            <h3 className="font-heading text-2xl font-semibold text-slate-900">Why choose us</h3>
            <ul className="mt-5 space-y-4">
              {[
                { icon: Clock, t: "On-time, every time", d: "Live tracking and accurate ETAs." },
                { icon: ShieldCheck, t: "Vetted & insured drivers", d: "Every move fully covered." },
                { icon: Zap, t: "No hidden fees", d: "The price you see is the price you pay." },
              ].map((f, i) => (
                <li key={i} className="flex gap-3">
                  <f.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div><p className="font-semibold text-slate-900 text-sm">{f.t}</p><p className="text-sm text-slate-500">{f.d}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="bg-primary rounded-3xl p-8 text-white flex flex-col justify-between">
          <Building2 className="h-9 w-9 text-white/80" />
          <div className="mt-6">
            <h3 className="font-heading text-2xl font-semibold">Covering any UK postcode</h3>
            <p className="text-white/70 mt-3 text-sm leading-relaxed">
              London, Manchester, Birmingham and everywhere in between. Local moves and long-distance relocations.
            </p>
          </div>
          <Button onClick={() => navigate("/book")} data-testid="coverage-cta" className="mt-8 bg-white text-primary hover:bg-white/90 gap-2 w-full">
            Start your move <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
