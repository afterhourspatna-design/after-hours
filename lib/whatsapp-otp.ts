export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Sends a WhatsApp OTP to the specified phone number.
 * Standardizes the phone number with country code (defaults to +91 if 10 digits).
 * Falls back to printing to server console if API credentials are not set.
 */
export async function sendWhatsAppOtp(phone: string, otp: string): Promise<boolean> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;

  // Clean the phone number to digits only
  let formattedPhone = phone.replace(/\D/g, "");
  // Assume India country code (+91) if it's a 10-digit number
  if (formattedPhone.length === 10) {
    formattedPhone = `91${formattedPhone}`;
  }

  // Print OTP to terminal console for local debugging
  console.log(`\n==================================================`);
  console.log(`💬 [WHATSAPP OTP LOG]`);
  console.log(`📱 Recipient Phone: +${formattedPhone}`);
  console.log(`🔑 Verification OTP: ${otp}`);
  console.log(`⏰ Generated At: ${new Date().toISOString()}`);
  console.log(`==================================================\n`);

  // Fallback if environment variables are not configured
  if (!token || !phoneNumberId) {
    console.log("⚠️ WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set in env. Simulating success.");
    return true;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    
    // Choose between template or custom text layout based on templateName variable
    const body = templateName
      ? {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: otp }]
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: otp }]
              }
            ]
          }
        }
      : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "text",
          text: {
            body: `Your After Hours verification code is: ${otp}. It is valid for 5 minutes.`
          }
        };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("❌ WhatsApp Cloud API Error Response:", data);
      return false;
    }

    console.log("✅ WhatsApp OTP message sent successfully.");
    return true;
  } catch (error) {
    console.error("❌ Error sending WhatsApp OTP via HTTP API:", error);
    return false;
  }
}
