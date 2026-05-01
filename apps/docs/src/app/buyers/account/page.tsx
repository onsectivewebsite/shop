export const metadata = { title: 'Account safety' };

export default function AccountSafetyPage() {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
        Buyers
      </p>
      <h1>Account safety</h1>
      <p>
        Onsective takes account security seriously. Every layer here is on
        by default; the parts you can opt into are listed below.
      </p>

      <h2 id="2fa">Two-factor sign-in</h2>
      <p>
        Email-based 2FA is on for every password login by default — no opt-in
        needed. SMS 2FA is opt-in from{' '}
        <a href="https://itsnottechy.cloud/account/security">Account → Security</a>;
        when enabled, the same code is dispatched to your verified phone in
        addition to your email.
      </p>

      <h2 id="recovery">Recovery codes</h2>
      <p>
        Generate ten one-shot recovery codes from <em>Account → Security</em>.
        Each code lets you sign in once if you've lost access to your email.
        Store them somewhere safe — a password manager is ideal.
      </p>

      <h2 id="passkeys">Passkeys</h2>
      <p>
        Phishing-resistant sign-in via Touch ID, Windows Hello, or a hardware
        key. Add one from <a href="https://itsnottechy.cloud/account/passkeys">
        Account → Passkeys</a> and skip passwords + 2FA codes entirely on
        future sign-ins.
      </p>

      <h2 id="suspicious">Suspicious-login detection</h2>
      <p>
        Every successful sign-in writes a short-lived event row keyed off
        IP + country. When we see a sign-in from a country your account has
        never used before, you'll get an email with a one-click <em>It wasn't
        me</em> link that revokes every session, scrubs your password, and
        emails a fresh reset code. The link is single-use and expires in 7
        days.
      </p>

      <h2 id="data">Your data</h2>
      <ul>
        <li>
          <strong>Export:</strong> request a JSON copy of everything we hold
          on you from <em>Account → Security</em>. We email a 24-hour
          download link inside a minute.
        </li>
        <li>
          <strong>Delete:</strong> close your account from the same page.
          Profile, addresses, payment metadata, recovery codes, and saved
          items are scrubbed. Past order rows are kept (for tax law) but
          carry no personal data.
        </li>
        <li>
          <strong>Notifications:</strong> unsubscribe from marketing emails
          from <em>Account → Notifications</em>, or use the one-click
          unsubscribe in any marketing email's footer. Order updates and
          security alerts are exempt and always sent.
        </li>
      </ul>
    </>
  );
}
