import { createFileRoute } from "@tanstack/react-router";

type Position = {
  ticket?: number;
  symbol: string;
  side: string;
  lot: number;
  entry: number;
  sl?: number;
  tp?: number;
  pnl?: number;
  comment?: string;
  time?: string;
};

type IngestBody = {
  ts?: string;
  account?: {
    balance?: number;
    equity?: number;
    margin?: number;
    free_margin?: number;
    currency?: string;
  };
  positions?: Position[];
  news_bias?: Record<string, number>;
  closed_trades?: Array<Position & { pnl: number; closed_at?: string }>;
};

export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-bot-token");
        const expected = process.env.BOT_INGEST_TOKEN;
        if (!expected || token !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        let body: IngestBody;
        try {
          body = (await request.json()) as IngestBody;
        } catch {
          return new Response("bad json", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Insert metrics snapshot
        if (body.account) {
          await supabaseAdmin.from("bot_metrics").insert({
            ts: body.ts ?? new Date().toISOString(),
            balance: body.account.balance,
            equity: body.account.equity,
            margin: body.account.margin,
            free_margin: body.account.free_margin,
            currency: body.account.currency,
            positions: body.positions ?? [],
            news_bias: body.news_bias ?? {},
          });
        }

        // Upsert open positions as trades
        if (Array.isArray(body.positions)) {
          for (const p of body.positions) {
            if (!p.ticket) continue;
            await supabaseAdmin.from("bot_trades").upsert(
              {
                ticket: p.ticket,
                symbol: p.symbol,
                side: p.side,
                lot: p.lot,
                entry: p.entry,
                sl: p.sl,
                tp: p.tp,
                pnl: p.pnl,
                status: "OPEN",
                comment: p.comment,
                raw: JSON.parse(JSON.stringify(p)),
              },
              { onConflict: "ticket" },
            );
          }
        }

        // Mark closed trades
        if (Array.isArray(body.closed_trades)) {
          for (const t of body.closed_trades) {
            if (!t.ticket) continue;
            await supabaseAdmin
              .from("bot_trades")
              .update({
                status: "CLOSED",
                pnl: t.pnl,
                closed_at: t.closed_at ?? new Date().toISOString(),
              })
              .eq("ticket", t.ticket);
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});