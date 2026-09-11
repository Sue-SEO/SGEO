"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Papa from "papaparse";
import { supabase } from "../../lib/supabaseClient";

const CATS = {
  pending: { label: "待处理", dot: "#9AA3AF", text: "#6B7280", bg: "#F3F4F6" },
  relevant: { label: "保留", dot: "#1F8A5A", text: "#1F8A5A", bg: "#E8F5EE" },
  competitor: { label: "竞品词", dot: "#B45309", text: "#B45309", bg: "#FBEEE0" },
  negative: { label: "已排除", dot: "#6B7280", text: "#6B7280", bg: "#EEF0F2" },
  irrelevant: { label: "不相关", dot: "#6B7280", text: "#6B7280", bg: "#EEF0F2" },
  uncertain: { label: "待复核", dot: "#4338CA", text: "#4338CA", bg: "#ECEAFB" },
};

const TABS = [
  { key: "all", label: "全部" },
  { key: "relevant", label: "保留" },
  { key: "competitor", label: "竞品词" },
  { key: "negative", label: "已排除" },
  { key: "irrelevant", label: "不相关" },
  { key: "uncertain", label: "待复核" },
];

const PAGE_SIZE = 50;
const BATCH_SIZE = 25;
const CONCURRENCY = 4;

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now();
}

function splitList(s) {
  return s
    .split(/[,，\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseInput(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return [];
  const parsed = Papa.parse(trimmed, { skipEmptyLines: true });
  const data = parsed.data;
  if (!data || data.length === 0) return [];

  const header = (data[0] || []).map((h) => String(h).trim());
  const looksLikeHeader = header.some((h) => /keyword|关键词|^词$/i.test(h));

  let colMap = { kw: 0, vol: -1, kd: -1, cpc: -1 };
  let startIdx = 0;

  if (looksLikeHeader) {
    startIdx = 1;
    header.forEach((h, i) => {
      if (/keyword|关键词/i.test(h)) colMap.kw = i;
      else if (/volume|搜索量|search vol/i.test(h)) colMap.vol = i;
      else if (/difficulty|^kd$|难度/i.test(h)) colMap.kd = i;
      else if (/cpc/i.test(h)) colMap.cpc = i;
    });
  }

  const rows = [];
  for (let i = startIdx; i < data.length; i++) {
    const cols = data[i];
    if (!cols) continue;
    const kwRaw = cols[colMap.kw];
    if (!kwRaw) continue;
    const keyword = String(kwRaw).trim();
    if (!keyword) continue;
    rows.push({
      id: uuid(),
      keyword,
      volume: colMap.vol >= 0 ? Number(cols[colMap.vol]) || null : null,
      kd: colMap.kd >= 0 ? Number(cols[colMap.kd]) || null : null,
      cpc: colMap.cpc >= 0 ? Number(cols[colMap.cpc]) || null : null,
      category: "pending",
      reason: "",
    });
  }
  return rows;
}

async function classifyBatch(topic, batchRows) {
  try {
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, batch: batchRows.map((r) => ({ keyword: r.keyword })) }),
    });
    const data = await res.json();
    if (!Array.isArray(data.results)) throw new Error("bad response");
    return data.results;
  } catch (e) {
    return batchRows.map((_, idx) => ({
      i: idx,
      c: "uncertain",
      n: "判断失败，需人工复核",
    }));
  }
}

