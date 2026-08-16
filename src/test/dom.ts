// @ts-expect-error jsdom is installed by the test harness without its separate declaration package.
import { JSDOM } from "jsdom";

if (typeof globalThis.document === "undefined") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window, writable: true },
    document: { configurable: true, value: dom.window.document, writable: true },
    navigator: { configurable: true, value: dom.window.navigator, writable: true },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement, writable: true },
    MutationObserver: { configurable: true, value: dom.window.MutationObserver, writable: true },
    getComputedStyle: {
      configurable: true,
      value: dom.window.getComputedStyle.bind(dom.window),
      writable: true,
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true, writable: true },
  });
}
