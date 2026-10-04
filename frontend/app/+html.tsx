// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ar" dir="rtl" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0b3d2e" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="ترف بوك" />
        {/* iOS install support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="ترف بوك" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <title>Book | احجز ملعبك في الأردن</title>
        <meta name="description" content="Book — منصة حجز الملاعب والدوريات الأولى في الأردن. احجز ملعبك، انضم لدوري، وتابع فريقك." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
              html, body, #root { font-family: 'IBM Plex Sans Arabic','Tajawal','Segoe UI',system-ui,sans-serif; }
              * { -webkit-tap-highlight-color: transparent; }
              ::selection { background: #B9EC2E; color: #0C1411; }
              ::-webkit-scrollbar { width: 10px; height: 10px; }
              ::-webkit-scrollbar-track { background: #F4F6F1; }
              ::-webkit-scrollbar-thumb { background: #CFD6C4; border-radius: 8px; }
              ::-webkit-scrollbar-thumb:hover { background: #0E3B2C; }
              @keyframes floaty { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
              @keyframes pulse-glow { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
