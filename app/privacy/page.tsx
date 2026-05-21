import Link from "next/link";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 8 }}>{title}</h2>
      <div style={{ fontSize: 14, color: "#4B5563", lineHeight: 1.75, display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ marginTop: 16, marginBottom: 4, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6B7280" }}>
      {children}
    </h3>
  );
}

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      <div style={{ margin: "0 auto", maxWidth: 640, padding: "56px 32px 80px" }}>

        <Link
          href="/"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#9CA3AF", textDecoration: "none", marginBottom: 32 }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back
        </Link>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.02em", marginBottom: 8 }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 40 }}>
          Effective date: April 24, 2026. Governing law: Province of Ontario, Canada.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          <Section title="1. Information We Collect">
            <H3>Account information</H3>
            <p>When you create an account we collect your email address and, optionally, your first and last name.</p>
            <H3>Profile information</H3>
            <p>To generate personalized nutrition targets we collect optional profile data including age, sex, height, weight, goal direction, activity level, and dietary restrictions. You may skip or update any of these at any time.</p>
            <H3>Usage data</H3>
            <p>We collect food logs, meal photos (see below), workout logs, supplement entries, and in-app activity to power your insights and nudges.</p>
            <H3>Apple Health data</H3>
            <p>With your permission, we read steps and sleep data from Apple Health (HealthKit). This data is transmitted to our servers solely to personalize your AI coach check-in. It is read at the time your daily message is generated and is not stored independently on our servers.</p>
            <H3>Push notification tokens</H3>
            <p>We store a push notification token for your device to deliver your daily AI coach check-in and reminders. You can disable notifications at any time in your device settings.</p>
            <H3>Device and technical data</H3>
            <p>We may collect basic technical information such as device type, operating system version, and crash logs solely for the purpose of maintaining app stability.</p>
          </Section>

          <Section title="2. Meal Photos">
            <p>Photos you capture are transmitted over an encrypted connection to our AI analysis providers (Anthropic and/or OpenAI) for the purpose of identifying food items and estimating nutritional content. Original full-resolution photos are not retained after analysis is complete. A compressed thumbnail is stored in our database linked to your food log entry for display purposes and is deleted when you delete the associated meal or your account.</p>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use your information to: (a) operate and improve the App; (b) generate personalized nutrition estimates, nudges, and insights; (c) calculate progress toward your stated health goals; (d) process subscription payments; (e) send you service-related and occasional product communications via email or push notification; and (f) comply with legal obligations.</p>
            <p>We do not sell your personal information to third parties. We do not use your personal information for third-party advertising purposes.</p>
          </Section>

          <Section title="4. Third-Party Service Providers">
            <p>We share data with the following processors only to the extent necessary to operate the App:</p>
            <ul style={{ marginTop: 8, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, listStyleType: "disc" }}>
              <li><span style={{ fontWeight: 600, color: "#374151" }}>Supabase</span>: secure database hosting and user authentication.</li>
              <li><span style={{ fontWeight: 600, color: "#374151" }}>Anthropic</span>: AI-powered meal photo analysis and nudge generation.</li>
              <li><span style={{ fontWeight: 600, color: "#374151" }}>OpenAI</span>: AI-powered meal photo analysis (used as a fallback provider).</li>
              <li><span style={{ fontWeight: 600, color: "#374151" }}>RevenueCat</span>: subscription and in-app purchase management.</li>
              <li><span style={{ fontWeight: 600, color: "#374151" }}>Vercel</span>: application hosting and infrastructure.</li>
              <li><span style={{ fontWeight: 600, color: "#374151" }}>Apple</span>: payment processing for App Store subscriptions.</li>
            </ul>
            <p>Each provider operates under its own privacy policy and data processing agreements. WhatYouAte is not responsible for the data practices of these third parties beyond the contractual safeguards in place.</p>
          </Section>

          <Section title="5. Data Retention and Deletion">
            <p>We retain your data for as long as your account is active. You may delete your account and all associated data at any time using the "Delete account" option in your Profile. Upon deletion, your personal data is removed from our systems within a reasonable period, except where retention is required by law.</p>
          </Section>

          <Section title="6. Security">
            <p>We use industry-standard security measures including encryption in transit (TLS) and encryption at rest to protect your data. No method of transmission over the internet is 100% secure. While we take reasonable steps to protect your information, we cannot guarantee absolute security.</p>
          </Section>

          <Section title="7. Your Rights">
            <p>Depending on your location, you may have rights including: the right to access your personal data; the right to correct inaccurate data; the right to request deletion; the right to data portability; and the right to withdraw consent.</p>
            <p>Canadian residents have rights under the Personal Information Protection and Electronic Documents Act (PIPEDA). Residents of the European Economic Area have rights under the General Data Protection Regulation (GDPR). Residents of California have rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected, the right to delete personal information, and the right to opt out of the sale of personal information (we do not sell personal information). To exercise any of these rights, contact us using the information below.</p>
          </Section>

          <Section title="8. International Users">
            <p>WhatYouAte is operated from Canada. If you access the App from outside Canada, your information may be transferred to and processed in Canada. By using the App, you consent to this transfer. We take steps to ensure that data transferred internationally receives an adequate level of protection.</p>
          </Section>

          <Section title="9. Cookies and Local Storage">
            <p>The App uses browser local storage to save preferences and cached data on your device. This data does not leave your device except as described in this policy. We do not use third-party tracking cookies or advertising trackers.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>We may update this policy as the App evolves. Material changes will be communicated within the App. The effective date at the top of this page reflects the most recent revision. Continued use of the App after changes are posted constitutes acceptance of the revised policy.</p>
          </Section>

          <Section title="11. Contact">
            <p>
              For privacy inquiries, data requests, or any questions about this policy, contact us at:{" "}
              <a href="mailto:hello@minimul.app" style={{ color: "#6FA8FF", textDecoration: "none" }}>
                hello@minimul.app
              </a>
            </p>
          </Section>

        </div>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(31,41,55,0.08)" }}>
          <Link href="/terms" style={{ fontSize: 13, color: "#9CA3AF", textDecoration: "none" }}>
            View Terms of Use
          </Link>
        </div>

      </div>
    </div>
  );
}
