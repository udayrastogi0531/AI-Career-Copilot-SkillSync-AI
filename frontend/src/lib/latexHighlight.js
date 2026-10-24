const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const TOKEN_PATTERN =
  /(%[^\n]*)|(\\(?:begin|end)\s*\{[^}]*\})|(\\(?:[a-zA-Z@]+|.)\*?)|(\$\$?[^$]*\$\$?)|([{}[\]])/g;

/**
 * Highlight LaTeX for display. Input is HTML-escaped first, so the returned
 * markup is safe to inject with dangerouslySetInnerHTML.
 */
export const highlightLatex = (source) => {
  const text = String(source ?? "");
  let result = "";
  let lastIndex = 0;

  TOKEN_PATTERN.lastIndex = 0;
  let match;
  while ((match = TOKEN_PATTERN.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    const [token, comment, environment, command, math, brace] = match;

    if (comment) {
      result += `<span class="tok-comment">${escapeHtml(token)}</span>`;
    } else if (environment) {
      result += `<span class="tok-env">${escapeHtml(token)}</span>`;
    } else if (command) {
      result += `<span class="tok-command">${escapeHtml(token)}</span>`;
    } else if (math) {
      result += `<span class="tok-math">${escapeHtml(token)}</span>`;
    } else if (brace) {
      result += `<span class="tok-brace">${escapeHtml(token)}</span>`;
    } else {
      result += escapeHtml(token);
    }

    lastIndex = match.index + token.length;
  }

  result += escapeHtml(text.slice(lastIndex));
  return result;
};
