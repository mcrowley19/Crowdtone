import { promises as fs } from "fs";
import path from "path";

/**
 * sharp renders the overlay SVG through librsvg, which resolves `font-family`
 * via fontconfig. Serverless containers ship no fonts at all, so every glyph
 * comes out as tofu (□) unless we bring our own. We bundle DejaVu Sans Bold —
 * already the intended fallback in the overlay font stack — and point
 * fontconfig at it.
 *
 * fontconfig also needs a writable cache dir, and /tmp is the only writable
 * path on serverless, so the generated config lives there too.
 */

const FONT_DIR_CANDIDATES = [
  path.join(process.cwd(), "assets", "fonts"),
  // Next traces the file relative to the compiled route, so resolve upwards too.
  path.join(process.cwd(), "..", "assets", "fonts"),
];

let configured: Promise<void> | null = null;

async function firstExistingFontDir(): Promise<string | null> {
  for (const dir of FONT_DIR_CANDIDATES) {
    try {
      const entries = await fs.readdir(dir);
      if (entries.some((f) => f.toLowerCase().endsWith(".ttf"))) return dir;
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function setup(): Promise<void> {
  // A pre-set FONTCONFIG_PATH means the host already has fonts wired up.
  if (process.env.FONTCONFIG_PATH) return;

  const fontDir = await firstExistingFontDir();
  if (!fontDir) return; // fall back to system fonts rather than breaking rendering

  const confDir = path.join("/tmp", "crowdtone-fontconfig");
  const cacheDir = path.join("/tmp", "fontconfig-cache");
  const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${fontDir}</dir>
  <cachedir>${cacheDir}</cachedir>
  <!-- The overlay stack asks for Arial/Helvetica first; neither exists here. -->
  <alias><family>Arial</family><prefer><family>DejaVu Sans</family></prefer></alias>
  <alias><family>Helvetica</family><prefer><family>DejaVu Sans</family></prefer></alias>
  <alias><family>sans-serif</family><prefer><family>DejaVu Sans</family></prefer></alias>
</fontconfig>
`;

  try {
    await fs.mkdir(confDir, { recursive: true });
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(path.join(confDir, "fonts.conf"), conf, "utf8");
    process.env.FONTCONFIG_PATH = confDir;
  } catch {
    // Unwritable /tmp: leave fontconfig alone and use whatever the system has.
  }
}

/** Idempotent — the first caller configures fontconfig, the rest await it. */
export function ensureFontsConfigured(): Promise<void> {
  if (!configured) configured = setup();
  return configured;
}
