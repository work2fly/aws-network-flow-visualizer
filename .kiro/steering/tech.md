# Technology Stack

## Core Technologies

- **Electron** - Cross-platform desktop application framework
- **React 18** - Frontend UI framework with TypeScript
- **TypeScript 5.6** - Type-safe JavaScript with strict mode enabled
- **Node.js 18+** - Runtime environment

## Build System

- **Webpack 5** - Module bundler with separate configs for main/renderer processes
- **ts-loader** - TypeScript compilation
- **Babel** - JavaScript transpilation
- **electron-builder** - Application packaging and distribution

## UI & Visualization

- **Cytoscape.js** - Network topology visualization
- **D3.js** - Charts and timeline visualizations
- **Tailwind CSS** - Utility-first CSS framework
- **PostCSS** - CSS processing with autoprefixer

## State Management & Data

- **Redux Toolkit** - Predictable state management
- **React Redux** - React bindings for Redux
- **AWS SDK v3** - CloudWatch Insights integration

## Development Tools

- **ESLint** - Code linting with TypeScript, React, and Prettier integration
- **Prettier** - Code formatting
- **Jest** - Testing framework with jsdom environment
- **Testing Library** - React component testing utilities
- **ts-jest** - TypeScript support for Jest

## Common Commands

### Development

```bash
npm run dev              # Start development with hot reload
npm run dev:main         # Build main process in watch mode
npm run dev:renderer     # Start renderer dev server
```

### Building

```bash
npm run build           # Build production version
npm run build:main      # Build main process only
npm run build:renderer  # Build renderer only
```

### Packaging

```bash
npm run package         # Package for current platform
npm run package:linux   # Package for Linux (AppImage, deb)
npm run package:mac     # Package for macOS (dmg)
npm run package:win     # Package for Windows (nsis)
```

### Testing & Quality

```bash
npm test               # Run test suite
npm run test:watch     # Run tests in watch mode
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues
npm run format         # Format code with Prettier
npm run format:check   # Check code formatting
npm run typecheck      # TypeScript type checking
```

## TypeScript Configuration

- Strict mode enabled with consistent casing enforcement
- Path aliases configured: `@/*`, `@main/*`, `@renderer/*`, `@shared/*`
- Target ES2020 with DOM and ES6 libraries
- JSX set to `react-jsx` (new transform)
