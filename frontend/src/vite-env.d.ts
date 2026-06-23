/// <reference types="vite/client" />

interface Window {
  hseDesktop?: {
    openExternal(url: string): Promise<boolean>;
  };
}