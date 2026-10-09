import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';
// The old './style.css' import (Vite dark-theme Inter boilerplate) is gone —
// it conflicted with App.css's font stack (audit finding 1). App.css owns
// popup styling via App.tsx.

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
