import { Navbar } from "@/components/Navbar";
import { Seo } from "@/components/Seo";
import { BookingWizard } from "@/components/BookingWizard";

export default function Book() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Seo title="Book a Man & Van | Instant Quote — Man With Van" description="Get an instant fixed quote and book a local man and van across the UK from £15/hour. No deposit, pay after your move." path="/book" />
      <Navbar />
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-10">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-6">Book your move</h1>
        <BookingWizard />
      </div>
    </div>
  );
}
