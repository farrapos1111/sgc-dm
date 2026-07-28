import { useMemo, type HTMLAttributes, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  extractToc,
  rewriteDocsHref,
  slugifyHeading,
  type TocItem,
} from "@/lib/docs-catalog";
import { cn } from "@/lib/utils";

type MarkdownDocProps = {
  content: string;
  title: string;
};

function flattenText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (typeof node === "object" && "props" in node) {
    const props = node.props as { children?: ReactNode };
    return flattenText(props.children);
  }
  return "";
}

function Heading({
  level,
  children,
  ...props
}: {
  level: 1 | 2 | 3 | 4;
  children?: ReactNode;
} & HTMLAttributes<HTMLHeadingElement>) {
  const text = flattenText(children);
  const id = level >= 2 ? slugifyHeading(text) : undefined;
  const Tag = `h${level}` as const;
  const sizes = {
    1: "sr-only",
    2: "text-2xl font-semibold tracking-tight mt-10 mb-4 scroll-mt-24 border-b border-border/60 pb-2",
    3: "text-lg font-semibold mt-8 mb-2 scroll-mt-24",
    4: "text-base font-semibold mt-6 mb-2",
  };

  return (
    <Tag id={id} className={sizes[level]} {...props}>
      {children}
    </Tag>
  );
}

function PageToc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;

  return (
    <aside className="hidden w-64 shrink-0 xl:block">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pl-2">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Nesta página
        </p>
        <nav className="space-y-2 border-l border-border pl-3">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn(
                "block text-sm leading-snug text-muted-foreground transition-colors hover:text-foreground",
                item.level === 3 && "pl-3 text-[13px]",
              )}
            >
              {item.text}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export function MarkdownDoc({ content, title }: MarkdownDocProps) {
  const toc = useMemo(() => extractToc(content), [content]);

  const components: Components = useMemo(
    () => ({
      h1: ({ children, ...props }) => (
        <Heading level={1} {...props}>
          {children}
        </Heading>
      ),
      h2: ({ children, ...props }) => (
        <Heading level={2} {...props}>
          {children}
        </Heading>
      ),
      h3: ({ children, ...props }) => (
        <Heading level={3} {...props}>
          {children}
        </Heading>
      ),
      h4: ({ children, ...props }) => (
        <Heading level={4} {...props}>
          {children}
        </Heading>
      ),
      p: ({ children }) => (
        <p className="mb-4 text-[15px] leading-7 text-foreground/90">{children}</p>
      ),
      ul: ({ children }) => (
        <ul className="mb-4 list-disc space-y-1.5 pl-6 text-[15px] leading-7">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="mb-4 list-decimal space-y-1.5 pl-6 text-[15px] leading-7">{children}</ol>
      ),
      li: ({ children }) => <li className="pl-1">{children}</li>,
      blockquote: ({ children }) => (
        <blockquote className="mb-4 border-l-4 border-[#9E1B32]/40 bg-[#9E1B32]/5 px-4 py-3 text-[15px] leading-7 text-foreground/90">
          {children}
        </blockquote>
      ),
      a: ({ href, children }) => {
        const rewritten = rewriteDocsHref(href);
        if (!rewritten) return <span>{children}</span>;

        const external =
          rewritten.startsWith("http://") ||
          rewritten.startsWith("https://") ||
          rewritten.startsWith("mailto:");

        return (
          <a
            href={rewritten}
            className="font-medium text-[#9E1B32] underline-offset-2 hover:underline"
            {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            {children}
          </a>
        );
      },
      code: ({ className, children, ...props }) => {
        const isBlock = Boolean(className?.includes("language-"));
        if (isBlock) {
          return (
            <code className={cn("font-mono text-[13px]", className)} {...props}>
              {children}
            </code>
          );
        }
        return (
          <code
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground"
            {...props}
          >
            {children}
          </code>
        );
      },
      pre: ({ children }) => (
        <pre className="mb-4 overflow-x-auto rounded-lg border border-border bg-[#1A1A1A] p-4 text-[13px] leading-6 text-[#F5F5F5]">
          {children}
        </pre>
      ),
      table: ({ children }) => (
        <div className="mb-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
      th: ({ children }) => (
        <th className="border-b border-border px-3 py-2 font-semibold">{children}</th>
      ),
      td: ({ children }) => (
        <td className="border-b border-border/70 px-3 py-2 align-top text-foreground/90">{children}</td>
      ),
      hr: () => <hr className="my-8 border-border" />,
      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    }),
    [],
  );

  return (
    <div className="flex gap-10">
      <article className="min-w-0 max-w-3xl flex-1">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Documentação
        </p>
        <h1 className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </ReactMarkdown>
      </article>
      <PageToc items={toc} />
    </div>
  );
}
