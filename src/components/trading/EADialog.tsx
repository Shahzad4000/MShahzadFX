import { useMemo, useState } from "react";
import { Copy, Download, FileCode2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { generateEA } from "@/lib/ea-generator";
import type { Strategy } from "@/lib/mock-data";

export function EADialog({ strategy }: { strategy: Strategy }) {
  const [open, setOpen] = useState(false);
  const code = useMemo(() => generateEA(strategy), [strategy]);
  const fileName = strategy.name.replace(/[^A-Za-z0-9]+/g, "_") + ".mq5";

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    toast.success("EA code copied", { description: fileName });
  };
  const download = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded", { description: fileName });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 h-7 px-2">
          <FileCode2 className="h-3.5 w-3.5" /> EA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-primary" />
            {strategy.brandHeader ?? "MShahzad-FX"} · MT5 EA — {strategy.name}
          </DialogTitle>
          <DialogDescription>
            Standalone <code>.mq5</code> · Magic #<b>{strategy.magicNumber}</b> · Telegram <b>{strategy.telegram}</b> · WhatsApp <b>{strategy.whatsapp}</b>. Compile in MetaEditor → attach to chart.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1 -mt-2">
          {strategy.indicators?.map((i) => (
            <Badge key={i} variant="secondary" className="text-[10px] font-normal">{i}</Badge>
          ))}
        </div>

        <div className="rounded-md border bg-muted/30 max-h-[420px] overflow-auto">
          <pre className="text-[11px] leading-relaxed p-3 font-mono whitespace-pre">{code}</pre>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            MT5 = broker account (Exness / XM). TrustWallet on-chain trades are handled separately in the dashboard's Wallet panel.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copy}><Copy className="h-4 w-4" /> Copy</Button>
            <Button size="sm" onClick={download}><Download className="h-4 w-4" /> Download .mq5</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
