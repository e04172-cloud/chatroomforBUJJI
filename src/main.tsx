import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { trackViewport } from './viewport';
import './styles/theme.css';

trackViewport();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
