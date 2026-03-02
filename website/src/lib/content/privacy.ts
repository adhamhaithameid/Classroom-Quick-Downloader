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
        'Download outcomes (success, fail, cancel) as counts.',
        'Browser and extension version for compatibility tracking.',
        'Country-level activity trends for service quality monitoring.'
      ]
    },
    {
      id: 'what-we-do-not-collect',
      title: 'What we do not collect',
      summary:
        'We avoid collecting sensitive personal content and keep public data privacy-safe.',
      bullets: [
        'No classroom document content is collected.',
        'No account passwords are collected.',
        'No raw IP lists are published in public website data.'
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
        'Supports safer, more stable releases.'
      ]
    }
  ]
};
