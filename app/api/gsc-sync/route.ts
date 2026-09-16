import { fetchGscPerformance } from "@/lib/gsc";
import { saveGscPerformance } from "@/lib/db";
import type { GscPerformanceRow } from "@/lib/types";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 没配置secret时不做限制，方便本地/首次测试
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  return queryKey === secret || authHeader === `Bearer ${secret}`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) {
    return Response.json(
      { error: "缺少 GSC_SITE_URL 环境变量，请在 Vercel 项目设置里添加" },
      { status: 500 }
    );
  }

  // GSC 的数据通常有2-3天延迟，所以拉取"3天前"往前推7天的这段区间
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);

  try {
    const rows = await fetchGscPerformance(siteUrl, formatDate(start), formatDate(end));

    const mapped: GscPerformanceRow[] = rows.map((r) => ({
      date: r.keys?.[0] || "",
      page_url: r.keys?.[1] || "",
      query: r.keys?.[2] || "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? null,
      position: r.position ?? null,
    }));

    const result = await saveGscPerformance(mapped);

    return Response.json({
      ok: result.ok,
      fetched: mapped.length,
      saved: result.count,
      dateRange: { start: formatDate(start), end: formatDate(end) },
      error: result.error,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
