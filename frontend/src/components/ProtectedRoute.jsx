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

export function ProtectedRoute({ children, admin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading || user === null) return <Loader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== "admin") return <Navigate to="/account" replace />;
  return children;
}
