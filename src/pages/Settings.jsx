import { useEffect, useState } from "react";
import { storageAdapter } from "@/api/storageAdapter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DollarSign, RotateCcw } from "lucide-react";
import { useTranslation } from "@/i18n/I18nContext";
import { useTour } from "@/contexts/TourContext";

export default function Settings() {
  const { t } = useTranslation();
  const { restartTour } = useTour();
  const [pricing, setPricing] = useState([]);
  const [rates, setRates] = useState({ PS5: "", PS4: "" });
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storageAdapter.entities.Pricing.list().then((p) => {
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
        await storageAdapter.entities.Pricing.update(existing.id, data);
      } else {
        await storageAdapter.entities.Pricing.create(data);
      }
    }
    toast.success(t('settings.toast.saved'));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">{t('settings.title')}</h2>
        <p className="text-game-muted text-sm mt-1">{t('settings.subtitle')}</p>
      </div>

      <div data-tour="pricing-form" className="bg-game-surface border border-game-border rounded-xl p-6 space-y-5">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-yellow-400" /> {t('settings.rates.title')}
        </h3>

        <div data-tour="currency-field">
          <label className="text-game-muted text-sm mb-1.5 block">{t('settings.currency.label')}</label>
          <Input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder={t('settings.currency.placeholder')}
            className="bg-game-bg border-game-border text-white w-32"
          />
        </div>

        {["PS5", "PS4"].map((type) => (
          <div key={type}>
            <label className="text-game-muted text-sm mb-1.5 block flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                type === "PS5" ? "bg-blue-600/30 text-blue-300" : "bg-purple-600/30 text-purple-300"
              }`}>{type}</span>
              {t('settings.rate.label').replace('{type}', type).replace('{currency}', currency)}
            </label>
            <Input
              type="number"
              value={rates[type]}
              onChange={(e) => setRates({ ...rates, [type]: e.target.value })}
              placeholder={t('settings.rate.placeholder')}
              className="bg-game-bg border-game-border text-white"
            />
          </div>
        ))}

        <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
          {t('settings.saveButton')}
        </Button>
      </div>

      <div className="bg-game-surface border border-game-border rounded-xl p-6">
        <h3 className="text-white font-semibold mb-2">{t('settings.currentRates.title')}</h3>
        {["PS5", "PS4"].map((type) => (
          <div key={type} className="flex justify-between py-2 border-b border-game-border last:border-0">
            <span className="text-game-muted text-sm">{type}</span>
            <span className="text-white font-semibold">
              {rates[type]
                ? t('settings.currentRates.value').replace('{currency}', currency).replace('{rate}', parseFloat(rates[type]).toFixed(2))
                : t('settings.currentRates.notSet')}
            </span>
          </div>
        ))}
      </div>

      <div data-tour="restart-tour" className="bg-game-surface border border-game-border rounded-xl p-6 space-y-3">
        <h3 className="text-white font-semibold">{t('settings.tour.title')}</h3>
        <p className="text-game-muted text-sm">{t('settings.tour.subtitle')}</p>
        <Button
          onClick={restartTour}
          variant="outline"
          className="gap-2 border-game-border text-white hover:bg-white/10"
        >
          <RotateCcw className="w-4 h-4" /> {t('settings.tour.button')}
        </Button>
      </div>
    </div>
  );
}
