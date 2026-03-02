<script lang="ts">
  import { base } from '$app/paths';
  import { STORE_LINKS } from '$lib/config';

  type FaqItem = {
    id: string;
    q: string;
    a: string;
  };

  type FaqSection = {
    title: string;
    icon: string;
    summary: string;
    items: FaqItem[];
  };

  const sections: FaqSection[] = [
    {
      title: 'Basics',
      icon: '📦',
      summary: 'What the extension does and who it is for.',
      items: [
        {
          id: 'basics-what',
          q: 'What is Classroom Quick Downloader?',
          a: 'Classroom Quick Downloader is a browser extension that adds one-click file downloads and batch download controls inside Google Classroom pages.'
        },
        {
          id: 'basics-who',
          q: 'Who should use it?',
          a: 'Students, teachers, and anyone who regularly downloads assignment files from Google Classroom can use it to reduce repetitive clicks and save time.'
        },
        {
          id: 'basics-free',
          q: 'Is it free?',
          a: 'Yes. The extension is completely free to use, has no premium tier, and is open-source under a public license.'
        },
        {
          id: 'basics-account',
          q: 'Do I need to create an account?',
          a: 'No account is required. Install it, open Classroom, and the download controls appear where supported.'
        },
        {
          id: 'basics-classwork',
          q: 'Does it work on the Classwork tab?',
          a: 'Yes. CQD supports both the Stream tab and the Classwork tab. It detects downloadable attachments across all supported Classroom views.'
        },
        {
          id: 'basics-mobile',
          q: 'Does it work on mobile?',
          a: 'Not directly. Browser extensions are a desktop feature. On mobile, you would need to use a mobile browser that supports extensions (like Firefox for Android), but this is not officially tested.'
        },
        {
          id: 'basics-how-many-files',
          q: 'Is there a limit to how many files I can download at once?',
          a: 'CQD itself doesn\'t impose a limit. However, your browser may throttle concurrent downloads — typically 6–10 at a time. CQD queues the rest and downloads them as slots free up.'
        },
        {
          id: 'basics-file-format',
          q: 'Does it change the file names or formats?',
          a: 'No. Files are downloaded exactly as they are hosted on Google Classroom. The original file names and formats are preserved.'
        }
      ]
    },
    {
      title: 'Installation & Browser Support',
      icon: '🌐',
      summary: 'Where it runs and how to install it.',
      items: [
        {
          id: 'install-browsers',
          q: 'Which browsers are supported?',
          a: 'Chrome, Firefox, Edge, and most Chromium-based browsers like Brave, Arc, Opera, and Vivaldi are supported.'
        },
        {
          id: 'install-safari',
          q: 'Does it support Safari?',
          a: 'Not currently. The extension depends on browser extension APIs that are not fully available in Safari for this workflow.'
        },
        {
          id: 'install-workspace',
          q: 'Does it work with Google Workspace school accounts?',
          a: 'Yes. It works with both personal Google accounts and Google Workspace accounts used by schools and institutions.'
        },
        {
          id: 'install-links',
          q: 'Where can I install it?',
          a: 'Use the official store links in the website header or from the project page on GitHub. It is available on the Chrome Web Store, Firefox Add-ons, and Edge Add-ons.'
        },
        {
          id: 'install-uninstall',
          q: 'How do I uninstall it?',
          a: 'Right-click the extension icon in your browser toolbar and choose "Remove". You can also go to your browser\'s extensions page and remove it from there.'
        },
        {
          id: 'install-size',
          q: 'How large is the extension?',
          a: 'The extension is very lightweight — under 200KB. It has no external dependencies and does not load any third-party scripts.'
        },
        {
          id: 'install-brave',
          q: 'Does it work on Brave with Shields enabled?',
          a: 'Yes. CQD works normally with Brave Shields enabled since it operates entirely within Google Classroom\'s existing page context and doesn\'t inject cross-site resources.'
        },
        {
          id: 'install-chromebook',
          q: 'Can I use it on a Chromebook?',
          a: 'Absolutely. Chromebooks support Chrome extensions natively. Install CQD from the Chrome Web Store and it will work the same as on any desktop Chrome browser.'
        }
      ]
    },
    {
      title: 'Privacy & Data',
      icon: '🔒',
      summary: 'What is collected and why.',
      items: [
        {
          id: 'privacy-collect',
          q: 'Does CQD collect personal data?',
          a: 'CQD is designed to avoid collecting personal content. Operational analytics are limited to service-level metrics needed to monitor reliability and usage trends.'
        },
        {
          id: 'privacy-files',
          q: 'Are my downloaded files uploaded anywhere?',
          a: 'No. Files are downloaded directly to your own device using the browser\'s built-in download mechanism. Nothing is routed through external servers.'
        },
        {
          id: 'privacy-ips',
          q: 'Do you store raw IP addresses?',
          a: 'Public-facing analytics are country-level aggregates. The system is designed to avoid exposing raw IP information in public endpoints.'
        },
        {
          id: 'privacy-cookies',
          q: 'Does CQD use tracking cookies?',
          a: 'No. CQD does not set any cookies, tracking pixels, or analytics beacons. There are no third-party analytics libraries included.'
        },
        {
          id: 'privacy-gdpr',
          q: 'Is CQD compliant with GDPR?',
          a: 'CQD minimizes data collection by design. It does not collect or store personally identifiable information, which aligns with GDPR data minimization principles.'
        },
        {
          id: 'privacy-full',
          q: 'Where can I read the full privacy policy?',
          a: 'Use the Privacy page on this website for the user summary, then open the full policy document from that page for complete details.'
        },
        {
          id: 'privacy-network',
          q: 'Does CQD make network requests?',
          a: 'CQD sends minimal aggregate analytics (download counts, browser version) to the CQD backend for reliability monitoring. No personal data, file content, or classroom details are transmitted.'
        }
      ]
    },
    {
      title: 'Download Behavior',
      icon: '⬇️',
      summary: 'How downloads work in real Classroom pages.',
      items: [
        {
          id: 'downloads-batch',
          q: 'How does "Download All" work?',
          a: 'On supported Classroom views, the extension identifies downloadable attachments and triggers downloads in batch with one action. Files are downloaded concurrently.'
        },
        {
          id: 'downloads-single',
          q: 'Can I still download files one by one?',
          a: 'Yes. Individual file download controls remain available in addition to batch actions. CQD adds buttons, it does not remove existing ones.'
        },
        {
          id: 'downloads-blocked',
          q: 'Why does Google Drive still show a warning sometimes?',
          a: 'Some files can still trigger Google or browser safety checks (e.g. virus scanning for large files). CQD reduces steps but cannot bypass provider-level security prompts.'
        },
        {
          id: 'downloads-speed',
          q: 'Does this make file transfer speed faster?',
          a: 'It improves workflow speed by reducing clicks and page transitions. Actual network transfer speed still depends on Google\'s servers and your internet connection.'
        },
        {
          id: 'downloads-types',
          q: 'What file types are supported?',
          a: 'All file types that Google Classroom supports can be downloaded. This includes PDFs, documents, spreadsheets, presentations, images, videos, and any other attachment format.'
        },
        {
          id: 'downloads-gdrive',
          q: 'Does it bypass Google Drive download limits?',
          a: 'No. CQD works within Google\'s normal download flow. If a file has exceeded its Drive download quota, CQD cannot override that restriction.'
        },
        {
          id: 'downloads-where',
          q: 'Where do downloaded files go?',
          a: 'Files go to your browser\'s default download location. You can change this in your browser\'s settings under the Downloads section.'
        },
        {
          id: 'downloads-zip',
          q: 'Does CQD zip the files into one download?',
          a: 'No. Each file is downloaded individually as a separate file. This preserves original file names and formats, and avoids the overhead of zipping and unzipping.'
        }
      ]
    },
    {
      title: 'For Students',
      icon: '🎓',
      summary: 'Real classroom scenarios and student-specific questions.',
      items: [
        {
          id: 'student-multi-class',
          q: 'Can I download files from multiple classes at once?',
          a: 'CQD works on one Classroom page at a time. To download from multiple classes, navigate to each class page and use the download controls there.'
        },
        {
          id: 'student-exam-period',
          q: 'Is it safe to use during exam periods?',
          a: 'Yes. CQD only downloads files you already have access to. It doesn\'t bypass any access restrictions, viewing locks, or exam-specific protections set by your instructor.'
        },
        {
          id: 'student-shared-account',
          q: 'Does it work on shared school computers?',
          a: 'Yes, as long as the browser has the extension installed. Since CQD stores no personal data, using it on shared computers doesn\'t create privacy concerns.'
        },
        {
          id: 'student-offline',
          q: 'Can I use CQD offline?',
          a: 'CQD needs Google Classroom to be loaded (which requires internet). However, once files are downloaded, they are available offline on your device.'
        },
        {
          id: 'student-old-posts',
          q: 'Does it work on archived or old class posts?',
          a: 'Yes. CQD detects downloadable attachments on any accessible Classroom page, including archived classes and older posts, as long as the files are still available.'
        },
        {
          id: 'student-google-docs',
          q: 'Can it download Google Docs, Sheets, and Slides?',
          a: 'CQD downloads files that have a direct download link. Native Google Docs/Sheets/Slides are web documents — they can be exported manually from Google Drive but are not standard file attachments.'
        },
        {
          id: 'student-teacher-notice',
          q: 'Will my teacher know I\'m using CQD?',
          a: 'No. CQD works entirely on the client side in your browser. It doesn\'t modify any server-side data or send notifications to your teacher. It simply adds download buttons to the page.'
        },
        {
          id: 'student-study-notes',
          q: 'Can I organize downloads by assignment or topic?',
          a: 'CQD downloads files with their original names. For organization, you can create folders on your device and move files after downloading. CQD doesn\'t rename or reorganize files.'
        }
      ]
    },
    {
      title: 'Troubleshooting',
      icon: '🔧',
      summary: 'Common issues and quick fixes.',
      items: [
        {
          id: 'trouble-button-missing',
          q: 'I do not see download buttons. What should I check?',
          a: 'Refresh the Classroom page, make sure the extension is enabled, and verify you are on a supported Classroom view with downloadable attachments. Try hard-refreshing with Ctrl+Shift+R.'
        },
        {
          id: 'trouble-permissions',
          q: 'What permissions are required?',
          a: 'The extension needs permission to run on Classroom pages and to trigger browser downloads. It does not request unrelated site permissions or access to other tabs.'
        },
        {
          id: 'trouble-conflicts',
          q: 'Can other extensions interfere with CQD?',
          a: 'Yes. Content blockers, ad blockers, or script-modifying extensions can conflict. Try temporarily disabling other extensions to isolate the issue.'
        },
        {
          id: 'trouble-update',
          q: 'How do I get the latest fixes?',
          a: 'Browser stores usually update extensions automatically. You can also force-check updates from your browser\'s extension management page (chrome://extensions or about:addons).'
        },
        {
          id: 'trouble-popup',
          q: 'The popup shows but nothing happens when I click download.',
          a: 'This can happen if the page structure changed or if your session expired. Try signing out and back into Google Classroom, then refresh the page.'
        },
        {
          id: 'trouble-csp',
          q: 'I see CSP errors in the console. Is this a problem?',
          a: 'Content Security Policy errors can appear in some institutional environments. CQD is designed to work within CSP constraints, but some strict school policies may need adjustment by IT administrators.'
        },
        {
          id: 'trouble-slow-download',
          q: 'Downloads are starting but seem slow.',
          a: 'Download speed depends on your internet connection and Google\'s servers, not CQD. If many files are queued, your browser may serialize some downloads. Try downloading fewer files at a time on slower connections.'
        },
        {
          id: 'trouble-blocked-school',
          q: 'My school\'s network blocks the extension. What can I do?',
          a: 'Some school networks or managed Chromebooks restrict extension installation. Contact your IT administrator and reference the extension\'s store listing and open-source repository for review.'
        }
      ]
    },
    {
      title: 'Updates & Versioning',
      icon: '🔄',
      summary: 'How updates work and what each version means.',
      items: [
        {
          id: 'updates-auto',
          q: 'Does CQD update automatically?',
          a: 'Yes. Browser extension stores handle automatic updates. When a new version is published, your browser will download and apply it within a few hours to a couple of days.'
        },
        {
          id: 'updates-force',
          q: 'How can I force an update?',
          a: 'Go to your browser\'s extensions page (chrome://extensions), enable "Developer mode", and click "Update". This will check for and install the latest version immediately.'
        },
        {
          id: 'updates-version-check',
          q: 'How do I check which version I have?',
          a: 'Open your browser\'s extensions page and find Classroom Quick Downloader in the list. The version number is displayed there. You can also see the latest version on the Changelog page.'
        },
        {
          id: 'updates-rollback',
          q: 'Can I go back to a previous version?',
          a: 'Browser stores don\'t support rollback natively. If you need an older version, you can download the source code from GitHub, check out a specific tag, and load it as an unpacked extension in developer mode.'
        },
        {
          id: 'updates-changelog',
          q: 'Where can I see what changed in each version?',
          a: 'The Changelog page on this website shows user-facing release notes. The GitHub repository has the full technical commit history for every change.'
        },
        {
          id: 'updates-beta',
          q: 'Is there a beta or preview channel?',
          a: 'Not currently. All releases go through the standard store review process. You can follow the GitHub repository for early visibility into upcoming changes.'
        }
      ]
    },
    {
      title: 'For Developers',
      icon: '💻',
      summary: 'Architecture, contributing, and technical details.',
      items: [
        {
          id: 'dev-code',
          q: 'Where is the source code?',
          a: 'The full repository is public on GitHub, including extension, backend, and website code. Anyone can review, fork, or contribute.'
        },
        {
          id: 'oss-report-bug',
          q: 'How do I report a bug or request a feature?',
          a: 'Use the in-product feedback links or open an issue on GitHub with clear reproduction steps, browser name/version, and what you expected to happen.'
        },
        {
          id: 'oss-security-report',
          q: 'How can I report a security issue responsibly?',
          a: 'Follow the repository\'s security policy (SECURITY.md) and report privately through the documented security contact path instead of posting sensitive details publicly.'
        },
        {
          id: 'oss-changelog',
          q: 'Where can I see release history?',
          a: 'The website changelog provides user-facing release notes. The GitHub repository contains the full technical commit history and detailed release notes.'
        },
        {
          id: 'oss-contribute',
          q: 'Can I contribute to the project?',
          a: 'Absolutely. Pull requests, bug reports, feature suggestions, and even documentation improvements are welcome. Check the CONTRIBUTING guidelines in the repository.'
        },
        {
          id: 'oss-license',
          q: 'What license does CQD use?',
          a: 'CQD is released under an open-source license. Check the LICENSE file in the GitHub repository for the exact terms and conditions.'
        }
      ]
    }
  ];

  let openId: string | null = sections[0]?.items[0]?.id ?? null;

  function toggle(id: string): void {
    openId = openId === id ? null : id;
  }
