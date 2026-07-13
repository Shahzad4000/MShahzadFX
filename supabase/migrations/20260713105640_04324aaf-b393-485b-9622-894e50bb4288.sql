
CREATE TABLE public.bot_metrics (
  id bigserial PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  balance numeric,
  equity numeric,
  margin numeric,
  free_margin numeric,
  currency text,
  positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  news_bias jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.bot_metrics TO anon, authenticated;
GRANT ALL ON public.bot_metrics TO service_role;
ALTER TABLE public.bot_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read metrics" ON public.bot_metrics FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.bot_trades (
  id bigserial PRIMARY KEY,
  ticket bigint,
  symbol text NOT NULL,
  side text NOT NULL,
  lot numeric NOT NULL,
  entry numeric NOT NULL,
  sl numeric,
  tp numeric,
  pnl numeric,
  status text NOT NULL DEFAULT 'OPEN',
  agent text,
  comment text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  raw jsonb
);
CREATE INDEX bot_trades_status_idx ON public.bot_trades(status);
CREATE INDEX bot_trades_opened_at_idx ON public.bot_trades(opened_at DESC);
GRANT SELECT ON public.bot_trades TO anon, authenticated;
GRANT ALL ON public.bot_trades TO service_role;
ALTER TABLE public.bot_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read trades" ON public.bot_trades FOR SELECT TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_trades;
