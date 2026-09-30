import { Link, useLocation } from "react-router-dom";
import { Package, ClipboardList, MessageCircle, User } from "lucide-react";

const TABS = [
  { to: "/book", label: "Book", icon: Package },
  { to: "/jobs", label: "My Jobs", icon: ClipboardList },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/account", label: "Account", icon: User },
];

export const BottomNav = () => {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200" data-testid="bottom-nav">
      <div className="max-w-2xl mx-auto grid grid-cols-4">
        {TABS.map((t) => {
          const active = pathname === t.to || (t.to === "/jobs" && pathname.startsWith("/track"));
          return (
            <Link key={t.to} to={t.to} data-testid={`tab-${t.label.toLowerCase().replace(/\s/g, "-")}`}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${active ? "text-primary" : "text-slate-400"}`}>
              <t.icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
              {t.label}
              {active && <span className="h-0.5 w-6 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
