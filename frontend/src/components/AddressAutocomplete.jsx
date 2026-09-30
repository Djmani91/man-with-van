import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";

export const AddressAutocomplete = ({ value, onChange, placeholder, testid }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!active || (value || "").trim().length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/address/suggest`, { params: { q: value } });
        setSuggestions(data); setOpen(true);
      } catch { setSuggestions([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [value, active]);

  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 z-10" />
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setActive(true); }}
        onFocus={() => { setActive(true); if (suggestions.length) setOpen(true); }}
        placeholder={placeholder}
        className="pl-9 focus:ring-2 focus:ring-violet-500"
        data-testid={testid}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto" data-testid={`${testid}-suggestions`}>
          {suggestions.map((s, i) => (
            <li key={i}>
              <button type="button" onClick={() => { onChange(s.label); setOpen(false); setActive(false); }}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-violet-50 flex items-center gap-2"
                data-testid={`${testid}-option-${i}`}>
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
