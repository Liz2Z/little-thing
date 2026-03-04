/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: "hsl(var(--rose-50))",
          100: "hsl(var(--rose-100))",
          200: "hsl(var(--rose-200))",
          500: "hsl(var(--rose-500))",
          600: "hsl(var(--rose-600))",
          700: "hsl(var(--rose-700))",
          900: "hsl(var(--rose-900))",
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
        // 低饱和暖灰色系
        stone: {
          50: "hsl(var(--warm-gray-50))",
          100: "hsl(var(--warm-gray-100))",
          200: "hsl(var(--warm-gray-200))",
          300: "hsl(var(--warm-gray-300))",
          400: "hsl(var(--warm-gray-400))",
          500: "hsl(var(--warm-gray-500))",
          600: "hsl(var(--warm-gray-600))",
          700: "hsl(var(--warm-gray-700))",
          800: "hsl(var(--warm-gray-800))",
          900: "hsl(var(--warm-gray-900))",
        },
        // 消息气泡专用色
        message: {
          user: {
            bg: "hsl(var(--rose-100))",
            fg: "hsl(var(--rose-900))",
          },
          assistant: {
            bg: "hsl(var(--card))",
            fg: "hsl(var(--foreground))",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        message: {
          user: "0.75rem 0.75rem 0.25rem 0.75rem",
          assistant: "0.75rem 0.75rem 0.75rem 0.25rem",
        },
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        "subtle-sm": "0 1px 1px 0 rgb(0 0 0 / 0.02)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in": {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
      },
      transitionTimingFunction: {
        subtle: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
