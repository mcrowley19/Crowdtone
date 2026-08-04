"use client";

import { useEffect } from "react";

/**
 * Entrance-only scroll reveal for anything marked `data-reveal`.
 *
 * Rendered once per page and outputs no DOM of its own, so reveal classes sit
 * directly on the real elements — a wrapper <div> between <ol> and <li> (or
 * <dl> and its rows) would be invalid HTML.
 *
 * Content must never be permanently invisible, so there are three safety nets:
 * reduced-motion reveals immediately, anything already on screen reveals on the
 * first observer callback, and a timeout reveals whatever is left in case the
 * observer never fires.
 */
export function RevealObserver() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (nodes.length === 0) return;

    const revealAll = () => nodes.forEach((n) => n.classList.add("revealed"));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    nodes.forEach((n) => observer.observe(n));

    const failsafe = window.setTimeout(revealAll, 2500);
    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  return null;
}
