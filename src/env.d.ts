/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_BACKEND_URL?: string;
    readonly VITE_ALLOWED_TELEGRAM_USERNAMES?: string;
    readonly VITE_MOCK_TELEGRAM_USERNAME?: string;
    readonly VITE_TG_BOT_USERNAME?: string;
    readonly VITE_TG_APP_SHORT_NAME?: string;
    readonly VITE_TG_APP_MODE?: "compact" | "fullscreen";
  }
}

export {};
