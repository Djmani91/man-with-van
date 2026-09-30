import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Seo } from "@/components/Seo";
import { BookingWizard } from "@/components/BookingWizard";
import { useAuth } from "@/context/AuthContext";

export default function Book() {
  const { user } = useAuth();
  const isCustomer = user && user.role === "customer";

  return (
    <div className={`min-h-screen bg-slate-50 ${isCustomer ? "pb-24" : ""}`}>
      <Seo title="Book a Man & Van | Instant Quote — Man With Van" description="Get an instant fixed quote and book a local man and van across the UK from £15/hour." path="/book" />
      {isCustomer ? <div className="hidden sm:block"><Navbar /></div> : <Navbar />}
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-10">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-6">Book your move</h1>
        <BookingWizard />
      </div>
      {isCustomer && <BottomNav />}
    </div>
  );
}
