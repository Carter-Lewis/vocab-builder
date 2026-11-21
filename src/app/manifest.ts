import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wordwell",
    short_name: "Wordwell",
    description: "A daily word, chosen to fill the gaps in your vocabulary.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4eee4",
    theme_color: "#f4eee4",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
