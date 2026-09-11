interface ModuleCard {
  href: string;
  title: string;
  desc: string;
  status: "可用" | "规划中";
}

const modules: ModuleCard[] = [
  {
    href: "/keywords",
    title: "关键词分拣",
    desc: "导入大批量关键词导出表，按规则+语义自动分成保留/竞品词/已排除/待复核。",
    status: "可用",
  },
  {
    href: "#",
    title: "GSC 排名与流量",
    desc: "自动拉取 Google Search Console 数据，识别快速提升机会与内容衰减页面。",
    status: "规划中",
  },
  {
    href: "#",
    title: "技术审计",
    desc: "导入 Screaming Frog 报告，汇总死链、重复标题、孤岛页面等问题清单。",
    status: "规划中",
  },
  {
    href: "#",
    title: "外链追踪",
    desc: "导入 Ahrefs/Semrush 外链导出，追踪新增/流失外链与竞品差距。",
    status: "规划中",
  },
];

export default function Home() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "48px 24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 600, letterSpacing: "-0.01em" }}>SGEO</h1>
        <p style={{ color: "#5B6472", fontSize: "14px", marginTop: "6px", maxWidth: "560px" }}>
          SEO 与 GEO 数据整合系统。以确定性数据源和规则引擎为主，AI 只用在少数需要语义判断的地方。
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "16px",
            marginTop: "32px",
          }}
        >
          {modules.map((m) => (
            
              key={m.title}
              href={m.href}
              style={{
                display: "block",
                padding: "20px",
                borderRadius: "10px",
                background: "#FFFFFF",
                border: "1px solid #E2E4E9",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>{m.title}</h2>
                <span
                  style={{
                    fontSize: "12px",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: m.status === "可用" ? "#E8F5EE" : "#EEF0F2",
                    color: m.status === "可用" ? "#1F8A5A" : "#6B7280",
                  }}
                >
                  {m.status}
                </span>
              </div>
              <p style={{ fontSize: "13px", color: "#5B6472", marginTop: "8px", lineHeight: 1.5 }}>
                {m.desc}
              </p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
