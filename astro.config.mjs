import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://camescasse.dev",
  // Astro 7 changes the default to "jsx". Keep the Astro 5 whitespace output.
  compressHTML: true,
  vite: {
    build: {
      // Vite 8 uses newer default browser targets for CSS.
      // Keep the old Vite targets. Then older browsers get the same layout.
      cssTarget: ["chrome87", "edge88", "firefox78", "safari14"],
    },
  },
});
