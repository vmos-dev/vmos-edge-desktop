export default {
  title: '任务中心',
  stats: {
    total: '全部任务',
    running: '运行中',
    done: '已完成',
    failed: '失败'
  },
  table: {
    name: '任务名称',
    workflow: '工作流',
    devices: '设备数',
    progress: '进度',
    status: '状态',
    duration: '耗时',
    actions: '操作',
    detail: '详情',
    cancel: '取消',
    retryFailed: '重试失败',
    delete: '删除'
  },
  status: {
    running: '运行中',
    done: '已完成',
    cancelled: '已取消',
    pending: '等待中',
    completed: '成功',
    failed: '失败',
    submitFailed: '提交失败',
    partialFailed: '部分失败'
  },
  detail: {
    back: '返回任务中心',
    progress: '进度',
    duration: '耗时',
    cancelAll: '全部取消',
    cancelDevice: '取消此设备',
    retryDevice: '重试此设备',
    viewLog: '查看日志',
    currentStep: '当前步骤',
    queuing: '排队中...',
    screenshot: '截图',
    failScreenshot: '失败时截图',
    variables: '注入变量'
  },
  batchExecute: {
    title: '执行自动化任务',
    selectWorkflow: '选择工作流',
    configParams: '配置参数',
    confirm: '确认执行',
    searchWorkflow: '搜索工作流...',
    steps: '{count} 步',
    variables: '{count} 个变量',
    noVariables: '无变量',
    importCsv: '导入 CSV',
    downloadTemplate: '下载模板',
    notFilled: '未填写',
    defaultValueHint: '未填写参数的设备将使用工作流默认值',
    prev: '上一步',
    next: '下一步',
    startExecute: '开始执行'
  },
  confirm: {
    cancelTask: '确定要取消这个任务吗？',
    deleteTask: '确定要删除这个任务吗？删除后不可恢复。'
  },
  time: {
    justNow: '刚刚',
    minutesAgo: '{count} 分钟前',
    hoursAgo: '{count} 小时前',
    daysAgo: '{count} 天前'
  }
}
