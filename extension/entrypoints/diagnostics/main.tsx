import { createRoot } from 'react-dom/client';
import { DiagnosticsApp } from './DiagnosticsApp';

const root = createRoot(document.getElementById('root')!);
root.render(<DiagnosticsApp />);
