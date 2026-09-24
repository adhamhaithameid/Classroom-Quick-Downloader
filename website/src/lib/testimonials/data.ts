/**
 * Real store reviews backing the testimonials section.
 * Collected 2026-09-19 from the Chrome Web Store, Edge Add-ons, and Firefox
 * Add-ons; full dataset with verification notes lives in
 * docs/testimonials/data/reviews.json. Every entry links back to its public
 * source. Review text is verbatim — never rewritten.
 */

export type TestimonialStore = 'chrome' | 'edge' | 'firefox';

export interface Testimonial {
  store: TestimonialStore;
  name: string;
  rating: 5;
  date: string;
  text: string;
  href: string;
  avatar?: string;
  initial?: string;
  initialBg?: string;
  rtl?: boolean;
  gloss?: string;
  helpful?: string;
}

export const TESTIMONIAL_AGGREGATE = {
  score: 4.7 as const,
  ratings: 31,
  stores: ['chrome', 'edge', 'firefox'] as const,
  /** Rating counts per store (total ratings, not just written reviews). */
  counts: { chrome: 25, edge: 2, firefox: 4 } as const,
  /** Each store's own average — the weighted mean of these (by counts) is 4.7. */
  averages: { chrome: 4.8, edge: 5.0, firefox: 4.0 } as const
};

const CHROME_REVIEWS_URL =
  'https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid/reviews';
const EDGE_REVIEWS_URL =
  'https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn';
const OMAR_FF_URL =
  'https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/reviews/2548746/';
const ROUBY_FF_URL =
  'https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/reviews/2548748/';

const avatar = (file: string) => `/testimonials/avatars/${file}`;

/**
 * Merge live store reviews (from the Cloudflare worker snapshot) over the
 * curated baseline. Guard rails: only 5-star reviews are showcased, the
 * developer identity is never attributed, duplicates are dropped by
 * reviewer+text, and the total stays bounded. Baseline entries always win —
 * the pipeline can only add or refresh, never remove the approved set.
 */
