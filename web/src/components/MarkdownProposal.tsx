import type { ElementType, ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

// Agent proposals come back as Markdown (headings, bold, lists) — this maps
// each element to the app's existing Tailwind conventions instead of
// pulling in a full typography plugin for one text block.

const HEADING_STYLES: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: "mt-4 mb-2 text-base font-semibold text-gray-900 first:mt-0",
  2: "mt-4 mb-1.5 text-sm font-semibold text-gray-900 first:mt-0",
  3: "mt-3 mb-1 text-sm font-semibold text-gray-900 first:mt-0",
  4: "mt-3 mb-1 text-sm font-semibold text-gray-800 first:mt-0",
  5: "mt-3 mb-1 text-sm font-medium text-gray-800 first:mt-0",
  6: "mt-3 mb-1 text-sm font-medium text-gray-700 first:mt-0",
};

/**
 * `headingOffset` shifts the *tag* (not the look) of every Markdown heading.
 * Agent text can contain its own `#`/`##`; when it's embedded under the page's
 * own h1/h2/h3 outline it has to become h4 and below, or the document
 * outline breaks (screen-reader heading navigation follows the tags).
 */
function buildComponents(headingOffset: number): Components {
  const heading = (level: 1 | 2 | 3 | 4 | 5 | 6) => {
    const Tag = `h${Math.min(6, level + headingOffset)}` as ElementType;
    const HeadingRenderer = ({ children }: { children?: ReactNode }) => (
      <Tag className={HEADING_STYLES[level]}>{children}</Tag>
    );
    return HeadingRenderer;
  };

  return {
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    h4: heading(4),
    h5: heading(5),
    h6: heading(6),
    p: ({ children }) => (
      <p className="text-sm leading-relaxed text-gray-800 not-first:mt-3">
        {children}
      </p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-gray-900">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => (
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-gray-800 marker:text-gray-400">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-gray-800 marker:text-gray-500">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="pl-1">{children}</li>,
    code: ({ children }) => (
      <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.8125rem] text-gray-800 wrap-break-word">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-100 p-3 text-xs text-gray-800">
        {children}
      </pre>
    ),
    a: ({ children, href }) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-blue-700 underline underline-offset-2 hover:text-blue-600"
      >
        {children}
      </a>
    ),
    blockquote: ({ children }) => (
      <blockquote className="mt-2 border-l-2 border-gray-300 pl-3 text-sm text-gray-600 italic">
        {children}
      </blockquote>
    ),
  };
}

const COMPONENTS_BY_OFFSET = new Map<number, Components>();

function componentsFor(headingOffset: number): Components {
  let components = COMPONENTS_BY_OFFSET.get(headingOffset);
  if (!components) {
    components = buildComponents(headingOffset);
    COMPONENTS_BY_OFFSET.set(headingOffset, components);
  }
  return components;
}

export function MarkdownProposal({
  content,
  headingOffset = 0,
}: {
  content: string;
  headingOffset?: number;
}) {
  return (
    <div className="wrap-break-word">
      <ReactMarkdown components={componentsFor(headingOffset)}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
