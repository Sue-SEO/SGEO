// 封装对 Google Search Console API 的调用。
// 只在服务器端使用（API路由里），密钥不会暴露给浏览器。

import { google } from "googleapis";

function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "缺少 GOOGLE_SERVICE_ACCOUNT_EMAIL 或 GOOGLE_PRIVATE_KEY 环境变量，请在 Vercel 项目设置里添加"
    );
  }
  // JSON密钥文件里的私钥是带 \n 转义符的一整行文本，存成环境变量后
  // 需要把 \n 还原成真正的换行符，否则Google的库无法解析这把密钥。
  const privateKey = rawKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

export interface GscApiRow {
  keys?: string[] | null;
  clicks?: number | null;
  impressions?: number | null;
  ctr?: number | null;
  position?: number | null;
}

export async function fetchGscPerformance(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<GscApiRow[]> {
  const auth = getAuthClient();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["date", "page", "query"],
      rowLimit: 25000,
    },
  });

  return res.data.rows || [];
}
