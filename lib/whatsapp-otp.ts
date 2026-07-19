/**
 * MSG91 WhatsApp OTP + Booking Notification Integration
 *
 * Required ENV vars:
 *   MSG91_AUTH_KEY                — Your MSG91 authentication key
 *   MSG91_TEMPLATE_ID             — WhatsApp OTP template ID
 *   MSG91_BOOKING_TEMPLATE_ID     — WhatsApp booking confirmation template ID
 *
 * Booking template must have these variables in order:
 *   {{1}} = customer name, {{2}} = game name, {{3}} = date,
 *   {{4}} = time range, {{5}} = payment status + amount
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

/**
 * Sends a booking confirmation WhatsApp message via MSG91 template API.
 * Requires MSG91_BOOKING_TEMPLATE_ID to be set (create the template in MSG91 dashboard).
 * Template variables: {{1}} name, {{2}} game, {{3}} date, {{4}} time, {{5}} payment
 */
export async function sendBookingNotification(data: {
  phone: string;
  name: string;
  gameName: string;
  date: string;
  timeRange: string;
  paymentLine: string;
}): Promise<{ success: boolean; error?: string }> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_BOOKING_TEMPLATE_ID;
  const mobile = formatPhone(data.phone);

  // ── Dev fallback ───────────────────────────────────────────────────────────
  if (!authKey || !templateId) {
    console.log("\n==================================================");
    console.log("💬 [MSG91 BOOKING — DEV MODE / Credentials not set]");
    console.log(`📱 Would send booking confirmation to: +${mobile}`);
    console.log(`📋 Name: ${data.name} | Game: ${data.gameName}`);
    console.log(`📅 ${data.date} ⏰ ${data.timeRange}`);
    console.log(`💳 ${data.paymentLine}`);
    console.log("⚠️  Set MSG91_AUTH_KEY and MSG91_BOOKING_TEMPLATE_ID in .env");
    console.log("==================================================\n");
    return { success: true };
  }

  // ── MSG91 WhatsApp Integrated Messaging (template send) ────────────────────
  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [
          {
            mobiles: mobile,
            VAR1: data.name,
            VAR2: data.gameName,
            VAR3: data.date,
            VAR4: data.timeRange,
            VAR5: data.paymentLine,
          },
        ],
      }),
    });

    const json = await res.json();
    if (json?.type === "success") {
      console.log(`✅ [MSG91] Booking notification sent to +${mobile}`);
      return { success: true };
    }

    console.error("❌ [MSG91] Booking notification failed:", json);
    return { success: false, error: json?.message ?? "Failed to send notification" };
  } catch (err) {
    console.error("❌ [MSG91] Network error sending booking notification:", err);
    return { success: false, error: "Network error — could not reach MSG91" };
  }
}
