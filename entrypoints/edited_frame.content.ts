// filepath: entrypoints/edited_frame.content.ts
import { EDIT_ICON_SVG_RAW, COMMENT_ICON_URL } from './content/icons';
import { injectStyles } from './content/styles';
import { isPageDark } from './content/theme';
import { t } from './content/i18n';

// Selector for the main stream card
const POST_SELECTOR = 'div[data-stream-item-id]';
const EDITED_ATTR = 'data-cqd-edited-processed';

// 🔴 NEW: debounce flag so we don't rescan on every tiny mutation
let editedScanScheduled = false;


export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    injectStyles();
    scanForEditedPosts();

    // --- STRATEGY 1: MUTATION OBSERVER (Reacts to DOM changes) ---
    const observer = new MutationObserver(() => {
      // ✅ Debounce: only schedule *one* scan per frame
      if (editedScanScheduled) return;
      editedScanScheduled = true;

      requestAnimationFrame(() => {
        editedScanScheduled = false;
        scanForEditedPosts();
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'title'],
    });

    // Heartbeat
    setInterval(() => {
      scanForEditedPosts();
    }, 1000);

    // URL watcher
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(scanForEditedPosts, 500);
        setTimeout(scanForEditedPosts, 1500);
      }
    }).observe(document, { subtree: true, childList: true });
  },
});

function scanForEditedPosts() {
  try {
    const direction = getPageDirection();
    document.body.setAttribute('data-cqd-dir', direction);

    const editedWord = t('edited').toLowerCase();
    const posts = document.querySelectorAll<HTMLElement>(POST_SELECTOR);

    posts.forEach((post) => {
      let alreadyProcessed = false;

      if (post.hasAttribute(EDITED_ATTR)) {
        const hasEditedOverlay =
          !!post.querySelector('.cqd-overlay-container.cqd-edited') ||
          !!post.querySelector('.cqd-edited-badge') ||
          !!post.querySelector('.cqd-both-badge');

        if (!hasEditedOverlay) {
          post.removeAttribute(EDITED_ATTR);
        } else {
          alreadyProcessed = true;
        }
      }

      if (!alreadyProcessed) {
        const candidates = Array.from(
          post.querySelectorAll<HTMLElement>('a, span, div[aria-label]')
        );

        let found = false;
        let diffText: string | null = null;

        for (const el of candidates) {
          const text = (el.textContent || '').trim();
          const aria = (el.getAttribute('aria-label') || '').trim();
          const title = (el.getAttribute('title') || '').trim();

          const combined = `${text} ${aria} ${title}`.toLowerCase();

          if (!combined.includes(editedWord)) continue;

          let sourceText = text;
          if (
            sourceText.length < 5 ||
            !sourceText.toLowerCase().includes(editedWord)
          ) {
            sourceText = aria || title || text;
          }

          diffText = calculateEditDiff(sourceText, editedWord) ?? '+0';
          found = true;
          break;
        }

        if (found && diffText !== null) {
          post.setAttribute(EDITED_ATTR, 'true');
          createEditedOverlay(post, diffText);
        }
      }

      // Always try to merge into BOTH pill if both states are present
      upgradeCombinedBadge(post);
    });
  } catch {
    // Silent fail
  }
}

/**
 * Calculates the difference in days between created and edited date.
 *
 * Example:
 *  "Oct 1 (Edited Oct 5)"  -> "+4"
 *  same-day edit           -> "+0"
 *
 * If parsing fails, returns null and caller falls back to "+0".
 */
