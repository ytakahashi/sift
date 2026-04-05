# Sift

> **Sift before you commit.**

A lightweight local diff viewer for inspecting changes

## ✨ Features

- **3-Pane Interface**: Easily navigate between your Working Directory changes
  and Staged Changes, while viewing the diff in the main viewer.
- **Granular Git Actions**: Stage and unstage changes directly from the UI.
- **Ephemeral Notes**: Add in-memory, session-only notes to specific lines of
  code. This is perfect for jotting down self-reminders and double-checking your
  work before it gets etched into your Git history.
- **Fast & Local**: Runs entirely locally. Data never leaves your computer, and
  directory traversal is strictly locked to your Git repository.

## 🚀 Getting Started

### Prerequisites

- Node.js / [pnpm](https://pnpm.io/)
- Git installed and initialized in your project

### Installation

1. Clone or download this repository.
2. Install the dependencies:

```bash
pnpm install
```

### Running in Development

To start Sift in development mode (which utilizes Vite's dev server):

```bash
pnpm run dev
```

By default, `sift` will detect the root of your current Git repository and spin
up a web server. Check `http://localhost:3000` in your browser.

**Options**:

- `-o, --open`: Automatically open the browser after the server starts

### Building for Production

To build the client assets and compile the server-side TypeScript code:

```bash
pnpm run build
```

Then you can run the compiled CLI application directly from the repository:

```bash
pnpm run start
```

### Installing Globally

For the best experience, you can link the CLI tool globally so you can run it from any Git repository on your machine:

```bash
pnpm link --global
```

Now you can start the viewer from any directory by simply running:

```bash
sift
```

> **Note**: If you change the source code, you only need to run `pnpm run build` in the project directory for the global `sift` command to pick up the latest changes.

### Code Quality (Linting & Formatting)

This project uses **ESLint** and **Prettier** to enforce a unified code style.

- **Check Formatting**: `pnpm run format`
- **Auto-Fix Formatting**: `pnpm run format:fix`
- **Run Linter**: `pnpm run lint`
- **Auto-Fix Lint Errors**: `pnpm run lint:fix`

## 🛠 Tech Stack

- **Server**: [Hono](https://hono.dev/) handling routing and static file serving
  on Node.js.
- **Client**: [React](https://react.dev/) + [Vite](https://vitejs.dev/) with
  purely Vanilla CSS for modern, lightweight, and ultra-fast rendering.
