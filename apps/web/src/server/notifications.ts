/**
 * Notification dispatch. v0 logs to console; Phase 1 wires to SES + Twilio.
 * Keep the interface stable so callers don't change when the impl swaps.
 */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  // TODO Phase 1: AWS SES via @aws-sdk/client-ses
  // eslint-disable-next-line no-console
  console.log(`[email→${to}] Your Onsective code is ${code} (expires in 10 min).`);
}

export async function sendOtpSms(to: string, code: string): Promise<void> {
  // TODO Phase 1: Twilio (or MSG91 for IN)
  // eslint-disable-next-line no-console
  console.log(`[sms→${to}] Your Onsective code is ${code} (expires in 10 min).`);
}
