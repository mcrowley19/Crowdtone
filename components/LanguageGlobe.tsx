"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Where the audience actually is, on an actual globe. A tiny orthographic
 * projection in plain SVG — no map library, no tiles — spinning slowly with
 * the countries your analytics reported pinned and sized by views. Honest by
 * construction: only countries the Analytics API returned are drawn.
 */

interface CountryMeta {
  name: string;
  lat: number;
  lon: number;
  language: string;
}

const COUNTRY: Record<string, CountryMeta> = {
  US: { name: "United States", lat: 39, lon: -98, language: "English" },
  GB: { name: "United Kingdom", lat: 54, lon: -2, language: "English" },
  CA: { name: "Canada", lat: 56, lon: -106, language: "English" },
  AU: { name: "Australia", lat: -25, lon: 134, language: "English" },
  IN: { name: "India", lat: 21, lon: 78, language: "Hindi" },
  PK: { name: "Pakistan", lat: 30, lon: 69, language: "Urdu" },
  BD: { name: "Bangladesh", lat: 24, lon: 90, language: "Bengali" },
  BR: { name: "Brazil", lat: -10, lon: -52, language: "Portuguese" },
  PT: { name: "Portugal", lat: 39, lon: -8, language: "Portuguese" },
  MX: { name: "Mexico", lat: 23, lon: -102, language: "Spanish" },
  ES: { name: "Spain", lat: 40, lon: -4, language: "Spanish" },
  AR: { name: "Argentina", lat: -34, lon: -64, language: "Spanish" },
  CO: { name: "Colombia", lat: 4, lon: -73, language: "Spanish" },
  CL: { name: "Chile", lat: -33, lon: -71, language: "Spanish" },
  PE: { name: "Peru", lat: -10, lon: -76, language: "Spanish" },
  DE: { name: "Germany", lat: 51, lon: 10, language: "German" },
  AT: { name: "Austria", lat: 47, lon: 14, language: "German" },
  CH: { name: "Switzerland", lat: 47, lon: 8, language: "German" },
  FR: { name: "France", lat: 46, lon: 2, language: "French" },
  IT: { name: "Italy", lat: 42, lon: 13, language: "Italian" },
  NL: { name: "Netherlands", lat: 52, lon: 5, language: "Dutch" },
  BE: { name: "Belgium", lat: 50, lon: 4, language: "Dutch" },
  PL: { name: "Poland", lat: 52, lon: 19, language: "Polish" },
  SE: { name: "Sweden", lat: 62, lon: 15, language: "Swedish" },
  NO: { name: "Norway", lat: 62, lon: 9, language: "Norwegian" },
  DK: { name: "Denmark", lat: 56, lon: 10, language: "Danish" },
  FI: { name: "Finland", lat: 64, lon: 26, language: "Finnish" },
  CZ: { name: "Czechia", lat: 50, lon: 15, language: "Czech" },
  RO: { name: "Romania", lat: 46, lon: 25, language: "Romanian" },
  HU: { name: "Hungary", lat: 47, lon: 19, language: "Hungarian" },
  GR: { name: "Greece", lat: 39, lon: 22, language: "Greek" },
  TR: { name: "Türkiye", lat: 39, lon: 35, language: "Turkish" },
  UA: { name: "Ukraine", lat: 49, lon: 32, language: "Ukrainian" },
  RU: { name: "Russia", lat: 60, lon: 90, language: "Russian" },
  JP: { name: "Japan", lat: 36, lon: 138, language: "Japanese" },
  KR: { name: "South Korea", lat: 36, lon: 128, language: "Korean" },
  CN: { name: "China", lat: 35, lon: 103, language: "Chinese" },
  TW: { name: "Taiwan", lat: 24, lon: 121, language: "Chinese" },
  HK: { name: "Hong Kong", lat: 22, lon: 114, language: "Cantonese" },
  ID: { name: "Indonesia", lat: -2, lon: 118, language: "Indonesian" },
  PH: { name: "Philippines", lat: 13, lon: 122, language: "Filipino" },
  VN: { name: "Vietnam", lat: 16, lon: 108, language: "Vietnamese" },
  TH: { name: "Thailand", lat: 15, lon: 101, language: "Thai" },
  MY: { name: "Malaysia", lat: 4, lon: 102, language: "Malay" },
  SG: { name: "Singapore", lat: 1.4, lon: 104, language: "English" },
  SA: { name: "Saudi Arabia", lat: 24, lon: 45, language: "Arabic" },
  AE: { name: "UAE", lat: 24, lon: 54, language: "Arabic" },
  EG: { name: "Egypt", lat: 27, lon: 30, language: "Arabic" },
  IL: { name: "Israel", lat: 31, lon: 35, language: "Hebrew" },
  NG: { name: "Nigeria", lat: 9, lon: 8, language: "English" },
  KE: { name: "Kenya", lat: 0, lon: 38, language: "Swahili" },
  ZA: { name: "South Africa", lat: -29, lon: 25, language: "English" },
  NZ: { name: "New Zealand", lat: -41, lon: 174, language: "English" },
  IE: { name: "Ireland", lat: 53, lon: -8, language: "English" },
};

