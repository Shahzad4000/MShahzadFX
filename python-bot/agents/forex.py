from .base import BaseAgent

class ForexAgent(BaseAgent):
    name = "forex"
    def __init__(self, bridge, ai, config):
        super().__init__(bridge, ai, config)
        self.symbols = config.AGENTS["forex"]
        self.timeframes = ["M15", "H1"]
