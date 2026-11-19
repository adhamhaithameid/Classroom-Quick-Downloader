import { createRoot } from 'react-dom/client';
import { OptionsApp } from './OptionsApp';
import { loadEngineBase } from '../../src/engines/engine-base';

// 82gr: OptionsApp reads isApiConfigured() on first render, which depends on
// the persisted engineBase flag — load it first (never rejects).
void loadEngineBase().then(() => {
  createRoot(document.getElementById('root')!).render(<OptionsApp />);
});