const R = 88;
const CX = 110;
const CY = 110;
const TILT = (20 * Math.PI) / 180;

function project(latDeg: number, lonDeg: number, spinDeg: number) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = ((lonDeg + spinDeg) * Math.PI) / 180;
  const cosc = Math.sin(TILT) * Math.sin(lat) + Math.cos(TILT) * Math.cos(lat) * Math.cos(lon);
  return {
    x: CX + R * Math.cos(lat) * Math.sin(lon),
    y: CY - R * (Math.cos(TILT) * Math.sin(lat) - Math.sin(TILT) * Math.cos(lat) * Math.cos(lon)),
    visible: cosc > 0,
  };
}

function graticulePath(points: { lat: number; lon: number }[], spin: number): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    const q = project(p.lat, p.lon, spin);
    if (!q.visible) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

export function LanguageGlobe({ countries }: { countries: { country: string; views: number }[] }) {
  const [spin, setSpin] = useState(0);
  const frame = useRef<number>();

  const known = useMemo(
    () =>
      countries
        .filter((c) => COUNTRY[c.country])
        .sort((a, b) => b.views - a.views)
        .slice(0, 8),
    [countries]
  );

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      setSpin((s) => (s + (now - last) * 0.008) % 360);
      last = now;
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  const grid = useMemo(() => {
    const lines: { lat: number; lon: number }[][] = [];
    for (let lon = -180; lon < 180; lon += 30) {
      lines.push(Array.from({ length: 37 }, (_, i) => ({ lat: -90 + i * 5, lon })));
    }
    for (const lat of [-60, -30, 0, 30, 60]) {
      lines.push(Array.from({ length: 73 }, (_, i) => ({ lat, lon: -180 + i * 5 })));
    }
    return lines;
  }, []);

  if (known.length === 0) return null;

  const maxViews = Math.max(...known.map((c) => c.views));

  return (
    <div className="globewrap">
      <svg viewBox="0 0 220 220" className="globe" role="img" aria-label="Globe marking the countries this video's audience watches from">
        <circle cx={CX} cy={CY} r={R} className="globedisc" />
        {grid.map((line, i) => (
          <path key={i} d={graticulePath(line, spin)} className="globegrid" />
        ))}
        <circle cx={CX} cy={CY} r={R} className="globerim" />
        {known.map((c) => {
          const meta = COUNTRY[c.country];
          const p = project(meta.lat, meta.lon, spin);
          if (!p.visible) return null;
          const r = 3 + 4 * Math.sqrt(c.views / maxViews);
          return (
            <g key={c.country}>
              <circle cx={p.x} cy={p.y} r={r} className="globedot" />
              <text x={p.x + r + 3} y={p.y + 3} className="globelabel">
                {c.country}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="globekey">
        {known.slice(0, 5).map((c) => {
          const meta = COUNTRY[c.country];
          return (
            <li key={c.country}>
              <b>{meta.name}</b>
              <span>{meta.language}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
