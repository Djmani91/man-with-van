import { MapPin, Navigation } from "lucide-react";

// Simulated map: projects pseudo lat/lng onto an SVG viewport with a route line
// and an animated live driver pin. No external maps key required.
export const TrackingMap = ({ pickup, dropoff, driver }) => {
  const all = [pickup, dropoff, driver].filter(Boolean);
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const padX = (maxLng - minLng || 0.01) * 0.25;
  const padY = (maxLat - minLat || 0.01) * 0.25;

  const project = (p) => {
    const x = ((p.lng - (minLng - padX)) / ((maxLng + padX) - (minLng - padX))) * 100;
    const y = (1 - (p.lat - (minLat - padY)) / ((maxLat + padY) - (minLat - padY))) * 100;
    return { x, y };
  };

  const a = project(pickup);
  const b = project(dropoff);
  const d = project(driver);

  return (
    <div className="relative w-full aspect-[16/11] rounded-xl overflow-hidden shadow-inner bg-[#e8eef5] border border-slate-200" data-testid="tracking-map">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <defs>
          <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#cbd6e4" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />
        {/* faux roads */}
        <path d="M0 62 Q 40 40 100 55" stroke="#ffffff" strokeWidth="2.4" fill="none" />
        <path d="M22 0 Q 30 50 15 100" stroke="#ffffff" strokeWidth="1.8" fill="none" />
        <path d="M70 0 L 78 100" stroke="#ffffff" strokeWidth="1.8" fill="none" />
        {/* route */}
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#5B21B6" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.85" />
      </svg>

      <Pin pos={a} color="#0f172a" label="Pickup" testid="map-pickup" />
      <Pin pos={b} color="#5B21B6" label="Drop-off" testid="map-dropoff" />

      {/* live driver */}
      <div className="absolute -translate-x-1/2 -translate-y-1/2 z-20" style={{ left: `${d.x}%`, top: `${d.y}%` }} data-testid="map-driver">
        <span className="absolute inset-0 rounded-full bg-emerald-500/60 animate-ping-slow" style={{ width: 26, height: 26, marginLeft: -3, marginTop: -3 }} />
        <div className="relative h-5 w-5 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center">
          <Navigation className="h-3 w-3 text-white" fill="white" />
        </div>
      </div>
    </div>
  );
};

const Pin = ({ pos, color, label, testid }) => (
  <div className="absolute -translate-x-1/2 -translate-y-full z-10 flex flex-col items-center" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} data-testid={testid}>
    <div className="px-2 py-0.5 rounded-md bg-white shadow text-[10px] font-semibold text-slate-700 mb-1 whitespace-nowrap">{label}</div>
    <MapPin className="h-6 w-6 drop-shadow" style={{ color }} fill={color} />
  </div>
);
