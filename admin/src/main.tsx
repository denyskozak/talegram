import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.js';
import { TrpcProvider } from './api/trpcProvider.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TrpcProvider>
        <App />
      </TrpcProvider>
    </BrowserRouter>
  </StrictMode>,
);
