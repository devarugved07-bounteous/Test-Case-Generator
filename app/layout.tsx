import type { Metadata } from "next";

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
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", backgroundColor: "#000", color: "#fff", minHeight: "100vh" }}>
        {children}
      </body>
    </html>
  );
}
