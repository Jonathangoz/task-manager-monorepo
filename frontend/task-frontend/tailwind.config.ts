import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
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
        // Colores personalizados para el Task Manager
        task: {
          pending: "hsl(var(--task-pending))",
          "in-progress": "hsl(var(--task-in-progress))",
          completed: "hsl(var(--task-completed))",
          cancelled: "hsl(var(--task-cancelled))",
          "on-hold": "hsl(var(--task-on-hold))",
        },
        priority: {
          low: "hsl(var(--priority-low))",
          medium: "hsl(var(--priority-medium))",
          high: "hsl(var(--priority-high))",
          urgent: "hsl(var(--priority-urgent))",
        },
        category: {
          DEFAULT: "hsl(var(--category-default))",
          work: "hsl(var(--category-work))",
          personal: "hsl(var(--category-personal))",
          health: "hsl(var(--category-health))",
          learning: "hsl(var(--category-learning))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "slide-in-from-top": {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-in-from-bottom": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-in-from-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-from-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.33)" },
          "40%, 50%": { opacity: "1" },
          "100%": { opacity: "0", transform: "scale(1.33)" },
        },
        "task-complete": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)" },
        },
        "notification-slide": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-out": "fade-out 0.3s ease-out",
        "slide-in-from-top": "slide-in-from-top 0.3s ease-out",
        "slide-in-from-bottom": "slide-in-from-bottom 0.3s ease-out",
        "slide-in-from-left": "slide-in-from-left 0.3s ease-out",
        "slide-in-from-right": "slide-in-from-right 0.3s ease-out",
        "bounce-in": "bounce-in 0.6s ease-out",
        "pulse-ring": "pulse-ring 1.25s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
        "task-complete": "task-complete 0.5s ease-in-out",
        "notification-slide": "notification-slide 0.3s ease-out",
      },
      boxShadow: {
        "task-card": "0 2px 8px rgba(0, 0, 0, 0.1)",
        "task-card-hover": "0 4px 16px rgba(0, 0, 0, 0.15)",
        "priority-urgent": "0 0 0 2px hsl(var(--priority-urgent))",
        "priority-high": "0 0 0 2px hsl(var(--priority-high))",
        "category-glow": "0 0 20px rgba(99, 102, 241, 0.3)",
      },
      spacing: {
        "sidebar": "256px",
        "header": "64px",
        "task-card": "120px",
      },
      backdropBlur: {
        "glass": "16px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "task-title": ["1.125rem", { lineHeight: "1.6" }],
        "task-description": ["0.875rem", { lineHeight: "1.5" }],
        "category-label": ["0.75rem", { lineHeight: "1.4", fontWeight: "500" }],
      },
      maxWidth: {
        "task-modal": "500px",
        "category-modal": "400px",
        "dashboard": "1200px",
      },
      gridTemplateColumns: {
        "task-grid": "repeat(auto-fill, minmax(300px, 1fr))",
        "dashboard": "1fr 300px",
        "sidebar-content": "256px 1fr",
      },
      transitionDuration: {
        "250": "250ms",
        "400": "400ms",
      },
      scale: {
        "102": "1.02",
        "103": "1.03",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config