/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_BACKEND_URL?: string;
    readonly VITE_ALLOWED_TELEGRAM_USERNAMES?: string;
    readonly VITE_MOCK_TELEGRAM_USERNAME?: string;
  }
}

export {};
