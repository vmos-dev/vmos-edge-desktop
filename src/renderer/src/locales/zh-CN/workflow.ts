export default {
  yamlEditor: 'YAML 编辑器',
  deviceScreen: '云机画面',
  selectDevice: '选择云机',
  run: '运行',
  stop: '停止',
  running: '运行中...',
  selectDeviceFirst: '请先选择一台云机',
  yamlEmpty: 'YAML 内容为空',
  runFailed: '运行失败',
  stopped: '已停止',
  stopFailed: '停止失败',
  retryConnection: '重试连接',
  connecting: '连接中...',
  connectionFailed: '连接失败',
  noDeviceConnected: '未连接云机',
  noDeviceDesc: '点击右上角选择一台运行中的云机',
  saved: '已保存并格式化',
  inspector: {
    title: '控件选择器',
    enable: '开启',
    disable: '关闭选择器',
    cancelPicking: '取消选择',
    repick: '重新选择',
    needDevice: '请先连接云机',
    hoverHint: '移动鼠标预览控件\n点击选中生成命令',
    locked: '已选中',
    attributes: '属性',
    position: '位置',
    state: '状态',
    clickable: '可点击',
    focusable: '可聚焦',
    enabled: '已启用',
    scrollable: '可滚动',
    checked: '已勾选',
    selected: '已选中',
    copied: '已复制',
    commands: '快捷命令',
    insert: '插入',
    copy: '复制'
  },
  actionModal: {
    title: '可以对这个元素执行的操作',
    search: '搜索命令...',
    noResult: '没有找到匹配的命令',
    copied: '已复制',
    run: '运行',
    edit: '编辑',
    copy: '复制',
    keyboard: {
      navigate: '导航',
      copy: '复制',
      edit: '编辑',
      run: '运行',
      search: '搜索',
      close: '关闭'
    }
  },
  editor: {
    yamlCannotSave: 'YAML 有错误，无法保存',
    saveFailed: '保存失败',
    saveSuccess: '保存成功',
    yamlErrorLeaveBody: '当前 YAML 有语法错误，无法保存。是否放弃修改并离开？',
    yamlErrorLeaveTitle: 'YAML 有错误',
    discardAndLeave: '放弃修改并离开',
    continueEditing: '继续编辑',
    unsavedBody: '当前脚本有未保存的修改，是否保存后再离开？',
    unsavedTitle: '未保存的修改',
    saveAndLeave: '保存并离开',
    discardChanges: '放弃修改',
    switchedTo: '已切换到：{name}',
    pickElementHint: '请在云机上点选要插入的元素',
    elementAdded: '已加到步骤',
    yamlValidationFailed: 'YAML 校验失败，请先修复',
    selectDeviceAndAddSteps: '请先选择云机并添加步骤'
  },
  engine: {
    offline: 'flow-engine 离线，主机不可达',
    notInstalled: 'flow-engine 未部署，无法执行',
    updateAvailable: 'flow-engine 版本过旧，请更新后执行',
    checking: '正在检测 flow-engine …'
  },
  grid: {
    emptyTitle: '还没有脚本',
    emptyDesc: '创建一条脚本，定义步骤和参数，之后一键在多台云机上批量运行。',
    emptyCreate: '新建第一条脚本',
    featSteps: '编写步骤',
    featStepsDesc: '从动作库中选择操作',
    featParams: '参数配置',
    featParamsDesc: '调整每步执行细节',
    featBatch: '批量执行',
    featBatchDesc: '多台云机同时运行',
    noMatchTitle: '没有找到「{keyword}」',
    noMatchDesc: '换个关键词试试，或者新建一条脚本。',
    clearSearch: '清除搜索',
    newScript: '新建脚本'
  },
  stage: {
    yamlError: '⚠ YAML 错误 · 暂不能加步骤',
    frozenMode: '🧊 冻结模式 · 可操作手机',
    pickMode: '🎯 选取模式 · 点元素添加步骤',
    switchToPick: '切回选取',
    switchToFreeze: '切到冻结',
    retry: '重试',
    connecting: '连接中...',
    noDevice: '未连接云机',
    noDeviceHint: '创建脚本时会自动连接'
  },
  topBar: {
    untitled: '未命名脚本',
    running: '运行中',
    runError: '运行失败',
    runSuccess: '✓ 运行完成',
    pickMode: '选元素模式 · 点元素加步骤',
    idle: '空闲',
    backToList: '返回列表',
    unsavedChanges: '有未保存修改',
    changeDevice: '换云机',
    syntaxGuide: '语法指南',
    cantSwitchRunning: '运行中不可切换云机',
    cantSwitchDeploying: '部署中不可切换云机',
    engineOnline: '在线',
    engineOffline: '离线',
    engineNotInstalled: '未安装',
    engineUpdateAvailable: '需更新',
    engineOnlineTitle: 'flow-engine 在线',
    engineOfflineTitle: 'flow-engine 离线 — 主机不可达（请检查网络）',
    engineNotInstalledTitle: 'flow-engine 未部署 — 请联系运维安装服务',
    engineUpdateAvailableTitle: '主机上的 flow-engine 版本较旧，请先更新再运行脚本'
  },
  actionBar: {
    stopRun: '停止运行',
    save: '保存',
    saved: '已保存',
    run: '运行'
  },
  yamlErrorBar: {
    defaultTitle: 'YAML 有错误，不能切回可视化也不能运行'
  },
  statusBar: {
    steps: '{count} 步',
    lines: '{count} 行',
    errors: '✗ {count} 个错误',
    noErrors: '✓ 无错误'
  },
  switcher: {
    search: '搜脚本',
    loading: '加载中…',
    noMatch: '未找到匹配',
    empty: '暂无脚本',
    steps: '{count} 步',
    newScript: '新建脚本'
  },
  sidePanel: {
    ariaLabel: '编辑面板',
    visual: '可视化',
    errors: '{count} 个错误',
    syntaxOk: '语法正常'
  },
  stepList: {
    title: '步骤列表',
    emptyHint: '还没有步骤，可以从下面添加',
    addStep: '添加步骤'
  },
  stepTree: {
    addInContainer: '加一步',
    branchLabel: '分支 {index}',
    insertElement: '+ 选元素插入'
  },
  stepItem: {
    viewYaml: '去 YAML 看这段',
    deleteStep: '删除这一步'
  },
  engineBanner: {
    title: 'flow-engine 未就绪',
    hint: '— 脚本无法执行，请先安装引擎。',
    install: '一键安装',
    updateTitle: 'flow-engine 需要更新',
    updateHint: '— 主机上的引擎版本较旧，更新后才能运行脚本。',
    update: '一键更新'
  },
  deviceDialog: {
    createTitle: '创建脚本',
    switchTitle: '切换云机',
    selectDevice: '选择目标云机',
    hostStats: '{hosts} 主机 · {running} 运行中',
    noHosts: '暂无在线主机或运行中的云机',
    selectApp: '选择目标应用',
    from: '来自',
    selectDeviceFirst: '请先在左侧选择一台设备',
    waitingForDevice: '等待选择设备...',
    searchApp: '搜索应用名或包名...',
    scanFailed: '扫描失败',
    retryScan: '重试扫描',
    noMatchApp: '未找到匹配的应用',
    noApps: '暂无已安装应用',
    recentApps: '常用应用',
    allApps: '全部应用 ({count})',
    nameYourScript: '命名你的脚本',
    namePlaceholder: '例如：抖音 自动点赞脚本',
    scanHint: '仅扫描包含桌面入口的应用',
    cancel: '取消',
    startCreate: '开始创建',
    confirmSwitch: '确认切换',
    defaultName: '{appName} 自动化'
  },
  deploy: {
    title: '安装 flow-engine',
    desc: '将自动化引擎部署到目标主机并启动服务',
    targetHost: '目标主机',
    password: '主机密码',
    passwordPlaceholder: '输入 root 密码',
    checkingVersion: '正在检查引擎版本…',
    connecting: '正在连接主机…',
    uploading: '上传引擎文件…',
    installing: '安装并启动服务…',
    verifying: '验证服务状态…',
    failed: '部署失败',
    success: '部署成功',
    installSuccess: '安装成功',
    updateSuccess: '更新成功',
    alreadyLatest: '当前已是最新版本，无需重复安装',
    unreachable: '目标主机不可达',
    updatePending: '检测到旧版本 {current}，将覆盖更新到 {bundled}',
    cancel: '取消',
    start: '开始部署',
    done: '完成',
    close: '关闭',
    retry: '重试'
  },
  actionPicker: {
    title: '添加步骤',
    heading: '添加动作',
    subtitle: '选择一个动作添加到脚本，随后可配置其详细参数。',
    searchPlaceholder: '搜索动作，如：点击、输入、等待...',
    noResult: '未找到与「{keyword}」相关的动作'
  },
  card: {
    openScript: '打开脚本 {name}',
    delete: '删除',
    justNowUpdated: '刚刚更新',
    minutesAgoUpdated: '{count} 分钟前更新',
    hoursAgoUpdated: '{count} 小时前更新',
    daysAgoUpdated: '{count} 天前更新',
    dateUpdated: '{month}月{day}日更新',
    dateYearUpdated: '{year}年{month}月{day}日更新',
    dateCreated: '{month}月{day}日创建',
    dateYearCreated: '{year}年{month}月{day}日创建',
    draft: '草稿',
    stepUnit: '步'
  },
  listView: {
    deleteTitle: '删除脚本',
    deleteConfirm: '确定要删除「{name}」吗？此操作不可撤销。',
    deleteBtn: '删除',
    cancelBtn: '取消',
    deleted: '已删除',
    deleteFailed: '删除失败',
    loadFailed: '加载失败'
  },
  filterBar: {
    ariaLabel: '应用分组',
    all: '全部'
  },
  elementPopover: {
    copied: '已复制',
    selectorStrategy: '选择器策略',
    elementProperties: '元素属性',
    viewDetails: '看属性 / 选择器',
    backToActions: '返回推荐动作',
    noAnchor: '未找到文本/id 锚点，仅坐标可用',
    lowStability: '脚本可能不够稳定，建议换个有文字的位置',
    close: '关闭',
    escClose: 'Esc 关闭'
  },
  yamlPreview: {
    collapse: '收起 YAML',
    expand: '看 YAML',
    noPreview: '# (无法生成预览)'
  },
  yamlEditorHover: {
    executionFailed: '**执行失败**'
  },
  appRow: {
    daysAgo: '{count} 天前',
    hoursAgo: '{count}h 前',
    minutesAgo: '{count}m 前',
    justNow: '刚刚'
  },
  actionPane: {
    otherActions: '其他可选动作',
    noRecommendation: '当前元素没有合适的推荐动作'
  },
  heroCard: {
    smartRecommend: '智能推荐',
    clickToApply: '点击应用'
  },
  candidatePicker: {
    clickableArea: '可点击区域（无锚）',
    noAnchor: '无文本锚点',
    label: '候选元素',
    sortHint: '按面积升序 · 越具体（越小）的元素排在前'
  },
  statusChip: {
    steps: '{count} 步',
    draft: '草稿'
  },
  stepEditor: {
    collapse: '收起',
    collapseEditor: '收起编辑器'
  },
  autoForm: {
    primaryParams: '主要参数',
    complexHint: '复杂结构，推荐到 YAML 编辑器修改',
    moreSettings: '更多设置 ({count})',
    common: '通用',
    labelField: '备注名',
    labelPlaceholder: '只给自己看，运行日志里显示',
    skipOnFail: '失败时跳过',
    skipOnFailHint: '这一步失败不会打断整个流程',
    chanceField: '按几率执行',
    chanceHint: '0~1，如 0.3 = 30% 几率'
  },
  deviceStage: {
    connectionFailed: '连接失败'
  },
  actionLabel: {
    tapOn: '点击',
    longPressOn: '长按',
    doubleTapOn: '双击',
    pressKey: '按按键',
    back: '按返回键',
    hideKeyboard: '收起键盘',
    inputText: '输入文字',
    eraseText: '清空输入框',
    pasteText: '粘贴',
    setClipboard: '写入剪贴板',
    copyTextFrom: '复制元素文字',
    inputRandomText: '随机字母',
    inputRandomNumber: '随机数字',
    inputRandomEmail: '随机邮箱',
    inputRandomPersonName: '随机姓名',
    scroll: '向下滚一次',
    scrollUntilVisible: '滚到看见',
    swipe: '滑动屏幕',
    sleep: '等待时间',
    waitForAnimationToEnd: '等动画结束',
    extendedWaitUntil: '等条件成立',
    launchApp: '启动应用',
    stopApp: '关闭应用',
    killApp: '强制结束',
    clearState: '清空应用数据',
    clearKeychain: '清账号缓存',
    assertVisible: '检查必须可见',
    assertNotVisible: '检查必须不可见',
    assertTrue: '检查表达式',
    repeat: '循环执行',
    retry: '失败重试',
    branch: '条件分支',
    runFlow: '调用子流程',
    takeScreenshot: '截图',
    setLocation: '模拟位置',
    openLink: '打开链接',
    setPermissions: '批量设权限',
    shell: '跑表达式(简写)',
    setAirplaneMode: '飞行模式',
    httpRequest: '发 HTTP 请求',
    defineVariables: '定义变量',
    evalScript: '跑表达式',
    runScript: '跑脚本'
  },
  actionDesc: {
    tapOn: '点一个按钮 / 文字',
    longPressOn: '长按某个元素',
    doubleTapOn: '双击某个元素',
    pressKey: '模拟按设备按键(返回 / Home / Enter ...)',
    back: '等同于按设备返回键',
    hideKeyboard: '把虚拟键盘收回去',
    inputText: '在当前输入框输入内容，支持变量',
    eraseText: '删除输入框里的字符',
    pasteText: '把剪贴板内容粘贴到当前输入框',
    setClipboard: '设置剪贴板内容，可用变量',
    copyTextFrom: '从指定元素把文字复制到剪贴板',
    inputRandomText: '输入指定长度的随机字母',
    inputRandomNumber: '输入指定位数的随机数字',
    inputRandomEmail: '输入一个随机邮箱地址',
    inputRandomPersonName: '输入一个随机姓名',
    scroll: '屏幕向下滚动一屏',
    scrollUntilVisible: '一直滚动直到目标元素出现',
    swipe: '上 / 下 / 左 / 右 滑动',
    sleep: '暂停一段时间(毫秒)',
    waitForAnimationToEnd: '等界面动画播完、不再变化',
    extendedWaitUntil: '一直等到某个元素出现 / 消失',
    launchApp: '启动配置中的应用，可设权限 / 清数据',
    stopApp: '正常关闭应用',
    killApp: '强制结束应用进程',
    clearState: '清除应用的数据和缓存(相当于重装)',
    clearKeychain: '清除应用保存的账号密码',
    assertVisible: '找不到目标元素就报错',
    assertNotVisible: '看到指定元素就报错',
    assertTrue: 'JS 表达式必须为 true，否则报错',
    repeat: '反复执行一批命令',
    retry: '失败时自动再试几次',
    branch: 'if / else if / else 多分支',
    runFlow: '执行另一个流程文件 / 子命令组',
    takeScreenshot: '把当前屏幕保存到指定路径',
    setLocation: '模拟 GPS 定位',
    openLink: '打开网页 URL 或应用深度链接',
    setPermissions: '一次性允许 / 拒绝多个权限',
    shell: 'evalScript 的简写，执行一段 JS 表达式',
    setAirplaneMode: '开 / 关飞行模式',
    httpRequest: 'GET / POST，可把返回存进变量',
    defineVariables: '定义可在后续命令里引用的变量',
    evalScript: '执行一段 JS 表达式(常用于改变量)',
    runScript: '执行多行 JS 代码或外部 JS 文件'
  },
  actionCategory: {
    tap: '点击',
    input: '输入',
    scroll: '滚动',
    wait: '等待',
    app: 'App 控制',
    assert: '检查',
    flow: '流程',
    device: '设备',
    http: '网络',
    script: '脚本'
  },
  actionSummary: {
    toFill: '(待填)',
    empty: '(空)',
    unfilled: '(未填)',
    useConfigAppId: '(使用配置 appId)',
    charCount: '{count} 字',
    digitCount: '{count} 位',
    branchCount: '{count} 分支',
    retryCount: '重试 {count} 次',
    varCount: '{count} 个变量',
    permCount: '{count} 项',
    on: '开',
    off: '关',
    defaultVal: '(默认)',
    waitVisible: '等出现 {target}',
    waitInvisible: '等消失 {target}'
  },
  field: {
    text: '显示文字',
    id: '控件 ID',
    index: '命中第几个',
    enabled: '必须可点击',
    selected: '必须已选中',
    checked: '必须已勾选',
    focused: '必须有焦点',
    width: '宽度',
    height: '高度',
    tolerance: '宽高误差',
    point: '坐标 (x,y)',
    traits: '无障碍属性',
    delay: '间隔 (毫秒)',
    repeat: '连点几次',
    waitToSettleTimeoutMs: '等界面稳定 (毫秒)',
    retryTapIfNoChange: '没变化就再试一次',
    waitUntilVisible: '等元素出现再点',
    duration: '时长 (毫秒)',
    timeout: '超时 (毫秒)',
    min: '最少 (毫秒)',
    max: '最多 (毫秒)',
    visible: '元素出现',
    notVisible: '元素消失',
    direction: '方向',
    start: '起点 (x,y)',
    end: '终点 (x,y)',
    from: '从这个元素开始',
    appId: '应用包名',
    clearState: '启动前清空数据',
    stopApp: '已运行先停掉再启',
    clearKeychain: '清除账号密码',
    permissions: '权限',
    arguments: '启动参数',
    charactersToErase: '删几个字符',
    length: '长度',
    speed: '速度 (0~100)',
    visibilityPercentage: '可见百分比',
    centerElement: '居中显示',
    element: '目标元素',
    url: '请求 URL',
    method: '请求方法',
    headers: '请求头',
    body: '请求体',
    outputVariable: '存入变量名',
    jsonPath: 'JSON 路径',
    latitude: '纬度',
    longitude: '经度',
    link: '链接',
    autoVerify: '自动核验',
    browser: '强制用浏览器',
    times: '次数',
    while: '循环条件',
    commands: '子命令',
    maxRetries: '最多重试',
    file: '文件路径',
    env: '变量',
    script: '脚本内容',
    true: '表达式',
    label: '备注名',
    optional: '失败时跳过',
    chance: '执行几率 (0-1)',
    when: '执行条件',
    $value: '内容'
  },
  guide: {
    listView: {
      welcomeTitle: '欢迎来到脚本编排',
      welcomeDesc: '在这里集中管理所有自动化脚本，查看脚本总数和关联应用数量。',
      searchTitle: '搜索脚本',
      searchDesc: '输入脚本名称或应用名，快速定位你要找的脚本。',
      groupTitle: '应用分组',
      groupDesc: '左侧按应用分组筛选。点击某个应用只看它的脚本，点「全部」恢复。',
      listTitle: '脚本列表',
      listDesc: '创建的脚本会以卡片形式展示在这里，按应用分组排列。点击卡片可进入编辑器。',
      createTitle: '开始创建第一个脚本',
      createDesc: '点击这里开始：选择云机 → 选择应用 → 命名脚本 → 进入编辑器。'
    },
    createDialog: {
      wizardTitle: '创建脚本向导',
      wizardDesc: '三步完成创建：选择云机 → 选择应用 → 命名脚本。按顺序操作即可。',
      deviceTitle: '第一步：选择云机',
      deviceDesc: '从左侧选择一台运行中的云机作为调试目标。设备按主机分组展示。',
      appTitle: '第二步：选择应用',
      appDesc: '选中云机后，右侧会自动扫描设备上已安装的应用。选择要自动化的目标应用。',
      nameTitle: '第三步：命名脚本',
      nameDesc: '为你的脚本起个名字。系统会自动填入「应用名 + 自动化」作为默认名。',
      confirmTitle: '确认创建',
      confirmDesc: '三项都选好后，点击「开始创建」进入编辑器。'
    },
    editView: {
      infoTitle: '脚本信息栏',
      infoDesc:
        '显示脚本名称、关联应用和运行状态。双击名称可重命名，下拉菜单可快速切换到其他脚本。',
      screenTitle: '云机画面',
      screenDesc:
        '实时显示云机屏幕。在「选取模式」下点击屏幕上的 UI 元素，系统会自动识别并推荐操作，一键生成步骤。',
      modeTitle: '模式切换',
      modeDesc:
        '「选取模式」拾取元素生成步骤；「冻结模式」正常操作手机——滑动翻页、打开目标页面后再切回选取。',
      editorTitle: 'YAML 编辑器',
      editorDesc: '右侧是脚本代码区。拾取元素后自动插入 YAML 代码，你也可以手动编写和修改。',
      saveRunTitle: '保存与运行',
      saveRunDesc: '编辑完成后点「保存」(⌘S)，然后「运行」即可在云机上执行脚本。运行中可随时停止。',
      switchTitle: '切换云机',
      switchDesc: '需要在其他云机上测试？点这里切换目标设备。'
    },
    elementPick: {
      panelTitle: '元素详情面板',
      panelDesc: '点击屏幕上的元素后会弹出这个面板，展示元素的类型、属性和位置信息。',
      recommendTitle: '智能推荐动作',
      recommendDesc:
        '系统根据元素类型自动推荐最合适的操作（点击、输入、滑动等）。直接点击卡片即可将操作添加为脚本步骤。',
      candidateTitle: '候选元素切换',
      candidateDesc:
        '屏幕同一位置可能有多个重叠元素。展开列表可切换到更精准的目标，高亮会同步更新。',
      detailTitle: '查看选择器详情',
      detailDesc: '切换到属性视图，查看元素的选择器策略（文本/ID/坐标）和详细属性，方便手动微调。'
    },
    frozenMode: {
      enteredTitle: '已进入冻结模式',
      enteredDesc:
        '冻结模式下可以正常操作手机——滑动翻页、打开应用、导航到目标界面，不会触发元素拾取。',
      operateTitle: '操作手机画面',
      operateDesc: '现在可以在屏幕上自由操作——滑动、点击、翻页，导航到你要拾取元素的目标页面。',
      switchBackTitle: '切回选取模式',
      switchBackDesc: '到达目标页面后，点这里切回选取模式，继续点击屏幕元素来生成脚本步骤。'
    },
    selectorDetail: {
      viewTitle: '元素详情视图',
      viewDesc: '这里展示当前元素的全部定位策略和属性信息，帮你理解脚本如何找到这个元素。',
      strategyTitle: '选择器策略',
      strategyDesc:
        '列出所有可用的定位方式（文本、ID、坐标等）。分数越高越稳定，首选项会自动用于生成的 YAML 代码。',
      propertyTitle: '元素属性',
      propertyDesc:
        '显示元素的完整属性（类名、坐标、尺寸、文本等）。点击属性行可一键复制值，方便手动编写脚本。'
    }
  },
  recommendation: {
    ancestorClickable: '最近可点父节点',
    ancestorScrollable: '最近可滚父容器',
    ancestorEditable: '最近可输入父节点',
    ancestorCheckable: '最近可勾选父节点',
    ancestorFocusable: '最近可聚焦父节点',
    self: '自身',
    upgraded: '源节点不可交互，升级到{relation}后最适合 {action}(评分 {score})',
    bestMatch: '该元素最适合 {action}(评分 {score})',
    multiStep: '多步方案：依次执行 {steps}',
    suitsCurrent: '适合当前元素',
    insertOneStep: '点击后会插入 1 个步骤',
    currentElement: '{name} 当前元素'
  },
  popover: {
    element: '元素',
    strategyTextIndexed: '按 text + 位置消歧',
    strategyText: '按 text 匹配',
    strategyIdIndexed: '按 id + 位置消歧',
    strategyId: '按 id 匹配',
    strategySpatial: '按空间关系',
    strategyTraits: '按无障碍属性',
    strategyPoint: '按坐标兜底',
    reasonUnique: '唯一匹配，不随布局变化',
    reasonIndexed: '带索引消歧，通常稳定',
    reasonMayChange: '可能受界面变化影响',
    reasonFragile: '换设备或分辨率即失效'
  },
  misc: {
    unnamedApp: '未命名应用',
    loadDeviceFailed: '加载主机 / 云机数据失败',
    scanTimeout: '扫描超时，请检查云机网络',
    guideNext: '下一步',
    guidePrev: '上一步',
    guideDone: '完成'
  },
  yamlSchema: {
    // ── 通用字段 ──
    commonWhen: '⚡ 只有满足条件时才执行这一步，否则跳过',
    commonChance:
      '🎲 按概率决定是否执行\n\n范围 `0.0`~`1.0`，如 `0.3` 表示 30% 概率执行\n\n与 `when` 二选一（同时写只有 `when` 生效）',
    commonLabel: '给这一步起个名字，方便在运行日志里辨认\n\n`string`',
    commonOptional: '这一步失败时不中断整个流程，自动跳过继续跑后面\n\n`boolean` 默认 `false`',

    // ── 元素选择器 ──
    selectorTitle: '元素选择器',
    selectorDesc:
      '在屏幕上找一个元素（按钮、文字、图标等）。可按文字、ID、状态、位置关系组合查找，多个条件必须同时满足。',
    selectorText: '按显示文字查找（支持正则表达式）\n\n如 `"登录"` `"^确定$"` `"价格：\\\\d+"`',
    selectorId: '按控件 ID 查找（不用写包名前缀）\n\n如 `"btn_login"`',
    selectorEnabled: '只选可点击（或不可点击）的元素\n\n`true` = 可点击，`false` = 不可点击',
    selectorSelected: '只选处于选中状态的元素\n\n`true` = 已选中，`false` = 未选中',
    selectorChecked: '只选勾选状态的元素（复选框 / 开关）\n\n`true` = 已勾选，`false` = 未勾选',
    selectorFocused: '只选当前有焦点的元素（如正在输入的文本框）\n\n`true` = 有焦点',
    selectorWidth: '按宽度查找\n\n单位像素 px',
    selectorHeight: '按高度查找\n\n单位像素 px',
    selectorTolerance: '宽高允许的误差范围（±像素）\n\n默认 `0`（严格相等）',
    selectorIndex:
      '匹配到多个时，选第几个\n\n从 0 开始：`0` 第一个，`1` 第二个；负数从后数：`-1` 最后一个',
    selectorOptional: '找不到就跳过，不报错\n\n`boolean` 默认 `false`',
    selectorBelow: '目标元素必须在此元素的「下方」',
    selectorAbove: '目标元素必须在此元素的「上方」',
    selectorLeftOf: '目标元素必须在此元素的「左边」',
    selectorRightOf: '目标元素必须在此元素的「右边」',
    selectorChildOf: '目标元素必须在此元素「里面」（嵌套在内）',
    selectorContainsChild: '目标元素「内部直接包含」此子元素',
    selectorContainsDescendants: '目标元素「内部」同时包含所有列出的后代元素',
    selectorTraits:
      '按无障碍（accessibility）属性查找，多个用空格隔开\n\n如 `"clickable enabled"` = 可点击且启用中',

    // ── 条件 ──
    conditionTitle: '条件判断',
    conditionDesc:
      '写一个判断条件，用在 `when`（满足才执行）、`repeat.while`（循环条件）、`extendedWaitUntil`（等待条件）等场景',
    conditionVisible: '某个元素在屏幕上「可见」时，条件成立',
    conditionNotVisible: '某个元素在屏幕上「不可见」时，条件成立',
    conditionTrue: '写一段 JS 表达式，结果为 `true` 时条件成立\n\n如 `"$\\{counter < 10\\}"`',
    conditionLabel: '给这个条件起个名字，方便在日志里辨认',

    // ── tap 系列 ──
    tapText: '按显示文字查找（支持正则）',
    tapId: '按控件 ID 查找（不用写包名前缀）',
    tapIndex: '匹配到多个时选第几个\n\n从 0 开始；`-1` 表示最后一个',
    tapEnabled: '只选可点击（或不可点击）的',
    tapSelected: '只选已选中的',
    tapChecked: '只选已勾选的（复选框 / 开关）',
    tapFocused: '只选当前有焦点的（如正在输入的框）',
    tapWidth: '按宽度查找\n\n单位像素 px',
    tapHeight: '按高度查找\n\n单位像素 px',
    tapTolerance: '宽高允许的误差范围（±像素）\n\n默认 `0`',
    tapBelow: '目标元素必须在此元素的「下方」',
    tapAbove: '目标元素必须在此元素的「上方」',
    tapLeftOf: '目标元素必须在此元素的「左边」',
    tapRightOf: '目标元素必须在此元素的「右边」',
    tapChildOf: '目标元素必须在此元素「里面」',
    tapContainsChild: '目标元素「内部直接包含」此子元素',
    tapContainsDescendants: '目标元素「内部」同时包含列出的所有后代元素',
    tapTraits: '按无障碍属性查找，多个用空格隔开\n\n如 `"clickable enabled"`',
    tapPoint:
      '直接按屏幕坐标点击\n\n绝对坐标 `"x,y"` 如 `"360,800"`；百分比坐标 `"50%,80%"` 不依赖分辨率',
    tapOptional: '找不到元素就跳过，不报错\n\n默认 `false`',
    tapWaitUntilVisible: '等元素出现后再点',
    tapWaitToSettleTimeoutMs:
      '点完后等界面不再变化多久才继续\n\n单位 ms，默认 `1500`，最大 `30000`（超过会被截断）',
    tapRetryTapIfNoChange: '点完后界面没变化时，自动再点一次\n\n默认 `false`（不重试）',
    tapRepeat: '连续点几次\n\n搭配 `delay` 一起用',
    tapDelay: '连续点击之间的间隔\n\n单位 ms 默认 `100`',
    tapLabel: '给这一步起个名字，方便在日志里辨认',

    // ── appId 对象 ──
    appIdDesc: '应用包名，省略时自动用配置区中的 `appId`',

    // ── 构造器辅助 ──
    helperBoolTrigger: '直接写 `true` 即可触发（不传参数）',
    helperStringParam: '传一个字符串参数',
    helperAppIdHint: '应用包名（如 `com.example.app`）',
    helperFixedMs: '固定毫秒数',
    helperRandomRange: '写成 `[最小值, 最大值]` 会在范围内随机取值（单位 ms）',

    // ── 命令枚举头 ──
    cmdTitle: '脚本命令',
    cmdDesc: '可以直接写命令名（不带参数），也可以写命令名 + 参数（冒号后面跟内容）',

    // ── 无参命令枚举描述 ──
    enumLaunchApp: '🚀 启动配置中指定的应用',
    enumStopApp: '⏹️ 停止配置中指定的应用',
    enumKillApp: '🔴 强制结束配置中指定的应用',
    enumClearState: '🗑️ 清除应用的数据和缓存',
    enumClearKeychain: '🔑 清除应用的账号密码缓存',
    enumScroll: '📜 向下滚动一次',
    enumBack: '⬅️ 按下返回键',
    enumHideKeyboard: '⌨️ 收起虚拟键盘',
    enumHideKeyboardAlias: '⌨️ 收起虚拟键盘（带空格的别名写法）',
    enumPasteText: '📋 粘贴剪贴板内容',
    enumEraseText: '⌫ 删除输入框文本（默认 50 字符）',
    enumInputRandomText: '🎲 输入 8 位随机字母',
    enumInputRandomNumber: '🎲 输入随机数字',
    enumInputRandomEmail: '📧 输入随机邮箱',
    enumInputRandomPersonName: '👤 输入随机姓名',
    enumWaitForAnimationToEnd: '⏱️ 等待动画结束（默认 `15000` ms）',

    // ── launchApp ──
    launchAppDesc: '🚀 启动应用\n\n可直接传包名，或写详细配置对象',
    launchAppAppIdHint: '应用包名，如 `com.example.app`',
    launchAppClearState: '启动前把应用的数据清空（相当于重装一次）\n\n默认 `false`',
    launchAppStopApp: '如果 App 已经在运行，先停掉再启动\n\n默认 `true`',
    launchAppClearKeychain: '清除应用保存的账号密码',
    launchAppPermissions:
      '启动时自动预设权限：`权限名: allow 或 deny`\n\n如 `camera: allow` `location: deny`',
    launchAppArguments:
      '启动时传给应用的额外参数（Android 叫 Intent extras）\n\n键值都是字符串，如 `from: push`',

    // ── stopApp / killApp / clearState ──
    stopAppDesc: '⏹️ 停止应用',
    killAppDesc: '🔴 强制停止应用',
    clearStateDesc: '🗑️ 清除应用数据',

    // ── tap 系列命令 ──
    tapOnDesc: '👆 点击元素\n\n可按文字、ID 或屏幕坐标点击',
    tapOnHint: '要点击的按钮 / 文字内容（支持正则）',
    longPressOnDesc: '👆 长按元素\n\n用法与 `tapOn` 完全一致',
    longPressOnHint: '要长按的按钮 / 文字内容（支持正则）',
    doubleTapOnDesc: '👆 双击元素\n\n用法与 `tapOn` 完全一致',
    doubleTapOnHint: '要双击的按钮 / 文字内容（支持正则）',

    // ── swipe ──
    swipeDesc: '👉 滑动屏幕\n\n按方向滑，或从起点到终点坐标滑',
    swipeEnumUp: '⬆️ 上滑',
    swipeEnumDown: '⬇️ 下滑',
    swipeEnumLeft: '⬅️ 左滑',
    swipeEnumRight: '➡️ 右滑',
    swipeDirection: '滑动方向',
    swipeDuration: '一次滑动耗时 ms 默认 `400`',
    swipeStart: '起点坐标，格式 `"x,y"` 或百分比 `"50%,80%"`',
    swipeEnd: '终点坐标，格式同 start',
    swipeFrom: '从这个元素所在的位置开始滑',
    swipeWaitToSettleTimeoutMs: '滑动后等界面不再变化多久才继续\n\n单位 ms，默认 `1500`',

    // ── scroll ──
    scrollDesc: '📜 向下滚动一次',

    // ── scrollUntilVisible ──
    scrollUntilVisibleDesc: '📜 一直滚到目标元素出现为止',
    scrollUntilVisibleElement: '要找的目标元素（必填）',
    scrollUntilVisibleDirection: '往哪个方向滚\n\n默认 `DOWN`（往下）',
    scrollUntilVisibleTimeout: '最多滚多久\n\n单位 ms 默认 `20000`，超时就算失败',
    scrollUntilVisibleSpeed: '滚动速度（`0` 最慢，`100` 最快）\n\n默认 `40`',
    scrollUntilVisibleVisibilityPct:
      '元素要露出多少百分比才算「看到了」\n\n`0`~`100`，默认 `100`（完全可见）',
    scrollUntilVisibleCenterElement: '找到后再继续滚，把元素移到屏幕正中间\n\n默认 `false`',
    scrollUntilVisibleWaitToSettle: '每次滚完等界面不再变化多久才继续\n\n单位 ms，默认 `1500`',
    scrollUntilVisibleFrom: '在指定容器内滚动（不在全屏范围内滚）\n\n如 `id: "list_container"`',

    // ── inputText ──
    inputTextDesc: '⌨️ 在当前输入框输入内容\n\n可直接写文字或数字，支持变量 `"$\\{USERNAME\\}"`',

    // ── eraseText ──
    eraseTextDesc: '⌫ 删除文本\n\n删除输入框中的字符',
    eraseTextIntHint: '删除字符数（默认 `50`）',
    eraseTextPropHint: '删除字符数',

    // ── inputRandomText ──
    inputRandomTextDesc: '🎲 输入随机文本',
    inputRandomTextIntHint: '随机文本长度（默认 `8`）',
    inputRandomTextPropHint: '文本长度',

    // ── inputRandomNumber ──
    inputRandomNumberDesc: '🎲 输入随机数字',
    inputRandomNumberIntHint: '随机数字位数',
    inputRandomNumberPropHint: '数字位数',

    // ── inputRandomEmail / inputRandomPersonName ──
    inputRandomEmailDesc: '📧 输入随机邮箱地址',
    inputRandomPersonNameDesc: '👤 输入随机姓名',

    // ── pressKey ──
    pressKeyDesc: '🔘 按键\n\n模拟按一下设备上的按键，名称大小写随意',
    pressKeyStringHint: [
      '按键名（不区分大小写；多个单词的键用空格分开，例如 `Volume Up`）',
      '',
      '**常用**：`Home` · `Back` · `Enter` · `Tab` · `Delete` · `Backspace` · `Space` · `Escape` · `Menu` · `Search` · `Power` · `Camera` · `Clear` · `Lock`',
      '**音量 / 翻页**：`Volume Up` · `Volume Down` · `Page Up` · `Page Down`',
      '**方向键**：`DPad Up` · `DPad Down` · `DPad Left` · `DPad Right` · `DPad Center`',
      '**字母/数字**：`A`~`Z` · `0`~`9`',
      '**符号**：`Comma` · `Period` · `Grave` · `Minus` · `Equals` · `Semicolon` · `Apostrophe` · `Slash` · `Backslash` · `Left Bracket` · `Right Bracket` · `At` · `Plus` · `Star` · `Pound`',
      '**小键盘**：`Numpad 0`~`Numpad 9`',
      '**其他**：`Call` · `EndCall` · `Forward Delete`'
    ].join('\n'),
    pressKeyIntHint: '也可以直接写 Android 按键代码数字\n\n`integer`',

    // ── hideKeyboard / back ──
    hideKeyboardDesc: '⌨️ 收起虚拟键盘',
    backDesc: '⬅️ 按下返回键',

    // ── assertions ──
    assertVisibleDesc: '✅ 检查元素必须可见\n\n默认等待 `17000` ms（17 秒），超时则报错、流程终止',
    assertVisibleHint: '希望看到的文本（支持正则）',
    assertNotVisibleDesc: '❌ 检查元素必须不可见\n\n如果一直能看到就报错（最多等 `7000` ms）',
    assertNotVisibleHint: '不应该出现的文本（支持正则）',
    assertTrueDesc:
      '🧪 检查条件必须成立\n\n写一个 JS 表达式，例如 `"$\\{counter > 0\\}"`，结果必须是 true',

    // ── sleep ──
    sleepDesc: '⏱️ 暂停一段时间\n\n可以写固定 ms、`[最小, 最大]` 随机区间，或对象形式',
    sleepFixedMs: '固定等待（毫秒）',
    sleepRandomRange: '写成 `[最小值, 最大值]` 会在范围内随机等待（单位 ms）',
    sleepDuration: '固定时长（ms）',
    sleepMin: '随机等待的最小值（ms）',
    sleepMax: '随机等待的最大值（ms）',

    // ── waitForAnimationToEnd ──
    waitAnimDesc: '⏱️ 等当前动画播完、界面不再变化\n\n单位 ms 默认最多等 `15000`',
    waitAnimDefault: '使用默认超时 `15000` ms',
    waitAnimCustom: '自定义超时（ms）',
    waitAnimTimeout: '超时\n\n单位 ms 默认 `15000`',

    // ── extendedWaitUntil ──
    extWaitDesc: '⏱️ 持续等待某个条件满足\n\n等到元素出现 / 消失为止，或等到超时为止',
    extWaitVisible: '一直等到这个元素「出现」',
    extWaitNotVisible: '一直等到这个元素「消失」',
    extWaitTimeout: '最多等多久\n\n单位 ms 默认 `17000`，超时就算失败',

    // ── repeat ──
    repeatDesc:
      '🔄 循环执行一批命令\n\n三种停止模式可组合：指定次数 `times` / 指定总时长 `duration` / 指定条件 `while`\n\n限制：单次最多 `1000` 次循环，不设 `duration` 时默认最长 `30` 分钟',
    repeatTimes: '重复几次\n\n如 `3`，表示这批命令执行 3 次',
    repeatDuration: '总共跑多久\n\n单位 ms；也可写成 `[min, max]` 在范围内随机',
    repeatDurationRandom: '写成 `[最小值, 最大值]` 会在范围内随机选一个时长（单位 ms）',
    repeatWhile: '循环条件：一直跑，直到条件不成立才停',
    repeatCommands: '要反复执行的命令列表（必填）',

    // ── retry ──
    retryDesc: '🔁 失败自动重试\n\n命令执行失败时，自动再试几次',
    retryMaxRetries: '失败后最多再重试几次（不算第一次），默认 `1`，最大 `3`',
    retryCommands: '要尝试执行的命令列表（必填）',

    // ── runFlow ──
    runFlowDesc: '📂 执行一个子流程\n\n可以直接写文件路径，也可以在 YAML 里直接写要执行的命令',
    runFlowStringHint: '另一个 YAML 子流程的文件路径',
    runFlowCommands: '子流程的命令列表（与 `file` 二选一）',
    runFlowFile: '子流程的文件路径（与 `commands` 二选一）',
    runFlowEnv: '子流程专用的变量（会覆盖或新增到父流程变量上）\n\n如 `USER: zhangsan`',

    // ── branch ──
    branchDesc:
      '🔀 条件分支（if / else if / else）\n\n从上到下找第一个条件成立的分支执行；没有 `when` 的那个就是兜底分支',
    branchWhen: '进入这个分支的条件；省略 `when` 的分支作为兜底（相当于 `else`）',
    branchCommands: '这个分支要执行的命令（必填）',

    // ── defineVariables / evalScript / runScript ──
    defineVariablesDesc:
      '📝 定义几个变量，后面用 `$\\{变量名\\}` 就能引用\n\n如 `USERNAME: zhangsan`，之后在命令里可以写 `$\\{USERNAME\\}`\n\n⚠️ 除 `when`/`chance` 外，所有其它键都会被当作变量名',
    evalScriptDesc:
      '📜 执行一段 JS 表达式（常用于更新变量）\n\n如 `"$\\{counter = counter + 1\\}"`',
    runScriptDesc: '📜 运行一段 JS 脚本\n\n可以直接写代码、写对象配置、或引用外部文件',
    runScriptStringHint: '直接写一段 JS 代码',
    runScriptScript: 'JS 代码（和 `file` 二选一）',
    runScriptFile: '外部 JS 文件路径（和 `script` 二选一）',
    runScriptEnv: '脚本运行时能读到的变量',

    // ── clipboard ──
    copyTextFromDesc: '📋 从指定元素把文字复制到剪贴板',
    copyTextFromHint: '要复制文字的目标元素',
    pasteTextCmdDesc: '📋 粘贴剪贴板里的内容到当前输入框',
    setClipboardDesc: '📋 设置剪贴板内容\n\n支持 `$\\{变量名\\}` 替换',

    // ── device ──
    setLocationDesc: '📍 模拟 GPS 定位到指定位置',
    setLocationLatitude: '纬度（南北方向坐标），范围 `-90.0` ~ `90.0`',
    setLocationLongitude: '经度（东西方向坐标），范围 `-180.0` ~ `180.0`',
    openLinkDesc: '🔗 打开链接\n\n网页地址或 app 内的跳转链接',
    openLinkStringHint: '网页 URL 或应用深度链接（如 `myapp://home`）',
    openLinkLink: '网页 URL 或应用深度链接（如 `myapp://home`）',
    openLinkAutoVerify: '让系统自动核对这个链接（Android App Links 的机制）',
    openLinkBrowser: '强制用浏览器打开，不走应用内跳转',
    takeScreenshotDesc: '📷 截图并保存到指定路径',
    setPermissionsDesc: '🔐 批量设置应用的权限',
    setPermissionsPermissions:
      '权限名：`allow`（授予）/ `deny`（拒绝）\n\n如 `camera: allow` `location: deny`',
    shellDesc: '📜 执行 JS 表达式（`evalScript` 的简写，不是操作系统命令行）',
    shellHint: 'JS 表达式，如 `"counter = counter + 1"`',
    setAirplaneModeDesc: '✈️ 开启 / 关闭飞行模式',
    setAirplaneModeBool: '`true` 开飞行模式，`false` 关飞行模式',
    setAirplaneModeEnabled: '开或关\n\n默认 `true`（开启）',

    // ── httpRequest ──
    httpDesc: '🌐 发一个 HTTP 请求\n\n可以把返回结果存进变量，后续命令用',
    httpUrl: '请求的 URL（必填），支持 `$\\{变量名\\}` 替换',
    httpMethod: '请求方法，默认 `GET`',
    httpEnumGet: '📥 GET（获取数据）',
    httpEnumPost: '📤 POST（提交数据）',
    httpHeaders: '请求头，键值都是字符串\n\n如 `Authorization: Bearer xxx`',
    httpBody: 'POST 请求的 body，写一个 JSON 结构（可嵌套）',
    httpOutputVariable: '把返回结果存到这个变量名里，后面用 `$\\{变量名\\}` 引用',
    httpJsonPath:
      '只取返回 JSON 里的某个字段（用点分隔）\n\n如 `"data.code"` 取 `data` 下的 `code`',
    httpRetry: '失败时自动重试的配置',
    httpRetryTimes: '最大重试次数，默认 `1`（即失败后最多再请求 1 次）',
    httpRetryInterval: '两次请求之间隔多久\n\n单位 ms 默认 `3000`',

    // ── 配置区 ──
    configTitle: '脚本配置',
    configDesc: '配置区域：写在第一段，用 `---` 跟下面的命令分开',
    configAppId: '📱 要自动化的应用包名（必填），如 `com.example.app`',
    configName: '📛 这个流程的名字（方便辨认）',
    configUrl: '🔗 要自动化的网页地址（做 Web 自动化时才用）',
    configTags: '🏷️ 给流程打标签，一个字符串数组（方便分类、筛选）',
    configEnv:
      '🔧 定义整个流程可用的变量\n\n如 `USERNAME: zhangsan`，命令里用 `$\\{USERNAME\\}` 引用',
    configOnFlowStart: '▶️ 流程开始前要先执行的命令（准备工作）',
    configOnFlowComplete: '⏏️ 流程结束后要执行的命令（无论成功失败都会跑，常用于清理）',
    configExceptionHandlers: '🛡️ 兜底弹窗处理\n\n命令执行遇到意外弹窗时，自动点掉对应按钮然后继续',
    configExceptionText: '弹窗里要点击的按钮文字（直接写文字）',
    configExceptionTextProp: '弹窗里要点击的按钮文字（支持正则）',
    configExceptionId: '弹窗里要点击的按钮 ID',
    configExceptionMaxTrigger: '最多处理多少次，防止同一个弹窗反复弹出导致卡死',
    configExceptionBelow: '限定按钮在某个元素下方（用于消歧义）',
    configProperties: '📦 自定义备注信息，只做记录用，不会影响流程执行',

    // ── 命令列表 ──
    commandListTitle: '命令列表',
    commandListDesc: '命令区域：写在 `---` 之后，每条命令前面加 `- `（短横杠 + 空格）'
  }
}
