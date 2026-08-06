"use client";

import { useEffect } from "react";

/**
 * The landing page's two motion drivers, rendered once and outputting no DOM
 * of their own (a wrapper element between <dl> and its rows would be invalid
 * HTML, so classes sit directly on the real elements).
 *
 * 1. Entrance reveal — anything marked `data-reveal` gets `.revealed` when it
 *    enters the viewport. What that class *does* varies per element (rules
 *    draw, slugs slide, prose inks in) — the variety lives in CSS.
 * 2. Scroll progress — anything marked `data-scrollwords` gets a `--p` custom
 *    property (0→1) as it crosses the viewport; its word spans read `--p`
 *    against their own `--i` to ink in one at a time.
 *
 * Content must never be permanently invisible, so there are safety nets:
 * reduced-motion reveals immediately (and pins --p to 1), anything already on
 * screen reveals on the first observer callback, and a timeout reveals
 * whatever is left in case the observer never fires.
 */
export function RevealObserver() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const bands = Array.from(document.querySelectorAll<HTMLElement>("[data-scrollwords]"));

    const revealAll = () => {
      nodes.forEach((n) => n.classList.add("revealed"));
      bands.forEach((b) => b.style.setProperty("--p", "1"));
    };

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

    // The band's ink follows the scroll position directly — progress runs
    // 0→1 while the element travels from the lower quarter of the viewport
    // to its upper third, which reads as the press rolling over the line.
    let ticking = false;
    const drive = () => {
      ticking = false;
      const vh = window.innerHeight;
      for (const band of bands) {
        const rect = band.getBoundingClientRect();
        const start = vh * 0.92;
        const end = vh * 0.38;
        const p = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
        band.style.setProperty("--p", p.toFixed(3));
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(drive);
      }
    };
    if (bands.length > 0) {
      drive();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
    }

    const failsafe = window.setTimeout(() => nodes.forEach((n) => n.classList.add("revealed")), 2500);
    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return null;
}
