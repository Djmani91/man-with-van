import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const googleLogin = () => {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = window.location.origin + "/account";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

export default function Login() {
  const { login, formatApiError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const u = await login(email, password);
      toast.success("Welcome back!");
      const dest = u.role === "admin" ? "/admin" : u.role === "driver" ? "/driver" : (location.state?.from || "/account");
      navigate(dest, { replace: true });
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to book moves and track deliveries.">
      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2" data-testid="login-error">{error}</div>}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password" placeholder="••••••••" />
        </div>
        <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-[#4C1D95]" data-testid="login-submit">
          {busy ? "Signing in…" : "Log in"}
        </Button>
      </form>
      <Divider />
      <Button variant="outline" className="w-full" onClick={googleLogin} data-testid="login-google">
        Continue with Google
      </Button>
      <p className="text-sm text-center text-slate-500 mt-6">
        No account? <Link to="/register" className="text-primary font-semibold" data-testid="login-to-register">Create one</Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      <div className="hidden lg:flex flex-col justify-between bg-primary p-12 text-white">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center">
            <Truck className="h-5 w-5" />
          </div>
          <span className="font-heading font-extrabold text-lg">Man With Van</span>
        </Link>
        <div>
          <h2 className="font-heading text-4xl font-bold leading-tight">Book a van in under 60 seconds.</h2>
          <p className="mt-4 text-white/70 max-w-sm">Instant quotes, vetted drivers, live tracking across any UK postcode.</p>
        </div>
        <p className="text-white/50 text-sm">© {new Date().getFullYear()} Man With Van</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <h1 className="font-heading text-3xl font-bold text-slate-900 mb-1">{title}</h1>
          <p className="text-slate-500 mb-8">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
      <div className="relative flex justify-center text-xs"><span className="bg-slate-50 px-2 text-slate-400">or</span></div>
    </div>
  );
}
