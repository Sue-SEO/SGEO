// 关键词表的数据访问层。
// 任何页面/组件需要读写 keywords 表，都通过这里的函数，
// 不要在组件里直接写 supabase.from("keywords")...
// 好处：以后如果要换数据库、加缓存、加日志，只需要改这一个文件。

import { supabase } from "./supabaseClient";
import type { KeywordRow, KeywordUiRow, KeywordCategory } from "./types";

function dbRowToUiRow(d: KeywordRow): KeywordUiRow {
  return {
    id: d.id,
    keyword: d.keyword,
    volume: d.search_volume,
    kd: d.kd,
    cpc: d.cpc,
    category: d.category,
    reason: d.reason || "",
  };
}

export async function fetchKeywords(limit = 5000): Promise<KeywordUiRow[]> {
  const { data, error } = await supabase
    .from("keywords")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as KeywordRow[]).map(dbRowToUiRow);
}

export async function saveKeywords(
  rows: KeywordUiRow[],
  seedTopic: string
): Promise<{ ok: boolean; error?: string; count: number }> {
  const payload: Omit<KeywordRow, "created_at">[] = rows.map((r) => ({
    id: r.id,
    keyword: r.keyword,
    seed_topic: seedTopic || null,
    category: r.category,
    search_volume: r.volume,
    kd: r.kd,
    cpc: r.cpc,
    reason: r.reason || null,
    source: "keyword_sorter",
  }));

  const chunkSize = 500;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await supabase.from("keywords").upsert(chunk, { onConflict: "id" });
    if (error) {
      return { ok: false, error: error.message, count: i };
    }
  }
  return { ok: true, count: payload.length };
}

export function isValidCategory(value: string): value is KeywordCategory {
  return ["pending", "relevant", "competitor", "negative", "irrelevant", "uncertain"].includes(
    value
  );
}
