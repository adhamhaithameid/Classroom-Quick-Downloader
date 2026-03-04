export type ManualPrivacySection = {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
};

export type ManualPrivacyContent = {
  headline: string;
  description: string;
  lastUpdatedAtUtc: number;
  fullPrivacyUrl: string;
  sections: ManualPrivacySection[];
};

// Edit this file directly to update website privacy copy.
export const privacyContent: ManualPrivacyContent = {
  headline: 'Privacy at a glance',
  description:
    'Classroom Quick Downloader uses aggregated operational analytics to keep downloads reliable across browsers. We do not collect private classroom file contents.',
  lastUpdatedAtUtc: Date.UTC(2026, 1, 27, 0, 0, 0),
  fullPrivacyUrl:
    'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/PRIVACY.md',
  sections: [
    {
      id: 'what-we-collect',
      title: 'What we collect',
      summary:
        'We collect aggregate usage signals to measure reliability and improve the extension over time.',
      bullets: [
        'Download outcomes (success, fail, cancel) as counts — never individual file details.',
        'Browser and extension version for compatibility tracking.',
        'Country-level activity trends for service quality monitoring.',
        'Page view counts on the CQD website (no personal identifiers attached).'
      ]
    },
    {
      id: 'what-we-do-not-collect',
      title: 'What we do not collect',
      summary:
        'We avoid collecting sensitive personal content and keep public data privacy-safe.',
      bullets: [
        'No classroom document content, file names, or assignment text is collected.',
        'No account passwords, emails, or Google credentials are accessed.',
        'No raw IP lists are published in public website data.',
        'No browsing history, search queries, or tab contents are tracked.',
        'No personally identifiable information (PII) is ever stored.'
      ]
    },
    {
      id: 'why-this-data-helps',
      title: 'Why this helps users',
      summary:
        'This limited data helps us prioritize fixes, improve stability, and keep downloads fast for students.',
      bullets: [
        'Improves reliability during high-volume download sessions.',
        'Helps focus engineering work on real-world issues.',
        'Supports safer, more stable releases across all browsers.'
      ]
    },
    {
      id: 'how-data-is-processed',
      title: 'How data is processed',
      summary:
        'All analytics are processed at the network edge using Cloudflare Workers. No raw data is stored — only pre-aggregated totals.',
      bullets: [
        'Data is aggregated in real-time at the edge, never stored as raw events.',
        'No central database of individual user interactions exists.',
        'Country-level resolution is derived from the request, then immediately aggregated — the raw signal is discarded.',
        'All processing happens within Cloudflare\'s global network infrastructure.'
      ]
    },
    {
      id: 'data-retention',
      title: 'Data retention',
      summary:
        'Aggregated counters are retained indefinitely to show lifetime stats. No personal data is retained because none is collected.',
      bullets: [
        'Aggregate download counts and country totals are kept for lifetime statistics.',
        'No individual session logs, timestamps, or user identifiers are retained.',
        'Rate-limiting data (e.g. IP-based cooldowns) is ephemeral and expires automatically.',
        'You can request deletion of any data via the contact email — though there is no personal data to delete.'
      ]
    },
    {
      id: 'your-rights',
      title: 'Your rights',
      summary:
        'CQD respects your privacy rights. Because we don\'t collect personal data, most data rights are satisfied by default.',
      bullets: [
        'GDPR: Data minimization is met by design — no personal data is collected.',
        'CCPA: No personal information is sold or shared with third parties.',
        'Right to deletion: No user-specific data exists to delete.',
        'Right to access: The public overview page shows all aggregate data we hold.',
        'Right to opt-out: Uninstalling the extension immediately stops all data collection.'
      ]
    },
    {
      id: 'childrens-privacy',
      title: 'Children\'s privacy',
      summary:
        'CQD is safe for users of all ages. No age verification is required because no personal data is collected.',
      bullets: [
        'The extension does not collect age, name, email, or any identifying information.',
        'No COPPA-regulated data is collected from any user, regardless of age.',
        'Google Classroom already handles age-appropriate access — CQD inherits those protections.',
        'Parents and educators can review the full source code on GitHub.'
      ]
    },
    {
      id: 'browser-permissions',
      title: 'Browser permissions explained',
      summary:
        'CQD requests only the minimum permissions needed to function. Here\'s what each one does and why.',
      bullets: [
        '"activeTab" — Allows the extension to interact with the current Classroom tab when you click.',
        '"downloads" — Required to trigger file downloads to your device.',
        '"Host permission for classroom.google.com" — Lets CQD detect and modify the Classroom UI to add download buttons.',
        'No "tabs", "history", "bookmarks", or broad host permissions are requested.',
        'All permissions are listed in the extension manifest, which is publicly auditable on GitHub.'
      ]
    },
    {
      id: 'contact-and-changes',
      title: 'Contact & policy changes',
      summary:
        'If you have questions about privacy, reach out anytime. We\'ll notify users of any material changes to this policy.',
      bullets: [
        'Contact: adhamhaithameid@gmail.com for any privacy questions.',
        'The full privacy policy is maintained at PRIVACY.md in the GitHub repository.',
        'Material changes will be communicated through extension update notes and this website.',
        'This summary page is updated whenever the underlying policy changes.'
      ]
    }
  ]
};
