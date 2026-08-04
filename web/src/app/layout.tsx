import type { Metadata, Viewport } from "next";
import { robotoFlex, robotoMono } from "@/lib/fonts";
import { AppShell } from "@/components/app-shell";
import { LenisProvider } from "@/components/providers/lenis-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "career-ops — official web experience",
  description: "The official, local-first web experience for career-ops.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "career-ops" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#191211",
};

const THEME_SCRIPT = `(function(){try{document.documentElement.classList.add('dark');var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}m.setAttribute('content','#191211');localStorage.setItem('career-ops:theme','dark');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${robotoFlex.variable} ${robotoMono.variable}`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <LenisProvider>
          <AppShell>{children}</AppShell>
        </LenisProvider>
      </body>
    </html>
  );
}
