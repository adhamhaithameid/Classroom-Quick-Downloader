/* Pointer-tracked glass sheen: feeds --card-mx/--card-my (percent of the
   element box) so a radial specular highlight can follow the cursor, the
   same reaction the navbar's pointer sheen gives the glass bar. Writes are
   throttled and the rect is cached on pointerenter, mirroring the navbar,
   so scrolling a busy page never forces per-event layout reads. */
export function glassSheen(node: HTMLElement): { destroy(): void } {
  let rect: DOMRect | null = null;
  let lastWrite = 0;

  function handlePointerEnter(): void {
    rect = node.getBoundingClientRect();
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!rect || !rect.width || !rect.height) return;
    const now = performance.now();
    if (now - lastWrite < 50) return;
    lastWrite = now;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    node.style.setProperty('--card-mx', `${x.toFixed(1)}%`);
    node.style.setProperty('--card-my', `${y.toFixed(1)}%`);
  }

  function handlePointerLeave(): void {
    rect = null;
  }

  node.addEventListener('pointerenter', handlePointerEnter);
  node.addEventListener('pointermove', handlePointerMove);
  node.addEventListener('pointerleave', handlePointerLeave);

  return {
    destroy(): void {
      node.removeEventListener('pointerenter', handlePointerEnter);
      node.removeEventListener('pointermove', handlePointerMove);
      node.removeEventListener('pointerleave', handlePointerLeave);
    }
  };
}
