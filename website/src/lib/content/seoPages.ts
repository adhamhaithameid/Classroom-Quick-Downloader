import { STORE_LINKS } from '$lib/config';

export type SeoCta = {
  label: string;
  href: string;
  external?: boolean;
};

export type SeoSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type SeoFaq = {
  question: string;
  answer: string;
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
  faqs?: SeoFaq[];
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
    title: 'Download All Google Classroom Attachments (1 Click)',
    description:
      'Download every attachment from a Google Classroom assignment in one click. Free extension for Chrome, Firefox, and Edge — no account, no file upload.',
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
          'Google Classroom was not built for high-volume attachment downloading. When a teacher posts an assignment with a worksheet, a slide deck, a PDF, and three reference links, Classroom treats each attachment as its own mini-task: click the file, wait for the preview to load, find the download control, save it, go back, and find your place again for the next one.',
          'That loop costs roughly ten to twenty seconds per file depending on preview load times. Across thirty attachments in one assignment, you have spent five to ten minutes doing nothing but clicking and waiting. Multiply that across six classes and a full exam-prep week, and collecting your own materials becomes one of the most time-expensive parts of studying.',
          'Classroom Quick Downloader (CQD) removes that loop entirely. The extension adds download controls directly inside the Google Classroom interface, so the files come to you instead of you going to each file.'
        ]
      },
      {
        heading: 'Step-By-Step: Download Every Attachment In One Click',
        paragraphs: ['Once the extension is installed, the whole workflow happens on pages you already use:'],
        bullets: [
          'Install CQD from the Chrome Web Store, Firefox Add-ons, or Edge Add-ons — no account or sign-up is required.',
          'Open Google Classroom normally and navigate to any class.',
          'On the Classwork tab (or Stream), CQD automatically detects the downloadable attachments on each post — nothing to configure or toggle.',
          'Click the Download All control on the assignment you need.',
          'Your browser queues and saves every detected file natively, exactly as if you had downloaded each one by hand.',
          'Keep working while downloads finish in the background; progress is visible and in-flight downloads can be cancelled individually.'
        ]
      },
      {
        heading: 'What Happens Under The Hood',
        paragraphs: [
          'CQD reads the Classroom page structure to find attachment cards, then triggers the same browser download flow you would get from manual clicks. Files travel directly from Google\'s servers to your device — the extension never uploads your files anywhere and never routes them through a third-party server.',
          'Because downloads are queued through the browser itself, saved files land in your normal Downloads folder with their original names. There is no proprietary archive format and no re-download tax if you close the tab mid-run.'
        ]
      },
      {
        heading: 'Edge Cases Worth Knowing',
        bullets: [
          'Links vs files: web links posted in Classroom are not downloadable files, so CQD targets actual file attachments (PDFs, Docs exports, images, videos, spreadsheets) and skips plain URLs.',
          'Drive-only large files: very large files may show Google\'s "can\'t scan for viruses" interstitial when opened manually; see our dedicated guide for handling that warning.',
          'Refresh after install: if buttons do not appear right after installing, reload the Classroom tab once so the extension can attach to the page.',
          'Student Work: recent versions also support downloading attachments from student submissions in class tools where your teacher has enabled access.'
        ]
      },
      {
        heading: 'Who Benefits Most',
        paragraphs: [
          'Students preparing offline study packs before exams, teachers archiving their own course materials at the end of a term, and anyone on a slow or metered connection who wants to grab everything in one scheduled pass instead of drip-feeding clicks all day.'
        ]
      }
    ],
    faqs: [
      {
        question: 'Is downloading all attachments from Google Classroom allowed?',
        answer:
          'Yes for your own course materials. You are downloading files your teacher explicitly shared with you, through your own logged-in account, using your browser\'s normal download mechanism. CQD does not bypass any permission — if you cannot open a file manually, it will not be downloaded.'
      },
      {
        question: 'Does CQD work without a Google account sign-up?',
        answer:
          'There is nothing to register. Install the extension from your browser\'s official store, open Classroom, and the download controls appear. No CQD account, email, or profile exists at all — check the security overview for what little data the extension does collect.'
      },
      {
        question: 'Will my teacher know I bulk-downloaded the files?',
        answer:
          'CQD uses the same download endpoints as manual clicking, from your own account. It does not post, comment, or modify anything in the classroom. There is no CQD-side activity feed for teachers because there is no CQD-side activity beyond aggregate reliability metrics.'
      },
      {
        question: 'Where do the downloaded files go?',
        answer:
          'Into your browser\'s standard Downloads folder, under their original filenames, ready to organize into per-class folders. Nothing is zipped or renamed by the extension.'
      },
      {
        question: 'Does it work on Chromebook?',
        answer:
          'If your Chromebook runs the Chrome browser and allows extension installs (most personal and many school devices do), CQD works the same as on desktop. School-managed devices may require IT approval — see our Workspace for Education guide.'
      }
    ]
  }),

  bulkDownloadAssignments: withDefaults({
    path: '/bulk-download-google-classroom-assignments',
    title: 'Bulk Download Google Classroom Assignments — Free',
    description:
      'Bulk download every Google Classroom assignment file at once with one-click queueing and browser-native downloads. Free, open source, no sign-up needed.',
    eyebrow: 'Use Case',
    h1: 'Bulk Download Google Classroom Assignments',
    intro:
      'When one class has dozens of files, manual downloads waste time. CQD provides a practical bulk-download workflow built for students.',
    keywords: 'bulk download google classroom assignments, classroom assignment downloader, download class materials fast',
    sections: [
      {
        heading: 'The Bulk Problem, Quantified',
        paragraphs: [
          'A single term of a typical course load produces a surprising amount of file traffic: syllabi, weekly worksheets, lecture slides, reading PDFs, lab handouts, rubrics, and reference material. It is common for one class to accumulate fifty or more downloadable files by midterm.',
          'At manual-click pace, pulling all of that down means well over an hour of pure clicking, waiting on previews, and re-navigating. Worse, it is error-prone: lose concentration halfway through assignment 14 of 30 and you will not notice the missing file until you are offline with no access to it.'
        ]
      },
      {
        heading: 'How CQD Handles Bulk Downloads',
        paragraphs: ['CQD makes bulk downloads predictable by handling discovery and queueing inside the Classroom page you are already using:'],
        bullets: [
          'No account creation — install from your browser\'s store and you are done.',
          'No external file proxy — files stream straight from Google to your device.',
          'Browser-native download flow — your browser\'s own download manager handles queueing, retries, and pauses.',
          'Per-post controls — grab one assignment\'s files or sweep every post on the page without leaving Classroom.'
        ]
      },
      {
        heading: 'A Weekly Routine That Works',
        paragraphs: [
          'Students who get the most out of bulk downloading tend to settle into the same rhythm: once a week, open each class, run Download All on anything new, then sort the fresh files into per-class folders while context is still fresh. The whole pass takes minutes instead of evenings.',
          'Because CQD preserves original filenames, sorting afterward stays simple — no renaming archaeology to figure out which worksheet belongs to which week.'
        ]
      },
      {
        heading: 'A Folder System That Survives The Semester',
        paragraphs: [
          'Bulk downloading only pays off if files stay findable afterward. A structure that scales well with Classroom\'s own hierarchy:',
        ],
        bullets: [
          'One top folder per school term, so old material never pollutes the current year.',
          'Inside it, one folder per class, named exactly as Classroom names it.',
          'Within each class, subfolders per unit or week — CQD\'s original filenames sort chronologically inside them without renaming.',
          'A single "_to-review" folder for anything you downloaded but have not opened, so nothing silently disappears.'
        ]
      },
      {
        heading: 'Term-End Archiving',
        paragraphs: [
          'Classroom access often ends when the term does — and with it, every attachment you never saved. The last week of term is the highest-value moment for a bulk pass: sweep all classes once, copy the folders to an external drive or secondary cloud location, and future-you inherits a complete offline record of every handout and slide deck.',
          'Students who lost access to a class know exactly how much those files were worth. The archive takes minutes while it is still possible.'
        ]
      },
      {
        heading: 'Reliability Under Load',
        paragraphs: [
          'Bulk runs are exactly where naive downloader scripts fall over — duplicated buttons, missed cards, downloads stuck in pending. CQD has been hardened specifically for large pages: detection is scoped per attachment card, duplicate triggers are filtered, and stuck download states clear instead of blocking the rest of the queue.',
          'If something does go wrong mid-run, in-flight downloads can be cancelled individually from the extension\'s progress UI without losing the files already saved.'
        ]
      },
      {
        heading: 'When Not To Bulk Download',
        paragraphs: [
          'Honest limits matter: if you only need one small file right now, clicking it directly is fine — CQD adds nothing there. The tool earns its keep when files stack up: multi-part assignments, end-of-unit review packs, archiving a class before access expires at the end of the term.'
        ]
      }
    ],
    faqs: [
      {
        question: 'Can I bulk download entire classes at once?',
        answer:
          'You can sweep every post on the Classwork tab in one pass, and repeat per class. CQD works within what Classroom loads on screen, so very long class histories may need scrolling first so every post is detected.'
      },
      {
        question: 'Do bulk downloads slow down my browser?',
        answer:
          'Downloads are queued natively, so your browser paces them the same way it would any batch of files. On limited connections you can cancel individual items; completed files are never re-fetched.'
      },
      {
        question: 'Is there a limit on file size or count?',
        answer:
          'CQD imposes none of its own — limits come from Google Drive itself. Extremely large Drive files can hit Google\'s scan interstitial; that behavior and its fix are covered in our virus-warning guide.'
      },
      {
        question: 'Does bulk downloading work with school accounts?',
        answer:
          'Yes, wherever the school allows extension installation. Workspace for Education accounts use the same Classroom interface; the practical gate is usually device policy, not account type. See the Workspace compatibility guide for IT-approval tips.'
      },
      {
        question: 'What if a download fails halfway through?',
        answer:
          'Already-saved files stay saved. Cancel the stuck item, refresh the page, and re-run Download All — CQD will detect the remaining attachments and you can skip files you already have in your Downloads folder.'
      }
    ]
  }),

  driveVirusWarning: withDefaults({
    path: '/google-drive-cant-scan-virus-warning-download',
    title: "Fix Google Drive Can't Scan This File For Viruses",
    description:
      "Why Google Drive says it can't scan a file for viruses, whether the file is safe, and how to download large Google Classroom files past the warning fast.",
    eyebrow: 'Troubleshooting',
    h1: "Fix: Google Drive Can't Scan This File For Viruses",
    intro:
      "That warning appears when a file is too large for Drive's automated scan preview. It does not always mean the file is malicious.",
    keywords:
      "google drive can't scan this file for viruses, google classroom download warning, large file download",
    sections: [
      {
        heading: 'What The Warning Actually Means',
        paragraphs: [
          'When you try to download or preview certain files from Google Drive — including files shared through Google Classroom — Google sometimes shows an interstitial reading "Google Drive can\'t scan this file for viruses."',
          'The trigger is size and type, not detection. Drive\'s inline antivirus scan has file-size limits; once a file exceeds what the scanner can process, Google cannot certify it, so it shows the warning and asks you to confirm before downloading. A two-hour lecture recording, a high-resolution lab image set, or a 200 MB dataset will all trip it while being perfectly ordinary course materials.',
          'In other words: the warning means "too big to auto-scan," not "we found malware." Genuine malware findings produce a different block entirely.'
        ]
      },
      {
        heading: 'Is The File Safe To Open?',
        paragraphs: [
          'That depends on the source, not the warning. If your teacher posted the file directly to Classroom, you have a trusted chain: teacher → Classroom → your account. The same caution you would apply to any email attachment applies here — unexpected executables (.exe, .bat) from anyone are worth questioning, regardless of size.',
          'The practical habit: verify the sender context first, then let your local antivirus do the deep check after download if you want belt-and-suspenders certainty. Your machine\'s scanner is not size-limited the way Drive\'s preview scan is.'
        ]
      },
      {
        heading: 'How To Download Past The Warning',
        bullets: [
          'Manual route: click Download anyway on the interstitial — one extra confirmation per large file.',
          'Faster route: install CQD and trigger downloads straight from the Classroom post, skipping repeated preview-and-confirm loops.',
          'For many large files: run Download All once and let the browser queue handle each file\'s fetch without you babysitting every interstitial.'
        ],
        paragraphs: [
          'CQD keeps download actions inside the assignment flow, which matters most when a class posts several heavyweight files at once — recorded lectures and design assets being the classic cases.'
        ]
      },
      {
        heading: 'Why Google Shows It At All',
        paragraphs: [
          'The scan exists so that casual Drive preview users get a baseline safety check before running unknown files. Because scanning everything is impossible at Drive\'s scale, Google draws a size line and warns past it. The result is a warning that fires mostly on legitimate large media — an acceptable trade-off for Google, but noisy for students.'
        ]
      },
      {
        heading: 'Safety Reminders That Still Apply',
        paragraphs: [
          'CQD accelerates the workflow; it does not replace judgment or your institution\'s security policy. Keep your browser and OS updated, let school-managed antivirus tools run their scheduled scans, and treat any file you were not expecting — from any source — as worth a second look.',
          'CQD itself reads no file contents: detection happens on the Classroom page structure, and bytes flow from Google\'s servers to your disk without passing through anything of ours.'
        ]
      }
    ],
    faqs: [
      {
        question: 'Does "can\'t scan for viruses" mean the file has a virus?',
        answer:
          'No. It means the file exceeded the size limit of Google Drive\'s automatic scan, so Google is telling you it could not certify either way. Most flagged files are ordinary large media or data files shared by teachers.'
      },
      {
        question: 'How do I bypass the warning safely?',
        answer:
          'Confirm the file comes from someone you trust, then click "Download anyway" — or use CQD to pull it from the Classroom post directly. After download, your local antivirus can scan it without Drive\'s size restriction.'
      },
      {
        question: 'Why does the warning appear for my teacher\'s file but not others?',
        answer:
          'Almost always because that file is larger than the others. Scan limits apply per file, so a 25 MB worksheet sails through while a 300 MB lecture video triggers the interstitial.'
      },
      {
        question: 'Can CQD remove the virus warning itself?',
        answer:
          'No extension can remove Google\'s interstitial, and be suspicious of any claiming to. What CQD does is reduce how often you meet the warning manually by queueing downloads from the Classroom page in one action.'
      },
      {
        question: 'Are there file types Drive refuses to scan entirely?',
        answer:
          'Drive\'s scanner handles common document, image, audio, and video formats up to its size cap. Obscure binary formats and archives above the cap reliably trigger the manual-confirmation path instead.'
      }
    ]
  }),

  workspaceSupport: withDefaults({
    path: '/google-workspace-school-accounts-support',
    title: 'Google Workspace For Education Account Support',
    description:
      'How Classroom Quick Downloader works with Google Workspace for Education accounts, school-managed browser policies, and admin extension restrictions.',
    eyebrow: 'Compatibility',
    h1: 'Works With Google Workspace For Education Accounts',
    intro:
      'CQD is built for the Google Classroom interface used by schools and universities using Workspace for Education.',
    keywords: 'google workspace education extension, school google classroom downloader, classroom quick downloader support',
    sections: [
      {
        heading: 'Account Compatibility',
        paragraphs: [
          'CQD works with both personal Google accounts and managed Google Workspace for Education accounts. School and university Classroom tenants render the same core interface as personal ones — same Classwork tab structure, same attachment cards — which is why the extension\'s detection works identically once it is allowed to run.',
          'The practical gate is rarely the account itself; it is whether your school\'s device policy permits installing extensions in the first place.'
        ]
      },
      {
        heading: 'If Your School Manages The Browser',
        paragraphs: ['Managed Chromebooks and school-controlled browsers can restrict what gets installed. If CQD is blocked or missing from the store on a school device, that is policy, not a technical failure. What tends to work:'],
        bullets: [
          'Send your IT admin the official store link plus the open-source GitHub repository for review.',
          'Point out the privacy posture: no file contents read, no third-party tracking, aggregate-only metrics.',
          'Ask whether your school allows a student-requested extension allowlist process — many do.',
          'On personal devices, install from the same store links with no restrictions.'
        ]
      },
      {
        heading: 'Common Setups, Honestly Categorized',
        bullets: [
          'Personal laptop + school Classroom account: works out of the box — this is the most common configuration.',
          'School-managed Chromebook: depends entirely on your district\'s extension allowlist; many schools approve study tools through a request process.',
          'Personal browser signed into a managed account: the browser profile is yours, so installation follows your device\'s rules, not Google\'s.',
          'Teacher devices: same story as students — CQD only reads pages you already have open and downloads files already shared with you.'
        ],
        paragraphs: [
          'If your setup falls into a gray area, the fastest resolution has always been a two-line email to IT with the store link and repository URL attached. Admins respond better to transparent, auditable extensions than to any workaround — which is exactly why none is offered here.'
        ]
      },
      {
        heading: 'What CQD Never Touches',
        paragraphs: [
          'Even on managed accounts, CQD does not read your email, grades, docs, or file contents. It operates on the Classroom page you already have open, triggers downloads you could have triggered manually, and sends back only aggregate reliability counters (counts of detections and download outcomes) designed so no personal profile can be built from them.',
          'For the full permission-by-permission breakdown, see the security overview; for data handling details, see the privacy summary.'
        ]
      },
      {
        heading: 'Teachers And Admins',
        paragraphs: [
          'Teachers evaluating CQD for their classes: students using it are downloading materials you already shared with them through Classroom, via their own accounts. Nothing is posted, edited, or exfiltrated. Schools that permit "download helper" style extensions generally clear CQD quickly because the repository is public and auditable.',
          'If you want a second opinion before recommending it to a class, point your IT department at the changelog — every feature and fix since v1.0 is documented there in plain language.'
        ]
      }
    ],
    faqs: [
      {
        question: 'Does CQD work with Google Workspace for Education accounts?',
        answer:
          'Yes. Education accounts use the same Classroom interface the extension is built against. Once installed on an allowed browser, everything — detection, Download All, flags — behaves exactly as on a personal account.'
      },
      {
        question: 'Why is the extension blocked on my school Chromebook?',
        answer:
          'School-managed devices commonly enforce extension allowlists. That is an IT policy decision, not a bug. Share the store listing and GitHub repo with your admin and ask about the school\'s extension request process.'
      },
      {
        question: 'Can my school see that I use CQD?',
        answer:
          'School admins can audit installed extensions on managed browsers — that is true of any extension, so install only where permitted. CQD itself reports no per-student activity anywhere.'
      },
      {
        question: 'Does it need extra permissions for school accounts?',
        answer:
          'No. Permissions are identical for every account type because the extension interacts with Classroom pages, not with account administration. Nothing education-specific is requested or stored.'
      },
      {
        question: 'Will admins consider it safe to approve?',
        answer:
          'The strongest case you can present is transparency: public source code, minimal scoped permissions, no file-content access, and documented data practices. Those four points answer most IT review checklists directly.'
      }
    ]
  }),

  downloadMaterialsFast: withDefaults({
    path: '/download-google-classroom-materials-fast',
    title: 'How To Download Google Classroom Materials Fast',
    description:
      'Download a whole week of Google Classroom materials in minutes instead of clicking file by file. Free browser extension built for students and teachers.',
    eyebrow: 'Performance',
    h1: 'Download Google Classroom Materials Fast',
    intro:
      'CQD is designed for speed: fewer clicks, fewer context switches, and faster access to your study files.',
    keywords: 'download google classroom materials fast, google classroom speed extension, student productivity extension',
    sections: [
      {
        heading: 'Where The Time Actually Goes',
        paragraphs: [
          'Manual downloading is not slow because your connection is slow — it is slow because of interaction overhead. Every file costs you a context switch: find the card, click the preview, wait for it to render, locate the small download control, click it, dismiss or navigate back, remember which file was next. Ten seconds each is typical, and none of those seconds involve bandwidth.',
          'That is why "just download them one by one" advice always underestimates: the cost compounds across files and across weeks.'
        ]
      },
      {
        heading: 'Before vs After CQD',
        bullets: [
          'Before: open preview → wait → download → back → repeat, per file, per post, per class.',
          'After: open Classwork → Download All → walk away while the browser queue drains.',
          'Net effect: minutes per class instead of an evening; a full exam-prep sweep in one sitting.'
        ],
        paragraphs: [
          'The biggest gains show up on exactly the pages students dread: end-of-unit posts with ten-plus attachments and recorded-lecture classes where every file weighs hundreds of megabytes.'
        ]
      },
      {
        heading: 'Speed Tactics That Stack',
        paragraphs: ['CQD removes clicks; you can compound that with three habits:'],
        bullets: [
          'Weekly sweep: run every class once at a fixed time instead of ad-hoc grabbing all week.',
          'Sort immediately: file downloads into class folders right after the sweep while names are fresh.',
          'Archive before access ends: term-end is when Classroom access disappears — one final bulk pass preserves everything offline.'
        ]
      },
      {
        heading: 'Measure The Difference Yourself',
        paragraphs: [
          'You do not have to take our word for the numbers. Pick one class with at least ten attachments and time both flows this week.',
          'Keep the comparison honest: files download at your network\'s pace no matter what, Google throttles bursts, and huge videos take as long as they take. What CQD eliminates is the interaction tax — the waiting-on-previews and click-recovery loops that never show up in any bandwidth chart.'
        ],
        bullets: [
          'Manual pass: stopwatch on, collect every file the traditional way. Note the final time.',
          'CQD pass: open the Classwork tab, Download All once, stop timing when the queue drains.',
          'Compare clicks too — most people count 30–60 interactions manually versus 2 with CQD.'
        ]
      },
      {
        heading: 'Why It Stays Fast On Big Pages',
        paragraphs: [
          'Detection runs locally against the page structure with per-card scoping, so large Classwork pages do not turn into a laggy mess. Downloads themselves are handed to your browser\'s native manager, which already knows how to pace parallel fetches without freezing tabs.',
          'Recent releases focused specifically on throughput: scan scheduling on heavy submission boards and faster state propagation during multi-file runs both got measurable improvements in v1.5.x.',
          'The engineering direction behind that is deliberate: CQD stays DOM-first — reading the page you already have open rather than calling extra APIs for each file — because it keeps detection fast, permission-light, and resilient when Classroom tweaks its markup between school terms.'
        ]
      }
    ],
    faqs: [
      {
        question: 'How much time does CQD actually save?',
        answer:
          'Roughly ten to twenty seconds per attachment versus manual clicking. A thirty-file assignment saves five to ten minutes; weekly sweeps across six classes save well over an hour compared with doing it by hand.'
      },
      {
        question: 'Does downloading many files at once slow my computer?',
        answer:
          'No more than downloading them manually would. Your browser\'s native download manager paces the queue; CQD adds no background processing after the initial detection pass completes.'
      },
      {
        question: 'Will it work on a slow school Wi-Fi connection?',
        answer:
          'Yes — and it helps most there, because queued batch downloading makes one reliable pass possible instead of many interrupted manual attempts. Files already saved are never re-fetched if you cancel partway.'
      },
      {
        question: 'Is there any premium tier for more speed?',
        answer:
          'No tiers exist. CQD is free and open source; speed is a property of the architecture (native browser queueing), not a paid unlock.'
      }
    ]
  }),

  installChrome: withDefaults({
    path: '/install/chrome',
    title: 'Install Classroom Quick Downloader For Chrome (Free)',
    description:
      'Add Classroom Quick Downloader to Chrome in under a minute and download all Google Classroom attachments in one click. Free, open source, no account.',
    eyebrow: 'Install Guide',
    h1: 'Install CQD For Chrome',
    intro: 'Chrome is the fastest way to get started with CQD. Installation takes less than a minute.',
    keywords: 'install classroom quick downloader chrome, chrome classroom extension, classroom downloader chrome',
    primaryCta: { label: 'Install from Chrome Web Store', href: STORE_LINKS.chrome, external: true },
    sections: [
      {
        heading: 'What You Need First',
        bullets: [
          'Chrome (or any Chromium browser: Brave, Opera, Vivaldi, Arc) on desktop or Chromebook.',
          'A Google account with Classroom access — personal or Workspace for Education.',
          'Permission to install extensions (personal devices: yes by default; managed devices: possibly IT approval).'
        ],
        paragraphs: ['Installation takes under a minute and there is no account creation, sign-up, or configuration step afterwards.']
      },
      {
        heading: 'Installation Steps',
        bullets: [
          'Open the Chrome Web Store listing via the install button on this page.',
          'Click "Add to Chrome", then confirm "Add extension" in the permission dialog.',
          'Pin CQD from the extensions menu if you want one-click access to its popup.',
          'Open classroom.google.com — if the tab was already open, refresh it once.'
        ],
        paragraphs: ['After installation, CQD appears automatically on supported Classroom pages: download controls on attachment cards and a Download All action on posts.']
      },
      {
        heading: 'What The Permissions Are For',
        paragraphs: [
          'CQD requests only what it needs to do its one job: seeing Classroom pages so it can detect attachment cards, and triggering downloads you could have made manually. It does not read file contents, does not touch your other sites, and stores nothing personal. The full breakdown lives on the security overview page, and the source code is public on GitHub if you would rather verify than trust.'
        ]
      },
      {
        heading: 'Troubleshooting',
        bullets: [
          'Buttons not appearing: refresh the Classroom tab — the extension attaches when the page loads, not retroactively.',
          'Still nothing: check chrome://extensions that CQD is enabled and not paused; re-open the browser if it was just installed.',
          'School device blocking the store: your organization manages extensions; send IT the store link and GitHub repository (see the Workspace guide).',
          'Odd behavior after a Classroom redesign: update the extension, then report it via GitHub Issues — layout shifts are fixed fast in patch releases.'
        ]
      },
      {
        heading: 'Your First Download: What Success Looks Like',
        bullets: [
          'Download controls appear on attachment cards inside Classroom — no toolbar detour required.',
          'One click on Download All queues every detected file through Chrome\'s native download manager.',
          'Files land in your Downloads folder under original names, ready to sort.',
          'The popup shows progress, and any in-flight item can be cancelled individually.'
        ],
        paragraphs: [
          'If a post also has edited or commented history, CQD\'s flags mark it visually so you can spot what changed without opening anything. Total time from install to first completed batch is typically under two minutes, most of which is Classroom loading.'
        ]
      },
      {
        heading: 'Keeping It Updated',
        paragraphs: [
          'Chrome updates extensions automatically in the background. Release notes for every version are published in the changelog, so you can always see what changed and why before it lands in your browser.'
        ]
      }
    ],
    faqs: [
      {
        question: 'Is Classroom Quick Downloader free on Chrome?',
        answer:
          'Completely — no premium tier, no trial limits, no ads. It is open source, so the full codebase is auditable on GitHub at any time.'
      },
      {
        question: 'Does it work on Chromebooks?',
        answer:
          'Yes, wherever the device allows Chrome extension installs. School-managed Chromebooks may require IT approval; personal Chromebooks install the same as any desktop.'
      },
      {
        question: 'Do I need to restart Chrome after installing?',
        answer:
          'No restart needed — but already-open Classroom tabs need one refresh so the extension can attach to them. New tabs pick it up automatically.'
      },
      {
        question: 'Will CQD slow Chrome down?',
        answer:
          'It activates only on Google Classroom pages and stays dormant elsewhere. Detection is a lightweight pass over page structure; you will not notice it in day-to-day browsing.'
      }
    ]
  }),

  installFirefox: withDefaults({
    path: '/install/firefox',
    title: 'Install Classroom Quick Downloader For Firefox',
    description:
      'Add Classroom Quick Downloader from Firefox Add-ons and bulk download Google Classroom attachments in one click. Free, open source, no account required.',
    eyebrow: 'Install Guide',
    h1: 'Install CQD For Firefox',
    intro: 'CQD is available on Firefox Add-ons with the same one-click download workflow.',
    keywords: 'install classroom quick downloader firefox, firefox classroom extension',
    primaryCta: { label: 'Install from Firefox Add-ons', href: STORE_LINKS.firefox, external: true },
    sections: [
      {
        heading: 'What You Need First',
        bullets: [
          'Firefox on desktop (Windows, macOS, or Linux).',
          'A Google account with Classroom access.',
          'Permission to install add-ons (automatic on personal machines; managed devices may restrict).'
        ],
        paragraphs: ['Firefox users get the same one-click workflow as Chrome users — detection, Download All, flags, and browser-native download queueing.']
      },
      {
        heading: 'Installation Steps',
        bullets: [
          'Open the Firefox Add-ons listing via the install button above.',
          'Click "Add to Firefox", then approve the permission prompt.',
          'Open classroom.google.com; refresh any already-open Classroom tab once.',
          'Download controls appear on posts with attachments — click Download All to test on a real class.'
        ]
      },
      {
        heading: 'What Makes The Firefox Build Different',
        paragraphs: [
          'Under the hood, Firefox uses the same WebExtension standard as Chrome, which is why feature parity is exact rather than approximate. Where the platforms genuinely differ — download API quirks, storage limits, private-window handling — CQD abstracts those details so your workflow never changes between browsers.',
          'One practical difference is release timing: Mozilla and Chrome Web Store review queues move at different speeds, so a given version may land in Firefox a few days after Chrome. Functionality is identical once it arrives; the changelog notes what shipped when.'
        ]
      },
      {
        heading: 'First-Week Tips',
        bullets: [
          'Run one Download All on your busiest class to see queue behavior with real file sizes.',
          'Enable "Run in Private Windows" if you do study sessions in private mode.',
          'Pin the extension for popup access to progress and cancellation.',
          'Bookmark the changelog — every release documents exactly what changed.'
        ],
        paragraphs: [
          'By the end of that first week you will know whether CQD fits your routine: most students keep a fixed weekly sweep and stop thinking about downloads entirely. If anything feels off, the support page lists exactly what to include in a bug report so fixes land fast.'
        ]
      },
      {
        heading: 'Feature Parity With Chrome',
        paragraphs: [
          'The Firefox build is the same product, not a stripped port. Bulk downloads, in-flight cancellation, edited/commented post flags, Student Work support, and the privacy posture all match the Chrome version. Where browsers differ technically (download APIs, storage limits), CQD abstracts it so your workflow is identical.'
        ]
      },
      {
        heading: 'Troubleshooting',
        bullets: [
          'Controls missing: refresh the Classroom tab after first install.',
          'Still missing: check about:addons that CQD is enabled, then restart Firefox.',
          'Private windows: extensions can be restricted there by default — allow CQD in private windows via its Add-ons settings if you study in that mode.',
          'Strict tracking protection quirks: Classroom itself is unaffected; if you ever see odd behavior, report it via GitHub Issues with your Firefox version.'
        ]
      }
    ],
    faqs: [
      {
        question: 'Is the Firefox version the same as the Chrome one?',
        answer:
          'Functionally yes — same features, same privacy posture, same release cadence. Only the browser-integration layer differs to match Firefox\'s APIs.'
      },
      {
        question: 'Does it work in Firefox private windows?',
        answer:
          'Only if you allow it: open about:addons, find CQD, and enable "Run in Private Windows". Otherwise Firefox keeps extensions out of private tabs by default.'
      },
      {
        question: 'Can I use it alongside the Chrome version?',
        answer:
          'Yes — many students run CQD in two browsers. There is no account to conflict, since nothing is synced anywhere; each browser manages its own downloads.'
      },
      {
        question: 'Is CQD on Firefox Mobile?',
        answer:
          'No — CQD targets desktop Classroom workflows where bulk downloading makes sense. Firefox on Android does not support the desktop extension model this is built on.'
      }
    ]
  }),

  installEdge: withDefaults({
    path: '/install/edge',
    title: 'Install Classroom Quick Downloader For Microsoft Edge',
    description:
      'Add Classroom Quick Downloader from Microsoft Edge Add-ons and download every Google Classroom attachment in one click. Free, open source, no account.',
    eyebrow: 'Install Guide',
    h1: 'Install CQD For Edge',
    intro: 'Edge users can install CQD directly from Microsoft Edge Add-ons.',
    keywords: 'install classroom quick downloader edge, edge google classroom extension',
    primaryCta: { label: 'Install from Edge Add-ons', href: STORE_LINKS.edge, external: true },
    sections: [
      {
        heading: 'What You Need First',
        bullets: [
          'Microsoft Edge on desktop (Chromium-based — any version from the last few years).',
          'A Google account with Classroom access.',
          'Permission to install extensions (standard on personal machines).'
        ],
        paragraphs: ['Edge is Chromium under the hood, so CQD behaves exactly as it does in Chrome once installed from Microsoft\'s own store.']
      },
      {
        heading: 'Installation Steps',
        bullets: [
          'Open the Edge Add-ons listing via the install button above.',
          'Click "Get", then confirm in the permission dialog.',
          'Open classroom.google.com; refresh already-open Classroom tabs once.',
          'Look for download controls on attachment cards and run Download All on a real post.'
        ]
      },
      {
        heading: 'Why A Native Edge Build Matters',
        paragraphs: [
          'Because Edge is Chromium-based, CQD could technically be side-loaded from the Chrome Web Store — but that path triggers "third-party store" warnings and depends on cross-store update timing. Publishing natively through Edge Add-ons means Microsoft\'s own review process, automatic updates through your browser, and no scary dialogs for students who just want their files.',
          'For schools standardized on Edge with managed extension policies, a native listing also gives IT a familiar approval target with a clean permission list rather than a workaround to evaluate.'
        ]
      },
      {
        heading: 'Your First Download',
        bullets: [
          'Open a class with real attachments on the Classwork tab.',
          'Confirm download controls appear on attachment cards.',
          'Run Download All once; watch files arrive in Downloads under original names.',
          'Try cancelling one in-flight item from the popup to see per-file control.'
        ],
        paragraphs: [
          'That is the entire learning curve. If any step misbehaves, the troubleshooting notes below cover the common causes, and the support page explains what details to include when reporting an issue.'
        ]
      },
      {
        heading: 'Edge-Specific Notes',
        paragraphs: [
          'Edge occasionally shows "extensions from other stores" warnings for Chrome Web Store items — installing from Edge Add-ons sidesteps that entirely, which is why we publish there natively.',
          'Collections, vertical tabs, and other Edge features are unaffected; CQD only activates on Classroom pages. If your school ships Edge with managed extension policies, the same IT-approval path applies as with Chromebooks.'
        ]
      },
      {
        heading: 'Troubleshooting',
        bullets: [
          'Buttons missing after install: refresh the Classroom tab once.',
          'Still missing: open edge://extensions, confirm CQD is enabled, restart the browser if it was a fresh install.',
          'Signed into the wrong profile: Edge profiles each carry their own extensions — make sure you installed on the profile you use for school.'
        ]
      }
    ],
    faqs: [
      {
        question: 'Is CQD available in the official Edge Add-ons store?',
        answer:
          'Yes — that is the recommended install path for Edge users. It avoids the third-party-store warnings Edge shows for Chrome Web Store extensions and keeps updates flowing through Microsoft\'s channel.'
      },
      {
        question: 'Does it behave differently than in Chrome?',
        answer:
          'No. Edge shares Chromium\'s extension APIs, so detection, Download All, flags, and cancellation all work identically. Updates may arrive days apart due to store review timing.'
      },
      {
        question: 'Will it work with multiple Edge profiles?',
        answer:
          'Extensions install per profile. Install CQD on whichever profile holds your school Google account; other profiles are unaffected either way.'
      },
      {
        question: 'Does it run on old Edge or Internet Explorer?',
        answer:
          'No. Legacy Edge and Internet Explorer predate the modern extension platform entirely. Current Chromium-based Edge (2020 onward) is fully supported.'
      }
    ]
  }),

  security: withDefaults({
    path: '/security',
    title: 'Security & Permissions — Classroom Quick Downloader',
    description:
      'Exactly which permissions Classroom Quick Downloader requests, what data never leaves your browser, and how to report a security issue responsibly.',
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
    title: 'Support & Help — Classroom Quick Downloader Guide',
    description:
      'Get help with Classroom Quick Downloader: fix missing download buttons, resolve failed downloads, report a bug, request a feature, and contact the team.',
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
    title: 'Press Kit: CQD Logos, Screenshots & Brand Assets',
    description:
      'Official Classroom Quick Downloader press kit: product summary, logos, screenshots, store links, and brand usage guidelines for writers and reviewers.',
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
    title: 'Featured Mentions & Reviews — Classroom Quick Downloader',
    description:
      'Where Classroom Quick Downloader has been featured: product mentions, student community highlights, reviews, and external references, updated regularly.',
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
    title: 'Classroom Quick Downloader vs One Click Downloader',
    description:
      'Classroom Quick Downloader vs Classroom One Click Downloader compared on download workflow, permissions, privacy, reliability, and browser support.',
    eyebrow: 'Comparison',
    h1: 'Classroom Quick Downloader vs Classroom One Click Downloader',
    intro:
      'This comparison page focuses on practical workflow differences so students can choose the right tool for their classes.',
    keywords: 'classroom quick downloader vs classroom one click downloader',
    sections: [
      {
        heading: 'How To Compare These Two Extensions Fairly',
        paragraphs: [
          'Both tools exist to solve the same problem: Classroom attachments should not require per-file clicking. Because their core promise overlaps this much, the decision lives in the details — transparency, maintenance rhythm, privacy posture, and how each behaves when a page gets big. This page gives you the evaluation axes; verify every claim against both store listings before installing either.'
        ]
      },
      {
        heading: 'Clicks And Workflow',
        paragraphs: [
          'CQD\'s model is detection-first: attachment cards are identified as the page loads, download controls appear in place, and Download All queues everything through your browser\'s native manager. When comparing workflow, count two things on any candidate: how many clicks from opening a class to files landing in your Downloads folder, and whether you can cancel individual items mid-run when something goes wrong.'
        ]
      },
      {
        heading: 'Transparency And Trust',
        paragraphs: [
          'CQD is fully open source — the repository, issue tracker, and changelog are public, so any claim on this site can be checked against code. That matters more in education than most categories: school devices, student accounts, and institutional data raise the stakes of "trust me" extensions. Whatever tool you pick, prefer one where permissions are explained line-by-line rather than buried in a wall of text.'
        ]
      },
      {
        heading: 'Privacy Posture',
        bullets: [
          'CQD reads no file contents and uploads nothing.',
          'Metrics are aggregate-only reliability counters — no personal profiles.',
          'No account system exists to breach or sell.'
        ],
        paragraphs: ['Compare each extension\'s stated data practices directly; vague privacy policies are themselves signal.']
      },
      {
        heading: 'Reliability Under Real Coursework',
        paragraphs: [
          'Large classes are the stress test: dozens of posts, mixed file types, Drive-only heavyweight videos. CQD\'s changelog shows a sustained focus on exactly these failure modes — duplicate-button filtering, stuck-state recovery, scan throttling on busy pages. Check any competitor\'s update history for the same pattern; extensions abandoned after their launch week are common in this niche.'
        ]
      },
      {
        heading: 'Browser Coverage',
        paragraphs: [
          'CQD ships natively for Chrome, Firefox, and Edge — plus Chromium derivatives like Brave, Opera, Vivaldi, and Arc. If you study across multiple browsers, native availability avoids the workarounds third-party stores require. Confirm equivalent coverage before committing your file-organizing habit to a single-browser tool.'
        ]
      }
    ],
    faqs: [
      {
        question: 'Which extension is faster for bulk downloads?',
        answer:
          'Both ultimately use browser-native downloads, so raw transfer speed is identical — the difference is interaction overhead and queue handling. Try both on a real class with ten-plus attachments and compare clicks-to-complete yourself.'
      },
      {
        question: 'Is Classroom Quick Downloader open source?',
        answer:
          'Yes — source, issues, and release notes are public on GitHub. We consider auditability a feature in the education space and would encourage the same standard for any competing tool.'
      },
      {
        question: 'Can I run both extensions at once?',
        answer:
          'Technically possible but not recommended: two extensions injecting similar controls into the same pages can duplicate buttons and confuse detection. Pick one, evaluate for a week, keep the winner.'
      },
      {
        question: 'What should decide it if both seem similar?',
        answer:
          'Maintenance cadence, permission clarity, and honest documentation. An actively maintained extension with public code will outlive a flashier launch — check both projects\' recent commit and release history.'
      },
      {
        question: 'Do both work with Google Workspace for Education?',
        answer:
          'Workspace compatibility depends mostly on school device policy rather than the extension. See our Workspace guide for what IT approval typically involves; then test whichever tool your school allows.'
      }
    ]
  }),

  compareClassmate: withDefaults({
    path: '/compare/classroom-quick-downloader-vs-classmate',
    title: 'Classroom Quick Downloader vs Classmate: Compared',
    description:
      'Classroom Quick Downloader vs Classmate compared on permissions requested, download reliability, privacy, and how fast each finishes a full class.',
    eyebrow: 'Comparison',
    h1: 'Classroom Quick Downloader vs Classmate',
    intro:
      'A practical side-by-side comparison for students evaluating browser extensions for Classroom downloads.',
    keywords: 'classroom quick downloader vs classmate',
    sections: [
      {
        heading: 'Different Categories, Adjacent Problems',
        paragraphs: [
          'These two names get compared often because they both live in the student-productivity space, but they are not the same category of tool: CQD is a bulk-download extension for Google Classroom attachments, while tools in the "classmate" family generally focus on study aids, assignment organization, or AI-assisted answers. The real question is whether you need file collection or study assistance — many students eventually want both.'
        ]
      },
      {
        heading: 'Where CQD Is The Right Tool',
        bullets: [
          'You need every attachment from a class on your device — offline packs, exam prep, term-end archiving.',
          'You want downloads queued natively with per-file cancellation.',
          'You care about edited/commented flags that surface what changed in Classroom posts.',
          'You need it to work identically across Chrome, Firefox, and Edge.'
        ],
        paragraphs: ['If your pain is "collecting files takes forever," a download tool is the correct category — an organizer will not click for you.']
      },
      {
        heading: 'Where An Organizer-Style Tool Wins',
        paragraphs: [
          'If your actual problem is forgetting due dates or wanting AI summaries rather than file access, a download accelerator solves nothing. Be honest about which problem you have before installing anything — the wrong category wastes more time than manual clicking does.'
        ]
      },
      {
        heading: 'Evaluation Checklist For Either Category',
        bullets: [
          'Permissions: minimal, explained, and scoped to what the tool claims to do.',
          'Data practices: explicit about what leaves the browser; aggregate-only beats profile-building.',
          'Maintenance: visible release history and a public changelog.',
          'Source availability: open source where possible, especially on school devices.',
          'Reviews with substance: store reviews that mention specific workflows beat star-count alone.'
        ]
      },
      {
        heading: 'Questions To Ask Before Installing Either',
        bullets: [
          'What exact problem did I hit this week that this tool solves?',
          'Does the permission list match the promise, feature by feature?',
          'Is there a public changelog, and when did it last update?',
          'What happens to my files if I uninstall — proprietary formats or plain folders?',
          'Who built it, and can I read what they wrote?'
        ],
        paragraphs: [
          'CQD\'s answers are deliberately boring: it solves one problem (attachment collection), asks for minimal permissions, publishes every change, stores nothing proprietary, and shows its work on GitHub. Hold any study-side tool to the same standard and the pair coexists cleanly.'
        ]
      },
      {
        heading: 'Using Both Together',
        paragraphs: [
          'They are not mutually exclusive. A common pattern: CQD pulls all course materials down weekly into organized folders, while whatever organizational layer you prefer works on top of local files. Because CQD preserves original filenames and never locks files into its own format, any downstream tool stays compatible.'
        ]
      }
    ],
    faqs: [
      {
        question: 'Is Classroom Quick Downloader the same kind of app as Classmate?',
        answer:
          'No. CQD batch-downloads attachments inside Google Classroom; Classmate-style tools organize studying. Compare them only insofar as both touch student workflows — they solve different problems.'
      },
      {
        question: 'Can I use CQD alongside Classmate?',
        answer:
          'Yes — there is no overlap in function. CQD gets files onto your disk with original names; organizer tools then work with those local files however they like.'
      },
      {
        question: 'Which one should a student install first?',
        answer:
          'Whichever matches your sharpest pain. If collecting materials costs you hours weekly, start with CQD; if your issue is planning rather than file access, an organizer serves you better.'
      },
      {
        question: 'Do either of them see my grades or emails?',
        answer:
          'CQD does not: it reads Classroom page structure for attachment cards only and uploads nothing. For any other tool, read its stated permissions carefully before granting them.'
      }
    ]
  }),

  compareClassfetch: withDefaults({
    path: '/compare/classroom-quick-downloader-vs-classfetch',
    title: 'Classroom Quick Downloader vs Classfetch: Compared',
    description:
      'Classroom Quick Downloader vs Classfetch compared on download speed, reliability, requested permissions, and privacy-first design. Free and open source.',
    eyebrow: 'Comparison',
    h1: 'Classroom Quick Downloader vs Classfetch',
    intro: 'This page compares key workflow outcomes and practical differences between CQD and Classfetch.',
    keywords: 'classroom quick downloader vs classfetch',
    sections: [
      {
        heading: 'The Direct Comparison Students Ask About',
        paragraphs: [
          'CQD and Classfetch-style tools both promise less friction around Classroom files, so this comparison sticks to axes you can verify yourself rather than marketing claims. The honest headline: if your need is bulk-downloading attachments with a transparent, auditable tool, CQD is built precisely for that; evaluate any alternative against the same checklist.'
        ]
      },
      {
        heading: 'Speed: What "Fast" Actually Means Here',
        paragraphs: [
          'Transfer speed is your network plus Google\'s servers — no extension changes physics. Where tools differ is interaction speed (clicks to start a batch) and queue management (what happens when thirty files are in flight). CQD\'s answer is one-click Download All feeding your browser\'s native manager, with cancellation per item. Time a candidate on a real ten-file post; seconds-to-first-file and total-clicks tell you everything.'
        ]
      },
      {
        heading: 'Reliability Signals Worth Checking',
        bullets: [
          'Public changelog: CQD publishes release notes for every version; v1.5.x specifically targeted scan throughput and state-propagation lag on large pages.',
          'Failure recovery: what happens when one download sticks — does the rest of the batch continue?',
          'Detection accuracy: duplicate buttons and missed attachment cards are the classic failure modes in this category.',
          'Issue tracker activity: a live repository means bugs get fixed, not buried.'
        ]
      },
      {
        heading: 'Permissions And Privacy',
        paragraphs: [
          'CQD requests only the access needed to detect attachments and trigger downloads on Classroom pages. It reads no file contents, uploads nothing, keeps no accounts, and reports only aggregate reliability counters. Whatever you compare against, put its permission list next to its promises — mismatches there are the clearest red flag in browser extensions.'
        ]
      },
      {
        heading: 'A Five-Minute Decision Framework',
        bullets: [
          'List your hard requirements: browsers you actually use, school device policies, offline archiving.',
          'Open both store listings and read the permission lists side by side.',
          'Check each project\'s last release date and changelog depth.',
          'Install your finalist and time it on a real ten-attachment post.',
          'Keep whichever one you forget is even installed — quiet reliability is the point.'
        ],
        paragraphs: [
          'Ten minutes of structured evaluation beats weeks of half-trusting a tool with your school account. Both projects should survive that scrutiny comfortably; if either does not, that is your answer.'
        ]
      },
      {
        heading: 'Ecosystem Fit',
        paragraphs: [
          'CQD ships natively through the Chrome Web Store, Firefox Add-ons, and Edge Add-ons, works with Workspace for Education wherever installs are permitted, and stays free with no tiers. If Classfetch covers browsers or platforms CQD does not — or vice versa — that alone can decide it for your device mix.'
        ]
      }
    ],
    faqs: [
      {
        question: 'Is Classroom Quick Downloader faster than Classfetch?',
        answer:
          'Raw download speed is identical — both hand files to your browser to fetch from Google. CQD optimizes interaction speed: fewer clicks to start, native queueing, per-item cancellation. Benchmark both on a real assignment for the honest number.'
      },
      {
        question: 'Which one respects privacy more?',
        answer:
          'We are confident in CQD\'s posture because it is verifiable: open source code, no file-content access, aggregate-only metrics, no account system. Apply the same verification standard to any competitor\'s claims.'
      },
      {
        question: 'Does CQD have features Classfetch lacks?',
        answer:
          'Feature sets evolve monthly, so check current changelogs — but CQD\'s differentiators are stable: cross-browser native builds, edited/commented post flags, Student Work support, and public source code.'
      },
      {
        question: 'Can I switch between them without losing anything?',
        answer:
          'Yes. Neither tool locks your files into proprietary formats — everything lands in your normal Downloads folder under original names, so switching costs nothing but an install.'
      }
    ]
  })
} as const;

