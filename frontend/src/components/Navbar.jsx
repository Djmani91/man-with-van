import { Link, useNavigate } from "react-router-dom";
import { Truck, LogOut, LayoutDashboard, User, Menu, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SERVICE_NAV } from "@/data/servicePages";

const LINKS = [
  { label: "Areas", href: "/man-and-van" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Student Discount", href: "/student-discount" },
  { label: "FAQ", href: "/faq" },
];

const initials = (name, email) =>
  (name?.trim()?.split(" ").map((p) => p[0]).slice(0, 2).join("") || email?.[0] || "U").toUpperCase();

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const bookNow = () => {
    if (window.location.pathname === "/") {
      document.getElementById("book")?.scrollIntoView({ behavior: "smooth" });
    } else navigate("/book");
  };

  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0" data-testid="nav-logo">
          <img src="/logo.png" alt="Man With Van" className="h-9 w-9 rounded-lg object-cover shrink-0" />
          <span className="font-heading font-extrabold text-lg tracking-tight text-slate-900 leading-none">Man With<br className="hidden sm:block" /> Van</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="/man-and-van" className="hover:text-primary transition-colors" data-testid="nav-areas">Areas</a>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 hover:text-primary transition-colors outline-none" data-testid="nav-services-menu">
                Services <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuItem onClick={() => navigate("/man-with-van-london")} data-testid="nav-service-london" className="font-medium">Man with van London</DropdownMenuItem>
              <DropdownMenuSeparator />
              {SERVICE_NAV.map((s) => (
                <DropdownMenuItem key={s.slug} onClick={() => navigate(`/${s.slug}`)} data-testid={`nav-service-${s.slug}`}>{s.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <a href="/how-it-works" className="hover:text-primary transition-colors" data-testid="nav-how-it-works">How it works</a>
          <a href="/#pricing" className="hover:text-primary transition-colors" data-testid="nav-pricing">Pricing</a>
          <a href="/student-discount" className="hover:text-primary transition-colors" data-testid="nav-student-discount">Student Discount</a>
          <a href="/faq" className="hover:text-primary transition-colors" data-testid="nav-faq">FAQ</a>
          <a href="/contact" className="hover:text-primary transition-colors" data-testid="nav-contact">Contact</a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/drive" className="hidden sm:inline text-sm font-semibold text-primary hover:underline" data-testid="nav-drive">Drive with us</Link>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2" data-testid="nav-account-menu">
                  <span className="hidden sm:inline text-sm font-medium text-slate-600">My moves</span>
                  <span className="h-9 w-9 rounded-full bg-violet-100 text-primary font-bold text-sm flex items-center justify-center">{initials(user.name, user.email)}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {user.role === "admin" && <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="nav-admin-link"><LayoutDashboard className="h-4 w-4 mr-2" /> Dispatch</DropdownMenuItem>}
                {user.role === "driver" && <DropdownMenuItem onClick={() => navigate("/driver")} data-testid="nav-driver-link"><Truck className="h-4 w-4 mr-2" /> Driver hub</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => navigate("/jobs")} data-testid="nav-bookings-link"><User className="h-4 w-4 mr-2" /> My moves</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await logout(); navigate("/"); }} data-testid="nav-logout"><LogOut className="h-4 w-4 mr-2" /> Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")} data-testid="nav-login" className="hidden sm:inline-flex">Log in</Button>
          )}
          <Button size="sm" onClick={bookNow} data-testid="nav-book" className="bg-primary hover:bg-[#4C1D95] rounded-full px-5">Book a van</Button>
        </div>
      </div>
    </header>
  );
};
