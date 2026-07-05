import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "真人 DJ 動態音樂播放器",
  description: "A live DJ style music player prototype",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
