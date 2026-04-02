import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { env } from '@/shared/config';
import './styles.css';


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
