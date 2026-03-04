<script lang="ts">
  import SeoContentPage from '$lib/components/SeoContentPage.svelte';
  import { seoPages } from '$lib/content/seoPages';
</script>

<SeoContentPage config={seoPages.featured} />
