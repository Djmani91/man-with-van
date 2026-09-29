import { Link, useNavigate } from "react-router-dom";
import { Truck, Menu, LogOut, LayoutDashboard, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group" data-testid="nav-logo">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <span className="font-heading font-extrabold text-lg tracking-tight text-slate-900">
            Man With Van
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="/#how" className="hover:text-primary transition-colors" data-testid="nav-how">How it works</a>
          <a href="/#vans" className="hover:text-primary transition-colors" data-testid="nav-vans">Our vans</a>
          <a href="/#coverage" className="hover:text-primary transition-colors" data-testid="nav-coverage">Coverage</a>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="nav-account-menu" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-[120px] truncate">{user.name || user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="nav-admin-link">
                    <LayoutDashboard className="h-4 w-4 mr-2" /> Dispatch
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate("/account")} data-testid="nav-bookings-link">
                  <Truck className="h-4 w-4 mr-2" /> My bookings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { logout(); navigate("/"); }} data-testid="nav-logout">
                  <LogOut className="h-4 w-4 mr-2" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/login")} data-testid="nav-login">
                Log in
              </Button>
              <Button size="sm" onClick={() => navigate("/book")} data-testid="nav-book" className="bg-primary hover:bg-[#4C1D95]">
                Get a quote
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
