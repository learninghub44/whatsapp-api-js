import type { Config } from "tailwindcss";

const config: Config = {
    content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
    theme: {
        extend: {
            colors: {
                paper: "#F7F6F2",
                ink: "#171A1F",
                muted: "#6B6F76",
                line: "#E3E0D6",
                panel: "#FFFFFF",
                signal: {
                    DEFAULT: "#B8842E",
                    soft: "#F1E4CB"
                },
                ok: {
                    DEFAULT: "#1F6F5C",
                    soft: "#DCEBE6"
                },
                warn: {
                    DEFAULT: "#AE4A2A",
                    soft: "#F3DFD5"
                }
            },
            fontFamily: {
                sans: [
                    "-apple-system",
                    "BlinkMacSystemFont",
                    "Segoe UI",
                    "Helvetica Neue",
                    "Arial",
                    "sans-serif"
                ],
                mono: [
                    "ui-monospace",
                    "SFMono-Regular",
                    "Menlo",
                    "Consolas",
                    "monospace"
                ]
            }
        }
    },
    plugins: []
};

export default config;
