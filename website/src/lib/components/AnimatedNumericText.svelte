<script lang="ts">
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';

  export let text = '';
  export let useGrouping = false;
  export let animated = false;

  type Segment =
    | { kind: 'text'; value: string }
    | { kind: 'number'; value: number; format: Intl.NumberFormatOptions };

  function buildSegments(input: string): Segment[] {
    if (!input) return [];
    const out: Segment[] = [];
    const regex = /\d+/g;
    let lastIndex = 0;
    let match = regex.exec(input);

    while (match) {
      const [raw] = match;
      const index = match.index;
      if (index > lastIndex) {
        out.push({ kind: 'text', value: input.slice(lastIndex, index) });
      }
      out.push({
        kind: 'number',
        value: Number(raw),
        format: {
          useGrouping,
          minimumIntegerDigits: raw.length > 1 && raw.startsWith('0') ? raw.length : 1
        }
      });
      lastIndex = index + raw.length;
      match = regex.exec(input);
    }

    if (lastIndex < input.length) {
      out.push({ kind: 'text', value: input.slice(lastIndex) });
    }

    return out;
  }

  $: segments = buildSegments(text);
</script>

{#each segments as segment}
  {#if segment.kind === 'number'}
    <AnimatedNumber value={segment.value} format={segment.format} {animated} />
  {:else}
    {segment.value}
  {/if}
{/each}
