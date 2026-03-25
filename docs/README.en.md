<div align="center">
  <h1>VMOS Edge Desktop</h1>
  <p>Desktop client for VMOS Edge cloud phone management</p>
  <p>
    <a href="https://help.vmosedge.com/zh/productupdates/image-release-history.html"><img src="https://img.shields.io/badge/Version-2.1.5-2F81F7.svg" alt="Version 2.1.5" /></a>
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-6E7781.svg" alt="Platform: Windows, macOS, Linux" />
    <a href="../LICENSE"><img src="https://img.shields.io/badge/License-GPL%20v3-blue.svg" alt="License: GPL v3" /></a>
    <img src="https://img.shields.io/badge/Electron-38-47848F.svg?logo=electron&logoColor=white" alt="Electron 38" />
    <img src="https://img.shields.io/badge/Vue-3-42B883.svg?logo=vuedotjs&logoColor=white" alt="Vue 3" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6.svg?logo=typescript&logoColor=white" alt="TypeScript 5" />
  </p>
  <p><a href="../README.md">简体中文</a> | <a href="./README.en.md">English</a></p>
  <p>
    <a href="https://vmosedge.com">Website</a> ·
    <a href="https://help.vmosedge.com/zh/productupdates/image-release-history.html">Release Notes</a> ·
    <a href="https://help.vmosedge.com/zh/sdk/agent-api.html">Developer Guide</a> ·
    <a href="https://help.vmosedge.com/zh/sdk/agent-api.html#_6-mcp-%E8%B0%83%E7%94%A8-ai-agent-%E9%9B%86%E6%88%90">AI Integration</a>
  </p>
</div>

## Interface Preview

<p align="center">
  <img src="./images/readme/hero-cloud-list.png" alt="VMOS Edge Cloud Phone Management" width="100%" />
</p>
<p align="center"><em>AI can dispatch tasks across multiple cloud phones, monitor progress in one place, and collect results centrally</em></p>

<table>
  <tr>
    <td width="50%" align="center">
      <img src="./images/readme/hero-workflow.png" alt="VMOS Edge AI Workflow" />
      <br />
      <sub><strong>AI Workflow</strong>: AI turns the task into scripted steps first, then executes them automatically for fixed and repeatable jobs</sub>
    </td>
    <td width="50%" align="center">
      <img src="./images/readme/hero-ai-agent.png" alt="VMOS Edge AI Agent" />
      <br />
      <sub><strong>AI Agent</strong>: AI makes decisions in real time, watching the interface and acting during execution for dynamic tasks</sub>
    </td>
  </tr>
</table>

## Overview

[VMOS Edge Desktop](https://vmosedge.com) is the desktop control client for the VMOS Edge locally deployed Android cloud phone platform. Powered by a self-developed Android virtualization engine and local edge hardware, it delivers low-latency, stable cloud-phone management and automation for developers and power users.

From the desktop app, you can centrally manage multiple boxes and cloud phones, control screens, manage images and hosts, and connect AI Workflow, AI Agent, and API integrations. This repository provides the open-source implementation of that client for learning, customization, and integration around VMOS Edge capabilities.

## Quick Start

### System Requirements

#### Minimum Requirements

- Windows: Windows 10 (64-bit) or later
- macOS: macOS 10.15 Catalina or later
- Linux: Ubuntu 18.04 or equivalent Linux distribution
- Memory: 4GB RAM (8GB recommended)
- Storage: 2GB available disk space

#### Development Requirements

- Node.js: >= 18.0.0
- pnpm: >= 9.7.1 (recommended package manager)
- Python: >= 3.8 (for building native dependencies)

### Development Setup

1. Clone the repository

```bash
git clone https://github.com/vmos-dev/vmos-edge-desktop.git
cd vmos-edge-desktop
```

2. Install dependencies

```bash
pnpm install
```

3. Start the development server

```bash
pnpm dev
```

The app starts in development mode with hot reload and debugging tools enabled.

### Code Checks and Formatting

```bash
# Format code
pnpm format

# ESLint checks
pnpm lint

# TypeScript type checks
pnpm typecheck
```

## Build and Package

### Development Build

```bash
# Build without packaging (for testing)
pnpm build

# Build and generate the unpacked app
pnpm build:unpack
```

### Production Build

#### Windows

```bash
# Build Windows installer (.exe)
pnpm build:win
```

#### macOS

```bash
# Build macOS Intel version (.dmg)
pnpm build:mac:intel

# Build macOS Apple Silicon version (.dmg)
pnpm build:mac:arm
```

#### Linux

```bash
# Build Linux packages (.AppImage, .deb)
pnpm build:linux
```

### Build Outputs

After the build completes, the installers will be generated in the `dist/` directory:

- Windows: `VMOS Edge Setup 2.1.5.exe`
- macOS: `VMOS Edge-2.1.5.dmg`
- Linux: `VMOS Edge-2.1.5.AppImage` / `vmos-edge-desktop_2.1.5_amd64.deb`

## Troubleshooting

### Common Issues

1. **Dependency installation failed**

```bash
# Clear cache and reinstall
pnpm store prune
rm -rf node_modules
pnpm install
```

2. **Build failed (native dependencies)**

- Make sure Python 3.8+ is installed
- Windows: install Visual Studio Build Tools
- macOS: install Xcode Command Line Tools
- Linux: install build-essential

3. **App failed to start**

- Check whether another instance is already running
- Clear the app data directory: `~/.vmos-edge-desktop`

### Debug Tips

- Press `F12` in development mode to open DevTools
- Main process logs: `logs/main.log`
- Renderer process logs: `logs/renderer.log`

## License

This project is released under [GPL-3.0](../LICENSE). You may use, modify, and distribute it under the terms of GPL-3.0.

If you need closed-source commercial use, distribution rights, OEM integration, or another arrangement that does not fit GPL-3.0, contact `vmosedge@vmos.cn` for a separate commercial license.
