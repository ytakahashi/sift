import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App';
import { createClientDependencies } from './composition/createClientDependencies';

const dependencies = createClientDependencies();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App dependencies={dependencies} />
  </StrictMode>,
);
