import type { Metadata } from "next";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CPA Codex Monitor",
  description: "Codex 账号额度监控",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <Theme appearance="dark" accentColor="orange" grayColor="sand" radius="medium" scaling="100%">
          {children}
        </Theme>
      </body>
    </html>
  );
}
