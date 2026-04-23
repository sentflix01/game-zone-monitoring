import { useEffect, useState } from "react";
import { storageAdapter } from "@/api/storageAdapter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DollarSign, RotateCcw } from "lucide-react";
import { useTranslation } from "@/i18n/I18nContext";
import { useTour } from "@/contexts/TourContext";
import RoleGuard from "@/components/RoleGuard";
import { useAuth } from "@/lib/AuthContext";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

export default function Settings() {
  const { t } = useTranslation();
  const { restartTour } = useTour();
  const { setRole, user } = useAuth();
  const [promoteUid, setPromoteUid] = useState("");
  const [pricing, setPricing] = useState([]);
  const [rates, setRates] = useState({ PS5: "", PS4: "" });
  const [gameTimes, setGameTimes] = useState({ PS5: "", PS4: "" });
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    storageAdapter.entities.Pricing.list().then((p) => {
      setPricing(p);
      const ps5 = p.find((x) => x.console_type === "PS5");
      const ps4 = p.find((x) => x.console_type === "PS4");
      setRates({ PS5: ps5?.hourly_rate || "", PS4: ps4?.hourly_rate || "" });
      setGameTimes({ PS5: ps5?.game_time_minutes || "", PS4: ps4?.game_time_minutes || "" });
      if (ps5?.currency) setCurrency(ps5.currency);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    for (const type of ["PS5", "PS4"]) {
      const existing = pricing.find((p) => p.console_type === type);
      const data = { console_type: type, hourly_rate: parseFloat(rates[type]) || 0, game_time_minutes: parseFloat(gameTimes[type]) || 0, currency };
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

      <RoleGuard role="admin">
        <div data-tour="pricing-form" className="bg-game-surface border border-game-border rounded-xl p-6 space-y-5">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-yellow-400" /> Session Pricing
        </h3>

        <div data-tour="currency-field">
          <label className="text-game-muted text-sm mb-1.5 block">Currency</label>
          <Input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="e.g. ETB, USD"
            className="bg-game-bg border-game-border text-white w-32"
          />
        </div>

        {["PS5", "PS4"].map((type) => (
          <div key={type} className="space-y-3 pb-3 border-b border-game-border last:border-0">
            <div className="flex items-center gap-2">
              <span className={"text-xs font-bold px-2 py-0.5 rounded-full " + (type === "PS5" ? "bg-blue-600/30 text-blue-300" : "bg-purple-600/30 text-purple-300")}>{type}</span>
            </div>
            <div>
              <label className="text-game-muted text-sm mb-1.5 block">Session Price ({currency}/session)</label>
              <Input
                type="number"
                value={rates[type]}
                onChange={(e) => setRates({ ...rates, [type]: e.target.value })}
                placeholder="e.g. 30"
                className="bg-game-bg border-game-border text-white"
              />
            </div>
            <div>
              <label className="text-game-muted text-sm mb-1.5 block">Game Time (min/session)</label>
              <Input
                type="number"
                value={gameTimes[type]}
                onChange={(e) => setGameTimes({ ...gameTimes, [type]: e.target.value })}
                placeholder="e.g. 5"
                className="bg-game-bg border-game-border text-white"
              />
              <p className="text-game-muted text-xs mt-1">Standard time per game. Overtime beyond this is tracked as wasted time.</p>
            </div>
          </div>
        ))}

        <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
          {t('settings.saveButton')}
        </Button>
      </div>
      </RoleGuard>

      <div className="bg-game-surface border border-game-border rounded-xl p-6">
        <h3 className="text-white font-semibold mb-2">Current Session Prices</h3>
        {["PS5", "PS4"].map((type) => (
          <div key={type} className="flex justify-between py-2 border-b border-game-border last:border-0">
            <span className="text-game-muted text-sm">{type}</span>
            <div className="text-right">
              <span className="text-white font-semibold">
                {rates[type] ? currency + " " + parseFloat(rates[type]).toFixed(2) + " / session" : "Not set"}
              </span>
              {gameTimes[type] && (
                <p className="text-game-muted text-xs">{gameTimes[type]} min / game</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-game-surface border border-game-border rounded-xl p-6 space-y-4">
        <h3 className="text-white font-semibold">Change Password</h3>
        <p className="text-game-muted text-xs">
          This works for email/password accounts. If you signed in with Gmail, use Google account security to change your password.
        </p>
        <div className="space-y-3">
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="bg-game-bg border-game-border text-white"
            autoComplete="current-password"
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="bg-game-bg border-game-border text-white"
            autoComplete="new-password"
          />
          <Input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="Confirm new password"
            className="bg-game-bg border-game-border text-white"
            autoComplete="new-password"
          />
          <Button
            disabled={pwLoading}
            onClick={async () => {
              if (!user) return;
              if (!user.email) {
                toast.error("This account doesn't have an email.");
                return;
              }
              const providers = (user.providerData || []).map((p) => p.providerId);
              if (!providers.includes("password")) {
                toast.error("Password change is only available for email/password accounts.");
                return;
              }
              if (!currentPassword || !newPassword) {
                toast.error("Fill current and new password.");
                return;
              }
              if (newPassword.length < 6) {
                toast.error("New password must be at least 6 characters.");
                return;
              }
              if (newPassword !== confirmNewPassword) {
                toast.error("New passwords do not match.");
                return;
              }
              setPwLoading(true);
              try {
                const cred = EmailAuthProvider.credential(user.email, currentPassword);
                await reauthenticateWithCredential(user, cred);
                await updatePassword(user, newPassword);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmNewPassword("");
                toast.success("Password updated.");
              } catch (err) {
                toast.error(err?.message || "Failed to update password.");
              } finally {
                setPwLoading(false);
              }
            }}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
          >
            {pwLoading ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </div>

      <RoleGuard role="admin">
        <div className="bg-game-surface border border-game-border rounded-xl p-6 space-y-4">
          <h3 className="text-white font-semibold">{t('auth.settings.promoteTitle')}</h3>
          <div>
            <label className="text-game-muted text-sm mb-1.5 block">{t('auth.settings.promoteLabel')}</label>
            <Input
              value={promoteUid}
              onChange={(e) => setPromoteUid(e.target.value)}
              placeholder="User UID"
              className="bg-game-bg border-game-border text-white"
            />
          </div>
          <Button
            onClick={() => { if (promoteUid.trim()) { setRole(promoteUid.trim(), 'admin'); toast.success(t('auth.settings.promoteButton')); setPromoteUid(''); } }}
            className="bg-purple-600 hover:bg-purple-500 text-white"
          >
            {t('auth.settings.promoteButton')}
          </Button>
        </div>
      </RoleGuard>

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
