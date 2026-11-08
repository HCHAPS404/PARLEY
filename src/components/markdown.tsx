"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-ink">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="mb-2.5 list-disc space-y-1.5 pl-5 marker:text-ink-soft/60">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2.5 list-decimal space-y-1.5 pl-5 marker:text-ink-soft/60">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-6">{children}</li>,
        h1: ({ children }) => (
          <h3 className="mb-2 mt-4 font-display text-[15px] font-semibold first:mt-0">
            {children}
          </h3>
        ),
        h2: ({ children }) => (
          <h3 className="mb-2 mt-4 font-display text-[15px] font-semibold first:mt-0">
            {children}
          </h3>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-4 text-[13px] font-semibold uppercase tracking-wide text-ink-soft first:mt-0">
            {children}
          </h3>
        ),
        hr: () => <hr className="my-3 border-line" />,
        blockquote: ({ children }) => (
          <blockquote className="mb-2.5 border-l-2 border-accent/40 pl-3 text-ink-soft">
            {children}
          </blockquote>
        ),
        pre: ({ children }) => (
          <pre className="mb-2.5 overflow-x-auto rounded-lg border border-line bg-paper px-3 py-2.5 text-[12px]">
            {children}
          </pre>
        ),
        code: ({ className, children }) =>
          className ? (
            <code className={`${className} font-mono`}>{children}</code>
          ) : (
            <code className="rounded bg-accent-mist px-1.5 py-0.5 font-mono text-[12.5px] text-accent-strong">
              {children}
            </code>
          ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-accent-strong underline underline-offset-2 hover:text-accent"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="mb-2.5 overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-[13px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-line bg-paper">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-semibold">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border-t border-line/60 px-3 py-2">{children}</td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