export function mergeLiveTestimonials(
  baseline: Testimonial[],
  live: Array<{
    reviewer: string;
    rating: number;
    text: string;
    dateText?: string;
    store?: string;
  }> | undefined
): Testimonial[] {
  if (!live || live.length === 0) return baseline;
  const known = new Set(
    baseline.map((r) => `${r.store}:${r.name}:${r.text.toLowerCase().slice(0, 60)}`)
  );
  const developerPattern = /adham\s+haitham/i;
  const merged = [...baseline];
  for (const item of live) {
    if (merged.length >= 60) break;
    if (item.rating !== 5) continue;
    const reviewer = String(item.reviewer ?? '').trim();
    if (!reviewer || developerPattern.test(reviewer)) continue;
    const text = String(item.text ?? '').trim();
    if (!text) continue;
    const store = (item.store && ['chrome', 'edge', 'firefox'].includes(item.store)
      ? item.store
      : 'chrome') as Testimonial['store'];
    const key = `${store}:${reviewer}:${text.toLowerCase().slice(0, 60)}`;
    if (known.has(key)) continue;
    known.add(key);
    merged.push({
      store,
      name: reviewer,
      rating: 5,
      date: String(item.dateText ?? ''),
      text,
      href:
        store === 'firefox'
          ? 'https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/reviews/'
          : store === 'edge'
            ? 'https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn'
            : 'https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid/reviews'
    });
  }
  return merged;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    store: 'chrome', name: 'Ziad 320230025', rating: 5, date: 'Mar 8, 2026', href: CHROME_REVIEWS_URL,
    avatar: avatar('ziad-320230025.png'),
    text: "That's really impressive, I was really struggling with downloading, especially when I opened all my materials in another tab to download them, and now it only takes one click to download."
  },
  {
    store: 'chrome', name: 'ANAS HANY', rating: 5, date: 'Apr 1, 2026', href: CHROME_REVIEWS_URL,
    avatar: avatar('anas-hany.png'), helpful: '1 person found this helpful',
    text: 'very effective and fast\nthanks for this amazing work'
  },
  {
    store: 'chrome', name: 'Mohamed Alaa Eddin', rating: 5, date: 'Mar 30, 2026', href: CHROME_REVIEWS_URL,
    avatar: avatar('mohamed-alaa-eddin.png'),
    text: 'Absolute Geniuses Working on it, keep it up gentlemen'
  },
  {
    store: 'chrome', name: 'Ahmed 320230045', rating: 5, date: 'Mar 25, 2026', href: CHROME_REVIEWS_URL,
    avatar: avatar('ahmed-320230045.png'), text: 'PERFECT!'
  },
  {
    store: 'chrome', name: 'Moustafa Abdelhamid', rating: 5, date: 'Mar 3, 2026', href: CHROME_REVIEWS_URL,
    avatar: avatar('moustafa-abdelhamid.png'), text: 'Best extension I have ever seen'
  },
  {
    store: 'chrome', name: 'Itz_Mt3l', rating: 5, date: 'Jan 16, 2026', href: CHROME_REVIEWS_URL,
    avatar: avatar('itz-mt3l.png'), helpful: '1 person found this helpful',
    text: 'that was actually helpful!! thanks'
  },
  {
    store: 'chrome', name: 'Mahmoud Elbahie', rating: 5, date: 'Dec 21, 2025', href: CHROME_REVIEWS_URL,
    avatar: avatar('mahmoud-elbahie.png'),
    text: 'it works perfectly and made my learning process much faster'
  },
  {
    store: 'chrome', name: 'Beedo Beedo', rating: 5, date: 'Dec 20, 2025', href: CHROME_REVIEWS_URL,
    avatar: avatar('beedo-beedo.png'), text: 'Best extension ever. Please download !!!!'
  },
  {
    store: 'chrome', name: 'Omar Khaled', rating: 5, date: 'Dec 19, 2025', href: CHROME_REVIEWS_URL,
    avatar: avatar('omar-khaled.png'), text: 'working perfectly and saves a lot of time'
  },
  {
    store: 'chrome', name: 'Amr Hendawy', rating: 5, date: 'Dec 19, 2025', href: CHROME_REVIEWS_URL,
    avatar: avatar('amr-hendawy.png'),
    text: 'This saves me a ton of headache when I download the study material from google classroom.'
  },
  {
    store: 'chrome', name: 'Delroy P', rating: 5, date: 'Aug 4, 2026', href: CHROME_REVIEWS_URL,
    avatar: avatar('delroy-p.png'), text: 'Just Works. ONE CLICK , YAY!'
  },
  {
    store: 'chrome', name: 'Muhammad Ukasha', rating: 5, date: 'Jun 15, 2026', href: CHROME_REVIEWS_URL,
    avatar: avatar('muhammad-ukasha.png'), text: 'Easy to use, Fast, Efficient and free.'
  },
  {
    store: 'chrome', name: 'B TED', rating: 5, date: 'Jun 8, 2026', href: CHROME_REVIEWS_URL,
    avatar: avatar('b-ted.png'), text: 'DUDE PERFECT'
  },
  {
    store: 'chrome', name: 'Ashraful Islam', rating: 5, date: 'Sep 7, 2026', href: CHROME_REVIEWS_URL,
    avatar: avatar('ashraful-islam.png'), text: 'thanks broo.'
  },
  {
    store: 'chrome', name: 'Adham Ahmed', rating: 5, date: 'Feb 26, 2026', href: CHROME_REVIEWS_URL,
    avatar: avatar('adham-ahmed.png'), text: 'very helpful'
  },
  {
    store: 'chrome', name: 'Adham 320230021', rating: 5, date: 'Dec 19, 2025', href: CHROME_REVIEWS_URL,
    avatar: avatar('adham-320230021.png'),
    text: 'it is really useful and made my downloading process faster'
  },
  {
    store: 'edge', name: 'Mohamed', rating: 5, date: 'Feb 16, 2026', href: EDGE_REVIEWS_URL,
    initial: 'M', initialBg: 'linear-gradient(135deg, #0078d4, #005a9e)',
    text: 'this was very helpful'
  },
  {
    store: 'firefox', name: 'Omar', rating: 5, date: 'Jan 4, 2026', href: OMAR_FF_URL,
    initial: 'O', initialBg: 'linear-gradient(135deg, #ff9500, #ff7139)',
    text: 'Best extension ever. Please download !!!!'
  },
  {
    store: 'firefox', name: 'rouby', rating: 5, date: 'Jan 4, 2026', href: ROUBY_FF_URL,
    initial: 'R', initialBg: 'linear-gradient(135deg, #ff9500, #ff7139)',
    rtl: true, gloss: 'Egyptian Arabic: \u201Cabsolutely awesome\u201D',
    text: 'جامد فشخ'
  }
];
