import type { MetadataRoute } from "next";

/** PWA manifest (spec §77) — installable, warm civic theme. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CivicIssue — Report it. Track it. Resolve it.",
    short_name: "CivicIssue",
    description:
      "Report civic problems in your locality, attach evidence, track progress and see resolutions.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#bf4726",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    ],
    categories: ["social", "utilities"],
  };
}
