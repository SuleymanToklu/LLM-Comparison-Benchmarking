/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        // Fallback: some accounts still serve avatars from github.com
        protocol: 'https',
        hostname: 'github.com',
      },
    ],
  },
}

export default nextConfig
