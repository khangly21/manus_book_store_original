import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Bot, ChevronDown, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  "What payment methods do you accept?",
  "How does book verification work?",
  "What is your return policy?",
  "How do I track my order?",
];

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm **CryptoBot**, your AI book assistant 📚\n\nI can help you with book recommendations, payment questions, order tracking, and more. What can I help you with today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const askChatbot = trpc.chatbot.chat.useMutation({
    onMutate: () => {
      setIsStreaming(true);
      setStreamingContent("");
    },
    onSuccess: (data: { content: string | any[] }) => {
      setIsStreaming(false);
      setStreamingContent("");
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content),
          timestamp: new Date(),
        },
      ]);
    },
    onError: () => {
      setIsStreaming(false);
      setStreamingContent("");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const sendMessage = (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isStreaming) return;
    setInput("");
    const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content: msg, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    const history = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));
    askChatbot.mutate({ message: msg, history });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300",
          "bg-gradient-to-br from-yellow-400 to-yellow-600 text-navy",
          "hover:scale-110 active:scale-95",
          open ? "rotate-180 opacity-0 pointer-events-none" : "rotate-0 opacity-100"
        )}
        aria-label="Open chat"
      >
        <MessageCircle className="w-6 h-6" />
        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-background" />
        )}
      </button>

      {/* Chat Window */}
      <div className={cn(
        "fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col",
        "transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
        open ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" : "opacity-0 translate-y-4 scale-95 pointer-events-none",
        "max-h-[600px]"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-navy-light to-card rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-navy" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground text-sm">CryptoBot</span>
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-xs text-muted-foreground">AI Book Assistant · Online</span>
              </div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" style={{ maxHeight: "380px" }}>
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400/80 to-yellow-600/80 flex items-center justify-center flex-none mt-0.5">
                  <Bot className="w-4 h-4 text-navy" />
                </div>
              )}
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-secondary text-foreground rounded-tl-sm"
              )}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {/* Streaming indicator */}
          {isStreaming && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400/80 to-yellow-600/80 flex items-center justify-center flex-none mt-0.5">
                <Bot className="w-4 h-4 text-navy" />
              </div>
              <div className="bg-secondary rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                <div className="flex gap-1 items-center h-5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length === 1 && !isStreaming && (
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs bg-secondary hover:bg-border text-foreground px-2.5 py-1.5 rounded-lg transition-colors border border-border/50 hover:border-primary/30"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-border">
          <div className="flex gap-2 bg-secondary rounded-xl border border-border/50 focus-within:border-primary/50 transition-colors">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about books, payments, orders..."
              disabled={isStreaming}
              className="flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isStreaming}
              className={cn(
                "m-1.5 w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                input.trim() && !isStreaming
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                  : "bg-border text-muted-foreground cursor-not-allowed"
              )}
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">Powered by AI · Trained by our team</p>
        </div>
      </div>
    </>
  );
}
