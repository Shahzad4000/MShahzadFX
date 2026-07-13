from .base import BaseAgent

class CryptoAgent(BaseAgent):
    name = "crypto"
    def __init__(self, bridge, ai, config):
        super().__init__(bridge, ai, config)
        self.symbols = config.AGENTS["crypto"]
        self.timeframes = ["M15", "H1", "H4"]
