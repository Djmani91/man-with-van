import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Truck } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const hash = window.location.hash || "";
    const sid = new URLSearchParams(hash.replace("#", "")).get("session_id");
    (async () => {
      if (!sid) { navigate("/login"); return; }
      try {
        const { data } = await api.post("/auth/session", {}, { headers: { "X-Session-ID": sid } });
        setUser(data);
        window.history.replaceState(null, "", window.location.pathname);
        navigate(data.role === "admin" ? "/admin" : "/account", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Truck className="h-10 w-10 text-primary animate-pulse" />
      <p className="text-slate-500">Signing you in…</p>
    </div>
  );
}
