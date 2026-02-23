<script lang="ts">
  import AnimatedNumericText from '$lib/components/AnimatedNumericText.svelte';

  const faqs = [
    {
      q: 'Is Classroom Quick Downloader safe to use?',
      a: 'Yes! CQD is fully open-source — every line of code is public on GitHub. It has been reviewed by thousands of users across Chrome, Firefox, and Edge. We collect no personal data and use no tracking cookies.'
    },
    {
      q: 'Which browsers are supported?',
      a: 'CQD works on all Chromium-based browsers (Chrome, Edge, Brave, Opera, Vivaldi, Arc, and more), as well as Firefox. The only major browser not supported is Safari, which doesn\'t support the required extension APIs.'
    },
    {
      q: 'Does it work with Google Workspace (G Suite) accounts?',
      a: 'Yes! CQD works with both personal Google accounts and Google Workspace (G Suite) accounts used by schools and organizations.'
    },
    {
      q: 'How does batch downloading work?',
      a: 'When you open a class or assignment in Google Classroom, CQD adds download buttons next to each file. You can click individual files or use the "Download All" button to batch-download every attachment at once.'
    },
    {
      q: 'Does CQD collect or share my data?',
      a: 'No. CQD does not track you, store cookies, or collect any personal information. The only data we count is anonymous download statistics to show how many people use the extension — no user identities are linked.'
    },
    {
      q: 'Is it free?',
      a: 'Yes, CQD is completely free and always will be. It\'s an open-source project built by a student for students.'
    },
    {
      q: 'Can I contribute to the project?',
      a: 'Absolutely! CQD is open-source on GitHub. You can report bugs, suggest features, or submit pull requests. We welcome all contributions from the community.'
    },
    {
      q: 'Why do I need to grant permissions?',
      a: 'CQD needs access to Google Classroom pages (classroom.google.com) to detect downloadable files and add download buttons. It also needs download permissions to save files to your device. No other permissions are required.'
    },
    {
      q: 'What happens to my files after downloading?',
      a: 'Downloaded files are saved directly to your device\'s default downloads folder (or a folder you choose). CQD never uploads, copies, or sends your files anywhere.'
    },
    {
      q: 'How do I uninstall the extension?',
      a: 'You can remove CQD like any browser extension: go to your browser\'s Extensions page, find Classroom Quick Downloader, and click Remove. We\'d appreciate it if you let us know why in our feedback form so we can improve!'
    }
  ];

  let openIndex: number | null = null;

  function toggle(i: number): void {
    openIndex = openIndex === i ? null : i;
  }
</script>

<svelte:head>
  <title>FAQ – Classroom Quick Downloader</title>
  <meta name="description" content="Frequently asked questions about Classroom Quick Downloader. Learn about browser support, privacy, permissions, and more." />
</svelte:head>

<section class="faq-page card">
  <div class="faq-header">
    <div class="icon-box">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gc-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    </div>
    <div>
      <h1>Frequently Asked Questions</h1>
      <p>Everything you need to know about Classroom Quick Downloader</p>
    </div>
  </div>

  <div class="faq-list">
    {#each faqs as faq, i}
      <button
        class="faq-item"
        class:open={openIndex === i}
        type="button"
        on:click={() => toggle(i)}
        aria-expanded={openIndex === i}
      >
        <div class="faq-question">
          <span class="faq-q-text"><AnimatedNumericText text={faq.q} /></span>
          <span class="faq-chevron">{openIndex === i ? '−' : '+'}</span>
        </div>
        {#if openIndex === i}
          <p class="faq-answer"><AnimatedNumericText text={faq.a} /></p>
        {/if}
      </button>
    {/each}
  </div>
</section>

<style>
  .faq-page {
    padding: 32px;
  }

  .faq-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
  }

  .icon-box {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--gc-green-bg);
    border: 1px solid rgba(26, 139, 85, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  .faq-header p {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 14px;
  }

  .faq-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .faq-item {
    text-align: left;
    background: white;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0;
    cursor: pointer;
    width: 100%;
    transition: all 0.25s ease;
    box-shadow: var(--shadow-sm);
  }

  .faq-item:hover {
    border-color: var(--border-hover);
  }

  .faq-item.open {
    border-color: rgba(26, 139, 85, 0.25);
    box-shadow: var(--shadow);
  }

  .faq-question {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    gap: 16px;
  }

  .faq-q-text {
    font-weight: 600;
    font-size: 15px;
    color: var(--text);
    line-height: 1.5;
  }

  .faq-chevron {
    font-size: 20px;
    color: var(--gc-green);
    font-weight: 700;
    flex-shrink: 0;
    width: 24px;
    text-align: center;
  }

  .faq-answer {
    margin: 0;
    padding: 0 20px 16px;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.7;
    animation: slideDown 0.2s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
