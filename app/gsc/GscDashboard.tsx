"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchGscPerformanceRows } from "@/lib/db";
import type { GscPerformanceRow } from "@/lib/types";

export default function GscDashboard() {
  const [rows, setRows] = useState<GscPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchGscPerformanceRows();
      setRows(data);
      setLoading(false);
    }
    load();
  }, []);

  const summary = useMemo(() => {
    const totalClicks = rows.reduce((sum, r) => sum + (r.clicks || 0), 0);
    const totalImpressions = rows.reduce((sum, r) => sum + (r.impressions || 0), 0);
    const withPosition = rows.filter((r) => r.position != null);
    const avgPosition =
      withPosition.length > 0
        ? withPosition.reduce((sum, r) => sum + (r.position || 0), 0) / withPosition.length
        : null;
    const dates = rows.map((r) => r.date).filter(Boolean).sort();
    return {
      totalClicks,
      totalImpressions,
      avgPosition,
      earliestDate: dates[0],
      latestDate: dates[dates.length - 1],
    };
  }, [rows]);

  return (
    <div style={{ background: "#F5F6F8", minHeight: "100vh", color: "#1B2230" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px" }}>
        <a href="/" style={{ fontSize: "13px", color: "#5B6472", textDecoration: "none" }}>
          ← 返回首页
        </a>
        <h1 style={{ fontSize: "24px", fontWeight: 600, margin: "6px 0 4px" }}>
          GSC 排名与流量
        </h1>
        <p style={{ color: "#5B6472", fontSize: "14px", maxWidth: "640px", marginBottom: "24px" }}>
          每天凌晨自动从 Google Search Console 拉取最近数据。这里只展示已经同步进数据库的记录，不会实时查询
          Google。
        </p>

        {/* Summary */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
          {[
            { label: "总点击", value: summary.totalClicks },
            { label: "总展现", value: summary.totalImpressions },
            {
              label: "平均排名",
              value: summary.avgPosition != null ? summary.avgPosition.toFixed(1) : "—",
            },
            {
              label: "数据覆盖区间",
              value:
                summary.earliestDate && summary.latestDate
                  ? `${summary.earliestDate} ~ ${summary.latestDate}`
                  : "—",
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                flex: "1 1 200px",
                padding: "16px",
                borderRadius: "8px",
                background: "#FFFFFF",
                border: "1px solid #E2E4E9",
              }}
            >
              <div style={{ fontSize: "12px", color: "#9CA3AF", marginBottom: "6px" }}>
                {s.label}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 600 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div
          style={{
            borderRadius: "8px",
            overflow: "hidden",
            border: "1px solid #E2E4E9",
            background: "#FFFFFF",
          }}
        >
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: "14px" }}>
              加载中…
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: "14px" }}>
              还没有同步到任何数据。这通常是因为网站流量太少、Google Search
              Console里暂时没有可返回的数据，等网站被搜索到一些、定时任务多跑几天之后就会陆续出现。
            </div>
          ) : (
            <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #E2E4E9" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "#6B7280", fontWeight: 500 }}>
                    日期
                  </th>
                  <th style={{ textAlign: "left", padding: "8px", color: "#6B7280", fontWeight: 500 }}>
                    页面
                  </th>
                  <th style={{ textAlign: "left", padding: "8px", color: "#6B7280", fontWeight: 500 }}>
                    查询词
                  </th>
                  <th style={{ textAlign: "right", padding: "8px", color: "#6B7280", fontWeight: 500 }}>
                    点击
                  </th>
                  <th style={{ textAlign: "right", padding: "8px", color: "#6B7280", fontWeight: 500 }}>
                    展现
                  </th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: "#6B7280", fontWeight: 500 }}>
                    排名
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F0F1F3" }}>
                    <td style={{ padding: "8px 12px", color: "#6B7280" }}>{r.date}</td>
                    <td style={{ padding: "8px", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.page_url}
                    </td>
                    <td style={{ padding: "8px" }}>{r.query}</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>{r.clicks}</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>{r.impressions}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      {r.position != null ? r.position.toFixed(1) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
