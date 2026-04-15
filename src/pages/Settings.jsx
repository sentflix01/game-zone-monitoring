import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";

export default function Settings() {
  const [pricing, setPricing] = useState([]);
  const [rates, setRates] = useState({ PS5: "", PS4: "" });
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Pricing.list().then((p) => {
      setPricing(p);
      const ps5 = p.find((x) => x.console_type === "PS5");
      const ps4 = p.find((x) => x.console_type === "PS4");
      setRates({ PS5: ps5?.hourly_rate || "", PS4: ps4?.hourly_rate || "" });
      if (ps5?.currency) setCurrency(ps5.currency);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    for (const type of ["PS5", "PS4"]) {
      const existing = pricing.find((p) => p.console_type === type);
      const data = { console_type: type, hourly_rate: parseFloat(rates[type]) || 0, currency };
      if (existing) {
        await base44.entities.Pricing.update(existing.id, data);
      } else {
        await base44.entities.Pricing.create(data);
      }
    }
    toast.success("Pricing saved!");
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-game-muted text-sm mt-1">Configure pricing for your game zone</p>
      </div>

      <div className="bg-game-surface border border-game-border rounded-xl p-6 space-y-5">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-yellow-400" /> Hourly Rates
        </h3>

        <div>
          <label className="text-game-muted text-sm mb-1.5 block">Currency</label>
          <Input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="USD"
            className="bg-game-bg border-game-border text-white w-32"
          />
        </div>

        {["PS5", "PS4"].map((type) => (
          <div key={type}>
            <label className="text-game-muted text-sm mb-1.5 block flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                type === "PS5" ? "bg-blue-600/30 text-blue-300" : "bg-purple-600/30 text-purple-300"
              }`}>{type}</span>
              Hourly Rate ({currency})
            </label>
            <Input
              type="number"
              value={rates[type]}
              onChange={(e) => setRates({ ...rates, [type]: e.target.value })}
              placeholder="0.00"
              className="bg-game-bg border-game-border text-white"
            />
          </div>
        ))}

        <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
          Save Pricing
        </Button>
      </div>

      <div className="bg-game-surface border border-game-border rounded-xl p-6">
        <h3 className="text-white font-semibold mb-2">Current Rates</h3>
        {["PS5", "PS4"].map((type) => (
          <div key={type} className="flex justify-between py-2 border-b border-game-border last:border-0">
            <span className="text-game-muted text-sm">{type}</span>
            <span className="text-white font-semibold">
              {rates[type] ? `${currency} ${parseFloat(rates[type]).toFixed(2)}/hr` : "Not set"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}