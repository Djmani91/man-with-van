import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AuthShell } from "@/pages/Login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const googleLogin = () => {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = window.location.origin + "/account";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

export default function Register() {
  const { register, formatApiError } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await register(form);
      toast.success("Account created!");
      navigate("/jobs", { replace: true });
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Create your account" subtitle="Book and track your move in minutes.">
      <form onSubmit={submit} className="space-y-4" data-testid="register-form">
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2" data-testid="register-error">{error}</div>}
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" required value={form.name} onChange={set("name")} data-testid="register-name" placeholder="Jane Smith" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={form.email} onChange={set("email")} data-testid="register-email" placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={form.phone} onChange={set("phone")} data-testid="register-phone" placeholder="07123 456789" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={6} value={form.password} onChange={set("password")} data-testid="register-password" placeholder="At least 6 characters" />
        </div>
        <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-[#4C1D95]" data-testid="register-submit">
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-slate-50 px-2 text-slate-400">or</span></div>
      </div>
      <Button variant="outline" className="w-full" onClick={googleLogin} data-testid="register-google">
        Continue with Google
      </Button>
      <p className="text-sm text-center text-slate-500 mt-6">
        Already have an account? <Link to="/login" className="text-primary font-semibold" data-testid="register-to-login">Log in</Link>
      </p>
    </AuthShell>
  );
}
