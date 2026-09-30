import { useParams, Navigate, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MapPin, ArrowRight, Truck, ShieldCheck, Clock, PoundSterling, CheckCircle2,
  Star, PackageCheck, Building2, Sofa,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Seo } from "@/components/Seo";
import { BookingWizard } from "@/components/BookingWizard";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AREA_BY_SLUG } from "@/data/areas";

const SITE = process.env.REACT_APP_BACKEND_URL || "";

function buildFaqs(a, nearbyNames) {
  return [
    { q: `How much does a man and van cost in ${a.name}?`,
      a: `A man and van in ${a.name} starts from just £15 per hour for a small van. You get an instant fixed quote based on van size, distance, number of floors and time — with no hidden fees. Larger vans and two-person crews are priced per hour, and you'll always see the full price before you confirm.` },
    { q: `Can I book a same-day man and van in ${a.name}?`,
      a: `Yes. In ${a.name} (${a.postcodes}) a local driver can usually reach you the same day, often within the hour during working times. Once your driver is assigned you can follow their live location and ETA on the tracking map.` },
    { q: `Which areas near ${a.name} do you cover?`,
      a: `As well as ${a.name} we cover nearby areas including ${nearbyNames.join(", ")}, and every other ${a.borough} postcode. We handle local moves and long-distance relocations to anywhere in the UK.` },
    { q: `Do you do house and flat removals in ${a.name}?`,
      a: `Yes — from a single item or a studio flat to a full 3–4 bed house or office in ${a.name}. We match the right van size to your move (small, medium, large Luton or XL) and can send a two-person crew for bigger jobs.` },
    { q: `Are your ${a.name} drivers insured?`,
      a: `Every ${a.name} man and van driver is vetted and fully insured, with licence, insurance and MOT checked before they can accept jobs. Your belongings are covered on every move.` },
    { q: `How do I get a quote for a move in ${a.name}?`,
      a: `Enter your ${a.name} pickup and drop-off addresses, choose your van size, floors and time, and you'll get a fixed quote in seconds. There's no deposit needed to book and you pay after your move.` },
  ];
}

