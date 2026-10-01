import { Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { SERVICE_NAV } from "@/data/servicePages";

export const Footer = () => (
  <footer className="bg-slate-900 text-slate-300 mt-24">
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 grid gap-10 md:grid-cols-4">
      <div className="md:col-span-1">
        <div className="flex items-center gap-2 mb-4">
          <img src="/logo.png" alt="Man With Van" className="h-9 w-9 rounded-lg object-cover shrink-0" />
          <span className="font-heading font-extrabold text-lg text-white">Man With Van</span>
        </div>
        <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
          Fast, friendly van + driver removals across London and the UK. Instant quotes and live tracking.
        </p>
      </div>
      <div>
        <h4 className="text-white font-semibold mb-3 text-sm">Services</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          <li><Link to="/man-with-van-london" className="hover:text-white transition-colors font-medium">Man with van London</Link></li>
          {SERVICE_NAV.map((s) => (
            <li key={s.slug}><Link to={`/${s.slug}`} className="hover:text-white transition-colors">{s.label}</Link></li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="text-white font-semibold mb-3 text-sm">Popular areas</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          <li><Link to="/man-and-van/kilburn" className="hover:text-white transition-colors">Man and van Kilburn</Link></li>
          <li><Link to="/man-and-van/central-london" className="hover:text-white transition-colors">Man and van Central London</Link></li>
          <li><Link to="/man-and-van/camden" className="hover:text-white transition-colors">Man and van Camden</Link></li>
          <li><Link to="/man-and-van" className="hover:text-white transition-colors font-medium">All London areas →</Link></li>
        </ul>
      </div>
      <div>
        <h4 className="text-white font-semibold mb-3 text-sm">Company</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          <li><Link to="/how-it-works" className="hover:text-white transition-colors">How it works</Link></li>
          <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
          <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
          <li><Link to="/student-discount" className="hover:text-white transition-colors">Student discount</Link></li>
        </ul>
      </div>
    </div>
    <div className="border-t border-slate-800 py-5 text-center text-xs text-slate-500">
      © {new Date().getFullYear()} Man With Van. All prices in GBP.
    </div>
  </footer>
);
