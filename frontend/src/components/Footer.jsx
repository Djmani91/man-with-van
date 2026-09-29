import { Truck } from "lucide-react";

export const Footer = () => (
  <footer className="bg-slate-900 text-slate-300 mt-24">
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 grid gap-10 md:grid-cols-4">
      <div className="md:col-span-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <span className="font-heading font-extrabold text-lg text-white">Man With Van</span>
        </div>
        <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
          Fast, friendly van + driver removals across the UK. Instant quotes, live tracking,
          no hidden fees.
        </p>
      </div>
      <div>
        <h4 className="text-white font-semibold mb-3 text-sm">Services</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          <li>Home removals</li>
          <li>Single item delivery</li>
          <li>Office relocation</li>
          <li>Student moves</li>
        </ul>
      </div>
      <div>
        <h4 className="text-white font-semibold mb-3 text-sm">Coverage</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          <li>London</li>
          <li>Manchester</li>
          <li>Birmingham</li>
          <li>Any UK postcode</li>
        </ul>
      </div>
    </div>
    <div className="border-t border-slate-800 py-5 text-center text-xs text-slate-500">
      © {new Date().getFullYear()} Man With Van. All prices in GBP.
    </div>
  </footer>
);