export default function AreaLanding() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const a = AREA_BY_SLUG[slug];
  if (!a) return <Navigate to="/man-and-van" replace />;

  const nearby = a.nearby.map((s) => AREA_BY_SLUG[s]).filter(Boolean);
  const nearbyNames = nearby.map((n) => n.name);
  const faqs = buildFaqs(a, nearbyNames);
  const path = `/man-and-van/${a.slug}`;
  const title = `Man and Van in ${a.name} | Same-Day Removals from £15/hr`;
  const description = `Book a trusted man and van in ${a.name} (${a.postcodes}) from £15/hour. Instant fixed quotes, fully insured local drivers, same-day availability and live tracking. Home removals, single items & office moves.`;

  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "LocalBusiness",
      "@id": SITE + path, name: `Man With Van — ${a.name}`,
      description, url: SITE + path, image: SITE + "/logo512.png",
      priceRange: "££", areaServed: { "@type": "Place", name: `${a.name}, London (${a.postcodes})` },
      address: { "@type": "PostalAddress", addressLocality: a.name, addressRegion: "London", postalCode: a.postcodes.split(",")[0].trim(), addressCountry: "GB" },
      aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "2000" },
    },
    {
      "@context": "https://schema.org", "@type": "Service",
      serviceType: "Man and van removals", provider: { "@type": "LocalBusiness", name: "Man With Van" },
      areaServed: { "@type": "Place", name: `${a.name}, London` }, name: `Man and van in ${a.name}`,
      description, offers: { "@type": "Offer", priceCurrency: "GBP", price: "15", priceSpecification: { "@type": "UnitPriceSpecification", price: "15", priceCurrency: "GBP", unitCode: "HUR" } },
    },
    {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Areas we cover", item: SITE + "/man-and-van" },
        { "@type": "ListItem", position: 3, name: a.name, item: SITE + path },
      ],
    },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      <Seo title={title} description={description} path={path}
        keywords={`man and van ${a.name}, ${a.name} removals, house removals ${a.name}, man with van ${a.postcodes}, movers ${a.name}`}
        jsonLd={jsonLd} />
      <Navbar />

      {/* Breadcrumb */}
      <nav className="max-w-7xl mx-auto px-5 sm:px-8 pt-6 text-sm text-slate-400" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-primary">Home</Link> <span className="mx-1">/</span>
        <Link to="/man-and-van" className="hover:text-primary">Areas</Link> <span className="mx-1">/</span>
        <span className="text-slate-600 font-medium" data-testid="crumb-area">{a.name}</span>
      </nav>

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-8 pb-14 grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary bg-violet-100 px-3 py-1.5 rounded-full">
            <MapPin className="h-3.5 w-3.5" /> {a.name} · {a.postcodes}
          </span>
          <h1 className="mt-5 font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.05] text-slate-900" data-testid="area-h1">
            Man &amp; Van in <span className="text-primary">{a.name}</span>
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-lg leading-relaxed">{a.highlight}</p>

          <div className="flex items-center gap-2 mt-6">
            <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-emerald-500 text-emerald-500" />)}</div>
            <span className="font-semibold text-slate-900">4.9 / 5</span>
            <span className="text-slate-500 text-sm">from 2,000+ moves</span>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 mt-6">
            {[{ i: PoundSterling, t: "From £15/hour" }, { i: ShieldCheck, t: "Vetted & insured" }, { i: Clock, t: "Same-day in " + a.name }].map((b) => (
              <span key={b.t} className="flex items-center gap-2 text-sm font-medium text-slate-700"><b.i className="h-4 w-4 text-primary" /> {b.t}</span>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-8">
            <Button onClick={() => document.getElementById("quote")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-primary hover:bg-[#4C1D95] rounded-full px-7 h-12 gap-2" data-testid="area-hero-cta">
              Get an instant {a.name} quote <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        <motion.div id="quote" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <BookingWizard />
        </motion.div>
      </section>

      {/* LOCAL INTRO */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-10">
        <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900">Trusted local removals in {a.name}</h2>
        <p className="text-slate-600 mt-4 leading-relaxed text-[15px]">{a.intro}</p>
        <p className="text-slate-600 mt-4 leading-relaxed text-[15px]">
          Whether you're moving a single sofa off {a.landmarks[0]}, a one-bed flat or a full family house, you get an instant fixed
          quote from just £15 per hour, a vetted and insured driver, and live tracking from pickup to drop-off. There's no deposit to
          book and you pay after your move is complete.
        </p>
      </section>

      {/* SERVICES IN AREA */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 text-center">What we move in {a.name}</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {[
            { icon: Sofa, t: `Single items & furniture`, d: `Sofas, beds, appliances and marketplace pickups collected and delivered across ${a.name} the same day.` },
            { icon: PackageCheck, t: `Home removals`, d: `Studio flats to 4-bed houses in ${a.postcodes} — right-sized vans and optional two-person crews.` },
            { icon: Building2, t: `Office & business`, d: `Desks, IT and stock moved in and around ${a.name}, with out-of-hours slots to keep you running.` },
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
        <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 text-center">Booking a man and van in {a.name}</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {[
            { icon: MapPin, t: "1. Get your quote", d: `Enter your ${a.name} pickup and drop-off, van size, floors and time for a fixed price in seconds.` },
            { icon: CheckCircle2, t: "2. Confirm your slot", d: "Pick a date and time and confirm — no deposit, pay after your move." },
            { icon: Truck, t: "3. Track it live", d: "We assign a vetted local driver and you follow the whole move on the live map." },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7">
              <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4"><s.icon className="h-6 w-6 text-primary" /></div>
              <h3 className="font-heading text-xl font-semibold text-slate-900">{s.t}</h3>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* NEARBY AREAS */}
      {nearby.length > 0 && (
        <section className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900">Areas near {a.name} we also cover</h2>
          <p className="text-slate-600 mt-3">Local drivers ready in the surrounding {a.borough} postcodes too:</p>
          <div className="flex flex-wrap gap-3 mt-6">
            {nearby.map((n) => (
              <Link key={n.slug} to={`/man-and-van/${n.slug}`} data-testid={`nearby-${n.slug}`}
                className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-slate-700 hover:border-violet-300 hover:text-primary transition-colors">
                <MapPin className="h-4 w-4 text-primary" /> Man and van in {n.name}
              </Link>
            ))}
            <Link to="/man-and-van" className="bg-violet-50 rounded-xl border border-violet-200 px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-primary hover:bg-violet-100 transition-colors" data-testid="all-areas-link">
              View all areas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-12">
        <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 text-center">Man and van in {a.name} — your questions answered</h2>
        <Accordion type="single" collapsible className="mt-8" data-testid="area-faq">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-b border-slate-200">
              <AccordionTrigger className="text-left font-heading font-semibold text-slate-900 hover:text-primary" data-testid={`area-faq-q-${i}`}>{f.q}</AccordionTrigger>
              <AccordionContent className="text-slate-600 leading-relaxed">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-8">
        <div className="rounded-3xl bg-primary text-white p-8 sm:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold">Ready to move in {a.name}?</h2>
            <p className="text-white/80 mt-2 text-lg">Instant quote, vetted local driver, live tracking. From £15/hour.</p>
          </div>
          <Button onClick={() => navigate("/book")} className="bg-white text-primary hover:bg-white/90 rounded-full px-7 h-12 gap-2" data-testid="area-cta-book">
            Book your {a.name} move <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
