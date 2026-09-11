// 这个文件运行在服务器端，浏览器永远看不到这段代码和 ANTHROPIC_API_KEY 的值。
// 前端只调用 /api/classify 这个地址，真正的密钥留在服务器这一层。

import type { ClassifyRequest, ClassifyResultItem } from "@/lib/types";

function buildPrompt(topic: string, batch: { keyword: string }[]): string {
  const lines = batch.map((r, idx) => `${idx}: ${r.keyword}`).join("\n");
  return `你是电商网站的SEO关键词筛选助手。该网站的核心业务/主题是："${
    topic || "未指定，请根据常识判断"
  }"。
请判断下面词表中每一个关键词，是否与该业务主题相关、适合作为SEO内容或落地页的目标词。
分类只能是以下三种之一：
- relevant：与主题强相关，适合作为SEO目标词
- irrelevant：主题不符、意图不符，或明显是别的领域/别的产品的词
- uncertain：难以判断，需要人工复核

只输出一个JSON数组，不要任何多余文字、不要解释、不要markdown代码块标记。格式示例：
[{"i":0,"c":"relevant","n":"核心产品词"},{"i":1,"c":"irrelevant","n":"与主题无关"}]

词表：
${lines}`;
}

export async function POST(req: Request) {
  const { topic, batch }: ClassifyRequest = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "服务器未配置 ANTHROPIC_API_KEY，请在 Vercel 项目的环境变量里添加" },
      { status: 500 }
    );
  }

  const prompt = buildPrompt(topic, batch);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const text = (data.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed: ClassifyResultItem[] = JSON.parse(clean);

    return Response.json({ results: parsed });
  } catch (e) {
    const fallback: ClassifyResultItem[] = batch.map((_, idx) => ({
      i: idx,
      c: "uncertain",
      n: "判断失败，需人工复核",
    }));
    return Response.json({ results: fallback });
  }
}
