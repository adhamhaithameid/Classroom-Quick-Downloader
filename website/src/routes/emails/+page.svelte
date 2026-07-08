<script lang="ts">
  import SeoMeta from '$lib/components/SeoMeta.svelte';

  export let data: {
    emailHeadStyles: string;
    emailBodyHtml: string;
  };
</script>

<SeoMeta
  title="Email Preview - Classroom Quick Downloader"
  description="Browser preview of the Classroom Quick Downloader advertisement email."
  path="/emails"
  keywords="classroom quick downloader email, classroom extension email ad"
  noindex={true}
/>

<section class="emails-page">
  <div class="emails-frame">
    <div class="email-canvas" aria-label="Classroom Quick Downloader email preview">
      {@html `<style>${data.emailHeadStyles}</style>${data.emailBodyHtml}`}
    </div>
  </div>
</section>

<style>
  .emails-page {
    width: 100%;
    padding: 12px 0 12px;
    overflow-x: clip;
  }

  .emails-frame {
    width: min(100%, 760px);
    margin: 0 auto;
    max-width: 100%;
    overflow-x: clip;
  }

  .email-canvas {
    width: 100%;
    border-radius: 18px;
    overflow: clip;
    box-shadow: none;
    color-scheme: only light;
    background: #f0f4f0;
  }

  :global(.email-canvas *),
  :global(.email-canvas *::before),
  :global(.email-canvas *::after) {
    box-sizing: border-box;
  }

  :global(.email-canvas table) {
    max-width: 100% !important;
  }

  :global(.email-canvas table[width='600']) {
    width: 100% !important;
    max-width: 600px !important;
  }

  :global(.email-canvas td[style*='padding:24px 0']) {
    padding-top: 8px !important;
    padding-bottom: 8px !important;
  }

  :global(.email-canvas img) {
    max-width: 100% !important;
    height: auto !important;
  }

  @media (max-width: 768px) {
    .emails-page {
      padding: 4px 0 10px;
    }

    .email-canvas {
      border-radius: 14px;
    }

    :global(.email-canvas td[style*='padding:48px 40px']) {
      padding: 32px 24px !important;
    }

    :global(.email-canvas td[style*='padding:32px 40px']) {
      padding: 24px 20px !important;
    }

    :global(.email-canvas td[style*='padding:24px 40px']) {
      padding: 16px 20px !important;
    }

    :global(.email-canvas td[style*='padding:20px 40px']) {
      padding: 16px 20px !important;
    }

    :global(.email-canvas td[style*='padding:0 40px']) {
      padding: 0 20px !important;
    }

    :global(.email-canvas td[width='48%']) {
      display: block;
      width: 100% !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
    }

    :global(.email-canvas td[width='4%']),
    :global(.email-canvas td[width='2%']) {
      display: none;
    }

    :global(.email-canvas td[width='49%']) {
      display: block;
      width: 100% !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      margin-bottom: 14px;
    }

    :global(.email-canvas td[width='25%']) {
      display: inline-block;
      width: 50% !important;
      vertical-align: top;
      border-right: none !important;
      margin-bottom: 10px;
    }

    :global(.email-canvas td[align='center'][style*='padding:0 5px']) {
      display: block;
      width: 100% !important;
      padding: 6px 0 !important;
    }
  }

  @media (max-width: 480px) {
    .emails-page {
      padding: 0 0 8px;
    }

    .email-canvas {
      border-radius: 12px;
    }

    :global(.email-canvas td[style*='padding:0 20px']) {
      padding-left: 10px !important;
      padding-right: 10px !important;
    }

    :global(.email-canvas table[style*='padding:0 20px']) {
      padding-left: 10px !important;
      padding-right: 10px !important;
    }

    :global(.email-canvas td[style*='padding:48px 40px']) {
      padding: 24px 16px !important;
    }

    :global(.email-canvas td[style*='padding:32px 40px']) {
      padding: 20px 16px !important;
    }

    :global(.email-canvas td[style*='padding:24px 40px']) {
      padding: 12px 16px !important;
    }

    :global(.email-canvas td[style*='padding:20px 40px']) {
      padding: 12px 16px !important;
    }

    :global(.email-canvas td[style*='padding:40px']) {
      padding: 20px 16px !important;
    }

    :global(.email-canvas td[style*='padding:0 40px']) {
      padding: 0 16px !important;
    }

    :global(.email-canvas h1[style*='font-size:42px']) {
      font-size: 28px !important;
    }

    :global(.email-canvas h2[style*='font-size:30px']) {
      font-size: 22px !important;
    }

    :global(.email-canvas h2[style*='font-size:28px']) {
      font-size: 20px !important;
    }

    :global(.email-canvas p[style*='font-size:17px']) {
      font-size: 14px !important;
    }

    :global(.email-canvas p[style*='font-size:16px']) {
      font-size: 13px !important;
    }

    :global(.email-canvas p[style*='font-size:15px']) {
      font-size: 13px !important;
    }

    :global(.email-canvas p[style*='font-size:14px']) {
      font-size: 12px !important;
    }

    :global(.email-canvas img[width='72']) {
      width: 56px !important;
      height: 56px !important;
    }
  }
</style>
