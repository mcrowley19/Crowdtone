/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The bundled font is loaded by path at runtime, so tracing can't detect it.
  // Without this the thumbnail route deploys without fonts and renders tofu.
  experimental: {
    outputFileTracingIncludes: {
      "/api/thumbnails": ["./assets/fonts/**"],
    },
  },
};

export default nextConfig;
