export default {
  yamlEditor: 'YAML 編輯器',
  deviceScreen: '雲機畫面',
  selectDevice: '選擇雲機',
  run: '運行',
  stop: '停止',
  running: '運行中...',
  selectDeviceFirst: '請先選擇一台雲機',
  yamlEmpty: 'YAML 內容為空',
  runFailed: '運行失敗',
  stopped: '已停止',
  stopFailed: '停止失敗',
  retryConnection: '重試連接',
  connecting: '連接中...',
  connectionFailed: '連接失敗',
  noDeviceConnected: '未連接雲機',
  noDeviceDesc: '點擊右上角選擇一台運行中的雲機',
  saved: '已儲存並格式化',
  inspector: {
    title: '控件選擇器',
    enable: '開啟',
    disable: '關閉選擇器',
    cancelPicking: '取消選擇',
    repick: '重新選擇',
    needDevice: '請先連接雲機',
    hoverHint: '移動滑鼠預覽控件\n點擊選中生成命令',
    locked: '已選中',
    attributes: '屬性',
    position: '位置',
    state: '狀態',
    clickable: '可點擊',
    focusable: '可聚焦',
    enabled: '已啟用',
    scrollable: '可滾動',
    checked: '已勾選',
    selected: '已選中',
    copied: '已複製',
    commands: '快捷命令',
    insert: '插入',
    copy: '複製'
  },
  actionModal: {
    title: '可以對這個元素執行的操作',
    search: '搜尋命令...',
    noResult: '沒有找到匹配的命令',
    copied: '已複製',
    run: '運行',
    edit: '編輯',
    copy: '複製',
    keyboard: {
      navigate: '導航',
      copy: '複製',
      edit: '編輯',
      run: '運行',
      search: '搜尋',
      close: '關閉'
    }
  },
  editor: {
    yamlCannotSave: 'YAML 有錯誤，無法儲存',
    saveFailed: '儲存失敗',
    saveSuccess: '儲存成功',
    yamlErrorLeaveBody: '目前 YAML 有語法錯誤，無法儲存。是否放棄修改並離開？',
    yamlErrorLeaveTitle: 'YAML 有錯誤',
    discardAndLeave: '放棄修改並離開',
    continueEditing: '繼續編輯',
    unsavedBody: '目前腳本有未儲存的修改，是否儲存後再離開？',
    unsavedTitle: '未儲存的修改',
    saveAndLeave: '儲存並離開',
    discardChanges: '放棄修改',
    switchedTo: '已切換到：{name}',
    pickElementHint: '請在雲機上點選要插入的元素',
    elementAdded: '已加到步驟',
    yamlValidationFailed: 'YAML 校驗失敗，請先修復',
    selectDeviceAndAddSteps: '請先選擇雲機並新增步驟'
  },
  engine: {
    offline: 'flow-engine 離線，主機不可達',
    notInstalled: 'flow-engine 未部署，無法執行',
    updateAvailable: 'flow-engine 版本過舊，請更新後執行',
    checking: '正在檢測 flow-engine …'
  },
  grid: {
    emptyTitle: '還沒有腳本',
    emptyDesc: '建立一條腳本，定義步驟和參數，之後一鍵在多台雲機上批量運行。',
    emptyCreate: '新建第一條腳本',
    featSteps: '編寫步驟',
    featStepsDesc: '從動作庫中選擇操作',
    featParams: '參數配置',
    featParamsDesc: '調整每步執行細節',
    featBatch: '批量執行',
    featBatchDesc: '多台雲機同時運行',
    noMatchTitle: '沒有找到「{keyword}」',
    noMatchDesc: '換個關鍵字試試，或者新建一條腳本。',
    clearSearch: '清除搜尋',
    newScript: '新建腳本'
  },
  stage: {
    yamlError: '⚠ YAML 錯誤 · 暫不能加步驟',
    frozenMode: '🧊 凍結模式 · 可操作手機',
    pickMode: '🎯 選取模式 · 點元素新增步驟',
    switchToPick: '切回選取',
    switchToFreeze: '切到凍結',
    retry: '重試',
    connecting: '連接中...',
    noDevice: '未連接雲機',
    noDeviceHint: '建立腳本時會自動連接'
  },
  topBar: {
    untitled: '未命名腳本',
    running: '運行中',
    runError: '運行失敗',
    runSuccess: '✓ 運行完成',
    pickMode: '選元素模式 · 點元素加步驟',
    idle: '空閒',
    backToList: '返回列表',
    unsavedChanges: '有未儲存修改',
    changeDevice: '換雲機',
    syntaxGuide: '語法指南',
    cantSwitchRunning: '運行中不可切換雲機',
    cantSwitchDeploying: '部署中不可切換雲機',
    engineOnline: '在線',
    engineOffline: '離線',
    engineNotInstalled: '未安裝',
    engineUpdateAvailable: '需更新',
    engineOnlineTitle: 'flow-engine 在線',
    engineOfflineTitle: 'flow-engine 離線 — 主機不可達（請檢查網路）',
    engineNotInstalledTitle: 'flow-engine 未部署 — 請聯繫運維安裝服務',
    engineUpdateAvailableTitle: '主機上的 flow-engine 版本較舊，請先更新再執行腳本'
  },
  actionBar: {
    stopRun: '停止運行',
    save: '儲存',
    saved: '已儲存',
    run: '運行'
  },
  yamlErrorBar: {
    defaultTitle: 'YAML 有錯誤，不能切回可視化也不能運行'
  },
  statusBar: {
    steps: '{count} 步',
    lines: '{count} 行',
    errors: '✗ {count} 個錯誤',
    noErrors: '✓ 無錯誤'
  },
  switcher: {
    search: '搜腳本',
    loading: '載入中…',
    noMatch: '未找到匹配',
    empty: '暫無腳本',
    steps: '{count} 步',
    newScript: '新建腳本'
  },
  sidePanel: {
    ariaLabel: '編輯面板',
    visual: '視覺化',
    errors: '{count} 個錯誤',
    syntaxOk: '語法正常'
  },
  stepList: {
    title: '步驟列表',
    emptyHint: '還沒有步驟，可以從下面新增',
    addStep: '新增步驟'
  },
  stepTree: {
    addInContainer: '加一步',
    branchLabel: '分支 {index}',
    insertElement: '+ 選元素插入'
  },
  stepItem: {
    viewYaml: '去 YAML 看這段',
    deleteStep: '刪除這一步'
  },
  engineBanner: {
    title: 'flow-engine 未就緒',
    hint: '— 腳本無法執行，請先安裝引擎。',
    install: '一鍵安裝',
    updateTitle: 'flow-engine 需要更新',
    updateHint: '— 主機上的引擎版本較舊，更新後才能執行腳本。',
    update: '一鍵更新'
  },
  deviceDialog: {
    createTitle: '建立腳本',
    switchTitle: '切換雲機',
    selectDevice: '選擇目標雲機',
    hostStats: '{hosts} 主機 · {running} 運行中',
    noHosts: '暫無在線主機或運行中的雲機',
    selectApp: '選擇目標應用',
    from: '來自',
    selectDeviceFirst: '請先在左側選擇一台裝置',
    waitingForDevice: '等待選擇裝置...',
    searchApp: '搜尋應用名或包名...',
    scanFailed: '掃描失敗',
    retryScan: '重試掃描',
    noMatchApp: '未找到匹配的應用',
    noApps: '暫無已安裝應用',
    recentApps: '常用應用',
    allApps: '全部應用 ({count})',
    nameYourScript: '命名你的腳本',
    namePlaceholder: '例如：抖音 自動點讚腳本',
    scanHint: '僅掃描包含桌面入口的應用',
    cancel: '取消',
    startCreate: '開始建立',
    confirmSwitch: '確認切換',
    defaultName: '{appName} 自動化'
  },
  deploy: {
    title: '安裝 flow-engine',
    desc: '將自動化引擎部署到目標主機並啟動服務',
    targetHost: '目標主機',
    password: '主機密碼',
    passwordPlaceholder: '輸入 root 密碼',
    checkingVersion: '正在檢查引擎版本…',
    connecting: '正在連接主機…',
    uploading: '上傳引擎檔案…',
    installing: '安裝並啟動服務…',
    verifying: '驗證服務狀態…',
    failed: '部署失敗',
    success: '部署成功',
    installSuccess: '安裝成功',
    updateSuccess: '更新成功',
    alreadyLatest: '目前已是最新版本，無需重複安裝',
    unreachable: '目標主機不可達',
    updatePending: '檢測到舊版本 {current}，將覆蓋更新到 {bundled}',
    cancel: '取消',
    start: '開始部署',
    done: '完成',
    close: '關閉',
    retry: '重試'
  },
  actionPicker: {
    title: '新增步驟',
    heading: '新增動作',
    subtitle: '選擇一個動作新增到腳本，隨後可配置其詳細參數。',
    searchPlaceholder: '搜尋動作，如：點擊、輸入、等待...',
    noResult: '未找到與「{keyword}」相關的動作'
  },
  card: {
    openScript: '打開腳本 {name}',
    delete: '刪除',
    justNowUpdated: '剛剛更新',
    minutesAgoUpdated: '{count} 分鐘前更新',
    hoursAgoUpdated: '{count} 小時前更新',
    daysAgoUpdated: '{count} 天前更新',
    dateUpdated: '{month}月{day}日更新',
    dateYearUpdated: '{year}年{month}月{day}日更新',
    dateCreated: '{month}月{day}日建立',
    dateYearCreated: '{year}年{month}月{day}日建立',
    draft: '草稿',
    stepUnit: '步'
  },
  listView: {
    deleteTitle: '刪除腳本',
    deleteConfirm: '確定要刪除「{name}」嗎？此操作不可撤銷。',
    deleteBtn: '刪除',
    cancelBtn: '取消',
    deleted: '已刪除',
    deleteFailed: '刪除失敗',
    loadFailed: '載入失敗'
  },
  filterBar: {
    ariaLabel: '應用分組',
    all: '全部'
  },
  elementPopover: {
    copied: '已複製',
    selectorStrategy: '選擇器策略',
    elementProperties: '元素屬性',
    viewDetails: '看屬性 / 選擇器',
    backToActions: '返回推薦動作',
    noAnchor: '未找到文字/id 錨點，僅座標可用',
    lowStability: '腳本可能不夠穩定，建議換個有文字的位置',
    close: '關閉',
    escClose: 'Esc 關閉'
  },
  yamlPreview: {
    collapse: '收起 YAML',
    expand: '看 YAML',
    noPreview: '# (無法產生預覽)'
  },
  yamlEditorHover: {
    executionFailed: '**執行失敗**'
  },
  appRow: {
    daysAgo: '{count} 天前',
    hoursAgo: '{count}h 前',
    minutesAgo: '{count}m 前',
    justNow: '剛剛'
  },
  actionPane: {
    otherActions: '其他可選動作',
    noRecommendation: '當前元素沒有合適的推薦動作'
  },
  heroCard: {
    smartRecommend: '智慧推薦',
    clickToApply: '點擊套用'
  },
  candidatePicker: {
    clickableArea: '可點擊區域（無錨）',
    noAnchor: '無文字錨點',
    label: '候選元素',
    sortHint: '按面積升序 · 越具體（越小）的元素排在前'
  },
  statusChip: {
    steps: '{count} 步',
    draft: '草稿'
  },
  stepEditor: {
    collapse: '收起',
    collapseEditor: '收起編輯器'
  },
  autoForm: {
    primaryParams: '主要參數',
    complexHint: '複雜結構，推薦到 YAML 編輯器修改',
    moreSettings: '更多設定 ({count})',
    common: '通用',
    labelField: '備註名',
    labelPlaceholder: '只給自己看，運行日誌裡顯示',
    skipOnFail: '失敗時跳過',
    skipOnFailHint: '這一步失敗不會打斷整個流程',
    chanceField: '按機率執行',
    chanceHint: '0~1，如 0.3 = 30% 機率'
  },
  deviceStage: {
    connectionFailed: '連線失敗'
  },
  actionLabel: {
    tapOn: '點擊',
    longPressOn: '長按',
    doubleTapOn: '雙擊',
    pressKey: '按按鍵',
    back: '按返回鍵',
    hideKeyboard: '收起鍵盤',
    inputText: '輸入文字',
    eraseText: '清空輸入框',
    pasteText: '貼上',
    setClipboard: '寫入剪貼簿',
    copyTextFrom: '複製元素文字',
    inputRandomText: '隨機字母',
    inputRandomNumber: '隨機數字',
    inputRandomEmail: '隨機信箱',
    inputRandomPersonName: '隨機姓名',
    scroll: '向下滾一次',
    scrollUntilVisible: '滾到看見',
    swipe: '滑動螢幕',
    sleep: '等待時間',
    waitForAnimationToEnd: '等動畫結束',
    extendedWaitUntil: '等條件成立',
    launchApp: '啟動應用',
    stopApp: '關閉應用',
    killApp: '強制結束',
    clearState: '清空應用資料',
    clearKeychain: '清帳號快取',
    assertVisible: '檢查必須可見',
    assertNotVisible: '檢查必須不可見',
    assertTrue: '檢查表達式',
    repeat: '迴圈執行',
    retry: '失敗重試',
    branch: '條件分支',
    runFlow: '呼叫子流程',
    takeScreenshot: '截圖',
    setLocation: '模擬位置',
    openLink: '開啟連結',
    setPermissions: '批次設權限',
    shell: '跑表達式(簡寫)',
    setAirplaneMode: '飛航模式',
    httpRequest: '發 HTTP 請求',
    defineVariables: '定義變數',
    evalScript: '跑表達式',
    runScript: '跑腳本'
  },
  actionDesc: {
    tapOn: '點一個按鈕 / 文字',
    longPressOn: '長按某個元素',
    doubleTapOn: '雙擊某個元素',
    pressKey: '模擬按裝置按鍵(返回 / Home / Enter ...)',
    back: '等同於按裝置返回鍵',
    hideKeyboard: '把虛擬鍵盤收回去',
    inputText: '在目前輸入框輸入內容，支援變數',
    eraseText: '刪除輸入框裡的字元',
    pasteText: '把剪貼簿內容貼到目前輸入框',
    setClipboard: '設定剪貼簿內容，可用變數',
    copyTextFrom: '從指定元素把文字複製到剪貼簿',
    inputRandomText: '輸入指定長度的隨機字母',
    inputRandomNumber: '輸入指定位數的隨機數字',
    inputRandomEmail: '輸入一個隨機信箱地址',
    inputRandomPersonName: '輸入一個隨機姓名',
    scroll: '螢幕向下滾動一屏',
    scrollUntilVisible: '一直滾動直到目標元素出現',
    swipe: '上 / 下 / 左 / 右 滑動',
    sleep: '暫停一段時間(毫秒)',
    waitForAnimationToEnd: '等介面動畫播完、不再變化',
    extendedWaitUntil: '一直等到某個元素出現 / 消失',
    launchApp: '啟動設定中的應用，可設權限 / 清資料',
    stopApp: '正常關閉應用',
    killApp: '強制結束應用程序',
    clearState: '清除應用的資料和快取(相當於重裝)',
    clearKeychain: '清除應用儲存的帳號密碼',
    assertVisible: '找不到目標元素就報錯',
    assertNotVisible: '看到指定元素就報錯',
    assertTrue: 'JS 表達式必須為 true，否則報錯',
    repeat: '反覆執行一批命令',
    retry: '失敗時自動再試幾次',
    branch: 'if / else if / else 多分支',
    runFlow: '執行另一個流程檔案 / 子命令組',
    takeScreenshot: '把目前螢幕儲存到指定路徑',
    setLocation: '模擬 GPS 定位',
    openLink: '開啟網頁 URL 或應用深度連結',
    setPermissions: '一次允許 / 拒絕多個權限',
    shell: 'evalScript 的簡寫，執行一段 JS 表達式',
    setAirplaneMode: '開 / 關飛航模式',
    httpRequest: 'GET / POST，可把回傳存進變數',
    defineVariables: '定義可在後續命令裡引用的變數',
    evalScript: '執行一段 JS 表達式(常用於改變數)',
    runScript: '執行多行 JS 程式碼或外部 JS 檔案'
  },
  actionCategory: {
    tap: '點擊',
    input: '輸入',
    scroll: '滾動',
    wait: '等待',
    app: 'App 控制',
    assert: '檢查',
    flow: '流程',
    device: '裝置',
    http: '網路',
    script: '腳本'
  },
  actionSummary: {
    toFill: '(待填)',
    empty: '(空)',
    unfilled: '(未填)',
    useConfigAppId: '(使用設定 appId)',
    charCount: '{count} 字',
    digitCount: '{count} 位',
    branchCount: '{count} 分支',
    retryCount: '重試 {count} 次',
    varCount: '{count} 個變數',
    permCount: '{count} 項',
    on: '開',
    off: '關',
    defaultVal: '(預設)',
    waitVisible: '等出現 {target}',
    waitInvisible: '等消失 {target}'
  },
  field: {
    text: '顯示文字',
    id: '控件 ID',
    index: '命中第幾個',
    enabled: '必須可點擊',
    selected: '必須已選中',
    checked: '必須已勾選',
    focused: '必須有焦點',
    width: '寬度',
    height: '高度',
    tolerance: '寬高誤差',
    point: '座標 (x,y)',
    traits: '無障礙屬性',
    delay: '間隔 (毫秒)',
    repeat: '連點幾次',
    waitToSettleTimeoutMs: '等介面穩定 (毫秒)',
    retryTapIfNoChange: '沒變化就再試一次',
    waitUntilVisible: '等元素出現再點',
    duration: '時長 (毫秒)',
    timeout: '逾時 (毫秒)',
    min: '最少 (毫秒)',
    max: '最多 (毫秒)',
    visible: '元素出現',
    notVisible: '元素消失',
    direction: '方向',
    start: '起點 (x,y)',
    end: '終點 (x,y)',
    from: '從這個元素開始',
    appId: '應用套件名',
    clearState: '啟動前清空資料',
    stopApp: '已執行先停掉再啟',
    clearKeychain: '清除帳號密碼',
    permissions: '權限',
    arguments: '啟動參數',
    charactersToErase: '刪幾個字元',
    length: '長度',
    speed: '速度 (0~100)',
    visibilityPercentage: '可見百分比',
    centerElement: '居中顯示',
    element: '目標元素',
    url: '請求 URL',
    method: '請求方法',
    headers: '請求標頭',
    body: '請求內容',
    outputVariable: '存入變數名',
    jsonPath: 'JSON 路徑',
    latitude: '緯度',
    longitude: '經度',
    link: '連結',
    autoVerify: '自動核驗',
    browser: '強制用瀏覽器',
    times: '次數',
    while: '迴圈條件',
    commands: '子命令',
    maxRetries: '最多重試',
    file: '檔案路徑',
    env: '變數',
    script: '腳本內容',
    true: '表達式',
    label: '備註名',
    optional: '失敗時跳過',
    chance: '執行機率 (0-1)',
    when: '執行條件',
    $value: '內容'
  },
  guide: {
    listView: {
      welcomeTitle: '歡迎來到腳本編排',
      welcomeDesc: '在這裡集中管理所有自動化腳本，查看腳本總數和關聯應用數量。',
      searchTitle: '搜尋腳本',
      searchDesc: '輸入腳本名稱或應用名，快速定位你要找的腳本。',
      groupTitle: '應用分組',
      groupDesc: '左側按應用分組篩選。點擊某個應用只看它的腳本，點「全部」恢復。',
      listTitle: '腳本列表',
      listDesc: '建立的腳本會以卡片形式展示在這裡，按應用分組排列。點擊卡片可進入編輯器。',
      createTitle: '開始建立第一個腳本',
      createDesc: '點擊這裡開始：選擇雲機 → 選擇應用 → 命名腳本 → 進入編輯器。'
    },
    createDialog: {
      wizardTitle: '建立腳本精靈',
      wizardDesc: '三步完成建立：選擇雲機 → 選擇應用 → 命名腳本。按順序操作即可。',
      deviceTitle: '第一步：選擇雲機',
      deviceDesc: '從左側選擇一台執行中的雲機作為除錯目標。裝置按主機分組展示。',
      appTitle: '第二步：選擇應用',
      appDesc: '選中雲機後，右側會自動掃描裝置上已安裝的應用。選擇要自動化的目標應用。',
      nameTitle: '第三步：命名腳本',
      nameDesc: '為你的腳本取個名字。系統會自動填入「應用名 + 自動化」作為預設名。',
      confirmTitle: '確認建立',
      confirmDesc: '三項都選好後，點擊「開始建立」進入編輯器。'
    },
    editView: {
      infoTitle: '腳本資訊列',
      infoDesc:
        '顯示腳本名稱、關聯應用和執行狀態。雙擊名稱可重新命名，下拉選單可快速切換到其他腳本。',
      screenTitle: '雲機畫面',
      screenDesc:
        '即時顯示雲機螢幕。在「選取模式」下點擊螢幕上的 UI 元素，系統會自動辨識並推薦操作，一鍵產生步驟。',
      modeTitle: '模式切換',
      modeDesc:
        '「選取模式」擷取元素產生步驟；「凍結模式」正常操作手機——滑動翻頁、開啟目標頁面後再切回選取。',
      editorTitle: 'YAML 編輯器',
      editorDesc: '右側是腳本程式碼區。擷取元素後自動插入 YAML 程式碼，你也可以手動編寫和修改。',
      saveRunTitle: '儲存與執行',
      saveRunDesc: '編輯完成後點「儲存」(⌘S)，然後「執行」即可在雲機上執行腳本。執行中可隨時停止。',
      switchTitle: '切換雲機',
      switchDesc: '需要在其他雲機上測試？點這裡切換目標裝置。'
    },
    elementPick: {
      panelTitle: '元素詳情面板',
      panelDesc: '點擊螢幕上的元素後會彈出這個面板，展示元素的類型、屬性和位置資訊。',
      recommendTitle: '智慧推薦動作',
      recommendDesc:
        '系統根據元素類型自動推薦最合適的操作（點擊、輸入、滑動等）。直接點擊卡片即可將操作加入腳本步驟。',
      candidateTitle: '候選元素切換',
      candidateDesc:
        '螢幕同一位置可能有多個重疊元素。展開列表可切換到更精準的目標，高亮會同步更新。',
      detailTitle: '查看選擇器詳情',
      detailDesc: '切換到屬性視圖，查看元素的選擇器策略（文字/ID/座標）和詳細屬性，方便手動微調。'
    },
    frozenMode: {
      enteredTitle: '已進入凍結模式',
      enteredDesc:
        '凍結模式下可以正常操作手機——滑動翻頁、開啟應用、導覽到目標介面，不會觸發元素擷取。',
      operateTitle: '操作手機畫面',
      operateDesc: '現在可以在螢幕上自由操作——滑動、點擊、翻頁，導覽到你要擷取元素的目標頁面。',
      switchBackTitle: '切回選取模式',
      switchBackDesc: '到達目標頁面後，點這裡切回選取模式，繼續點擊螢幕元素來產生腳本步驟。'
    },
    selectorDetail: {
      viewTitle: '元素詳情視圖',
      viewDesc: '這裡展示目前元素的全部定位策略和屬性資訊，幫你理解腳本如何找到這個元素。',
      strategyTitle: '選擇器策略',
      strategyDesc:
        '列出所有可用的定位方式（文字、ID、座標等）。分數越高越穩定，首選項會自動用於產生的 YAML 程式碼。',
      propertyTitle: '元素屬性',
      propertyDesc:
        '顯示元素的完整屬性（類別名、座標、尺寸、文字等）。點擊屬性列可一鍵複製值，方便手動編寫腳本。'
    }
  },
  recommendation: {
    ancestorClickable: '最近可點父節點',
    ancestorScrollable: '最近可滾父容器',
    ancestorEditable: '最近可輸入父節點',
    ancestorCheckable: '最近可勾選父節點',
    ancestorFocusable: '最近可聚焦父節點',
    self: '自身',
    upgraded: '來源節點不可互動，升級到{relation}後最適合 {action}(評分 {score})',
    bestMatch: '該元素最適合 {action}(評分 {score})',
    multiStep: '多步方案：依次執行 {steps}',
    suitsCurrent: '適合目前元素',
    insertOneStep: '點擊後會插入 1 個步驟',
    currentElement: '{name} 目前元素'
  },
  popover: {
    element: '元素',
    strategyTextIndexed: '按 text + 位置消歧',
    strategyText: '按 text 匹配',
    strategyIdIndexed: '按 id + 位置消歧',
    strategyId: '按 id 匹配',
    strategySpatial: '按空間關係',
    strategyTraits: '按無障礙屬性',
    strategyPoint: '按座標兜底',
    reasonUnique: '唯一匹配，不隨版面變化',
    reasonIndexed: '帶索引消歧，通常穩定',
    reasonMayChange: '可能受介面變化影響',
    reasonFragile: '換裝置或解析度即失效'
  },
  misc: {
    unnamedApp: '未命名應用',
    loadDeviceFailed: '載入主機 / 雲機資料失敗',
    scanTimeout: '掃描逾時，請檢查雲機網路',
    guideNext: '下一步',
    guidePrev: '上一步',
    guideDone: '完成'
  },
  yamlSchema: {
    // ── 通用欄位 ──
    commonWhen: '⚡ 只有滿足條件時才執行這一步，否則跳過',
    commonChance:
      '🎲 按機率決定是否執行\n\n範圍 `0.0`~`1.0`，如 `0.3` 表示 30% 機率執行\n\n與 `when` 二擇一（同時寫只有 `when` 生效）',
    commonLabel: '給這一步取個名字，方便在執行日誌裡辨認\n\n`string`',
    commonOptional: '這一步失敗時不中斷整個流程，自動跳過繼續跑後面\n\n`boolean` 預設 `false`',

    // ── 元素選擇器 ──
    selectorTitle: '元素選擇器',
    selectorDesc:
      '在螢幕上找一個元素（按鈕、文字、圖示等）。可按文字、ID、狀態、位置關係組合查找，多個條件必須同時滿足。',
    selectorText: '按顯示文字查找（支援正則表達式）\n\n如 `"登入"` `"^確定$"` `"價格：\\\\d+"`',
    selectorId: '按控件 ID 查找（不用寫套件名前綴）\n\n如 `"btn_login"`',
    selectorEnabled: '只選可點擊（或不可點擊）的元素\n\n`true` = 可點擊，`false` = 不可點擊',
    selectorSelected: '只選處於選中狀態的元素\n\n`true` = 已選中，`false` = 未選中',
    selectorChecked: '只選勾選狀態的元素（核取方塊 / 開關）\n\n`true` = 已勾選，`false` = 未勾選',
    selectorFocused: '只選目前有焦點的元素（如正在輸入的文字方塊）\n\n`true` = 有焦點',
    selectorWidth: '按寬度查找\n\n單位像素 px',
    selectorHeight: '按高度查找\n\n單位像素 px',
    selectorTolerance: '寬高允許的誤差範圍（±像素）\n\n預設 `0`（嚴格相等）',
    selectorIndex:
      '匹配到多個時，選第幾個\n\n從 0 開始：`0` 第一個，`1` 第二個；負數從後數：`-1` 最後一個',
    selectorOptional: '找不到就跳過，不報錯\n\n`boolean` 預設 `false`',
    selectorBelow: '目標元素必須在此元素的「下方」',
    selectorAbove: '目標元素必須在此元素的「上方」',
    selectorLeftOf: '目標元素必須在此元素的「左邊」',
    selectorRightOf: '目標元素必須在此元素的「右邊」',
    selectorChildOf: '目標元素必須在此元素「裡面」（巢狀在內）',
    selectorContainsChild: '目標元素「內部直接包含」此子元素',
    selectorContainsDescendants: '目標元素「內部」同時包含所有列出的後代元素',
    selectorTraits:
      '按無障礙（accessibility）屬性查找，多個用空格隔開\n\n如 `"clickable enabled"` = 可點擊且啟用中',

    // ── 條件 ──
    conditionTitle: '條件判斷',
    conditionDesc:
      '寫一個判斷條件，用在 `when`（滿足才執行）、`repeat.while`（迴圈條件）、`extendedWaitUntil`（等待條件）等場景',
    conditionVisible: '某個元素在螢幕上「可見」時，條件成立',
    conditionNotVisible: '某個元素在螢幕上「不可見」時，條件成立',
    conditionTrue: '寫一段 JS 表達式，結果為 `true` 時條件成立\n\n如 `"$\\{counter < 10\\}"`',
    conditionLabel: '給這個條件取個名字，方便在日誌裡辨認',

    // ── tap 系列 ──
    tapText: '按顯示文字查找（支援正則）',
    tapId: '按控件 ID 查找（不用寫套件名前綴）',
    tapIndex: '匹配到多個時選第幾個\n\n從 0 開始；`-1` 表示最後一個',
    tapEnabled: '只選可點擊（或不可點擊）的',
    tapSelected: '只選已選中的',
    tapChecked: '只選已勾選的（核取方塊 / 開關）',
    tapFocused: '只選目前有焦點的（如正在輸入的框）',
    tapWidth: '按寬度查找\n\n單位像素 px',
    tapHeight: '按高度查找\n\n單位像素 px',
    tapTolerance: '寬高允許的誤差範圍（±像素）\n\n預設 `0`',
    tapBelow: '目標元素必須在此元素的「下方」',
    tapAbove: '目標元素必須在此元素的「上方」',
    tapLeftOf: '目標元素必須在此元素的「左邊」',
    tapRightOf: '目標元素必須在此元素的「右邊」',
    tapChildOf: '目標元素必須在此元素「裡面」',
    tapContainsChild: '目標元素「內部直接包含」此子元素',
    tapContainsDescendants: '目標元素「內部」同時包含列出的所有後代元素',
    tapTraits: '按無障礙屬性查找，多個用空格隔開\n\n如 `"clickable enabled"`',
    tapPoint:
      '直接按螢幕座標點擊\n\n絕對座標 `"x,y"` 如 `"360,800"`；百分比座標 `"50%,80%"` 不依賴解析度',
    tapOptional: '找不到元素就跳過，不報錯\n\n預設 `false`',
    tapWaitUntilVisible: '等元素出現後再點',
    tapWaitToSettleTimeoutMs:
      '點完後等介面不再變化多久才繼續\n\n單位 ms，預設 `1500`，最大 `30000`（超過會被截斷）',
    tapRetryTapIfNoChange: '點完後介面沒變化時，自動再點一次\n\n預設 `false`（不重試）',
    tapRepeat: '連續點幾次\n\n搭配 `delay` 一起用',
    tapDelay: '連續點擊之間的間隔\n\n單位 ms 預設 `100`',
    tapLabel: '給這一步取個名字，方便在日誌裡辨認',

    // ── appId 物件 ──
    appIdDesc: '應用套件名，省略時自動用設定區中的 `appId`',

    // ── 建構器輔助 ──
    helperBoolTrigger: '直接寫 `true` 即可觸發（不傳參數）',
    helperStringParam: '傳一個字串參數',
    helperAppIdHint: '應用套件名（如 `com.example.app`）',
    helperFixedMs: '固定毫秒數',
    helperRandomRange: '寫成 `[最小值, 最大值]` 會在範圍內隨機取值（單位 ms）',

    // ── 命令列舉頭 ──
    cmdTitle: '腳本命令',
    cmdDesc: '可以直接寫命令名（不帶參數），也可以寫命令名 + 參數（冒號後面跟內容）',

    // ── 無參命令列舉描述 ──
    enumLaunchApp: '🚀 啟動設定中指定的應用',
    enumStopApp: '⏹️ 停止設定中指定的應用',
    enumKillApp: '🔴 強制結束設定中指定的應用',
    enumClearState: '🗑️ 清除應用的資料和快取',
    enumClearKeychain: '🔑 清除應用的帳號密碼快取',
    enumScroll: '📜 向下捲動一次',
    enumBack: '⬅️ 按下返回鍵',
    enumHideKeyboard: '⌨️ 收起虛擬鍵盤',
    enumHideKeyboardAlias: '⌨️ 收起虛擬鍵盤（帶空格的別名寫法）',
    enumPasteText: '📋 貼上剪貼簿內容',
    enumEraseText: '⌫ 刪除輸入框文字（預設 50 字元）',
    enumInputRandomText: '🎲 輸入 8 位隨機字母',
    enumInputRandomNumber: '🎲 輸入隨機數字',
    enumInputRandomEmail: '📧 輸入隨機信箱',
    enumInputRandomPersonName: '👤 輸入隨機姓名',
    enumWaitForAnimationToEnd: '⏱️ 等待動畫結束（預設 `15000` ms）',

    // ── launchApp ──
    launchAppDesc: '🚀 啟動應用\n\n可直接傳套件名，或寫詳細設定物件',
    launchAppAppIdHint: '應用套件名，如 `com.example.app`',
    launchAppClearState: '啟動前把應用的資料清空（相當於重裝一次）\n\n預設 `false`',
    launchAppStopApp: '如果 App 已經在執行，先停掉再啟動\n\n預設 `true`',
    launchAppClearKeychain: '清除應用儲存的帳號密碼',
    launchAppPermissions:
      '啟動時自動預設權限：`權限名: allow 或 deny`\n\n如 `camera: allow` `location: deny`',
    launchAppArguments:
      '啟動時傳給應用的額外參數（Android 叫 Intent extras）\n\n鍵值都是字串，如 `from: push`',

    // ── stopApp / killApp / clearState ──
    stopAppDesc: '⏹️ 停止應用',
    killAppDesc: '🔴 強制停止應用',
    clearStateDesc: '🗑️ 清除應用資料',

    // ── tap 系列命令 ──
    tapOnDesc: '👆 點擊元素\n\n可按文字、ID 或螢幕座標點擊',
    tapOnHint: '要點擊的按鈕 / 文字內容（支援正則）',
    longPressOnDesc: '👆 長按元素\n\n用法與 `tapOn` 完全一致',
    longPressOnHint: '要長按的按鈕 / 文字內容（支援正則）',
    doubleTapOnDesc: '👆 雙擊元素\n\n用法與 `tapOn` 完全一致',
    doubleTapOnHint: '要雙擊的按鈕 / 文字內容（支援正則）',

    // ── swipe ──
    swipeDesc: '👉 滑動螢幕\n\n按方向滑，或從起點到終點座標滑',
    swipeEnumUp: '⬆️ 上滑',
    swipeEnumDown: '⬇️ 下滑',
    swipeEnumLeft: '⬅️ 左滑',
    swipeEnumRight: '➡️ 右滑',
    swipeDirection: '滑動方向',
    swipeDuration: '一次滑動耗時 ms 預設 `400`',
    swipeStart: '起點座標，格式 `"x,y"` 或百分比 `"50%,80%"`',
    swipeEnd: '終點座標，格式同 start',
    swipeFrom: '從這個元素所在的位置開始滑',
    swipeWaitToSettleTimeoutMs: '滑動後等介面不再變化多久才繼續\n\n單位 ms，預設 `1500`',

    // ── scroll ──
    scrollDesc: '📜 向下捲動一次',

    // ── scrollUntilVisible ──
    scrollUntilVisibleDesc: '📜 一直捲動到目標元素出現為止',
    scrollUntilVisibleElement: '要找的目標元素（必填）',
    scrollUntilVisibleDirection: '往哪個方向捲\n\n預設 `DOWN`（往下）',
    scrollUntilVisibleTimeout: '最多捲多久\n\n單位 ms 預設 `20000`，逾時就算失敗',
    scrollUntilVisibleSpeed: '捲動速度（`0` 最慢，`100` 最快）\n\n預設 `40`',
    scrollUntilVisibleVisibilityPct:
      '元素要露出多少百分比才算「看到了」\n\n`0`~`100`，預設 `100`（完全可見）',
    scrollUntilVisibleCenterElement: '找到後再繼續捲，把元素移到螢幕正中間\n\n預設 `false`',
    scrollUntilVisibleWaitToSettle: '每次捲完等介面不再變化多久才繼續\n\n單位 ms，預設 `1500`',
    scrollUntilVisibleFrom: '在指定容器內捲動（不在全螢幕範圍內捲）\n\n如 `id: "list_container"`',

    // ── inputText ──
    inputTextDesc: '⌨️ 在目前輸入框輸入內容\n\n可直接寫文字或數字，支援變數 `"$\\{USERNAME\\}"`',

    // ── eraseText ──
    eraseTextDesc: '⌫ 刪除文字\n\n刪除輸入框中的字元',
    eraseTextIntHint: '刪除字元數（預設 `50`）',
    eraseTextPropHint: '刪除字元數',

    // ── inputRandomText ──
    inputRandomTextDesc: '🎲 輸入隨機文字',
    inputRandomTextIntHint: '隨機文字長度（預設 `8`）',
    inputRandomTextPropHint: '文字長度',

    // ── inputRandomNumber ──
    inputRandomNumberDesc: '🎲 輸入隨機數字',
    inputRandomNumberIntHint: '隨機數字位數',
    inputRandomNumberPropHint: '數字位數',

    // ── inputRandomEmail / inputRandomPersonName ──
    inputRandomEmailDesc: '📧 輸入隨機信箱地址',
    inputRandomPersonNameDesc: '👤 輸入隨機姓名',

    // ── pressKey ──
    pressKeyDesc: '🔘 按鍵\n\n模擬按一下裝置上的按鍵，名稱大小寫隨意',
    pressKeyStringHint: [
      '按鍵名（不區分大小寫；多個單詞的鍵用空格分開，例如 `Volume Up`）',
      '',
      '**常用**：`Home` · `Back` · `Enter` · `Tab` · `Delete` · `Backspace` · `Space` · `Escape` · `Menu` · `Search` · `Power` · `Camera` · `Clear` · `Lock`',
      '**音量 / 翻頁**：`Volume Up` · `Volume Down` · `Page Up` · `Page Down`',
      '**方向鍵**：`DPad Up` · `DPad Down` · `DPad Left` · `DPad Right` · `DPad Center`',
      '**字母/數字**：`A`~`Z` · `0`~`9`',
      '**符號**：`Comma` · `Period` · `Grave` · `Minus` · `Equals` · `Semicolon` · `Apostrophe` · `Slash` · `Backslash` · `Left Bracket` · `Right Bracket` · `At` · `Plus` · `Star` · `Pound`',
      '**數字鍵盤**：`Numpad 0`~`Numpad 9`',
      '**其他**：`Call` · `EndCall` · `Forward Delete`'
    ].join('\n'),
    pressKeyIntHint: '也可以直接寫 Android 按鍵代碼數字\n\n`integer`',

    // ── hideKeyboard / back ──
    hideKeyboardDesc: '⌨️ 收起虛擬鍵盤',
    backDesc: '⬅️ 按下返回鍵',

    // ── assertions ──
    assertVisibleDesc: '✅ 檢查元素必須可見\n\n預設等待 `17000` ms（17 秒），逾時則報錯、流程終止',
    assertVisibleHint: '希望看到的文字（支援正則）',
    assertNotVisibleDesc: '❌ 檢查元素必須不可見\n\n如果一直能看到就報錯（最多等 `7000` ms）',
    assertNotVisibleHint: '不應該出現的文字（支援正則）',
    assertTrueDesc:
      '🧪 檢查條件必須成立\n\n寫一個 JS 表達式，例如 `"$\\{counter > 0\\}"`，結果必須是 true',

    // ── sleep ──
    sleepDesc: '⏱️ 暫停一段時間\n\n可以寫固定 ms、`[最小, 最大]` 隨機區間，或物件形式',
    sleepFixedMs: '固定等待（毫秒）',
    sleepRandomRange: '寫成 `[最小值, 最大值]` 會在範圍內隨機等待（單位 ms）',
    sleepDuration: '固定時長（ms）',
    sleepMin: '隨機等待的最小值（ms）',
    sleepMax: '隨機等待的最大值（ms）',

    // ── waitForAnimationToEnd ──
    waitAnimDesc: '⏱️ 等目前動畫播完、介面不再變化\n\n單位 ms 預設最多等 `15000`',
    waitAnimDefault: '使用預設逾時 `15000` ms',
    waitAnimCustom: '自訂逾時（ms）',
    waitAnimTimeout: '逾時\n\n單位 ms 預設 `15000`',

    // ── extendedWaitUntil ──
    extWaitDesc: '⏱️ 持續等待某個條件滿足\n\n等到元素出現 / 消失為止，或等到逾時為止',
    extWaitVisible: '一直等到這個元素「出現」',
    extWaitNotVisible: '一直等到這個元素「消失」',
    extWaitTimeout: '最多等多久\n\n單位 ms 預設 `17000`，逾時就算失敗',

    // ── repeat ──
    repeatDesc:
      '🔄 迴圈執行一批命令\n\n三種停止模式可組合：指定次數 `times` / 指定總時長 `duration` / 指定條件 `while`\n\n限制：單次最多 `1000` 次迴圈，不設 `duration` 時預設最長 `30` 分鐘',
    repeatTimes: '重複幾次\n\n如 `3`，表示這批命令執行 3 次',
    repeatDuration: '總共跑多久\n\n單位 ms；也可寫成 `[min, max]` 在範圍內隨機',
    repeatDurationRandom: '寫成 `[最小值, 最大值]` 會在範圍內隨機選一個時長（單位 ms）',
    repeatWhile: '迴圈條件：一直跑，直到條件不成立才停',
    repeatCommands: '要反覆執行的命令列表（必填）',

    // ── retry ──
    retryDesc: '🔁 失敗自動重試\n\n命令執行失敗時，自動再試幾次',
    retryMaxRetries: '失敗後最多再重試幾次（不算第一次），預設 `1`，最大 `3`',
    retryCommands: '要嘗試執行的命令列表（必填）',

    // ── runFlow ──
    runFlowDesc: '📂 執行一個子流程\n\n可以直接寫檔案路徑，也可以在 YAML 裡直接寫要執行的命令',
    runFlowStringHint: '另一個 YAML 子流程的檔案路徑',
    runFlowCommands: '子流程的命令列表（與 `file` 二擇一）',
    runFlowFile: '子流程的檔案路徑（與 `commands` 二擇一）',
    runFlowEnv: '子流程專用的變數（會覆蓋或新增到父流程變數上）\n\n如 `USER: zhangsan`',

    // ── branch ──
    branchDesc:
      '🔀 條件分支（if / else if / else）\n\n從上到下找第一個條件成立的分支執行；沒有 `when` 的那個就是兜底分支',
    branchWhen: '進入這個分支的條件；省略 `when` 的分支作為兜底（相當於 `else`）',
    branchCommands: '這個分支要執行的命令（必填）',

    // ── defineVariables / evalScript / runScript ──
    defineVariablesDesc:
      '📝 定義幾個變數，後面用 `$\\{變數名\\}` 就能引用\n\n如 `USERNAME: zhangsan`，之後在命令裡可以寫 `$\\{USERNAME\\}`\n\n⚠️ 除 `when`/`chance` 外，所有其它鍵都會被當作變數名',
    evalScriptDesc:
      '📜 執行一段 JS 表達式（常用於更新變數）\n\n如 `"$\\{counter = counter + 1\\}"`',
    runScriptDesc: '📜 執行一段 JS 腳本\n\n可以直接寫程式碼、寫物件設定、或引用外部檔案',
    runScriptStringHint: '直接寫一段 JS 程式碼',
    runScriptScript: 'JS 程式碼（和 `file` 二擇一）',
    runScriptFile: '外部 JS 檔案路徑（和 `script` 二擇一）',
    runScriptEnv: '腳本執行時能讀到的變數',

    // ── clipboard ──
    copyTextFromDesc: '📋 從指定元素把文字複製到剪貼簿',
    copyTextFromHint: '要複製文字的目標元素',
    pasteTextCmdDesc: '📋 貼上剪貼簿裡的內容到目前輸入框',
    setClipboardDesc: '📋 設定剪貼簿內容\n\n支援 `$\\{變數名\\}` 替換',

    // ── device ──
    setLocationDesc: '📍 模擬 GPS 定位到指定位置',
    setLocationLatitude: '緯度（南北方向座標），範圍 `-90.0` ~ `90.0`',
    setLocationLongitude: '經度（東西方向座標），範圍 `-180.0` ~ `180.0`',
    openLinkDesc: '🔗 開啟連結\n\n網頁地址或 app 內的跳轉連結',
    openLinkStringHint: '網頁 URL 或應用深度連結（如 `myapp://home`）',
    openLinkLink: '網頁 URL 或應用深度連結（如 `myapp://home`）',
    openLinkAutoVerify: '讓系統自動核對這個連結（Android App Links 的機制）',
    openLinkBrowser: '強制用瀏覽器開啟，不走應用內跳轉',
    takeScreenshotDesc: '📷 截圖並儲存到指定路徑',
    setPermissionsDesc: '🔐 批次設定應用的權限',
    setPermissionsPermissions:
      '權限名：`allow`（授予）/ `deny`（拒絕）\n\n如 `camera: allow` `location: deny`',
    shellDesc: '📜 執行 JS 表達式（`evalScript` 的簡寫，不是作業系統命令列）',
    shellHint: 'JS 表達式，如 `"counter = counter + 1"`',
    setAirplaneModeDesc: '✈️ 開啟 / 關閉飛航模式',
    setAirplaneModeBool: '`true` 開飛航模式，`false` 關飛航模式',
    setAirplaneModeEnabled: '開或關\n\n預設 `true`（開啟）',

    // ── httpRequest ──
    httpDesc: '🌐 發一個 HTTP 請求\n\n可以把回傳結果存進變數，後續命令用',
    httpUrl: '請求的 URL（必填），支援 `$\\{變數名\\}` 替換',
    httpMethod: '請求方法，預設 `GET`',
    httpEnumGet: '📥 GET（取得資料）',
    httpEnumPost: '📤 POST（提交資料）',
    httpHeaders: '請求標頭，鍵值都是字串\n\n如 `Authorization: Bearer xxx`',
    httpBody: 'POST 請求的 body，寫一個 JSON 結構（可巢狀）',
    httpOutputVariable: '把回傳結果存到這個變數名裡，後面用 `$\\{變數名\\}` 引用',
    httpJsonPath:
      '只取回傳 JSON 裡的某個欄位（用點分隔）\n\n如 `"data.code"` 取 `data` 下的 `code`',
    httpRetry: '失敗時自動重試的設定',
    httpRetryTimes: '最大重試次數，預設 `1`（即失敗後最多再請求 1 次）',
    httpRetryInterval: '兩次請求之間隔多久\n\n單位 ms 預設 `3000`',

    // ── 設定區 ──
    configTitle: '腳本設定',
    configDesc: '設定區域：寫在第一段，用 `---` 跟下面的命令分開',
    configAppId: '📱 要自動化的應用套件名（必填），如 `com.example.app`',
    configName: '📛 這個流程的名字（方便辨認）',
    configUrl: '🔗 要自動化的網頁地址（做 Web 自動化時才用）',
    configTags: '🏷️ 給流程打標籤，一個字串陣列（方便分類、篩選）',
    configEnv:
      '🔧 定義整個流程可用的變數\n\n如 `USERNAME: zhangsan`，命令裡用 `$\\{USERNAME\\}` 引用',
    configOnFlowStart: '▶️ 流程開始前要先執行的命令（準備工作）',
    configOnFlowComplete: '⏏️ 流程結束後要執行的命令（無論成功失敗都會跑，常用於清理）',
    configExceptionHandlers: '🛡️ 兜底彈窗處理\n\n命令執行遇到意外彈窗時，自動點掉對應按鈕然後繼續',
    configExceptionText: '彈窗裡要點擊的按鈕文字（直接寫文字）',
    configExceptionTextProp: '彈窗裡要點擊的按鈕文字（支援正則）',
    configExceptionId: '彈窗裡要點擊的按鈕 ID',
    configExceptionMaxTrigger: '最多處理多少次，防止同一個彈窗反覆彈出導致卡死',
    configExceptionBelow: '限定按鈕在某個元素下方（用於消歧義）',
    configProperties: '📦 自訂備註資訊，只做記錄用，不會影響流程執行',

    // ── 命令列表 ──
    commandListTitle: '命令列表',
    commandListDesc: '命令區域：寫在 `---` 之後，每條命令前面加 `- `（短橫杠 + 空格）'
  }
}
