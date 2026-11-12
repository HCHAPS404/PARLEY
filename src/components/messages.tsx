"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { usePrefs } from "./preferences";

interface Thread {
  id: string;
  subject: string | null;
  counterpart: string;
  lastMsg: { body: string; role: string; at: string } | null;
  unread: number;
  lastMsgAt: string;
}
interface Msg {
  id: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

/** Buyer↔seller deal channel — one thread per relationship, both personas
 * share this view. */
export function MessagesPanel({ persona }: { persona: "buyer" | "seller" }) {
  const { t } = usePrefs();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const myRole = persona;

  const loadThreads = useCallback(
    () =>
      fetch("/api/threads")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setThreads(d.threads ?? []))
        .catch(() => {}),
    [],
  );
  const loadMsgs = useCallback(
    (id: string) =>
      fetch("/api/threads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: id }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setMsgs(d.messages ?? []))
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    loadThreads();
    const id = setInterval(loadThreads, 15_000);
    return () => clearInterval(id);
  }, [loadThreads]);
  useEffect(() => {
    if (active) {
      loadMsgs(active);
      const id = setInterval(() => loadMsgs(active), 10_000);
      return () => clearInterval(id);
    }
  }, [active, loadMsgs]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !active || sending) return;
    setSending(true);
    try {
      const r = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: active, body }),
      });
      if (r.ok) {
        setDraft("");
        await loadMsgs(active);
        await loadThreads();
      }
    } finally {
      setSending(false);
    }
  };

  const sel = threads?.find((t) => t.id === active);

  return (
    <div className="flex min-h-0 flex-1">
      {/* Thread list */}
      <div className="w-64 shrink-0 border-r border-line">
        {threads === null ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-line/40" />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="p-6 text-center">
            <MessageSquare className="mx-auto h-6 w-6 text-ink-soft/50" />
            <p className="mt-2 text-[12px] text-ink-soft">{t("msg.empty")}</p>
            <p className="mt-1 text-[11px] text-ink-soft/70">{t("msg.emptySub")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-line/50">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setActive(t.id)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    active === t.id ? "bg-accent-mist" : "hover:bg-paper"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">{t.counterpart}</span>
                    {t.unread > 0 && (
                      <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-paper">
                        {t.unread}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-soft">
                    {t.subject && <span className="text-accent-strong/80">{t.subject} · </span>}
                    {t.lastMsg ? t.lastMsg.body : "—"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Conversation */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!sel ? (
          <div className="grid flex-1 place-items-center text-[12px] text-ink-soft">
            {t("msg.pick")}
          </div>
        ) : (
          <>
            <div className="border-b border-line px-4 py-3">
              <div className="font-display text-sm font-semibold">{sel.counterpart}</div>
              {sel.subject && <div className="text-[11px] text-ink-soft">{sel.subject}</div>}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {msgs.map((m) => {
                const mine = m.senderRole === myRole;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-[13px] ${
                        mine
                          ? "rounded-br-md bg-accent text-paper"
                          : "rounded-bl-md border border-line bg-card"
                      }`}
                    >
                      {m.body}
                      <div
                        className={`mt-0.5 text-[9px] ${mine ? "text-paper/70" : "text-ink-soft/70"}`}
                      >
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="border-t border-line p-3">
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={t("msg.placeholder")}
                  className="min-w-0 flex-1 rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
                />
                <button
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  className="rounded-md bg-accent px-3.5 py-2 text-paper transition-colors hover:bg-accent-strong disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
