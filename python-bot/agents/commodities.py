from .base import BaseAgent

class CommoditiesAgent(BaseAgent):
    name = "commodities"
    def __init__(self, bridge, ai, config):
        super().__init__(bridge, ai, config)
        self.symbols = config.AGENTS["commodities"]
        self.timeframes = ["H1", "H4"]
