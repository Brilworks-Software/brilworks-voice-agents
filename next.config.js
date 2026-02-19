/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Referrer-Policy",
            // This is the "no-nonsense" value that ensures the origin is always sent
            value: "no-referrer-when-downgrade",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*", // Helps with cross-origin handshake
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
