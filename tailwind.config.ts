import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        /* ============================================================
           Metallic palette overrides — every legacy color name in the
           codebase (red/blue/green/teal/amber/emerald/orange/yellow/
           purple/slate/etc.) resolves to a brighter steel/silver/bronze
           tone so the entire app stays on-theme without per-component edits.
           Bronze family = warm metallic accents (was amber/orange/yellow/red)
           Silver family = cool metallic neutrals (was blue/teal/cyan/emerald/green/slate)
           ============================================================ */
        bronze: {
          DEFAULT: "hsl(32 55% 68%)",
          50: "hsl(34 60% 92%)",
          100: "hsl(34 58% 86%)",
          200: "hsl(33 55% 78%)",
          300: "hsl(32 55% 72%)",
          400: "hsl(32 58% 66%)",
          500: "hsl(30 60% 60%)",
          600: "hsl(28 55% 52%)",
          700: "hsl(26 50% 44%)",
          800: "hsl(24 42% 36%)",
          900: "hsl(22 36% 28%)",
        },
        silver: {
          DEFAULT: "hsl(217 18% 80%)",
          50: "hsl(217 22% 95%)",
          100: "hsl(217 20% 90%)",
          200: "hsl(217 18% 84%)",
          300: "hsl(217 18% 78%)",
          400: "hsl(217 16% 70%)",
          500: "hsl(217 14% 62%)",
          600: "hsl(217 12% 52%)",
          700: "hsl(217 12% 42%)",
          800: "hsl(218 12% 30%)",
          900: "hsl(218 12% 20%)",
        },
        /* Re-map every legacy palette name to the metallic gradient.
           Bronze tones (warm) for warning/highlight families. */
        red: {
          50: "hsl(34 60% 92%)", 100: "hsl(34 58% 86%)", 200: "hsl(33 55% 78%)",
          300: "hsl(32 55% 72%)", 400: "hsl(32 58% 66%)", 500: "hsl(30 60% 60%)",
          600: "hsl(28 55% 52%)", 700: "hsl(26 50% 44%)", 800: "hsl(24 42% 36%)", 900: "hsl(22 36% 28%)",
        },
        orange: {
          50: "hsl(34 60% 92%)", 100: "hsl(34 58% 86%)", 200: "hsl(33 55% 78%)",
          300: "hsl(32 55% 72%)", 400: "hsl(32 58% 66%)", 500: "hsl(30 60% 60%)",
          600: "hsl(28 55% 52%)", 700: "hsl(26 50% 44%)", 800: "hsl(24 42% 36%)", 900: "hsl(22 36% 28%)",
        },
        amber: {
          50: "hsl(34 60% 92%)", 100: "hsl(34 58% 86%)", 200: "hsl(33 55% 78%)",
          300: "hsl(32 55% 72%)", 400: "hsl(32 58% 66%)", 500: "hsl(30 60% 60%)",
          600: "hsl(28 55% 52%)", 700: "hsl(26 50% 44%)", 800: "hsl(24 42% 36%)", 900: "hsl(22 36% 28%)",
        },
        yellow: {
          50: "hsl(34 60% 92%)", 100: "hsl(34 58% 86%)", 200: "hsl(33 55% 78%)",
          300: "hsl(32 55% 72%)", 400: "hsl(32 58% 66%)", 500: "hsl(30 60% 60%)",
          600: "hsl(28 55% 52%)", 700: "hsl(26 50% 44%)", 800: "hsl(24 42% 36%)", 900: "hsl(22 36% 28%)",
        },
        rose: {
          50: "hsl(34 60% 92%)", 100: "hsl(34 58% 86%)", 200: "hsl(33 55% 78%)",
          300: "hsl(32 55% 72%)", 400: "hsl(32 58% 66%)", 500: "hsl(30 60% 60%)",
          600: "hsl(28 55% 52%)", 700: "hsl(26 50% 44%)", 800: "hsl(24 42% 36%)", 900: "hsl(22 36% 28%)",
        },
        pink: {
          50: "hsl(34 60% 92%)", 100: "hsl(34 58% 86%)", 200: "hsl(33 55% 78%)",
          300: "hsl(32 55% 72%)", 400: "hsl(32 58% 66%)", 500: "hsl(30 60% 60%)",
          600: "hsl(28 55% 52%)", 700: "hsl(26 50% 44%)", 800: "hsl(24 42% 36%)", 900: "hsl(22 36% 28%)",
        },
        /* Silver tones (cool) for success/info/neutral families. */
        green: {
          50: "hsl(217 22% 95%)", 100: "hsl(217 20% 90%)", 200: "hsl(217 18% 84%)",
          300: "hsl(217 18% 78%)", 400: "hsl(217 16% 70%)", 500: "hsl(217 14% 62%)",
          600: "hsl(217 12% 52%)", 700: "hsl(217 12% 42%)", 800: "hsl(218 12% 30%)", 900: "hsl(218 12% 20%)",
        },
        emerald: {
          50: "hsl(217 22% 95%)", 100: "hsl(217 20% 90%)", 200: "hsl(217 18% 84%)",
          300: "hsl(217 18% 78%)", 400: "hsl(217 16% 70%)", 500: "hsl(217 14% 62%)",
          600: "hsl(217 12% 52%)", 700: "hsl(217 12% 42%)", 800: "hsl(218 12% 30%)", 900: "hsl(218 12% 20%)",
        },
        teal: {
          50: "hsl(217 22% 95%)", 100: "hsl(217 20% 90%)", 200: "hsl(217 18% 84%)",
          300: "hsl(217 18% 78%)", 400: "hsl(217 16% 70%)", 500: "hsl(217 14% 62%)",
          600: "hsl(217 12% 52%)", 700: "hsl(217 12% 42%)", 800: "hsl(218 12% 30%)", 900: "hsl(218 12% 20%)",
        },
        cyan: {
          50: "hsl(217 22% 95%)", 100: "hsl(217 20% 90%)", 200: "hsl(217 18% 84%)",
          300: "hsl(217 18% 78%)", 400: "hsl(217 16% 70%)", 500: "hsl(217 14% 62%)",
          600: "hsl(217 12% 52%)", 700: "hsl(217 12% 42%)", 800: "hsl(218 12% 30%)", 900: "hsl(218 12% 20%)",
        },
        sky: {
          50: "hsl(217 22% 95%)", 100: "hsl(217 20% 90%)", 200: "hsl(217 18% 84%)",
          300: "hsl(217 18% 78%)", 400: "hsl(217 16% 70%)", 500: "hsl(217 14% 62%)",
          600: "hsl(217 12% 52%)", 700: "hsl(217 12% 42%)", 800: "hsl(218 12% 30%)", 900: "hsl(218 12% 20%)",
        },
        blue: {
          50: "hsl(217 22% 95%)", 100: "hsl(217 20% 90%)", 200: "hsl(217 18% 84%)",
          300: "hsl(217 18% 78%)", 400: "hsl(217 16% 70%)", 500: "hsl(217 14% 62%)",
          600: "hsl(217 12% 52%)", 700: "hsl(217 12% 42%)", 800: "hsl(218 12% 30%)", 900: "hsl(218 12% 20%)",
        },
        indigo: {
          50: "hsl(217 22% 95%)", 100: "hsl(217 20% 90%)", 200: "hsl(217 18% 84%)",
          300: "hsl(217 18% 78%)", 400: "hsl(217 16% 70%)", 500: "hsl(217 14% 62%)",
          600: "hsl(217 12% 52%)", 700: "hsl(217 12% 42%)", 800: "hsl(218 12% 30%)", 900: "hsl(218 12% 20%)",
        },
        violet: {
          50: "hsl(217 22% 95%)", 100: "hsl(217 20% 90%)", 200: "hsl(217 18% 84%)",
          300: "hsl(217 18% 78%)", 400: "hsl(217 16% 70%)", 500: "hsl(217 14% 62%)",
          600: "hsl(217 12% 52%)", 700: "hsl(217 12% 42%)", 800: "hsl(218 12% 30%)", 900: "hsl(218 12% 20%)",
        },
        purple: {
          50: "hsl(217 22% 95%)", 100: "hsl(217 20% 90%)", 200: "hsl(217 18% 84%)",
          300: "hsl(217 18% 78%)", 400: "hsl(217 16% 70%)", 500: "hsl(217 14% 62%)",
          600: "hsl(217 12% 52%)", 700: "hsl(217 12% 42%)", 800: "hsl(218 12% 30%)", 900: "hsl(218 12% 20%)",
        },
        fuchsia: {
          50: "hsl(217 22% 95%)", 100: "hsl(217 20% 90%)", 200: "hsl(217 18% 84%)",
          300: "hsl(217 18% 78%)", 400: "hsl(217 16% 70%)", 500: "hsl(217 14% 62%)",
          600: "hsl(217 12% 52%)", 700: "hsl(217 12% 42%)", 800: "hsl(218 12% 30%)", 900: "hsl(218 12% 20%)",
        },
        lime: {
          50: "hsl(217 22% 95%)", 100: "hsl(217 20% 90%)", 200: "hsl(217 18% 84%)",
          300: "hsl(217 18% 78%)", 400: "hsl(217 16% 70%)", 500: "hsl(217 14% 62%)",
          600: "hsl(217 12% 52%)", 700: "hsl(217 12% 42%)", 800: "hsl(218 12% 30%)", 900: "hsl(218 12% 20%)",
        },
        slate: {
          50: "hsl(217 22% 95%)", 100: "hsl(217 20% 90%)", 200: "hsl(217 18% 84%)",
          300: "hsl(217 18% 78%)", 400: "hsl(217 16% 70%)", 500: "hsl(217 14% 62%)",
          600: "hsl(217 12% 42%)", 700: "hsl(218 12% 30%)", 800: "hsl(218 12% 20%)", 900: "hsl(220 13% 12%)",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
