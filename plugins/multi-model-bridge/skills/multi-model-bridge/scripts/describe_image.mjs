// describe_image.mjs — multi-model-bridge: 把图片交给外部视觉模型（人格 Luna）转成文字描述。
// 可移植版本：密钥来自环境变量或 ~/.config/multi-model-bridge.json，不硬编码任何用户路径。
//
// 用法:
//   node describe_image.mjs <图片路径> [问题…]
//
// 配置优先级: 环境变量 > ~/.config/multi-model-bridge.json
//   env: LUNASEE_API_KEY (回退 OPENAI_API_KEY), LUNASEE_API_BASE (默认官方), LUNASEE_MODEL (默认 gpt-4o)
//   配置文件: { "apiKey": "...", "apiBase": "...", "model": "...", "personaName": "Luna" }
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ---- 配置解析（不打印密钥）----
let cfg = {};
try {
  const p = path.join(os.homedir(), ".config", "multi-model-bridge.json");
  cfg = JSON.parse(fs.readFileSync(p, "utf8"));
} catch {}

const env = process.env;
const apiBase = (cfg.apiBase || env.LUNASEE_API_BASE || env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/+$/, "");
const model = cfg.model || env.LUNASEE_MODEL || "gpt-4o";
const persona = cfg.personaName || "Luna";
const key = (env.LUNASEE_API_KEY || env.OPENAI_API_KEY || cfg.apiKey || "").trim();

if (!key) {
  console.error(
    "缺少 API Key：设置环境变量 LUNASEE_API_KEY（或 OPENAI_API_KEY），" +
      "或在 ~/.config/multi-model-bridge.json 写入 { \"apiKey\": \"...\" }"
  );
  process.exit(1);
}

// ---- 参数 ----
const imgPath = process.argv[2];
const question =
  process.argv.slice(3).join(" ") ||
  "请尽可能详细、准确地用中文描述这张图片的内容；图中有文字请原文抄录；如含图表/公式请说明结构。";

if (!imgPath || !fs.existsSync(imgPath)) {
  console.error("用法: node describe_image.mjs <图片路径> [问题…]");
  process.exit(1);
}

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};
const ext = path.extname(imgPath).toLowerCase();
const mime = MIME[ext] || "image/png";
const b64 = fs.readFileSync(imgPath).toString("base64");

// ---- 调用外部视觉模型 ----
const res = await fetch(`${apiBase}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "system",
        content: `你是${persona}，一位善于观察与表达的视觉助手。请用简洁、准确、有条理的中文描述图片内容；图中有文字就原文抄录；用户有具体问题就针对问题回答。`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: question },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
        ],
      },
    ],
    max_tokens: 1200,
  }),
});

const data = await res.json();
if (!res.ok) {
  console.error("API 错误:", res.status, JSON.stringify(data).slice(0, 500)); // 不含密钥
  process.exit(1);
}
const out = data.choices?.[0]?.message?.content ?? "(无返回)";
console.log(`[${persona}] ${out}`);
