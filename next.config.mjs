/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El dataset público se lee del filesystem en build; no hay imágenes remotas.
  images: { unoptimized: true },
};
export default nextConfig;
