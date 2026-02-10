import { describe, expect, it } from 'vitest';
import {
  UNIFIED_POST_SELECTOR,
  getCurrentTab,
  isClassworkPost,
  isClassworkTab,
  isStreamPost,
  isStreamTab,
  isTopicView,
} from '../entrypoints/content/tab-detector';

function setPath(path: string) {
  window.history.pushState({}, '', path);
}

describe('content tab detector', () => {
  it('detects current tab from known classroom route patterns', () => {
    setPath('/w/class1/t/all');
    expect(getCurrentTab()).toBe('classwork');
    expect(isClassworkTab()).toBe(true);

    setPath('/r/class1/sort-last-name');
    expect(getCurrentTab()).toBe('people');

    setPath('/u/0/g/class1');
    expect(getCurrentTab()).toBe('grades');

    setPath('/c/class1');
    expect(getCurrentTab()).toBe('stream');
    expect(isStreamTab()).toBe(true);

    setPath('/unknown');
    expect(getCurrentTab()).toBe('unknown');
  });

  it('detects topic view and classwork post variants', () => {
    setPath('/w/class1/tc/topic1');
    expect(isTopicView()).toBe(true);

    const liPost = document.createElement('li');
    liPost.className = 'tfGBod';
    expect(isClassworkPost(liPost)).toBe(true);

    const topicPost = document.createElement('div');
    topicPost.className = 'sVNOQ';
    topicPost.setAttribute('data-stream-item-id', '1');
    expect(isClassworkPost(topicPost)).toBe(true);

    const dataPost = document.createElement('div');
    dataPost.setAttribute('data-stream-item-id', '1');
    dataPost.setAttribute('data-material-parent-id', '2');
    expect(isClassworkPost(dataPost)).toBe(true);
  });

  it('identifies stream posts and unified selector', () => {
    const streamPost = document.createElement('div');
    streamPost.setAttribute('data-stream-item-id', 'x');
    expect(isStreamPost(streamPost)).toBe(true);
    expect(UNIFIED_POST_SELECTOR).toBe('[data-stream-item-id]');

    const nonPost = document.createElement('span');
    expect(isStreamPost(nonPost as unknown as HTMLElement)).toBe(false);
  });
});
