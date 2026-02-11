import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";
import { SnowAndControls } from "./SnowAndControls";

export const metadata: Metadata = {
  title: "NextJS Test Case Generator",
  description: "Generate Jest + React Testing Library test cases from code or requirements using Gemini.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);else if(window.matchMedia("(prefers-color-scheme: light)").matches)document.documentElement.setAttribute("data-theme","light");})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <SnowAndControls>{children}</SnowAndControls>
        </ThemeProvider>
      </body>
    </html>
  );
}
