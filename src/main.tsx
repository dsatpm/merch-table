import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';
import { App } from './App';
import { initNativeShell } from './native';
import './styles.css';

if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });
void initNativeShell();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
