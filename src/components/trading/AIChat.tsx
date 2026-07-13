import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const seed: UIMessage[] = [
  {
    id: "m0",
    role: "assistant",
    parts: [
      {
        type: "text",
        text:
          "**Nexus AI online.** Main aap ka trading brain hun — Gemini se powered.\n\n" +
          "Mujh se poochein:\n- Naya strategy design karo (e.g. \"Gold ke liye London ORB banao\")\n- Kisi symbol ka analysis (e.g. \"XAUUSD H1 par kya edge hai?\")\n- Risk math check (e.g. \"$10k account, 1% risk, XAUUSD 0.1 lot SL 30 pips — sahi hai?\")\n- News impact (e.g. \"Fed rate cut delay ka DXY par kya asar?\")",
      },
    ],
  },
];

export function AIChat() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status } = useChat({
    messages: seed,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  async function submit() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="flex h-[560px] flex-col rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">Nexus AI — Gemini 2.5 Flash</div>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> live
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          const mine = m.role === "user";
          return (
            <div key={m.id} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${mine ? "bg-accent text-accent-foreground" : "bg-primary/15 text-primary"}`}>
                {mine ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${mine ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"}`}>
                {text || (busy && !mine ? "…" : "")}
              </div>
            </div>
          );
        })}
        {busy && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Nexus soch raha hai…</div>
          </div>
        )}
      </div>
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Strategy discuss karein, market analysis pucho, risk check karo…"
            rows={2}
            className="resize-none"
          />
          <Button onClick={submit} disabled={busy || !input.trim()} size="icon" className="h-10 w-10 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}