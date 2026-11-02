/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string
  readonly VITE_API_URL?: string
  readonly VITE_TIMEZONE?: string
  readonly VITE_REFRESH_INTERVAL_SECONDS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
