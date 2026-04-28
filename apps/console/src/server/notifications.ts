export async function sendOtpEmail(to: string, code: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[email→${to}] Onsective password reset code: ${code} (expires in 10 min).`);
}