export type RelatedLink = {
  path: string;
  label: string;
  description: string;
};

// Topical clusters. Each keyword page links to the siblings a reader of that
// page would actually want next, so link equity stays inside the cluster
// instead of leaking straight out to the store listings.
const RELATED_PATHS: Record<string, string[]> = {
  '/download-all-attachments-google-classroom': [
    '/bulk-download-google-classroom-assignments',
    '/download-google-classroom-materials-fast',
    '/google-drive-cant-scan-virus-warning-download',
    '/install/chrome'
  ],
  '/bulk-download-google-classroom-assignments': [
    '/download-all-attachments-google-classroom',
    '/download-google-classroom-materials-fast',
    '/google-workspace-school-accounts-support',
    '/compare/classroom-quick-downloader-vs-classroom-one-click-downloader'
  ],
  '/google-drive-cant-scan-virus-warning-download': [
    '/download-all-attachments-google-classroom',
    '/support',
    '/security'
  ],
  '/google-workspace-school-accounts-support': [
    '/security',
    '/support',
    '/download-all-attachments-google-classroom'
  ],
  '/download-google-classroom-materials-fast': [
    '/download-all-attachments-google-classroom',
    '/bulk-download-google-classroom-assignments',
    '/install/chrome'
  ],
  '/install/chrome': [
    '/install/firefox',
    '/install/edge',
    '/download-all-attachments-google-classroom'
  ],
  '/install/firefox': [
    '/install/chrome',
    '/install/edge',
    '/download-all-attachments-google-classroom'
  ],
  '/install/edge': [
    '/install/chrome',
    '/install/firefox',
    '/download-all-attachments-google-classroom'
  ],
  '/security': [
    '/google-workspace-school-accounts-support',
    '/support',
    '/press-kit'
  ],
  '/support': [
    '/google-drive-cant-scan-virus-warning-download',
    '/security',
    '/google-workspace-school-accounts-support'
  ],
  '/press-kit': ['/featured', '/security', '/download-all-attachments-google-classroom'],
  '/featured': [
    '/press-kit',
    '/compare/classroom-quick-downloader-vs-classroom-one-click-downloader',
    '/download-all-attachments-google-classroom'
  ],
  '/compare/classroom-quick-downloader-vs-classroom-one-click-downloader': [
    '/compare/classroom-quick-downloader-vs-classmate',
    '/compare/classroom-quick-downloader-vs-classfetch',
    '/download-all-attachments-google-classroom'
  ],
  '/compare/classroom-quick-downloader-vs-classmate': [
    '/compare/classroom-quick-downloader-vs-classroom-one-click-downloader',
    '/compare/classroom-quick-downloader-vs-classfetch',
    '/bulk-download-google-classroom-assignments'
  ],
  '/compare/classroom-quick-downloader-vs-classfetch': [
    '/compare/classroom-quick-downloader-vs-classroom-one-click-downloader',
    '/compare/classroom-quick-downloader-vs-classmate',
    '/bulk-download-google-classroom-assignments'
  ]
};

const pagesByPath = new Map<string, SeoPageConfig>(
  Object.values(seoPages).map((page) => [page.path, page])
);

export function relatedPagesFor(path: string): RelatedLink[] {
  return (RELATED_PATHS[path] ?? [])
    .map((relatedPath) => pagesByPath.get(relatedPath))
    .filter((page): page is SeoPageConfig => Boolean(page))
    .map((page) => ({
      path: page.path,
      label: page.h1,
      description: page.description
    }));
}
