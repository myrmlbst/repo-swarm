import ReactMarkdown, { type Components } from "react-markdown";

// Agent proposals come back as Markdown (headings, bold, lists) — this maps
// each element to the app's existing Tailwind conventions instead of
// pulling in a full typography plugin for one text block.
const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-base font-semibold text-gray-900 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-1.5 text-sm font-semibold text-gray-900 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1 text-sm font-semibold text-gray-900 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-gray-800 [&:not(:first-child)]:mt-2">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-800">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-800">
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  code: ({ children }) => (
    <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-800">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto rounded-md bg-gray-100 p-3 text-xs text-gray-800">
      {children}
    </pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-600 hover:underline"
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

export function MarkdownProposal({ content }: { content: string }) {
  return (
    <div className="space-y-1">
      <ReactMarkdown components={COMPONENTS}>{content}</ReactMarkdown>
    </div>
  );
}
