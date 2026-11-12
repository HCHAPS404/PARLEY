"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, MessageSquare, Pin, PinOff, Send, X } from "lucide-react";
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
  image: string | null;
  pinned: boolean;
  createdAt: string;
}

/** Same downscale as product photos — 800px max, JPEG 0.8 data URL. */
function fileToMsgImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 800;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Buyer↔seller deal channel — one thread per relationship, both personas
 * share this view. */
export function MessagesPanel({ persona }: { persona: "buyer" | "seller" }) {
  const { t } = usePrefs();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [img, setImg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
    if ((!body && !img) || !active || sending) return;
    setSending(true);
    try {
      const r = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: active, body, image: img }),
      });
      if (r.ok) {
        setDraft("");
        setImg(null);
        await loadMsgs(active);
        await loadThreads();
      }
    } finally {
      setSending(false);
    }
  };

  const togglePin = async (m: Msg) => {
    const r = await fetch("/api/threads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: m.id, pinned: !m.pinned }),
    });
    if (r.ok && active) await loadMsgs(active);
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
            {msgs.some((m) => m.pinned) && (
              <div className="space-y-1 border-b border-line bg-accent-mist/40 px-4 py-2">
                {msgs.filter((m) => m.pinned).map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-[11px] text-ink-soft">
                    <Pin className="h-3 w-3 shrink-0 text-accent-strong" />
                    <span className="min-w-0 flex-1 truncate">
                      {m.image && !m.body.startsWith("📷") ? m.body : m.body === "📷" ? t("msg.pinnedPhoto") : m.body}
                    </span>
                    <button onClick={() => togglePin(m)} className="shrink-0 text-ink-soft/60 hover:text-ink" aria-label={t("msg.unpin")}>
                      <PinOff className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {msgs.map((m) => {
                if (m.senderRole === "system") {
                  return (
                    <div key={m.id} className="flex justify-center">
                      <div className="max-w-[85%] rounded-full border border-line/70 bg-paper px-3.5 py-1.5 text-center text-[11px] text-ink-soft">
                        {m.body}
                        <span className="ml-1.5 text-[9px] text-ink-soft/60">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                }
                const mine = m.senderRole === myRole;
                return (
                  <div key={m.id} className={`group flex items-center gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] overflow-hidden rounded-2xl text-[13px] ${
                        m.image ? "p-1" : "px-3.5 py-2"
                      } ${
                        mine
                          ? "rounded-br-md bg-accent text-paper"
                          : "rounded-bl-md border border-line bg-card"
                      }`}
                    >
                      {m.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.image} alt="" className="max-h-56 w-auto max-w-full rounded-xl object-cover" />
                      )}
                      {m.body && m.body !== "📷" && (
                        <span className={m.image ? "block px-2.5 pb-1 pt-1.5" : ""}>{m.body}</span>
                      )}
                      <div
                        className={`mt-0.5 flex items-center gap-1 text-[9px] ${m.image ? "px-2.5 pb-1" : ""} ${mine ? "text-paper/70" : "text-ink-soft/70"}`}
                      >
                        {m.pinned && <Pin className="h-2.5 w-2.5" />}
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => togglePin(m)}
                      className="shrink-0 rounded p-1 text-ink-soft/50 opacity-0 transition-opacity hover:text-accent-strong group-hover:opacity-100"
                      aria-label={m.pinned ? t("msg.unpin") : t("msg.pin")}
                    >
                      {m.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="border-t border-line p-3">
              {img && (
                <div className="mb-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="h-12 w-12 rounded-md border border-line object-cover" />
                  <button onClick={() => setImg(null)} className="rounded p-1 text-ink-soft hover:text-danger" aria-label={t("msg.removeImg")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-md border border-line px-2.5 text-ink-soft transition-colors hover:border-accent hover:text-accent-strong"
                  aria-label={t("msg.attach")}
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setImg(await fileToMsgImage(f));
                    e.target.value = "";
                  }}
                />
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={t("msg.placeholder")}
                  className="min-w-0 flex-1 rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
                />
                <button
                  onClick={send}
                  disabled={(!draft.trim() && !img) || sending}
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
