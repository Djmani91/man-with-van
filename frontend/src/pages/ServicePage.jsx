import { useLocation, Link, Navigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { SERVICE_PAGES, SERVICE_NAV } from "@/data/servicePages";

export default function ServicePage() {
  const slug = useLocation().pathname.replace(/^\/+|\/+$/g, "");
  const page = SERVICE_PAGES[slug];
  if (!page) return <Navigate to="/" replace />;

  const faqLd = page.faqs?.length
    ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: page.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }
    : null;
  const orgLd = { "@context": "https://schema.org", "@type": "Organization", "@id": "https://manwithvanapp.co.uk/#organization", name: "Man With Van App", url: "https://manwithvanapp.co.uk/" };

  return (
    <div className="min-h-screen bg-white">
      <Seo title={page.title} description={page.description} path={`/${slug}`} jsonLd={[orgLd, faqLd].filter(Boolean)} />
      <Navbar />

      <section className="max-w-4xl mx-auto px-5 sm:px-8 pt-16 pb-10">
        <nav className="text-sm text-slate-400 mb-4" data-testid="service-breadcrumb">
          <Link to="/" className="hover:text-primary">Home</Link> <span className="mx-1">/</span>
          <Link to="/man-and-van" className="hover:text-primary">Services</Link> <span className="mx-1">/</span>
          <span className="text-slate-600">{page.h1}</span>
        </nav>
        <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight text-slate-900" data-testid="service-h1">{page.h1}</h1>
        <p className="mt-5 text-lg text-slate-600 leading-relaxed">{page.intro}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/book"><Button className="bg-primary hover:bg-[#4C1D95] h-12 px-6" data-testid="service-quote-cta">Get your quote <ArrowRight className="h-4 w-4 ml-2" /></Button></Link>
          <Link to="/man-and-van"><Button variant="outline" className="h-12 px-6">Explore London areas</Button></Link>
        </div>
      </section>

      {page.sections?.length > 0 && (
        <section className="max-w-4xl mx-auto px-5 sm:px-8 pb-6 space-y-8">
          {page.sections.map((s, i) => (
            <div key={i} data-testid={`service-section-${i}`}>
              <h2 className="font-heading text-lg md:text-xl font-semibold text-slate-900 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> {s.h2}</h2>
              <p className="mt-2 text-slate-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </section>
      )}

      {page.faqs?.length > 0 && (
        <section className="max-w-4xl mx-auto px-5 sm:px-8 py-10">
          <h2 className="font-heading text-2xl font-semibold text-slate-900 mb-6">Frequently asked questions</h2>
          <div className="space-y-5">
            {page.faqs.map((f, i) => (
              <div key={i} className="border-b border-slate-100 pb-5" data-testid={`service-faq-${i}`}>
                <p className="font-semibold text-slate-900">{f.q}</p>
                <p className="mt-1.5 text-slate-600 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-4xl mx-auto px-5 sm:px-8 pb-14">
        <div className="rounded-2xl bg-violet-50 border border-violet-100 p-7">
          <h2 className="font-heading text-xl font-semibold text-slate-900">Our London services</h2>
          <div className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {SERVICE_NAV.filter((s) => s.slug !== slug).map((s) => (
              <Link key={s.slug} to={`/${s.slug}`} className="text-primary hover:underline text-sm py-1" data-testid={`related-${s.slug}`}>{s.label}</Link>
            ))}
          </div>
          <div className="mt-6"><Link to="/book"><Button className="bg-primary hover:bg-[#4C1D95] h-11 px-6">Get your quote <ArrowRight className="h-4 w-4 ml-2" /></Button></Link></div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
