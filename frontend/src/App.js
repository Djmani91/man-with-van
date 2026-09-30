import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AuthCallback from "@/pages/AuthCallback";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Book from "@/pages/Book";
import MyJobs from "@/pages/MyJobs";
import Messages from "@/pages/Messages";
import Account from "@/pages/Account";
import Track from "@/pages/Track";
import Admin from "@/pages/Admin";
import DriverSignup from "@/pages/DriverSignup";
import DriverLogin from "@/pages/DriverLogin";
import DriverDashboard from "@/pages/DriverDashboard";

function Shell() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/book" element={<Book />} />
      <Route path="/jobs" element={<ProtectedRoute><MyJobs /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
      <Route path="/track/:id" element={<ProtectedRoute><Track /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute role="admin"><Admin /></ProtectedRoute>} />
      <Route path="/driver/signup" element={<DriverSignup />} />
      <Route path="/driver/login" element={<DriverLogin />} />
      <Route path="/driver" element={<ProtectedRoute role="driver"><DriverDashboard /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Shell />
          <Toaster position="top-center" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
