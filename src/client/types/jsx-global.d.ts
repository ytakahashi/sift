import type { JSX as ReactJSX } from 'react';

// rehype-react registers its compile result with unified as the global
// `JSX.Element`, which React 19 types no longer declare. Left unresolved, it
// widens unified's `CompileResults` to `any`, and every processor built with a
// plugin such as remark-gfm silently loses its tree types.
declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
  }
}
