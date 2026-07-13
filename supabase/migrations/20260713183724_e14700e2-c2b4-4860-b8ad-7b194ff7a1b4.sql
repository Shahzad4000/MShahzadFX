
CREATE TABLE public.mt5_candles (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  time TIMESTAMPTZ NOT NULL,
  o DOUBLE PRECISION NOT NULL,
  h DOUBLE PRECISION NOT NULL,
  l DOUBLE PRECISION NOT NULL,
  c DOUBLE PRECISION NOT NULL,
  v DOUBLE PRECISION,
  pushed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (symbol, timeframe, time)
);
CREATE INDEX idx_mt5_candles_lookup ON public.mt5_candles (symbol, timeframe, time DESC);
GRANT SELECT ON public.mt5_candles TO anon;
GRANT SELECT ON public.mt5_candles TO authenticated;
GRANT ALL ON public.mt5_candles TO service_role;
ALTER TABLE public.mt5_candles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read candles" ON public.mt5_candles FOR SELECT USING (true);
