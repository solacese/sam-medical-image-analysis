import type { AppConfig } from './types';

export const APP_CONFIG: AppConfig = {
  videoTopic: import.meta.env.VITE_VIDEO_TOPIC || 'gehc/mri/scanner/feed',
  statusTopic: import.meta.env.VITE_STATUS_TOPIC || 'gehc/mri/scanner/status',
  solace: {
    url: import.meta.env.VITE_SOLACE_URL || 'ws://localhost:8008',
    vpnName: import.meta.env.VITE_SOLACE_VPN || 'default',
    username: import.meta.env.VITE_SOLACE_USERNAME || 'default',
    password: import.meta.env.VITE_SOLACE_PASSWORD || 'default'
  }
};

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export const SESSION_ID_ENABLED = import.meta.env.VITE_SESSION_ID_ENABLED === 'true';
