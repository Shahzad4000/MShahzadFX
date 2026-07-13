import { createFileRoute } from "@tanstack/react-router";

type Candle = { time: string; o: number; h: number; l: number; c: number; v?: number };
type PushBody = { symbol: string; timeframe: string; candles: Candle[] };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-bot-token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export const Route = createFileRoute("/api/public/mt5-candles")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      // Public read: last N candles for symbol+timeframe (used by the strategy tester)
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const symbol = (url.searchParams.get("symbol") ?? "").toUpperCase();
        const timeframe = (url.searchParams.get("timeframe") ?? "H1").toUpperCase();
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 5000), 20000);
        if (!symbol) {
          return Response.json({ error: "symbol required" }, { status: 400, headers: CORS });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("mt5_candles")
          .select("time,o,h,l,c,v")
          .eq("symbol", symbol)
          .eq("timeframe", timeframe)
          .order("time", { ascending: false })
          .limit(limit);
        if (error) return Response.json({ error: error.message }, { status: 500, headers: CORS });
        const rows = (data ?? []).slice().reverse();
        return Response.json(
          { symbol, timeframe, count: rows.length, candles: rows },
          { headers: { ...CORS, "cache-control": "public, max-age=60" } },
        );
      },

      // Python bot push endpoint — protected by BOT_INGEST_TOKEN
      POST: async ({ request }) => {
        const token = request.headers.get("x-bot-token");
        const expected = process.env.BOT_INGEST_TOKEN;
        if (!expected || token !== expected) {
          return new Response("unauthorized", { status: 401, headers: CORS });
        }
        let body: PushBody;
        try { body = (await request.json()) as PushBody; }
        catch { return new Response("bad json", { status: 400, headers: CORS }); }
        if (!body?.symbol || !body?.timeframe || !Array.isArray(body.candles)) {
          return new Response("symbol, timeframe, candles required", { status: 400, headers: CORS });
        }
        const symbol = body.symbol.toUpperCase();
        const timeframe = body.timeframe.toUpperCase();
        const rows = body.candles.map((k) => ({
          symbol, timeframe, time: k.time,
          o: k.o, h: k.h, l: k.l, c: k.c, v: k.v ?? 0,
        }));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // upsert in chunks of 500 to stay under statement limits
        let inserted = 0;
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500);
          const { error } = await supabaseAdmin
            .from("mt5_candles")
            .upsert(chunk, { onConflict: "symbol,timeframe,time" });
          if (error) return Response.json({ error: error.message, inserted }, { status: 500, headers: CORS });
          inserted += chunk.length;
        }
        return Response.json({ ok: true, symbol, timeframe, inserted }, { headers: CORS });
      },
    },
  },
});