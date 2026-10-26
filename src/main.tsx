import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { initAuth } from './lib/backend/auth';
import { initSync } from './lib/backend/sync';
import { initAccounts } from './lib/account/accounts';

// Hosts that cannot serve every path (static file hosts, embedded viewers) build with VITE_ROUTER=hash.
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter;

initAuth();
initSync();
initAccounts();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </Router>
  </React.StrictMode>,
);
