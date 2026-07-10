/**
 * MSG91 WhatsApp OTP Integration
 *
 * MSG91 manages OTP generation, delivery via WhatsApp, and verification
 * entirely on their side. We do NOT store OTP codes in our database.
 *
 * Required ENV vars:
 *   MSG91_AUTH_KEY      — Your MSG91 authentication key (from MSG91 dashboard)
 *   MSG91_TEMPLATE_ID   — WhatsApp OTP template ID (from MSG91 > WhatsApp > Templates)
 *
 * Optional:
 *   MSG91_OTP_EXPIRY    — OTP validity in minutes (default: 5)
 *   MSG91_OTP_LENGTH    — Number of digits in OTP (default: 6)
 */

const MSG91_BASE = "https://control.msg91.com/api/v5";

/** Formats phone to MSG91 standard: 91XXXXXXXXXX (no + prefix) */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Sends a WhatsApp OTP via MSG91.
 * MSG91 generates and delivers the OTP code — we just trigger it.
 * Returns { success: true } or { success: false, error: string }
 */
export async function sendMsg91Otp(
  phone: string
): Promise<{ success: boolean; error?: string }> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const expiry = process.env.MSG91_OTP_EXPIRY ?? "5";
  const otpLength = process.env.MSG91_OTP_LENGTH ?? "6";

  const mobile = formatPhone(phone);

  // ── Local dev fallback ──────────────────────────────────────────────────────
  if (!authKey || !templateId) {
    console.log("\n==================================================");
    console.log("💬 [MSG91 OTP — DEV MODE / Credentials not set]");
    console.log(`📱 Would send OTP to: +${mobile}`);
    console.log("⚠️  Set MSG91_AUTH_KEY and MSG91_TEMPLATE_ID in .env to enable real delivery");
    console.log("==================================================\n");
    return { success: true };
  }

  // ── Real MSG91 API call ────────────────────────────────────────────────────
  try {
    const url = new URL(`${MSG91_BASE}/otp`);
    url.searchParams.set("template_id", templateId);
    url.searchParams.set("mobile", mobile);
    url.searchParams.set("authkey", authKey);
    url.searchParams.set("otp_length", otpLength);
    url.searchParams.set("otp_expiry", expiry);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "accept": "application/json" },
    });

    const data = await res.json();

    if (data?.type === "success") {
      console.log(`✅ [MSG91] OTP dispatched to +${mobile}`);
      return { success: true };
    }

    console.error("❌ [MSG91] Send OTP failed:", data);
    return {
      success: false,
      error: data?.message ?? "Failed to send OTP via MSG91",
    };
  } catch (err) {
    console.error("❌ [MSG91] Network error while sending OTP:", err);
    return { success: false, error: "Network error — could not reach MSG91" };
  }
}

/**
 * Verifies the OTP code entered by the user against MSG91.
 * MSG91 tracks the code on their side — no DB lookup needed.
 * Returns { verified: true } or { verified: false, error: string }
 */
export async function verifyMsg91Otp(
  phone: string,
  otp: string
): Promise<{ verified: boolean; error?: string }> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const mobile = formatPhone(phone);

  // ── Local dev fallback ──────────────────────────────────────────────────────
  if (!authKey) {
    console.log(`🔓 [MSG91 VERIFY — DEV MODE] Accepting any OTP for +${mobile}`);
    return { verified: true };
  }

  // ── Real MSG91 verification ────────────────────────────────────────────────
  try {
    const url = new URL(`${MSG91_BASE}/otp/verify`);
    url.searchParams.set("authkey", authKey);
    url.searchParams.set("mobile", mobile);
    url.searchParams.set("otp", otp);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "accept": "application/json" },
    });

    const data = await res.json();

    if (data?.type === "success") {
      console.log(`✅ [MSG91] OTP verified for +${mobile}`);
      return { verified: true };
    }

    console.warn(`⚠️ [MSG91] OTP verification failed for +${mobile}:`, data);
    return {
      verified: false,
      error: data?.message ?? "Incorrect or expired OTP",
    };
  } catch (err) {
    console.error("❌ [MSG91] Network error during OTP verification:", err);
    return { verified: false, error: "Network error — could not reach MSG91" };
  }
}

/**
 * Retries / resends the OTP to the same number via MSG91.
 * Useful for the "Resend Code" button — MSG91 reuses the same OTP session.
 */
export async function resendMsg91Otp(
  phone: string
): Promise<{ success: boolean; error?: string }> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const mobile = formatPhone(phone);

  if (!authKey) {
    console.log(`🔁 [MSG91 RESEND — DEV MODE] Would resend OTP to +${mobile}`);
    return { success: true };
  }

  try {
    const url = new URL(`${MSG91_BASE}/otp/retry`);
    url.searchParams.set("authkey", authKey);
    url.searchParams.set("mobile", mobile);
    url.searchParams.set("retrytype", "text"); // "text" = WhatsApp text; use "voice" for voice call

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "accept": "application/json" },
    });

    const data = await res.json();

    if (data?.type === "success") {
      console.log(`🔁 [MSG91] OTP resent to +${mobile}`);
      return { success: true };
    }

    console.error("❌ [MSG91] Resend OTP failed:", data);
    return { success: false, error: data?.message ?? "Failed to resend OTP" };
  } catch (err) {
    console.error("❌ [MSG91] Network error during OTP resend:", err);
    return { success: false, error: "Network error — could not reach MSG91" };
  }
}
