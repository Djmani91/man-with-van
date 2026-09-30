import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Truck } from "lucide-react";

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Truck className="h-10 w-10 text-primary animate-pulse" />
    </div>
  );
}

export function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading || user === null) return <Loader />;
  if (!user) {
    const to = role === "driver" ? "/driver/login" : "/login";
    return <Navigate to={to} state={{ from: location.pathname }} replace />;
  }
  if (role && user.role !== role) {
    const home = user.role === "admin" ? "/admin" : user.role === "driver" ? "/driver" : "/account";
    return <Navigate to={home} replace />;
  }
  return children;
}
