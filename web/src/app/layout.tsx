import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIM:US — 시민 선택 시뮬레이션",
  description: "시민의 선택으로 도시의 변화를 만드는 참여형 시뮬레이션",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
