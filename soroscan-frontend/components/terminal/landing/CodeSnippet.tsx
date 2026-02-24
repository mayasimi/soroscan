"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CodeSnippetProps {
  code: string;
  language?: "python" | "typescript" | "bash" | "json";
  filename?: string;
  className?: string;
}

/** Lightweight regex-based tokenizer — no external deps. */
function tokenize(code: string, language: string): React.ReactNode[] {
  const lines = code.split("\n");
  return lines.map((line, i) => (
    <div key={i} className="flex gap-4">
      <span className="select-none w-6 text-right opacity-30 shrink-0">
        {i + 1}
      </span>
      <span>{colourLine(line, language)}</span>
    </div>
  ));
}

function colourLine(line: string, language: string): React.ReactNode {
  if (!line) return <br />;

  // Comment lines
  if (language === "python" && /^\s*#/.test(line)) {
    return <span className="tok-comment">{line}</span>;
  }
  if (
    (language === "typescript" || language === "bash") &&
    /^\s*\/\//.test(line)
  ) {
    return <span className="tok-comment">{line}</span>;
  }
  if (language === "bash" && /^\s*#/.test(line)) {
    return <span className="tok-comment">{line}</span>;
  }

  // Build segments by matching keywords, strings, comments, and numbers
  const segments: Array<{ text: string; cls: string }> = [];
  const remaining = line;

  const combined =
    /(["'`])(?:\\.|(?!\1)[^\\])*\1|#.*|\/\/.*|\b(?:import|export|from|const|let|var|async|await|function|return|if|else|new|type|interface|class|def|elif|for|in|with|as|print|True|False|None)\b|\b\d+(?:\.\d+)?\b/g;

  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = combined.exec(remaining)) !== null) {
    if (match.index > last) {
      segments.push({
        text: remaining.slice(last, match.index),
        cls: "tok-var",
      });
    }
    const tok = match[0];
    let cls = "tok-var";
    if (/^["'`]/.test(tok)) cls = "tok-string";
    else if (/^(#|\/\/)/.test(tok)) cls = "tok-comment";
    else if (/^\d/.test(tok)) cls = "tok-number";
    else cls = "tok-keyword";
    segments.push({ text: tok, cls });
    last = match.index + tok.length;
  }
  if (last < remaining.length) {
    segments.push({ text: remaining.slice(last), cls: "tok-var" });
  }

  return (
    <>
      {segments.map((seg, i) => (
        <span key={i} className={seg.cls}>
          {seg.text}
        </span>
      ))}
    </>
  );
}

const langLabel: Record<string, string> = {
  python: "python",
  typescript: "typescript",
  bash: "bash",
  json: "json",
};

export function CodeSnippet({
  code,
  language = "typescript",
  filename,
  className,
}: CodeSnippetProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={cn("code-window", className)}>
      {/* Title bar */}
      <div className="code-window-titlebar">
        <span className="code-dot code-dot-red" />
        <span className="code-dot code-dot-yellow" />
        <span className="code-dot code-dot-green" />
        <span className="ml-3 text-[10px] text-terminal-gray tracking-widest flex-1">
          {filename ?? langLabel[language] ?? language}
        </span>
        <button
          onClick={handleCopy}
          className="text-[10px] text-terminal-gray hover:text-terminal-green transition-colors px-2 py-0.5 border border-terminal-gray/30 hover:border-terminal-green/50"
          aria-label="Copy code"
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      {/* Code body */}
      <div className="code-body">{tokenize(code, language)}</div>
    </div>
  );
}
