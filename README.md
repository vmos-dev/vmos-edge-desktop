# VMOS Edge 桌面客户端

![Version](https://img.shields.io/badge/version-2.1.5-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

VMOS Edge Desktop 是一款专业的云手机/虚拟安卓设备管理桌面应用程序，基于 Electron + Vue 3 + TypeScript 技术栈构建，为用户提供完整的虚拟设备管理、远程控制、代理配置等功能。

## ✨ 主要功能

### 🚀 核心功能
- **云手机管理**: 创建、配置、启动、停止、重启、删除虚拟安卓设备
- **主机管理**: 自动发现、监控和管理多个 VMOS Edge 主机的在线状态
- **设备控制**: 远程控制虚拟设备（实时屏幕共享、触控操作、文件传输）
- **代理管理**: 配置和测试各种代理协议（SS、SSR、Vmess、Vless等）
- **镜像管理**: 导入、管理和切换设备系统镜像
- **机型配置**: 管理和导入手机机型模板配置（ADI）

### 🎯 特色功能
- **批量操作**: 支持批量创建、控制和管理设备
- **分组管理**: 按主机或设备维度进行分组管理
- **实时流媒体**: WebRTC/RTMP 实时视频音频传输
- **传感器模拟**: GPS、加速度计等传感器数据模拟
- **多语言支持**: 中文/英文双语界面
- **主题系统**: 支持明暗主题切换
- **自动更新**: 内置自动更新机制

## 🛠 技术架构

### 前端技术栈
- **框架**: Vue 3.5.21 + TypeScript 5.9.2
- **构建工具**: Vite 7.1.6 + Electron-Vite 4.0.1
- **UI 组件库**: Element Plus 2.11.9
- **路由管理**: Vue Router 4.6.3
- **国际化**: Vue i18n 11.2.8
- **样式**: SCSS + CSS Variables

### 桌面应用框架
- **Electron**: 38.1.2 (跨平台桌面应用框架)
- **Electron Builder**: 25.1.8 (应用打包和分发)
- **Electron Updater**: 6.3.9 (自动更新)

### 后端技术栈
- **数据库**: SQLite3 (better-sqlite3 12.5.0)
- **日志系统**: Winston 3.19.0 + Daily Rotate File
- **网络请求**: Axios 1.13.2
- **数据处理**: XLSX 0.18.5 (Excel 导入导出)
- **3D 渲染**: Three.js 0.182.0

### VMOS 专有 SDK
- `@vmosedge/web-sdk`: 1.2.1 (设备控制 SDK)
- `@vmosedge/proxy-sdk`: 1.0.8 (代理管理 SDK)
- `@vmosedge/sensor-simulator`: 1.0.1 (传感器模拟 SDK)

## 📋 系统要求

### 最低系统要求
- **Windows**: Windows 10 (64-bit) 或更高版本
- **macOS**: macOS 10.15 Catalina 或更高版本
- **Linux**: Ubuntu 18.04 或同等 Linux 发行版
- **内存**: 4GB RAM (推荐 8GB)
- **存储**: 500MB 可用磁盘空间

### 开发环境要求
- **Node.js**: >= 18.0.0
- **pnpm**: >= 9.7.1 (推荐包管理器)
- **Python**: >= 3.8 (用于构建 native 依赖)

## 🚀 快速开始

### 开发环境搭建

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd vmos-edge-desktop-github
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **启动开发服务器**
   ```bash
   pnpm dev
   ```
   应用将在开发模式下启动，支持热重载和调试工具。

### 代码检查和格式化
```bash
# 代码格式化
pnpm format

# ESLint 检查
pnpm lint

# TypeScript 类型检查
pnpm typecheck
```

## 📦 构建和打包

### 开发构建
```bash
# 构建但不打包 (用于测试)
pnpm build

# 构建并生成未打包的应用
pnpm build:unpack
```

### 生产构建

#### Windows 平台
```bash
# 构建 Windows 安装包 (.exe)
pnpm build:win
```

#### macOS 平台
```bash
# 构建 macOS Intel 版本 (.dmg)
pnpm build:mac:intel

# 构建 macOS Apple Silicon 版本 (.dmg)
pnpm build:mac:arm
```

#### Linux 平台
```bash
# 构建 Linux 安装包 (.AppImage, .deb)
pnpm build:linux
```

### 构建产物说明
构建完成后，安装包将生成在 `dist/` 目录中：
- **Windows**: `VMOS Edge Setup 2.1.0.exe`
- **macOS**: `VMOS Edge-2.1.0.dmg`
- **Linux**: `VMOS Edge-2.1.0.AppImage` / `vmos-edge-desktop_2.1.0_amd64.deb`

## 📁 项目结构

```
src/
├── main/           # Electron 主进程
│   ├── core/       # 核心业务逻辑
│   │   ├── db/     # SQLite 数据库层
│   │   ├── dao/    # 数据访问对象
│   │   ├── ipc/    # IPC 通讯处理
│   │   ├── store/  # 业务逻辑管理器
│   │   └── utils/  # 工具函数
│   └── index.ts    # 主进程入口
├── renderer/       # Vue 前端应用
│   └── src/
│       ├── views/    # 页面组件
│       ├── components/ # 公共组件
│       ├── hooks/    # 自定义 Hook
│       ├── locales/  # 国际化文件
│       └── utils/    # 前端工具
├── preload/        # Preload 脚本
└── shared/         # 主进程/渲染进程共享代码
    ├── api/        # HTTP API 封装
    ├── ipc/        # IPC 类型定义
    └── types/      # TypeScript 类型
```

## 🔧 推荐开发环境

- **IDE**: [Visual Studio Code](https://code.visualstudio.com/)
- **必装插件**:
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - 代码检查
  - [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) - 代码格式化
  - [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) - Vue 3 语言支持
  - [TypeScript Vue Plugin](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) - Vue 中的 TS 支持

## 🐛 故障排除

### 常见问题

1. **安装依赖失败**
   ```bash
   # 清除缓存并重新安装
   pnpm store prune
   rm -rf node_modules
   pnpm install
   ```

2. **构建失败 (Native 依赖)**
   - 确保系统已安装 Python 3.8+
   - Windows: 安装 Visual Studio Build Tools
   - macOS: 安装 Xcode Command Line Tools
   - Linux: 安装 build-essential

3. **应用启动失败**
   - 检查是否有其他实例正在运行
   - 清除应用数据目录：`~/.vmos-edge-desktop`

### 调试技巧
- 开发模式下按 `F12` 打开开发者工具
- 主进程日志查看：`logs/main.log`
- 渲染进程日志查看：`logs/renderer.log`

## 📖 更新日志

### v2.1.0 (当前版本)
- 新增媒体流传输支持
- 优化代理检测性能
- 增加更多传感器模拟功能
- UI/UX 界面优化

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证开源。

## 🔗 相关链接

- **官方网站**: [https://help.vmosedge.com](https://help.vmosedge.com)
- **产品主页**: VMOS Edge Desktop
- **技术支持**: 请通过官方渠道联系
