# AWS Network Flow Visualizer

A cross-platform desktop application for visualizing AWS network traffic flows across VPCs, Transit Gateways, and VPN connections. This tool helps network administrators and engineers troubleshoot connectivity issues and understand traffic patterns in complex multi-account AWS environments.

## Features

- **Interactive Network Topology**: Visualize VPCs, Transit Gateway, and VPN connections with traffic flows
- **AWS SSO Integration**: Secure authentication using AWS SSO, named profiles, and IAM roles
- **CloudWatch Insights Integration**: Query VPC and Transit Gateway flow logs directly
- **Real-time Filtering**: Filter by IP ranges, ports, protocols, and time ranges
- **Cross-platform**: Runs on Linux, macOS, and Windows
- **Privacy-focused**: All data processing happens locally, no telemetry or external dependencies
- **Export Capabilities**: Export visualizations and data for reporting and sharing

## Architecture

Built with:
- **Electron** + **React** + **TypeScript** for cross-platform desktop experience
- **Cytoscape.js** for network topology visualization
- **D3.js** for charts and timeline visualizations
- **AWS SDK v3** for CloudWatch Insights integration

## Security & Privacy

- No telemetry or analytics data collection
- All flow log processing happens locally on your machine
- Only connects to AWS APIs for CloudWatch Insights queries
- Supports AWS SSO and temporary credentials (no long-term access keys required)
- Self-contained application with all dependencies bundled

## Development Status

The project structure and development environment have been set up. The application is ready for feature implementation.

## Documentation

- [Requirements](./.kiro/specs/aws-network-flow-visualizer/requirements.md) - Detailed feature requirements and acceptance criteria
- [Design](./.kiro/specs/aws-network-flow-visualizer/design.md) - Technical architecture and component design
- [Implementation Plan](./.kiro/specs/aws-network-flow-visualizer/tasks.md) - Step-by-step development tasks

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production version
- `npm run package` - Package application for current platform
- `npm run package:linux` - Package for Linux
- `npm run package:mac` - Package for macOS  
- `npm run package:win` - Package for Windows
- `npm run test` - Run test suite
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Project Structure

```
src/
├── main/           # Electron main process
│   ├── main.ts     # Main entry point
│   └── preload.ts  # Preload script for secure IPC
├── renderer/       # React frontend
│   ├── components/ # React components (to be added)
│   ├── store/      # Redux store
│   └── index.tsx   # Renderer entry point
└── shared/         # Shared types and utilities
    └── types.ts    # TypeScript type definitions
```

## Use Cases

- Troubleshooting connectivity issues between VPCs and site-to-site VPN connections
- Visualizing traffic patterns across Transit Gateway attachments
- Identifying security issues and unusual traffic patterns
- Understanding network topology in complex multi-account environments
- Analyzing VPC Flow Logs and Transit Gateway Flow Logs from CloudWatch

## License

[License to be determined]

## Contributing

[Contributing guidelines to be added]