function calculateEditDiff(fullText: string, _keyword: string): string | null {
  try {
    const monthRegex =
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/gi;

    const matches = fullText.match(monthRegex);
    const currentYear = new Date().getFullYear();

    if (!matches || matches.length === 0) {
      return null;
    }

    const parseDate = (s: string): Date | null => {
      const d = new Date(`${s.trim()} ${currentYear}`);
      return isNaN(d.getTime()) ? null : d;
    };

    let createdDate: Date | null = null;
    let editedDate: Date | null = null;

    if (matches.length >= 2) {
      createdDate = parseDate(matches[0]);
      editedDate = parseDate(matches[1]);
    } else {
      createdDate = parseDate(matches[0]);
      editedDate = createdDate;
    }

    if (!createdDate || !editedDate) return null;

    let diffDays = Math.floor(
      (editedDate.getTime() - createdDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) diffDays = 0;

    return `+${diffDays}`;
  } catch {
    return null;
  }
}

function createEditedOverlay(post: HTMLElement, diffText: string) {
  const computed = window.getComputedStyle(post);

  if (computed.position === 'static') post.style.position = 'relative';
  post.style.setProperty('overflow', 'visible', 'important');
  post.style.setProperty('contain', 'none', 'important');
  post.style.zIndex = '1';

  // Frame (reuse if comment script already created it)
  let overlay = post.querySelector<HTMLDivElement>('.cqd-overlay-container');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'cqd-overlay-container cqd-edited';
    overlay.style.borderRadius = computed.borderRadius || '8px';
    if (isPageDark()) overlay.classList.add('cqd-theme-dark');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        const link = post.querySelector<HTMLElement>('a[href*="/details/"], h2 a');
        if (link) link.click();
        else post.click();
      }
    });

    post.appendChild(overlay);
  } else {
    overlay.classList.add('cqd-edited');
    if (isPageDark()) overlay.classList.add('cqd-theme-dark');
  }

  // If BOTH pill already exists, don't create a separate edited pill
  if (post.querySelector('.cqd-both-badge')) {
    return;
  }

  // Remove any older edited pill to avoid duplicates
  const existingEditedBadge = post.querySelector<HTMLElement>('.cqd-edited-badge');
  existingEditedBadge?.remove();

  const pill = document.createElement('div');
  pill.className = 'cqd-edited-badge';
  if (isPageDark()) pill.classList.add('cqd-theme-dark');

  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'cqd-edited-icon';
  iconWrapper.innerHTML = EDIT_ICON_SVG_RAW;
  pill.appendChild(iconWrapper);

  const content = document.createElement('div');
  content.className = 'cqd-edited-content';

  const diffSpan = document.createElement('span');
  diffSpan.className = 'cqd-diff-val';
  diffSpan.textContent = diffText; // "+4", "+0", etc.
  content.appendChild(diffSpan);

  pill.appendChild(content);
  post.appendChild(pill);
}

