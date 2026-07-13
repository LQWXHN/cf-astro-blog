import type { APIRoute } from "astro";
import { getDb } from "@/lib/db";
import { notes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { env } from "cloudflare:workers";

const colorMap: Record<string, string> = {
  yellow: "#fef3c7",
  blue: "#dbeafe",
  green: "#d1fae5",
  pink: "#fce7f3",
  purple: "#ede9fe",
  orange: "#fed7aa",
  red: "#fecaca",
  gray: "#e5e7eb",
};

// 十六进制颜色 → colorTheme 映射（用于用户自定义颜色）
function hexToTheme(hex: string): string {
  const entries = Object.entries(colorMap);
  // 将 hex 转为 RGB 数值进行比较
  const targetR = parseInt(hex.slice(1, 3), 16);
  const targetG = parseInt(hex.slice(3, 5), 16);
  const targetB = parseInt(hex.slice(5, 7), 16);
  
  let minDist = Infinity;
  let closest = "yellow";
  for (const [theme, themeHex] of entries) {
    const r = parseInt(themeHex.slice(1, 3), 16);
    const g = parseInt(themeHex.slice(3, 5), 16);
    const b = parseInt(themeHex.slice(5, 7), 16);
    const dist = (r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2;
    if (dist < minDist) {
      minDist = dist;
      closest = theme;
    }
  }
  return closest;
}

export const GET: APIRoute = async () => {
  const db = getDb(env.DB);
  const result = await db
    .select()
    .from(notes)
    .where(eq(notes.status, "approved"))
    .orderBy(desc(notes.createdAt))
    .limit(150);

  const mapped = result.map(note => ({
    ...note,
    color: colorMap[note.colorTheme] || "#f3f4f6"
  }));

  return new Response(JSON.stringify(mapped), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json();
    const content = body.content?.trim();
    const customColor = body.color || null; // 用户选择的颜色（十六进制）
    
    if (!content) {
      return new Response(JSON.stringify({ error: "内容不能为空" }), { status: 400 });
    }
    if (content.length > 30) {
      return new Response(JSON.stringify({ error: "内容不能超过30个字" }), { status: 400 });
    }
    
    const sanitized = content.replace(/<[^>]*>/g, "");
    const db = getDb(env.DB);
    
    // 确定颜色主题
    let colorTheme: string;
    if (customColor && customColor.startsWith("#")) {
      colorTheme = hexToTheme(customColor);
    } else {
      const themes = ["yellow", "blue", "green", "pink", "purple", "orange"];
      colorTheme = themes[Math.floor(Math.random() * themes.length)];
    }
    
    await db.insert(notes).values({
      content: sanitized,
      colorTheme,
      positionLeft: Math.floor(Math.random() * 70) + 5,
      positionTop: Math.floor(Math.random() * 70) + 5,
      rotation: Math.floor(Math.random() * 20) - 10,
      status: "approved",
      visitorIp: clientAddress,
    });
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "服务器错误" }), { status: 500 });
  }
};