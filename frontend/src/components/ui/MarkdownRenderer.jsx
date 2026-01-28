import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

const MarkdownRenderer = ({ content, className = "" }) => {
  const text =
    typeof content === "string"
      ? content
      : content?.toString
        ? content.toString()
        : "";

  if (!text) {
    return null;
  }

  return (
    <ReactMarkdown
      className={`markdown-body ${className}`.trim()}
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        a: ({ ...props }) => (
          <a {...props} target="_blank" rel="noreferrer" />
        ),
        pre: ({ className: preClass, ...props }) => (
          <pre
            className={["markdown-pre", preClass].filter(Boolean).join(" ")}
            {...props}
          />
        ),
        code: ({ inline, className: codeClass, ...props }) => (
          <code
            className={[
              inline ? "markdown-inline-code" : "markdown-code",
              codeClass,
            ]
              .filter(Boolean)
              .join(" ")}
            {...props}
          />
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;
