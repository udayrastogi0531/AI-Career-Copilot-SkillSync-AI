import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import {
  Send,
  Trash2,
  Plus,
  Download,
  Pencil,
  MessageSquare,
  Sparkles,
  User,
  ArrowRight,
  TrendingUp,
  Award
} from "lucide-react";
import { toast } from "sonner";

const TypingAnimation = () => (
  <div className="flex items-center gap-1.5 py-1 px-2">
    <motion.span
      animate={{ opacity: [0.4, 1, 0.4], y: [0, -4, 0] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
      className="h-2 w-2 rounded-full bg-cyan-300"
    />
    <motion.span
      animate={{ opacity: [0.4, 1, 0.4], y: [0, -4, 0] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
      className="h-2 w-2 rounded-full bg-cyan-300"
    />
    <motion.span
      animate={{ opacity: [0.4, 1, 0.4], y: [0, -4, 0] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      className="h-2 w-2 rounded-full bg-cyan-300"
    />
  </div>
);

export default function CareerCoachPage() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const streamTimerRef = useRef(null);

  const quickPrompts = [
    { label: "Summary Optimizer", text: "Improve my resume summary for a high-growth tech startup" },
    { label: "Google Prep Guide", text: "Prepare a STAR mock roadmap for Google technical interviews" },
    { label: "Skill Accelerator", text: "What technology focus skills should I add to target Senior Engineering?" },
    { label: "Accomplishment Metrics", text: "How do I add STAR metrics to my Projects bullet points?" }
  ];

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId),
    [chats, activeChatId]
  );

  const messages = activeChat?.messages || [];

  const saveChats = (nextChats) => {
    setChats(nextChats);
    localStorage.setItem("career_copilot_chats", JSON.stringify(nextChats));
  };

  const saveChatsWith = (updater) => {
    setChats((prev) => {
      const nextChats = updater(prev);
      localStorage.setItem("career_copilot_chats", JSON.stringify(nextChats));
      return nextChats;
    });
  };

  const createNewChat = () => {
    const newChat = {
      id: String(Date.now()),
      title: `Career Thread ${chats.length + 1}`,
      messages: [
        {
          id: `msg-${Date.now()}`,
          type: "bot",
          text: "Hello! 👋 I'm your AI Career Coach. Ask me anything about resumes, job hunting, interviews, or career development.",
          timestamp: new Date().toISOString()
        }
      ]
    };
    saveChatsWith((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    toast.success("New career mentor thread created!");
  };

  const updateChatMessages = (chatId, nextMessages) => {
    saveChatsWith((prev) =>
      prev.map((chat) => (chat.id === chatId ? { ...chat, messages: nextMessages } : chat))
    );
  };

  const renameChat = (chatId) => {
    const current = chats.find((chat) => chat.id === chatId)?.title || "Career Thread";
    const title = window.prompt("Rename chat thread", current);
    if (!title) return;
    saveChatsWith((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)));
    toast.success("Thread renamed successfully!");
  };

  const deleteChat = (chatId) => {
    saveChatsWith((prev) => prev.filter((chat) => chat.id !== chatId));
    if (activeChatId === chatId) {
      const remaining = chats.filter((chat) => chat.id !== chatId);
      if (remaining[0]) {
        setActiveChatId(remaining[0].id);
      } else {
        createNewChat();
      }
    }
    toast.info("Career thread deleted");
  };

  const exportChat = () => {
    if (!activeChat) return;
    const payload = {
      title: activeChat.title,
      messages: activeChat.messages
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeChat.title.replace(/\s+/g, "-").toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Career thread exported successfully!");
  };

  const renderInlineMarkdown = (text) => {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const withBold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong class='text-cyan-300 font-bold'>$1</strong>");
    const withCode = withBold.replace(/`(.+?)`/g, "<code class='bg-slate-950/80 px-1.5 py-0.5 rounded text-xs text-indigo-300 font-mono'>$1</code>");
    return <span dangerouslySetInnerHTML={{ __html: withCode }} />;
  };

  const renderMarkdown = (text) => {
    const lines = String(text || "").split("\n");
    const listItems = [];
    const blocks = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        listItems.push(
          <li key={`li-${index}`} className="text-sm text-slate-100 flex items-start gap-2">
            <span className="text-cyan-300 mt-1 flex-shrink-0">•</span>
            <span>{renderInlineMarkdown(trimmed.replace(/^[-*]\s+/, ""))}</span>
          </li>
        );
      } else {
        if (listItems.length) {
          blocks.push(
            <ul key={`ul-${index}`} className="mb-3 pl-2 space-y-2">
              {listItems.splice(0)}
            </ul>
          );
        }
        if (trimmed) {
          blocks.push(
            <p key={`p-${index}`} className="text-sm leading-relaxed text-slate-200 mb-3">
              {renderInlineMarkdown(trimmed)}
            </p>
          );
        }
      }
    });

    if (listItems.length) {
      blocks.push(
        <ul key="ul-last" className="mb-3 pl-2 space-y-2">
          {listItems}
        </ul>
      );
    }

    return blocks;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const stored = localStorage.getItem("career_copilot_chats");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setChats(parsed);
        setActiveChatId(parsed[0]?.id || "");
        return;
      } catch {
        localStorage.removeItem("career_copilot_chats");
      }
    }
    const initial = [
      {
        id: String(Date.now()),
        title: "Welcome Thread",
        messages: [
          {
            id: `msg-${Date.now()}`,
            type: "bot",
            text: "Hello! 👋 I'm your AI Career Coach. Ask me anything about resumes, job hunting, interviews, or career development. I'm here to help you succeed!",
            timestamp: new Date().toISOString()
          }
        ]
      }
    ];
    saveChats(initial);
    setActiveChatId(initial[0].id);
  }, []);

  useEffect(() => {
    return () => {
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async (e, overrideMessage) => {
    if (e) e.preventDefault();
    if ((!inputValue.trim() && !overrideMessage) || loading || !activeChatId) return;

    const userMessage = overrideMessage || inputValue.trim();
    setInputValue("");
    setError("");

    const userMsg = {
      id: Date.now(),
      type: "user",
      text: userMessage,
      timestamp: new Date().toISOString()
    };

    const currentMessages = [...messages, userMsg];
    updateChatMessages(activeChatId, currentMessages);
    setLoading(true);

    try {
      const { data } = await api.post("/coach/chat", { message: userMessage });
      const fullText = data.result?.answer || "I couldn't generate a response. Please try again.";
      const botMsg = {
        id: `msg-${Date.now() + 1}`,
        type: "bot",
        text: "",
        fullText,
        actions: data.result?.actions || [],
        timestamp: new Date().toISOString()
      };
      
      const nextMessages = [...currentMessages, botMsg];
      updateChatMessages(activeChatId, nextMessages);
      
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
      }

      let currentIndex = 0;
      streamTimerRef.current = setInterval(() => {
        currentIndex += 3;
        updateChatMessages(
          activeChatId,
          nextMessages.map((msg) => {
            if (msg.id !== botMsg.id) return msg;
            return { ...msg, text: fullText.slice(0, currentIndex) };
          })
        );
        if (currentIndex >= fullText.length) {
          clearInterval(streamTimerRef.current);
        }
      }, 15);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to get response from coach");
      const errorMsg = {
        id: `msg-${Date.now() + 1}`,
        type: "error",
        text: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString()
      };
      updateChatMessages(activeChatId, [...currentMessages, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (!activeChatId) return;
    updateChatMessages(activeChatId, [
      {
        id: `msg-${Date.now()}`,
        type: "bot",
        text: "Hello! 👋 I'm your AI Career Coach. Ask me anything about resumes, job hunting, interviews, or career development. I'm here to help you succeed!",
        timestamp: new Date().toISOString()
      }
    ]);
    setError("");
    toast.info("Thread history cleared");
  };

  return (
    <section className="min-h-[calc(100vh-140px)] flex flex-col text-white max-w-6xl mx-auto py-4">
      {/* Page Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-extrabold flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" /> Career Mentoring
          </span>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">AI Career Coach Pro</h1>
          <p className="mt-1 text-sm text-slate-400">Get persistent advice, interview tips, and STAR roadmaps.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={createNewChat}
            className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/20 transition"
          >
            <Plus className="h-4 w-4" /> New thread
          </button>
          <button
            onClick={exportChat}
            className="flex items-center gap-2 rounded-xl border border-slate-500/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5 transition"
          >
            <Download className="h-4 w-4" /> Export thread
          </button>
          <button
            onClick={clearHistory}
            className="flex items-center gap-2 rounded-xl border border-slate-500/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5 transition"
          >
            <Trash2 className="h-4 w-4" /> Clear history
          </button>
        </div>
      </div>

      <ErrorBanner message={error} />

      {/* Main Console Split */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr] flex-1">
        {/* Left Side Pane: Threads & Prompts */}
        <aside className="space-y-6 flex flex-col max-h-[660px] lg:max-h-[720px]">
          {/* Threads list */}
          <div className="premium-card p-5 flex-1 overflow-y-auto space-y-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold border-b border-white/10 pb-2">
              Career Threads
            </p>
            <div className="space-y-2">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  className={`w-full rounded-xl border p-3 text-left transition cursor-pointer ${
                    activeChatId === chat.id
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.1)]"
                      : "border-white/5 bg-white/5 text-slate-400 hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-bold truncate">
                      <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                      {chat.title}
                    </span>
                    <span className="text-[10px] rounded px-1.5 py-0.5 bg-slate-950/40 text-slate-500">
                      {chat.messages.length}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-3 border-t border-white/5 pt-2 text-[10px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        renameChat(chat.id);
                      }}
                      className="inline-flex items-center gap-1 text-slate-400 hover:text-cyan-300 transition"
                    >
                      <Pencil className="h-3 w-3" /> Rename
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                      className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 transition"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick suggestions */}
          <div className="premium-card p-5 space-y-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold border-b border-white/10 pb-2">
              Mentor suggestions
            </p>
            <div className="space-y-2">
              {quickPrompts.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={(e) => sendMessage(e, p.text)}
                  disabled={loading}
                  className="w-full text-left rounded-xl border border-white/5 bg-white/5 px-3 py-2.5 text-xs text-slate-350 hover:border-cyan-400/30 hover:bg-cyan-500/5 hover:text-cyan-350 transition duration-300 disabled:opacity-40"
                >
                  <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-cyan-300" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Chat Console Panel */}
        <div className="flex flex-col max-h-[660px] lg:max-h-[720px]">
          {/* Messages Panel */}
          <div className="flex-1 overflow-y-auto mb-4 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-5 shadow-2xl relative scrollbar-thin">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isUser = msg.type === "user";
                const isError = msg.type === "error";
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {/* Bot avatar */}
                    {!isUser && (
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/10 mt-0.5 flex-shrink-0">
                        AC
                      </div>
                    )}

                    <div
                      className={`max-w-[78%] rounded-3xl px-5 py-4 border ${
                        isUser
                          ? "bg-gradient-to-r from-cyan-400/20 to-indigo-500/10 border-cyan-400/30 text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          : isError
                          ? "bg-rose-950/20 border-rose-500/30 text-rose-100"
                          : "bg-slate-900/60 border-white/5 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                      }`}
                    >
                      <div className="space-y-1.5">
                        {isUser || isError ? (
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                        ) : (
                          renderMarkdown(msg.text || msg.fullText || "")
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>{isUser ? "Candidate Profile" : "AI Career Mentor"}</span>
                      </div>

                      {/* Display suggestions roadmap nodes */}
                      {!isUser && msg.actions && msg.actions.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-cyan-500/20 pt-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Suggested Action Roadmap</p>
                          {msg.actions.map((action, idx) => (
                            <p key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                              <span className="text-cyan-300 mt-0.5 font-bold">→</span>
                              <span>{action}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* User avatar */}
                    {isUser && (
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-cyan-300 font-black text-xs mt-0.5 flex-shrink-0">
                        <User className="h-4.5 w-4.5" />
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Streaming loading indicator */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start gap-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-950 font-black text-xs mt-0.5">
                    AC
                  </div>
                  <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-4">
                    <TypingAnimation />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Form input console */}
          <form onSubmit={sendMessage} className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about resumes formatting, target checklists, panel reviews..."
              disabled={loading || !activeChatId}
              className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/30 disabled:opacity-40"
            />
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              type="submit"
              disabled={loading || !inputValue.trim() || !activeChatId}
              className="rounded-2xl bg-cyan-500/20 border border-cyan-400/40 px-5 py-4 text-cyan-300 hover:bg-cyan-500/35 transition disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send className="h-5 w-5" />
            </motion.button>
          </form>
        </div>
      </div>
    </section>
  );
}
