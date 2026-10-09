/** Hash router. Formats: '' | '#/' → map, '#popup=<id>', '#page=<id>', '#options=<id>'. */

export type Route =
  | { kind: 'map' }
  | { kind: 'popup'; stateId: string }
  | { kind: 'classroom'; pageId: string; params: URLSearchParams }
  | { kind: 'options'; stateId: string };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  if (raw.startsWith('popup=')) {
    return { kind: 'popup', stateId: decodeURIComponent(raw.slice('popup='.length)) };
  }
  if (raw.startsWith('page=')) {
    const rest = raw.slice('page='.length);
    const amp = rest.indexOf('&');
    const pageId = amp === -1 ? rest : rest.slice(0, amp);
    const params = new URLSearchParams(amp === -1 ? '' : rest.slice(amp + 1));
    return { kind: 'classroom', pageId: decodeURIComponent(pageId), params };
  }
  if (raw.startsWith('options=')) {
    return { kind: 'options', stateId: decodeURIComponent(raw.slice('options='.length)) };
  }
  return { kind: 'map' };
}

export function popupHash(stateId: string): string {
  return `#popup=${encodeURIComponent(stateId)}`;
}

export function classroomHash(pageId: string, demo?: string): string {
  return demo ? `#page=${encodeURIComponent(pageId)}&demo=${encodeURIComponent(demo)}` : `#page=${encodeURIComponent(pageId)}`;
}

export function optionsHash(stateId: string): string {
  return `#options=${encodeURIComponent(stateId)}`;
}
