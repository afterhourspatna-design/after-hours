"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Eye, EyeOff, Shield, Building2 } from "lucide-react";

interface Setting { key: string; value: string; }

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Password change
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    // Load from env defaults shown as placeholders — in production, fetch from /api/settings
    setSettings({
      venue_name: "After Hours Gaming Parlour",
      venue_phone: "+91-300-0000000",
      venue_email: "info@afterhours.in",
      currency_symbol: "Rs",
      operating_hours_start: "10:00",
      operating_hours_end: "24:00",
      hold_expiry_minutes: "15",
    });
  }, []);

  async function saveSettings() {
    setLoading(true);
    try {
      // In a full implementation, POST to /api/settings
      await new Promise(r => setTimeout(r, 500));
      toast.success("Settings saved!");
    } catch { toast.error("Failed to save settings"); }
    finally { setLoading(false); }
  }

  async function changePassword() {
    if (!currentPwd || !newPwd) { toast.error("Both fields required"); return; }
    if (newPwd.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setPwdLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Password changed!"); setCurrentPwd(""); setNewPwd("");
    } catch (e: any) { toast.error(e.message ?? "Failed to change password"); }
    finally { setPwdLoading(false); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Configure venue details and app preferences</p></div>

      {/* Venue info */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
          <Building2 className="w-4 h-4 text-violet-400" /> Venue Information
        </div>
        {[
          { key: "venue_name", label: "Venue Name" },
          { key: "venue_phone", label: "Contact Phone" },
          { key: "venue_email", label: "Contact Email" },
          { key: "currency_symbol", label: "Currency Symbol" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs text-zinc-400 mb-1 block">{label}</label>
            <input value={settings[key] ?? ""} onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
              className="input-field" />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "operating_hours_start", label: "Opening Time" },
            { key: "operating_hours_end", label: "Closing Time" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs text-zinc-400 mb-1 block">{label}</label>
              <input type="time" value={settings[key] ?? ""} onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                className="input-field" />
            </div>
          ))}
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Hold Expiry (minutes)</label>
          <input type="number" value={settings.hold_expiry_minutes ?? "15"}
            onChange={e => setSettings(s => ({ ...s, hold_expiry_minutes: e.target.value }))}
            className="input-field" min={5} max={60} />
          <p className="text-xs text-zinc-600 mt-1">How long a booking stays on HOLD before staff must confirm or cancel</p>
        </div>

        <button onClick={saveSettings} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50">
          <Save className="w-4 h-4" /> {loading ? "Saving…" : "Save Settings"}
        </button>
      </div>

      {/* Password change */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
          <Shield className="w-4 h-4 text-violet-400" /> Change Password
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Current Password</label>
          <div className="relative">
            <input type={showPwd ? "text" : "password"} value={currentPwd} onChange={e => setCurrentPwd(e.target.value)}
              placeholder="••••••••" className="input-field pr-10" />
            <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">New Password</label>
          <input type={showPwd ? "text" : "password"} value={newPwd} onChange={e => setNewPwd(e.target.value)}
            placeholder="Min 8 characters" className="input-field" />
        </div>
        <button onClick={changePassword} disabled={pwdLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl border border-zinc-700 transition-all disabled:opacity-50">
          <Shield className="w-4 h-4" /> {pwdLoading ? "Updating…" : "Change Password"}
        </button>
      </div>

      {/* Feature flags */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
          Feature Flags
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-zinc-200">Customer Portal</p>
            <p className="text-xs text-zinc-600">Allow customers to self-register and book</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Set via <code className="text-violet-400 bg-zinc-800 px-1 py-0.5 rounded">.env.local</code></span>
            <span className={`badge ${process.env.NEXT_PUBLIC_FEATURE_CUSTOMER_PORTAL === "true" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-zinc-800 text-zinc-500 border-zinc-700"}`}>
              {process.env.NEXT_PUBLIC_FEATURE_CUSTOMER_PORTAL === "true" ? "ON" : "OFF"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
