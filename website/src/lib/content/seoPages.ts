import { STORE_LINKS } from '$lib/config';

export type SeoCta = {
  label: string;
  href: string;
  external?: boolean;
};

export type SeoSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type SeoPageConfig = {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  keywords: string;
  sections: SeoSection[];
  primaryCta?: SeoCta;
  secondaryCta?: SeoCta;
};

const defaultPrimaryCta: SeoCta = {
  label: 'Install for Chrome',
  href: STORE_LINKS.chrome,
  external: true
};

const defaultSecondaryCta: SeoCta = {
  label: 'View FAQ',
  href: '/faq'
};

function withDefaults(config: SeoPageConfig): SeoPageConfig {
  return {
    ...config,
    primaryCta: config.primaryCta ?? defaultPrimaryCta,
    secondaryCta: config.secondaryCta ?? defaultSecondaryCta
  };
}

export const seoPages = {
  downloadAllAttachments: withDefaults({
    path: '/download-all-attachments-google-classroom',
    title: 'Download All Google Classroom Attachments — Classroom Quick Downloader',
    description:
      'How to download all attachments from Google Classroom at once with one click using Classroom Quick Downloader.',
    eyebrow: 'Use Case',
    h1: 'How To Download All Attachments From Google Classroom',
    intro:
      'Classroom Quick Downloader adds download buttons directly inside Google Classroom so you can download every attachment from an assignment without opening each file.',
    keywords:
      'download all google classroom attachments, bulk download google classroom files, classroom quick downloader',
    sections: [
      {
        heading: 'Why This Workflow Matters',
        paragraphs: [
          'Google Classroom was not built for high-volume attachment downloading. You often need to open each file preview, then manually download one by one.',
          'CQD removes that friction by exposing one-click controls in assignment views and queueing downloads automatically.'
        ]
      },
      {
        heading: 'Step-By-Step',
        paragraphs: ['Install the extension, open your Classwork tab, then click the Download All control on a post or assignment.'],
        bullets: [
          'Open Google Classroom and go to the assignment.',
          'Click Download All.',
          'Let your browser queue the downloads in the background.',
          'Continue studying while downloads complete.'
        ]
      },
      {
        heading: 'What You Get',
        paragraphs: ['You reduce repetitive clicks, avoid preview interruptions, and keep your file collection process consistent across courses.']
      }
    ]
  }),

  bulkDownloadAssignments: withDefaults({
    path: '/bulk-download-google-classroom-assignments',
    title: 'Bulk Download Google Classroom Assignments — Classroom Quick Downloader',
    description:
      'Bulk download assignment materials from Google Classroom faster with one-click queueing and browser-native downloads.',
    eyebrow: 'Use Case',
    h1: 'Bulk Download Google Classroom Assignments',
    intro:
      'When one class has dozens of files, manual downloads waste time. CQD provides a practical bulk-download workflow built for students.',
    keywords: 'bulk download google classroom assignments, classroom assignment downloader, download class materials fast',
    sections: [
      {
        heading: 'Typical Problem',
        paragraphs: [
          'Students often need all assignment files before class, offline study, or exam review.',
          'Manual clicking creates delays and increases the chance of missing files.'
        ]
      },
      {
        heading: 'CQD Approach',
        paragraphs: ['CQD makes assignment downloads predictable by handling file discovery and queuing inside the page you are already using.'],
        bullets: [
          'No account creation.',
          'No external file proxy.',
          'Browser-native download flow.'
        ]
      },
      {
        heading: 'Best Practice',
        paragraphs: ['Use CQD at the start of each week to pull your class materials in one pass and keep folders organized by class name.']
      }
    ]
  }),

  driveVirusWarning: withDefaults({
    path: '/google-drive-cant-scan-virus-warning-download',
    title: "Fix Google Drive 'Can't Scan This File For Viruses' Warning — CQD",
    description:
      "Understand the Google Drive 'can't scan this file for viruses' warning and download your classroom files safely with fewer steps.",
    eyebrow: 'Troubleshooting',
    h1: "Fix: Google Drive Can't Scan This File For Viruses",
    intro:
      "That warning appears when a file is too large for Drive's automated scan preview. It does not always mean the file is malicious.",
    keywords:
      "google drive can't scan this file for viruses, google classroom download warning, large file download",
    sections: [
      {
        heading: 'What The Warning Means',
        paragraphs: [
          'Google Drive uses size and content limits for inline antivirus scanning.',
          "Large files may show this warning even when they are valid class materials."
        ]
      },
      {
        heading: 'How CQD Helps',
        paragraphs: ['CQD keeps download actions in the assignment flow, so you do not need repeated preview-and-confirm loops.'],
        bullets: [
          'Start downloads directly from the Classroom page.',
          'Reduce manual preview clicks.',
          'Keep your workflow consistent when many files are involved.'
        ]
      },
      {
        heading: 'Safety Reminder',
        paragraphs: [
          'Always use your institution guidelines for trusted material handling. CQD accelerates the workflow but does not replace your local security policy.'
        ]
      }
    ]
  }),

  workspaceSupport: withDefaults({
    path: '/google-workspace-school-accounts-support',
    title: 'Google Workspace School Account Support — Classroom Quick Downloader',
    description:
      'Classroom Quick Downloader works with Google Workspace for Education school accounts across supported browsers.',
    eyebrow: 'Compatibility',
    h1: 'Works With Google Workspace For Education Accounts',
    intro:
      'CQD is built for the Google Classroom interface used by schools and universities using Workspace for Education.',
    keywords: 'google workspace education extension, school google classroom downloader, classroom quick downloader support',
    sections: [
      {
        heading: 'Account Compatibility',
        paragraphs: [
          'CQD works for personal Google accounts and managed school Workspace accounts where browser extension installation is allowed.'
        ]
      },
      {
        heading: 'Managed Device Notes',
        paragraphs: ['If your school controls browser policies, installation may need IT approval.'],
        bullets: [
          'Share the extension store link with your IT admin.',
          'Reference the GitHub repository for technical review.',
          'Check browser extension policy restrictions on managed devices.'
        ]
      }
    ]
  }),

  downloadMaterialsFast: withDefaults({
    path: '/download-google-classroom-materials-fast',
    title: 'Download Google Classroom Materials Fast — Classroom Quick Downloader',
    description:
      'Speed up your Google Classroom workflow by downloading class materials in one click instead of one-by-one.',
    eyebrow: 'Performance',
    h1: 'Download Google Classroom Materials Fast',
    intro:
      'CQD is designed for speed: fewer clicks, fewer context switches, and faster access to your study files.',
    keywords: 'download google classroom materials fast, google classroom speed extension, student productivity extension',
    sections: [
      {
        heading: 'Before vs After',
        paragraphs: [
          'Without CQD you open many previews and repeat the same sequence of clicks.',
          'With CQD you click once and let the browser queue handle the rest.'
        ]
      },
      {
        heading: 'Where You Save Time',
        bullets: [
          'No repeated open-preview-download loops.',
          'Less navigation back and forth between tabs.',
          'More time spent on actual coursework.'
        ],
        paragraphs: ['The biggest gain comes from reducing repetitive interaction overhead in large assignments.']
      }
    ]
  }),

  installChrome: withDefaults({
    path: '/install/chrome',
    title: 'Install Classroom Quick Downloader On Chrome',
    description:
      'Install Classroom Quick Downloader on Chrome and start downloading Google Classroom files in one click.',
    eyebrow: 'Install Guide',
    h1: 'Install CQD For Chrome',
    intro: 'Chrome is the fastest way to get started with CQD. Installation takes less than a minute.',
    keywords: 'install classroom quick downloader chrome, chrome classroom extension, classroom downloader chrome',
    primaryCta: { label: 'Install from Chrome Web Store', href: STORE_LINKS.chrome, external: true },
    sections: [
      {
        heading: 'Installation Steps',
        bullets: [
          'Open the Chrome Web Store link.',
          'Click Add to Chrome.',
          'Confirm permissions.',
          'Open Google Classroom and start downloading.'
        ],
        paragraphs: ['After installation, CQD appears automatically on supported Classroom pages.']
      },
      {
        heading: 'Troubleshooting',
        paragraphs: ['If controls do not appear, refresh the Classroom tab or re-open the browser.']
      }
    ]
  }),

  installFirefox: withDefaults({
    path: '/install/firefox',
    title: 'Install Classroom Quick Downloader On Firefox',
    description:
      'Install Classroom Quick Downloader on Firefox Add-ons and download Google Classroom attachments faster.',
    eyebrow: 'Install Guide',
    h1: 'Install CQD For Firefox',
    intro: 'CQD is available on Firefox Add-ons with the same one-click download workflow.',
    keywords: 'install classroom quick downloader firefox, firefox classroom extension',
    primaryCta: { label: 'Install from Firefox Add-ons', href: STORE_LINKS.firefox, external: true },
    sections: [
      {
        heading: 'Installation Steps',
        bullets: [
          'Open the Firefox Add-ons listing.',
          'Click Add to Firefox.',
          'Approve requested permissions.',
          'Open Classroom and test a post with attachments.'
        ],
        paragraphs: ['Firefox users get the same CQD experience with browser-native downloads.']
      }
    ]
  }),

  installEdge: withDefaults({
    path: '/install/edge',
    title: 'Install Classroom Quick Downloader On Edge',
    description:
      'Install Classroom Quick Downloader on Microsoft Edge Add-ons for one-click Google Classroom downloads.',
    eyebrow: 'Install Guide',
    h1: 'Install CQD For Edge',
    intro: 'Edge users can install CQD directly from Microsoft Edge Add-ons.',
    keywords: 'install classroom quick downloader edge, edge google classroom extension',
    primaryCta: { label: 'Install from Edge Add-ons', href: STORE_LINKS.edge, external: true },
    sections: [
      {
        heading: 'Installation Steps',
        bullets: [
          'Open the Edge Add-ons listing.',
          'Click Get.',
          'Approve install permissions.',
          'Refresh Classroom tabs after install.'
        ],
        paragraphs: ['CQD runs on Edge with the same classroom workflow.']
      }
    ]
  }),

  security: withDefaults({
    path: '/security',
    title: 'Security — Classroom Quick Downloader',
    description:
      'Security overview for Classroom Quick Downloader: data boundaries, permissions scope, and disclosure process.',
    eyebrow: 'Trust',
    h1: 'Security Overview',
    intro:
      'CQD is built with minimal data collection and clear permission boundaries to keep student workflows safe and predictable.',
    keywords: 'classroom quick downloader security, browser extension security, google classroom extension privacy',
    secondaryCta: { label: 'Read Privacy Summary', href: '/privacy' },
    sections: [
      {
        heading: 'Data Boundaries',
        paragraphs: [
          'CQD does not read or upload classroom file contents.',
          'Operational reliability metrics are aggregate-only and designed to avoid personal profiling.'
        ]
      },
      {
        heading: 'Disclosure Process',
        paragraphs: ['Security issues can be reported through the repository security channels for triage and coordinated fixes.']
      }
    ]
  }),

  support: withDefaults({
    path: '/support',
    title: 'Support — Classroom Quick Downloader',
    description:
      'Support page for Classroom Quick Downloader: bug reports, feature requests, and response guidance.',
    eyebrow: 'Help',
    h1: 'Support And Contact',
    intro:
      'Need help with CQD? Use these channels to report bugs, request features, and get guidance.',
    keywords: 'classroom quick downloader support, report bug classroom extension',
    secondaryCta: { label: 'Open GitHub Issues', href: `${STORE_LINKS.github}/issues`, external: true },
    sections: [
      {
        heading: 'Where To Ask For Help',
        bullets: [
          'GitHub Issues for reproducible bugs.',
          'Feature requests via issue templates.',
          'Direct email for high-priority operational issues.'
        ],
        paragraphs: ['Include browser name, extension version, and reproducible steps to speed up diagnosis.']
      },
      {
        heading: 'Response Guidance',
        paragraphs: ['Critical issues are prioritized first. Non-critical improvements are grouped into upcoming releases.']
      }
    ]
  }),

  pressKit: withDefaults({
    path: '/press-kit',
    title: 'Press Kit — Classroom Quick Downloader',
    description:
      'Press kit for Classroom Quick Downloader: product summary, official links, logos, and usage guidelines.',
    eyebrow: 'Media',
    h1: 'Press Kit',
    intro:
      'This page provides a fast media reference for bloggers, student communities, and education tooling directories.',
    keywords: 'classroom quick downloader press kit, cqd logo, education extension media',
    sections: [
      {
        heading: 'Brand Assets',
        bullets: [
          'Use the official CQD logo and extension name as provided.',
          'Link to official store pages and repository.',
          'Do not imply affiliation with Google.'
        ],
        paragraphs: ['For latest screenshots and product visuals, use the assets folder and website pages linked below.']
      },
      {
        heading: 'Official Links',
        bullets: [STORE_LINKS.chrome, STORE_LINKS.firefox, STORE_LINKS.edge, STORE_LINKS.github],
        paragraphs: ['Use these official links in articles and resource pages.']
      }
    ]
  }),

  featured: withDefaults({
    path: '/featured',
    title: 'Featured Mentions — Classroom Quick Downloader',
    description:
      'A running list of product mentions, student community highlights, and external references for Classroom Quick Downloader.',
    eyebrow: 'Community',
    h1: 'Featured Mentions',
    intro: 'This page tracks notable mentions, write-ups, and community references for CQD.',
    keywords: 'classroom quick downloader reviews, mentions, featured',
    sections: [
      {
        heading: 'How This Page Is Used',
        paragraphs: [
          'Featured mentions help students and educators discover trusted references before installing tools.',
          'It also acts as a transparent public changelog of where CQD has been showcased.'
        ]
      },
      {
        heading: 'Submission Note',
        paragraphs: ['If you wrote about CQD and want to be listed, open an issue with the article link and publication details.']
      }
    ]
  }),

  compareOneClick: withDefaults({
    path: '/compare/classroom-quick-downloader-vs-classroom-one-click-downloader',
    title: 'CQD vs Classroom One Click Downloader — Comparison',
    description:
      'Compare Classroom Quick Downloader and Classroom One Click Downloader across workflow, privacy, reliability, and browser support.',
    eyebrow: 'Comparison',
    h1: 'Classroom Quick Downloader vs Classroom One Click Downloader',
    intro:
      'This comparison page focuses on practical workflow differences so students can choose the right tool for their classes.',
    keywords: 'classroom quick downloader vs classroom one click downloader',
    sections: [
      {
        heading: 'Comparison Criteria',
        bullets: [
          'Number of clicks required for bulk downloads.',
          'Browser support coverage.',
          'Privacy and operational transparency.',
          'Reliability under large assignment loads.'
        ],
        paragraphs: ['Use these objective criteria when evaluating classroom download extensions.']
      }
    ]
  }),

  compareClassmate: withDefaults({
    path: '/compare/classroom-quick-downloader-vs-classmate',
    title: 'CQD vs Classmate — Comparison',
    description:
      'Compare Classroom Quick Downloader and Classmate by permissions, reliability, and student workflow speed.',
    eyebrow: 'Comparison',
    h1: 'Classroom Quick Downloader vs Classmate',
    intro:
      'A practical side-by-side comparison for students evaluating browser extensions for Classroom downloads.',
    keywords: 'classroom quick downloader vs classmate',
    sections: [
      {
        heading: 'What To Compare',
        bullets: [
          'Workflow clarity inside Classroom pages.',
          'Maintenance frequency and update transparency.',
          'Cross-browser support for Chrome, Firefox, and Edge.'
        ],
        paragraphs: ['Choose tools that clearly document behavior and keep updates visible.']
      }
    ]
  }),

  compareClassfetch: withDefaults({
    path: '/compare/classroom-quick-downloader-vs-classfetch',
    title: 'CQD vs Classfetch — Comparison',
    description:
      'Compare Classroom Quick Downloader and Classfetch with a focus on speed, reliability, and privacy-first design.',
    eyebrow: 'Comparison',
    h1: 'Classroom Quick Downloader vs Classfetch',
    intro: 'This page compares key workflow outcomes and practical differences between CQD and Classfetch.',
    keywords: 'classroom quick downloader vs classfetch',
    sections: [
      {
        heading: 'Evaluation Checklist',
        bullets: [
          'How fast can you start bulk downloads?',
          'Does it minimize repetitive clicks?',
          'Is documentation transparent and up to date?',
          'Does it support your browser and school environment?'
        ],
        paragraphs: ['Students should prioritize predictable behavior and transparent documentation over feature claims alone.']
      }
    ]
  })
} as const;
