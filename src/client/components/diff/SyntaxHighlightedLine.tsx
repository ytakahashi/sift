import React, { useMemo } from 'react';
import Prism from 'prismjs';

// Load common languages
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-diff';

// Utility moved to src/client/utils/language.ts

function renderToken(token: string | Prism.Token, key: string | number): React.ReactNode {
  if (typeof token === 'string') {
    return <React.Fragment key={key}>{token}</React.Fragment>;
  }

  const aliasClass = token.alias
    ? Array.isArray(token.alias)
      ? token.alias.join(' ')
      : token.alias
    : '';
  const className = `token ${token.type} ${aliasClass}`.trim();

  let children: React.ReactNode;
  if (Array.isArray(token.content)) {
    children = token.content.map((t, i) => renderToken(t, i));
  } else if (typeof token.content === 'string') {
    children = token.content;
  } else {
    children = renderToken(token.content, 0);
  }

  return (
    <span key={key} className={className}>
      {children}
    </span>
  );
}

interface Props {
  content: string;
  language?: string;
}

/**
 * Renders a single line of text with syntax highlighting using Prism.js.
 *
 * Note: Because this component parses and highlights a single line (or hunk fragment)
 * at a time in isolation, it lacks the context of the full file. As a result,
 * multi-line constructs (such as `/* ... *\/` block comments or multi-line strings)
 * that span across multiple diff rows may not be highlighted correctly and will
 * fallback to plain text.
 */
export const SyntaxHighlightedLine = React.memo(({ content, language }: Props) => {
  const tokens = useMemo(() => {
    if (!language || !Prism.languages[language]) {
      return null;
    }
    try {
      return Prism.tokenize(content, Prism.languages[language]);
    } catch {
      return null;
    }
  }, [content, language]);

  if (!tokens) {
    return <>{content}</>;
  }

  return <>{tokens.map((token, i) => renderToken(token, i))}</>;
});
