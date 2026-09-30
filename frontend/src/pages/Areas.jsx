import { Link, useNavigate } from "react-router-dom";
import { MapPin, ArrowRight, ShieldCheck, PoundSterling, Clock } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { AREAS } from "@/data/areas";

const SITE = process.env.REACT_APP_BACKEND_URL || "";

export default function Areas() {
  const navigate = useNavigate();
  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Areas we cover", item: SITE + "/man-and-van" },
      ],
    },
    {
      "@context": "https://schema.org", "@type": "ItemList",
      itemListElement: AREAS.map((a, i) => ({
        "@type": "ListItem", position: i + 1, name: `Man and van in ${a.name}`, url: SITE + `/man-and-van/${a.slug}`,
      })),
    },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      <Seo title="Man and Van Across London | Areas We Cover — From £15/hr"
        description="Book a trusted man and van across London — Kilburn, Central London, Harrow, Camden, Hackney, Wembley and more. Instant fixed quotes from £15/hour, insured local drivers and live tracking."
        path="/man-and-van"
        keywords="man and van London, London removals, man with van near me, house removals London"
        jsonLd={jsonLd} />
      <Navbar />

      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 pb-8 text-center">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary bg-violet-100 px-3 py-1.5 rounded-full">
          <MapPin className="h-3.5 w-3.5" /> Areas we cover
        </span>
        <h1 className="mt-5 font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.05] text-slate-900" data-testid="areas-h1">
          Man &amp; van across <span className="text-primary">London</span>
        </h1>
        <p className="mt-5 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Local, vetted and insured drivers in every London borough — instant fixed quotes from £15/hour,
          same-day availability and live move tracking. Pick your area below.
        </p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mt-7">
          {[{ i: PoundSterling, t: "From £15/hour" }, { i: ShieldCheck, t: "Vetted & insured" }, { i: Clock, t: "Same-day availability" }].map((b) => (
            <span key={b.t} className="flex items-center gap-2 text-sm font-medium text-slate-700"><b.i className="h-4 w-4 text-primary" /> {b.t}</span>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        <h2 className="sr-only">London areas we serve</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {AREAS.map((a) => (
            <Link key={a.slug} to={`/man-and-van/${a.slug}`} data-testid={`area-card-${a.slug}`}
              className="group bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:-translate-y-1 hover:shadow-md hover:border-violet-300 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center"><MapPin className="h-5 w-5 text-primary" /></div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-heading text-xl font-semibold text-slate-900 mt-4">Man and van in {a.name}</h3>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-1">{a.postcodes}</p>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed line-clamp-3">{a.highlight}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-8 pt-6">
        <div className="rounded-3xl bg-primary text-white p-8 sm:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold">Don't see your area?</h2>
            <p className="text-white/80 mt-2 text-lg">We cover every London postcode and the whole UK. Get an instant quote for any address.</p>
          </div>
          <Button onClick={() => navigate("/book")} className="bg-white text-primary hover:bg-white/90 rounded-full px-7 h-12 gap-2" data-testid="areas-cta-book">
            Get an instant quote <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
