import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Console — WhatsApp Platform",
    description: "Tenant, AI provider, and usage management console"
};

export default function RootLayout({
    children
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="min-h-screen font-sans antialiased">
                {children}
            </body>
        </html>
    );
}
