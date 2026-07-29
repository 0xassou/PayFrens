import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Farcaster / Base App profile pictures are served from a handful of CDNs.
    remotePatterns: [
      {protocol: "https", hostname: "**.imagedelivery.net"},
      {protocol: "https", hostname: "**.googleusercontent.com"},
      {protocol: "https", hostname: "i.imgur.com"},
      {protocol: "https", hostname: "**.warpcast.com"},
      {protocol: "https", hostname: "**.farcaster.xyz"},
      {protocol: "https", hostname: "**.decentralized-content.com"},
      {protocol: "https", hostname: "**.pinata.cloud"},
    ],
  },
};

export default nextConfig;
