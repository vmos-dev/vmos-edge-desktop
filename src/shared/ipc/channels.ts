/**
 * IPC 通道和事件名称（简化版）
 * 所有 IPC 通信只用这些字符串常量
 */

// ==================== 核心通道 ====================
// 渲染进程 ↔ 主进程的底层通道

export const IPC_SEND = 'ipc:send' // 渲染 → 主进程（单向）
export const IPC_INVOKE = 'ipc:invoke' // 渲染 ⇄ 主进程（双向）
export const IPC_PUSH = 'ipc:push' // 主进程 → 渲染（推送）

// ==================== 窗口事件 ====================

export const WINDOW_MINIMIZE = 'window:minimize'
export const WINDOW_MAXIMIZE = 'window:maximize'
export const WINDOW_CLOSE = 'window:close'
export const WINDOW_RESIZE = 'window:resize'
export const WINDOW_TOP = 'window:top'

// ==================== 云机事件 ====================

export const CLOUD_CREATE = 'cloud:create'
export const CLOUD_CLOSE = 'cloud:close'
export const CLOUD_CONNECT = 'cloud:connect'
export const CLOUD_DISCONNECT = 'cloud:disconnect'
export const CLOUD_STATUS_CHANGE = 'cloud:statusChange'
export const CLOUD_GET_LIST = 'cloud:getList'
export const CLOUD_ARRANGE = 'cloud:arrange'

// ==================== 窗口间桥接事件 ====================

export const BRIDGE_MAIN_TO_CLOUD = 'bridge:mainToCloud'
export const BRIDGE_CLOUD_TO_MAIN = 'bridge:cloudToMain'
export const BRIDGE_BROADCAST = 'bridge:broadcast'