export default function KeywordSorter() {
  const [rows, setRows] = useState([]);
  const [seedTopic, setSeedTopic] = useState("");
  const [competitorBrands, setCompetitorBrands] = useState("");
  const [negativeWords, setNegativeWords] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [fileName, setFileName] = useState("");
  const [loadingDb, setLoadingDb] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const fileInputRef = useRef(null);

  // 页面加载时，从 Supabase 拉取之前保存过的关键词
  useEffect(() => {
    async function load() {
      setLoadingDb(true);
      const { data, error } = await supabase
        .from("keywords")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (!error && data) {
        setRows(
          data.map((d) => ({
            id: d.id,
            keyword: d.keyword,
            volume: d.search_volume,
            kd: d.kd,
            cpc: d.cpc,
            category: d.category || "pending",
            reason: d.reason || "",
          }))
        );
      }
      setLoadingDb(false);
    }
    load();
  }, []);

  const counts = useMemo(() => {
    const c = { all: rows.length, relevant: 0, competitor: 0, negative: 0, irrelevant: 0, uncertain: 0, pending: 0 };
    rows.forEach((r) => {
      c[r.category] = (c[r.category] || 0) + 1;
    });
    return c;
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (activeTab === "all") return rows;
    return rows.filter((r) => r.category === activeTab);
  }, [rows, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseInput(String(ev.target.result));
      setRows((prev) => [...parsed, ...prev]);
      setActiveTab("all");
      setPage(1);
    };
    reader.readAsText(file, "utf-8");
  }

  function handlePasteLoad(text) {
    const parsed = parseInput(text);
    if (parsed.length === 0) return;
    setRows((prev) => [...parsed, ...prev]);
    setActiveTab("all");
    setPage(1);
  }

  const startSort = useCallback(async () => {
    if (rows.length === 0 || processing) return;
    setProcessing(true);

    const brands = splitList(competitorBrands);
    const negs = splitList(negativeWords);

    let working = rows.map((r) => {
      if (r.category !== "pending") return r;
      if (brands.some((b) => b && r.keyword.includes(b))) {
        return { ...r, category: "competitor", reason: "命中竞品品牌词" };
      }
      if (negs.some((n) => n && r.keyword.includes(n))) {
        return { ...r, category: "negative", reason: "命中排除规则词" };
      }
      return r;
    });
    setRows(working);

    const pendingIdx = working
      .map((r, i) => (r.category === "pending" ? i : -1))
      .filter((i) => i >= 0);

    setProgress({ done: 0, total: pendingIdx.length });

    if (pendingIdx.length === 0) {
      setProcessing(false);
      return;
    }

    const batches = [];
    for (let i = 0; i < pendingIdx.length; i += BATCH_SIZE) {
      batches.push(pendingIdx.slice(i, i + BATCH_SIZE));
    }

    let batchCursor = 0;
    let doneCount = 0;

    async function worker() {
      while (batchCursor < batches.length) {
        const myBatch = batches[batchCursor++];
        const batchRows = myBatch.map((i) => working[i]);
        const results = await classifyBatch(seedTopic, batchRows);
        results.forEach((r) => {
          const globalIdx = myBatch[r.i];
          if (globalIdx === undefined) return;
          const cat =
            r.c === "relevant" ? "relevant" : r.c === "irrelevant" ? "irrelevant" : "uncertain";
          working[globalIdx] = { ...working[globalIdx], category: cat, reason: r.n || "" };
        });
        doneCount += myBatch.length;
        setProgress({ done: doneCount, total: pendingIdx.length });
        setRows([...working]);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setProcessing(false);
  }, [rows, processing, competitorBrands, negativeWords, seedTopic]);

  function overrideCategory(id, newCat) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, category: newCat, reason: "人工修正" } : r))
    );
  }

  async function saveToDb() {
    if (rows.length === 0) return;
    setSaving(true);
    setSaveMsg("");
    const payload = rows.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      seed_topic: seedTopic || null,
      category: r.category,
      search_volume: r.volume || null,
      kd: r.kd || null,
      cpc: r.cpc || null,
      reason: r.reason || null,
      source: "keyword_sorter",
    }));

    // 分批写入，避免单次请求过大
    const chunkSize = 500;
    let ok = true;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const { error } = await supabase.from("keywords").upsert(chunk, { onConflict: "id" });
      if (error) {
        ok = false;
        setSaveMsg("保存失败：" + error.message);
        break;
      }
    }
    if (ok) setSaveMsg(`已保存 ${payload.length} 条到数据库`);
    setSaving(false);
  }

  function exportCSV(which) {
    const target = which === "current" ? filteredRows : rows.filter((r) => r.category === "relevant");
    const csv = Papa.unparse(
      target.map((r) => ({
        关键词: r.keyword,
        搜索量: r.volume,
        KD: r.kd,
        CPC: r.cpc,
        分类: CATS[r.category]?.label || r.category,
        备注: r.reason,
      }))
    );
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = which === "current" ? `关键词分拣_${activeTab}.csv` : "关键词分拣_保留列表.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ background: "#F5F6F8", minHeight: "100vh", color: "#1B2230" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <a href="/" style={{ fontSize: "13px", color: "#5B6472", textDecoration: "none" }}>
              ← 返回首页
            </a>
            <h1 style={{ fontSize: "24px", fontWeight: 600, margin: "6px 0 4px" }}>关键词分拣站</h1>
            <p style={{ color: "#5B6472", fontSize: "14px", maxWidth: "600px" }}>
              把动辄上万条的关键词导出表，按业务相关性自动分成保留 / 竞品词 / 已排除 / 待复核。
              {loadingDb ? "（正在从数据库加载历史数据…）" : `已从数据库加载 ${rows.length} 条`}
            </p>
          </div>
          <button
            onClick={saveToDb}
            disabled={saving || rows.length === 0}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              background: saving ? "#B9C6C5" : "#146B69",
              color: "#fff",
              border: "none",
              fontSize: "13px",
              cursor: saving ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {saving ? "保存中…" : "保存到数据库"}
          </button>
        </div>
        {saveMsg && (
          <p style={{ fontSize: "12px", color: saveMsg.startsWith("保存失败") ? "#B45309" : "#1F8A5A", marginTop: "-12px" }}>
            {saveMsg}
          </p>
        )}

        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          <div
            style={{
              width: "320px",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              padding: "16px",
              borderRadius: "8px",
              background: "#FFFFFF",
              border: "1px solid #E2E4E9",
              height: "fit-content",
            }}
          >
            <div>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151" }}>
                核心主题 / 业务描述
              </label>
              <textarea
                value={seedTopic}
                onChange={(e) => setSeedTopic(e.target.value)}
                placeholder="例如：家用空气净化器电商网站，主打除甲醛和过敏原"
                style={{ width: "100%", marginTop: "4px", padding: "8px", fontSize: "13px", borderRadius: "6px", border: "1px solid #D8DBE0", minHeight: "60px", resize: "vertical" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151" }}>
                竞品品牌（逗号或换行分隔）
              </label>
              <textarea
                value={competitorBrands}
                onChange={(e) => setCompetitorBrands(e.target.value)}
                placeholder="352, 小米, 美的, IQAir"
                style={{ width: "100%", marginTop: "4px", padding: "8px", fontSize: "13px", borderRadius: "6px", border: "1px solid #D8DBE0", minHeight: "50px", resize: "vertical" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151" }}>
                排除规则词（逗号或换行分隔）
              </label>
              <textarea
                value={negativeWords}
                onChange={(e) => setNegativeWords(e.target.value)}
                placeholder="维修, 二手, 批发, 加盟"
                style={{ width: "100%", marginTop: "4px", padding: "8px", fontSize: "13px", borderRadius: "6px", border: "1px solid #D8DBE0", minHeight: "50px", resize: "vertical" }}
              />
            </div>

            <div style={{ height: "1px", background: "#E2E4E9" }} />

            <div>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151" }}>导入关键词</label>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ fontSize: "13px", padding: "6px 12px", borderRadius: "6px", border: "1px solid #D8DBE0", background: "#fff", color: "#374151" }}
                >
                  上传CSV文件
                </button>
                <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: "none" }} />
                {fileName && <span style={{ fontSize: "12px", color: "#9CA3AF", alignSelf: "center" }}>{fileName}</span>}
              </div>
              <textarea
                placeholder="或者直接把Semrush导出的表格粘贴到这里"
                style={{ width: "100%", marginTop: "8px", padding: "8px", fontSize: "13px", borderRadius: "6px", border: "1px solid #D8DBE0", minHeight: "90px", resize: "vertical" }}
                onBlur={(e) => {
                  if (e.target.value.trim()) {
                    handlePasteLoad(e.target.value);
                    e.target.value = "";
                  }
                }}
              />
            </div>

            <button
              onClick={startSort}
              disabled={rows.length === 0 || processing}
              style={{
                width: "100%",
                fontSize: "13px",
                padding: "10px",
                borderRadius: "6px",
                fontWeight: 500,
                background: rows.length === 0 || processing ? "#B9C6C5" : "#146B69",
                color: "#fff",
                border: "none",
                cursor: rows.length === 0 || processing ? "not-allowed" : "pointer",
              }}
            >
              {processing ? `分拣中 ${progress.done}/${progress.total}` : `开始分拣（共 ${rows.length} 条）`}
            </button>

            {processing && (
              <div style={{ background: "#EEF0F2", borderRadius: "999px", height: "6px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                    background: "#146B69",
                    height: "100%",
                    transition: "width 0.2s",
                  }}
                />
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              {["all", "relevant", "competitor", "negative", "irrelevant", "uncertain"].map((key) => {
                const isAll = key === "all";
                const meta = isAll ? { label: "总数", dot: "#1B2230" } : CATS[key];
                const value = isAll ? counts.all : counts[key] || 0;
                return (
                  <div
                    key={key}
                    style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderRadius: "6px", background: "#fff", border: "1px solid #E2E4E9" }}
                  >
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: meta.dot, display: "inline-block" }} />
                    <span style={{ fontSize: "13px", color: "#5B6472" }}>{meta.label}</span>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{value}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => {
                      setActiveTab(t.key);
                      setPage(1);
                    }}
                    style={{
                      fontSize: "13px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      background: activeTab === t.key ? "#146B69" : "transparent",
                      color: activeTab === t.key ? "#fff" : "#5B6472",
                      fontWeight: activeTab === t.key ? 500 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {t.label} ({t.key === "all" ? counts.all : counts[t.key] || 0})
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => exportCSV("current")} style={{ fontSize: "13px", padding: "6px 12px", borderRadius: "6px", border: "1px solid #D8DBE0", background: "#fff", color: "#374151" }}>
                  导出当前视图
                </button>
                <button onClick={() => exportCSV("relevant")} style={{ fontSize: "13px", padding: "6px 12px", borderRadius: "6px", border: "1px solid #146B69", background: "#146B69", color: "#fff" }}>
                  导出保留列表
                </button>
              </div>
            </div>

            <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid #E2E4E9", background: "#fff" }}>
              {rows.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: "14px" }}>
                  {loadingDb ? "加载中…" : "还没有导入关键词。上传CSV文件，或把表格粘贴到左侧输入框。"}
                </div>
              ) : (
                <>
                  <table style={{ width: "100%", fontSize: "14px", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #E2E4E9" }}>
                        <th style={{ textAlign: "left", padding: "8px 8px 8px 12px", color: "#6B7280", fontWeight: 500 }}>关键词</th>
                        <th style={{ textAlign: "right", padding: "8px", color: "#6B7280", fontWeight: 500, width: "90px" }}>搜索量</th>
                        <th style={{ textAlign: "right", padding: "8px", color: "#6B7280", fontWeight: 500, width: "70px" }}>KD</th>
                        <th style={{ textAlign: "left", padding: "8px", color: "#6B7280", fontWeight: 500, width: "100px" }}>分类</th>
                        <th style={{ textAlign: "left", padding: "8px", color: "#6B7280", fontWeight: 500 }}>原因</th>
                        <th style={{ textAlign: "left", padding: "8px 12px 8px 8px", color: "#6B7280", fontWeight: 500, width: "120px" }}>调整</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r) => {
                        const meta = CATS[r.category] || CATS.pending;
                        return (
                          <tr key={r.id} style={{ borderBottom: "1px solid #F0F1F3" }}>
                            <td style={{ padding: "8px 8px 8px 12px" }}>{r.keyword}</td>
                            <td style={{ padding: "8px", textAlign: "right", color: "#6B7280" }}>{r.volume ?? ""}</td>
                            <td style={{ padding: "8px", textAlign: "right", color: "#6B7280" }}>{r.kd ?? ""}</td>
                            <td style={{ padding: "8px" }}>
                              <span style={{ padding: "2px 8px", borderRadius: "4px", background: meta.bg, color: meta.text, fontSize: "12px" }}>
                                {meta.label}
                              </span>
                            </td>
                            <td style={{ padding: "8px", color: "#9CA3AF", fontSize: "12px" }}>{r.reason}</td>
                            <td style={{ padding: "8px 12px 8px 8px" }}>
                              <select
                                value={r.category}
                                onChange={(e) => overrideCategory(r.id, e.target.value)}
                                style={{ fontSize: "12px", borderRadius: "4px", border: "1px solid #D8DBE0", padding: "2px 4px" }}
                              >
                                {Object.keys(CATS)
                                  .filter((k) => k !== "pending")
                                  .map((k) => (
                                    <option key={k} value={k}>
                                      {CATS[k].label}
                                    </option>
                                  ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderTop: "1px solid #E2E4E9", fontSize: "13px", color: "#6B7280" }}>
                    <span>
                      第 {page} / {totalPages} 页，共 {filteredRows.length} 条
                    </span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: "4px 10px", borderRadius: "4px", border: "1px solid #D8DBE0", opacity: page <= 1 ? 0.4 : 1 }}>
                        上一页
                      </button>
                      <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: "4px 10px", borderRadius: "4px", border: "1px solid #D8DBE0", opacity: page >= totalPages ? 0.4 : 1 }}>
                        下一页
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
