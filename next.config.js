/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    // Fix dev server hanging on Windows/OneDrive: use polling instead of native watcher
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
};

module.exports = nextConfig;
