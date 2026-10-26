/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_TRANSLATE_ENDPOINT?: string;
  readonly VITE_ROUTER?: 'hash' | 'browser';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
