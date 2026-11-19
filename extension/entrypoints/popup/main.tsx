import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';
import { loadEngineBase } from '../../src/engines/engine-base';
// The old './style.css' import (Vite dark-theme Inter boilerplate) is gone —
// it conflicted with App.css's font stack (audit finding 1). App.css owns
// popup styling via App.tsx.

// 82gr: App reads isApiConfigured() on first render, which depends on the
// persisted engineBase flag — load it first (never rejects).
void loadEngineBase().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
});
