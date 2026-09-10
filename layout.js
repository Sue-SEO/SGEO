import "./globals.css";

export const metadata = {
  title: "SGEO · SEO数据整合与分拣系统",
  description: "SEO与GEO数据整合、规则引擎与关键词分拣工具",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
