import { useEffect, useState } from 'react';
import { subscribeFixture } from '../fixtures/fixture-chrome';

/** Re-render hook for panels that must follow live fixture mutations. */
export function useFixtureVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribeFixture(() => setVersion((v) => v + 1)), []);
  return version;
}
