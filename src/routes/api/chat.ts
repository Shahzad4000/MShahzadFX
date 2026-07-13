import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM = `You are "Nexus AI" — the brain of an autonomous multi-agent MT5 trading system.

Agents you orchestrate:
- Forex Agent (EURUSD, GBPUSD, USDJPY, AUDUSD...)
- Crypto Agent (BTCUSD, ETHUSD, SOLUSD...)
- Metals Agent (XAUUSD gold, XAGUSD silver)
- Commodities Agent (WTI, Brent, NatGas)
- News Agent (global macro, geopolitics, central banks)
- Manager Agent (you) — orchestrates the four specialists

Capabilities:
- Discuss, design, and iterate on trading strategies (SMC, ICT, ORB, mean-reversion, ML/AI, breakout, carry, news-driven).
- Explain risk math: 1% per trade, R:R >= 1:1.5, correlation exposure, max drawdown.
- Analyze uploaded trade history and suggest adaptive tweaks.
- Recommend timeframes (M5/M15/H1/H4/D1) and confluences.
- Always output strategies as: Name, Instruments, Timeframe, Entry Rules, Exit Rules, SL/TP, Risk %, Expected Edge.

Style: concise, professional trader tone. Use markdown, bullet points, tables when useful.
You reply in the SAME language the user writes in (English, Roman Urdu, or Urdu).`;

// --- Abuse guards (mitigates unauthenticated public endpoint costs) ---
const MAX_MESSAGES = 30;
const MAX_CHARS_PER_MSG = 4000;
const MAX_TOTAL_CHARS = 20000;
const MAX_OUTPUT_TOKENS = 800;

// Best-effort per-IP rate limiter (per-isolate memory; not global, but blocks trivial spam)
const RATE_LIMIT = { windowMs: 60_000, max: 15 };
const hits = new Map<string, { count: number; reset: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + RATE_LIMIT.windowMs });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_LIMIT.max;
}
function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = clientIp(request);
        if (rateLimited(ip)) {
          return new Response("Rate limit exceeded. Try again in a minute.", { status: 429 });
        }

        let body: { messages?: UIMessage[] };
        try {
          body = (await request.json()) as { messages?: UIMessage[] };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const messages = body?.messages;
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("Messages required", { status: 400 });
        }
        if (messages.length > MAX_MESSAGES) {
          return new Response(`Too many messages (max ${MAX_MESSAGES})`, { status: 413 });
        }
        let total = 0;
        for (const m of messages) {
          const text = Array.isArray(m?.parts)
            ? m.parts.map((p) => (p?.type === "text" ? p.text ?? "" : "")).join("")
            : "";
          if (text.length > MAX_CHARS_PER_MSG) {
            return new Response(`Message too long (max ${MAX_CHARS_PER_MSG} chars)`, { status: 413 });
          }
          total += text.length;
        }
        if (total > MAX_TOTAL_CHARS) {
          return new Response(`Conversation too long (max ${MAX_TOTAL_CHARS} chars)`, { status: 413 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-2.5-flash"),
          system: SYSTEM,
          messages: await convertToModelMessages(messages),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        });
        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});