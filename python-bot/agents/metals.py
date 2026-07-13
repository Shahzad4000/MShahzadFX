from .base import BaseAgent

class MetalsAgent(BaseAgent):
    name = "metals"
    def __init__(self, bridge, ai, config):
        super().__init__(bridge, ai, config)
        self.symbols = config.AGENTS["metals"]
        self.timeframes = ["M5", "M15", "H1"]