function getPageDirection(): 'ltr' | 'rtl' {
  const docDir = document.documentElement.dir || document.body.dir;
  return docDir === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * Merge comments badge + edited badge into a single BOTH pill
 * with:
 *  - comment icon + count
 *  - "+"
 *  - divider
 *  - edited icon + "+N"
 */
function upgradeCombinedBadge(post: HTMLElement) {
  const overlay = post.querySelector<HTMLDivElement>('.cqd-overlay-container');
  const commentBadge = post.querySelector<HTMLElement>('.cqd-comment-badge');
  const editedBadge = post.querySelector<HTMLElement>('.cqd-edited-badge');
  let bothBadge = post.querySelector<HTMLElement>('.cqd-both-badge');

  // Does this post have comments & edited info?
  const hasComments =
    !!commentBadge || post.hasAttribute('data-cqd-processed');
  const hasEdited =
    !!editedBadge || post.hasAttribute('data-cqd-edited-processed');

  // If it doesn't truly have BOTH, no combined pill
  if (!hasComments || !hasEdited) {
    // If we somehow had an old BOTH pill, clean it up
    bothBadge?.remove();
    return;
  }

  // --------- Extract VALUES ---------

  // 1) Comment count
  let commentCount = '0';
  const commentLabel = commentBadge?.querySelector<HTMLElement>('.cqd-badge-label');
  if (commentLabel?.textContent?.trim()) {
    commentCount = commentLabel.textContent.trim();
  } else if (bothBadge) {
    const existing = bothBadge.querySelector<HTMLElement>('.cqd-both-value-comment');
    if (existing?.textContent?.trim()) {
      commentCount = existing.textContent.trim();
    }
  }

  // 2) Edit diff "+N"
  let diffText = '+0';
  const diffSpan = editedBadge?.querySelector<HTMLElement>('.cqd-diff-val');
  if (diffSpan?.textContent?.trim()) {
    diffText = diffSpan.textContent.trim();
  } else if (bothBadge) {
    const existing = bothBadge.querySelector<HTMLElement>('.cqd-both-value-edited');
    if (existing?.textContent?.trim()) {
      diffText = existing.textContent.trim();
    }
  }

  // If BOTH badge already exists, just sync its numbers and exit
  if (bothBadge) {
    const cc = bothBadge.querySelector<HTMLElement>('.cqd-both-value-comment');
    const dd = bothBadge.querySelector<HTMLElement>('.cqd-both-value-edited');
    if (cc) cc.textContent = commentCount;
    if (dd) dd.textContent = diffText;
    return;
  }

  // --------- Build the merged pill ---------

  // Remove separate comment/edited badges so we only have the combined one
  commentBadge?.remove();
  editedBadge?.remove();

  // Ensure overlay exists (in case comments script didn't make one)
  if (!overlay) {
    const computed = window.getComputedStyle(post);
    const newOverlay = document.createElement('div');
    newOverlay.className = 'cqd-overlay-container';
    newOverlay.style.borderRadius = computed.borderRadius || '8px';

    newOverlay.addEventListener('click', (e) => {
      if (e.target === newOverlay) {
        const link = post.querySelector<HTMLElement>('a[href*="/details/"], h2 a');
        if (link) link.click();
        else post.click();
      }
    });

    post.appendChild(newOverlay);
  }

  bothBadge = document.createElement('div');
  bothBadge.className = 'cqd-both-badge';

  // Section 1: Comments (icon + number)
  const commentsSection = document.createElement('div');
  commentsSection.className = 'cqd-both-section cqd-both-comments';

  const commentIcon = document.createElement('div');
  commentIcon.className = 'cqd-both-icon cqd-both-icon-comment';
  commentIcon.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;
  commentsSection.appendChild(commentIcon);

  const commentValue = document.createElement('span');
  commentValue.className = 'cqd-both-value cqd-both-value-comment';
  commentValue.textContent = commentCount;
  commentsSection.appendChild(commentValue);

  // Middle: "+"
  const plus = document.createElement('div');
  plus.className = 'cqd-both-plus';
  plus.textContent = '+';

  // Divider (only visible on hover)
  const divider = document.createElement('div');
  divider.className = 'cqd-both-divider';

  // Section 2: Edited (icon + +N)
  const editedSection = document.createElement('div');
  editedSection.className = 'cqd-both-section cqd-both-edited';

  const editedIcon = document.createElement('div');
  editedIcon.className = 'cqd-both-icon cqd-both-icon-edited';
  editedIcon.innerHTML = EDIT_ICON_SVG_RAW;
  editedSection.appendChild(editedIcon);

  const diffValue = document.createElement('span');
  diffValue.className = 'cqd-both-value cqd-both-value-edited';
  diffValue.textContent = diffText;
  editedSection.appendChild(diffValue);

  // Final vertical order inside the pill:
  //  commentsSection (icon, number)
  //  plus
  //  divider
  //  editedSection (icon, +N)
  bothBadge.appendChild(commentsSection);
  bothBadge.appendChild(plus);
  bothBadge.appendChild(divider);
  bothBadge.appendChild(editedSection);

  bothBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerPostClick(post);
  });

  post.appendChild(bothBadge);
}

function triggerPostClick(post: HTMLElement) {
  const titleLink = post.querySelector<HTMLElement>('a[href*="/details/"], h2 a');
  if (titleLink) {
    titleLink.click();
  } else {
    post.click();
  }
}
