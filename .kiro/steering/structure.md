# Project Structure

## Root Directory Organization
```
├── src/                    # Source code
├── dist/                   # Build output
├── docs/                   # Project documentation
├── scripts/                # Build and utility scripts
├── .kiro/                  # Kiro AI assistant configuration
├── .github/                # GitHub workflows and templates
└── node_modules/           # Dependencies
```

## Source Code Structure (`src/`)
```
src/
├── main/                   # Electron main process
│   ├── main.ts            # Application entry point
│   ├── preload.ts         # Secure IPC bridge
│   └── aws/               # AWS integration modules
│       ├── connection-manager.ts
│       ├── credential-manager.ts
│       ├── profile-reader.ts
│       └── __tests__/     # Unit tests for AWS modules
├── renderer/              # React frontend (renderer process)
│   ├── App.tsx           # Main React component
│   ├── index.tsx         # Renderer entry point
│   ├── index.html        # HTML template
│   ├── index.css         # Global styles
│   └── store/            # Redux state management
│       └── store.ts
├── shared/               # Shared types and utilities
│   └── types.ts         # TypeScript type definitions
└── setupTests.ts        # Jest test configuration
```

## Architecture Patterns

### Electron Security Model
- **Context Isolation**: Enabled for security
- **Node Integration**: Disabled in renderer
- **Preload Script**: Secure IPC communication bridge
- **Window Controls**: Prevent unauthorized window creation

### Process Separation
- **Main Process** (`src/main/`): Node.js environment, system access, AWS SDK
- **Renderer Process** (`src/renderer/`): Browser environment, React UI
- **Shared** (`src/shared/`): Common types and utilities

### AWS Integration Structure
- **Connection Manager**: AWS service connections and session management
- **Credential Manager**: AWS authentication and credential handling
- **Profile Reader**: AWS CLI profile parsing and management

### Testing Organization
- Unit tests co-located with source in `__tests__/` directories
- Integration tests for AWS components
- React component tests using Testing Library
- Test files follow `*.test.ts` or `*.spec.ts` naming

## Configuration Files

### TypeScript
- `tsconfig.json` - Base configuration with path aliases
- `tsconfig.main.json` - Main process specific config
- `tsconfig.renderer.json` - Renderer process specific config

### Build & Development
- `webpack.main.config.js` - Main process bundling
- `webpack.renderer.config.js` - Renderer process bundling with dev server
- `electron-dev.js` - Development startup script

### Code Quality
- `.eslintrc.js` - ESLint configuration with TypeScript and React rules
- `.prettierrc` - Code formatting rules
- `jest.config.js` - Test runner configuration

## Naming Conventions
- **Files**: kebab-case for components, camelCase for utilities
- **Components**: PascalCase React components
- **Types**: PascalCase interfaces and types
- **Constants**: UPPER_SNAKE_CASE
- **Functions**: camelCase

## Import Path Aliases
- `@/*` - Root src directory
- `@main/*` - Main process modules
- `@renderer/*` - Renderer process modules  
- `@shared/*` - Shared utilities and types