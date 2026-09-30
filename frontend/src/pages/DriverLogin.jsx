import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Truck, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function DriverLogin() {
  const { login, formatApiError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const u = await login(email, password);
      if (u.role !== "driver") { setError("This isn't a driver account. Use the customer login."); setBusy(false); return; }
      toast.success("Welcome back!");
      navigate("/driver", { replace: true });
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Seo title="Driver Login — Man With Van" description="Log in to your Man With Van driver account to see and manage your jobs." path="/driver/login" noindex />
      <div className="max-w-sm w-full mx-auto px-5 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary mb-6" data-testid="driver-login-home"><ArrowLeft className="h-4 w-4" /> Back to site</Link>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center"><Truck className="h-5 w-5 text-white" /></div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Driver login</h1>
        </div>
        <p className="text-slate-500 mb-8">Access your jobs and update move status.</p>
        <form onSubmit={submit} className="space-y-4" data-testid="driver-login-form">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2" data-testid="driver-login-error">{error}</div>}
          <div className="space-y-2"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="dl-email" /></div>
          <div className="space-y-2"><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="dl-password" /></div>
          <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-[#4C1D95]" data-testid="dl-submit">{busy ? "Signing in…" : "Log in"}</Button>
        </form>
        <p className="text-sm text-center text-slate-500 mt-6">New driver? <Link to="/driver/signup" className="text-primary font-semibold" data-testid="dl-to-signup">Sign up to drive</Link></p>
      </div>
    </div>
  );
}
