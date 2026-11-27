import { vi } from "vitest";
Object.defineProperty(window, "matchMedia", {
  value: () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
});
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Object.defineProperty(window, "confirm", { value: () => true, writable: true });