</script>

<svelte:head>
  <title>FAQ - Classroom Quick Downloader</title>
  <meta
    name="description"
    content="Comprehensive FAQ for Classroom Quick Downloader: setup, browser support, privacy, troubleshooting, security, and release information."
  />
</svelte:head>

<div class="faq-page">
  <header class="faq-hero">
    <div class="faq-hero-icon">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </div>
    <div>
      <h1>Frequently Asked Questions</h1>
      <p>Comprehensive answers for setup, usage, privacy, and troubleshooting.</p>
    </div>
  </header>

  <div class="faq-quick-links">
    <a href="{base}/privacy" class="faq-quick-link">Privacy Summary</a>
    <a href="{base}/changelog" class="faq-quick-link">User Changelog</a>
    <a href={STORE_LINKS.github} target="_blank" rel="noopener noreferrer" class="faq-quick-link">GitHub Repository</a>
  </div>

  <div class="faq-sections">
    {#each sections as section}
      <section class="faq-section">
        <header class="faq-section-head">
          <span class="faq-section-icon">{section.icon}</span>
          <div>
            <h2>{section.title}</h2>
            <p>{section.summary}</p>
          </div>
        </header>

        <div class="faq-list">
          {#each section.items as item}
            <button
              class="faq-item"
              class:open={openId === item.id}
              type="button"
              on:click={() => toggle(item.id)}
              aria-expanded={openId === item.id}
            >
              <div class="faq-question">
                <span class="faq-q-text">{item.q}</span>
                <span class="faq-chevron" aria-hidden="true">{openId === item.id ? '−' : '+'}</span>
              </div>
              {#if openId === item.id}
                <p class="faq-answer">{item.a}</p>
              {/if}
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>

<style>
  .faq-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .faq-hero {
    display: flex;
    align-items: center;
    gap: 16px;
    animation: riseIn 0.5s ease both;
  }

  .faq-hero-icon {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: var(--gc-green-bg);
    border: 1px solid rgba(26, 139, 85, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--gc-green);
  }

  h1 {
    margin: 0;
    font-size: clamp(28px, 4vw, 40px);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--text);
  }

  .faq-hero p {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 15px;
  }

  .faq-quick-links {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .faq-quick-link {
    text-decoration: none;
    color: var(--gc-green);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    border: 1px solid rgba(26, 139, 85, 0.18);
    background: rgba(26, 139, 85, 0.04);
    border-radius: 999px;
    padding: 7px 14px;
    transition: all 0.2s ease;
    backdrop-filter: blur(6px);
  }

  .faq-quick-link:hover {
    border-color: rgba(26, 139, 85, 0.35);
    background: rgba(26, 139, 85, 0.08);
  }

  .faq-sections {
    display: grid;
    gap: 20px;
  }

  .faq-section {
    border: 1px solid var(--border-subtle, rgba(226, 232, 240, 0.35));
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: 22px;
    animation: slideUp 0.5s ease both;
    opacity: 0;
  }

  .faq-section:nth-child(1) { animation-delay: 0s; }
  .faq-section:nth-child(2) { animation-delay: 0.06s; }
  .faq-section:nth-child(3) { animation-delay: 0.12s; }
  .faq-section:nth-child(4) { animation-delay: 0.18s; }
  .faq-section:nth-child(5) { animation-delay: 0.24s; }
  .faq-section:nth-child(6) { animation-delay: 0.3s; }

  .faq-section-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }

  .faq-section-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .faq-section-head h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.015em;
    color: var(--text);
  }

  .faq-section-head p {
    margin: 3px 0 0;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .faq-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .faq-item {
    text-align: left;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid var(--border-subtle, rgba(226, 232, 240, 0.35));
    border-radius: var(--radius-sm);
    padding: 0;
    cursor: pointer;
    width: 100%;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(15, 20, 25, 0.03);
  }

  .faq-item:hover {
    border-color: rgba(26, 139, 85, 0.18);
    box-shadow: 0 2px 8px rgba(15, 20, 25, 0.05);
  }

  .faq-item.open {
    border-color: rgba(26, 139, 85, 0.28);
    box-shadow: 0 4px 16px rgba(15, 20, 25, 0.06);
    background: rgba(255, 255, 255, 0.85);
  }

  .faq-question {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    gap: 14px;
  }

  .faq-q-text {
    font-weight: 700;
    font-size: 14px;
    color: var(--text);
    line-height: 1.5;
  }

  .faq-chevron {
    font-size: 20px;
    color: var(--gc-green);
    font-weight: 700;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }

  .faq-answer {
    margin: 0;
    padding: 0 16px 14px;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.75;
    animation: slideDown 0.18s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 700px) {
    .faq-hero {
      align-items: flex-start;
    }

    h1 {
      font-size: 24px;
    }

    .faq-section {
      padding: 16px;
    }
  }
</style>
