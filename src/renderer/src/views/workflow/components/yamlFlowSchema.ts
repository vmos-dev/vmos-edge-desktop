/**
 * yaml-flow-engine JSON Schema (JSON Schema 7)
 * 用于 monaco-yaml：补全、校验、悬停提示
 *
 *
 * hover 描述规范：
 *   - 第一行：emoji + 命令名 + 一句话说明
 *   - 第二行：`类型` | `单位` | `默认值` | `取值范围`（用 inline code）
 *   - 不放大段代码示例（hover 空间有限）
 *
 * 国际化：所有用户可见文案通过 t() 获取，切换语言时由 monacoSetup 重新注册 schema。
 */

import { t } from '@renderer/locales'

/**
 * 创建国际化的 YAML Flow Schema。
 * 每次调用都用当前 locale 的文案生成全新 schema 对象。
 */
export function createYamlFlowSchema() {
  const s = (key: string) => t(`workflow.yamlSchema.${key}`)

  // ── 通用字段（精准对齐引擎语义） ──

  const whenChanceProperties = {
    when: {
      $ref: '#/definitions/condition',
      markdownDescription: s('commonWhen')
    },
    chance: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      markdownDescription: s('commonChance')
    }
  }

  const labelOptionalProperties = {
    label: {
      type: 'string',
      markdownDescription: s('commonLabel')
    },
    optional: {
      type: 'boolean',
      markdownDescription: s('commonOptional')
    }
  }

  const commonCommandProperties = {
    ...labelOptionalProperties,
    ...whenChanceProperties
  }

  // ── 元素选择器 ──

  const elementSelectorSchema = {
    type: 'object' as const,
    title: s('selectorTitle'),
    markdownDescription: s('selectorDesc'),
    properties: {
      text: {
        type: 'string',
        markdownDescription: s('selectorText')
      },
      id: {
        type: 'string',
        markdownDescription: s('selectorId')
      },
      enabled: {
        type: 'boolean',
        markdownDescription: s('selectorEnabled')
      },
      selected: {
        type: 'boolean',
        markdownDescription: s('selectorSelected')
      },
      checked: {
        type: 'boolean',
        markdownDescription: s('selectorChecked')
      },
      focused: {
        type: 'boolean',
        markdownDescription: s('selectorFocused')
      },
      width: { type: 'integer', markdownDescription: s('selectorWidth') },
      height: { type: 'integer', markdownDescription: s('selectorHeight') },
      tolerance: {
        type: 'integer',
        markdownDescription: s('selectorTolerance')
      },
      index: {
        type: 'integer',
        markdownDescription: s('selectorIndex')
      },
      optional: {
        type: 'boolean',
        markdownDescription: s('selectorOptional')
      },
      below: {
        $ref: '#/definitions/elementSelector',
        markdownDescription: s('selectorBelow')
      },
      above: {
        $ref: '#/definitions/elementSelector',
        markdownDescription: s('selectorAbove')
      },
      leftOf: {
        $ref: '#/definitions/elementSelector',
        markdownDescription: s('selectorLeftOf')
      },
      rightOf: {
        $ref: '#/definitions/elementSelector',
        markdownDescription: s('selectorRightOf')
      },
      childOf: {
        $ref: '#/definitions/elementSelector',
        markdownDescription: s('selectorChildOf')
      },
      containsChild: {
        $ref: '#/definitions/elementSelector',
        markdownDescription: s('selectorContainsChild')
      },
      containsDescendants: {
        type: 'array',
        items: { $ref: '#/definitions/elementSelector' },
        markdownDescription: s('selectorContainsDescendants')
      },
      traits: {
        type: 'string',
        markdownDescription: s('selectorTraits')
      }
    }
  }

  // ── 条件 ──

  const conditionSchema = {
    type: 'object' as const,
    title: s('conditionTitle'),
    markdownDescription: s('conditionDesc'),
    properties: {
      visible: {
        $ref: '#/definitions/elementSelector',
        markdownDescription: s('conditionVisible')
      },
      notVisible: {
        $ref: '#/definitions/elementSelector',
        markdownDescription: s('conditionNotVisible')
      },
      true: {
        type: 'string',
        markdownDescription: s('conditionTrue')
      },
      label: { type: 'string', markdownDescription: s('conditionLabel') }
    }
  }

  // ── tap 系列共享属性 ──

  const tapSelectorProperties = {
    text: { type: 'string', markdownDescription: s('tapText') },
    id: { type: 'string', markdownDescription: s('tapId') },
    index: {
      type: 'integer',
      markdownDescription: s('tapIndex')
    },
    enabled: { type: 'boolean', markdownDescription: s('tapEnabled') },
    selected: { type: 'boolean', markdownDescription: s('tapSelected') },
    checked: { type: 'boolean', markdownDescription: s('tapChecked') },
    focused: { type: 'boolean', markdownDescription: s('tapFocused') },
    width: { type: 'integer', markdownDescription: s('tapWidth') },
    height: { type: 'integer', markdownDescription: s('tapHeight') },
    tolerance: { type: 'integer', markdownDescription: s('tapTolerance') },
    below: {
      $ref: '#/definitions/elementSelector',
      markdownDescription: s('tapBelow')
    },
    above: {
      $ref: '#/definitions/elementSelector',
      markdownDescription: s('tapAbove')
    },
    leftOf: {
      $ref: '#/definitions/elementSelector',
      markdownDescription: s('tapLeftOf')
    },
    rightOf: {
      $ref: '#/definitions/elementSelector',
      markdownDescription: s('tapRightOf')
    },
    childOf: {
      $ref: '#/definitions/elementSelector',
      markdownDescription: s('tapChildOf')
    },
    containsChild: {
      $ref: '#/definitions/elementSelector',
      markdownDescription: s('tapContainsChild')
    },
    containsDescendants: {
      type: 'array',
      items: { $ref: '#/definitions/elementSelector' },
      markdownDescription: s('tapContainsDescendants')
    },
    traits: {
      type: 'string',
      markdownDescription: s('tapTraits')
    },
    point: {
      type: 'string',
      markdownDescription: s('tapPoint')
    },
    optional: { type: 'boolean', markdownDescription: s('tapOptional') },
    waitUntilVisible: { type: 'boolean', markdownDescription: s('tapWaitUntilVisible') },
    waitToSettleTimeoutMs: {
      type: 'integer',
      markdownDescription: s('tapWaitToSettleTimeoutMs')
    },
    retryTapIfNoChange: {
      type: 'boolean',
      markdownDescription: s('tapRetryTapIfNoChange')
    },
    repeat: { type: 'integer', markdownDescription: s('tapRepeat') },
    delay: { type: 'integer', markdownDescription: s('tapDelay') },
    label: { type: 'string', markdownDescription: s('tapLabel') },
    when: {
      $ref: '#/definitions/condition',
      markdownDescription: s('commonWhen')
    },
    chance: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      markdownDescription: s('commonChance')
    }
  }

  // ── appId 对象形式 ──

  const appIdObjectSchema = {
    type: 'object' as const,
    properties: {
      appId: { type: 'string', markdownDescription: s('appIdDesc') },
      ...commonCommandProperties
    }
  }

  // ── 命令构造器 ──

  const bareCommand = (markdownDescription: string) => ({
    oneOf: [
      { type: 'boolean' as const, markdownDescription: s('helperBoolTrigger') },
      { type: 'object' as const, properties: { ...commonCommandProperties } }
    ],
    markdownDescription
  })

  const stringCommand = (markdownDescription: string, stringHint?: string) => ({
    oneOf: [
      { type: 'string' as const, markdownDescription: stringHint ?? s('helperStringParam') },
      { type: 'object' as const, properties: { ...commonCommandProperties } }
    ],
    markdownDescription
  })

  const appIdCommand = (markdownDescription: string) => ({
    oneOf: [
      { type: 'string' as const, markdownDescription: s('helperAppIdHint') },
      appIdObjectSchema
    ],
    markdownDescription
  })

  const intOrString = (markdownDescription: string) => ({
    oneOf: [{ type: 'integer' as const }, { type: 'string' as const }],
    markdownDescription
  })

  const msOrRandomRange = (markdownDescription: string) => ({
    oneOf: [
      { type: 'integer' as const, markdownDescription: s('helperFixedMs') },
      {
        type: 'array' as const,
        items: { type: 'integer' },
        minItems: 2,
        maxItems: 2,
        markdownDescription: s('helperRandomRange')
      }
    ],
    markdownDescription
  })

  const tapLikeCommand = (markdownDescription: string, stringHint: string) => ({
    oneOf: [
      { type: 'string' as const, markdownDescription: stringHint },
      { type: 'object' as const, properties: tapSelectorProperties }
    ],
    markdownDescription
  })

  const intOrObjectCommand = (
    markdownDescription: string,
    intHint: string,
    propName: string,
    propHint: string,
    allowString = false
  ) => ({
    oneOf: [
      { type: 'integer' as const, markdownDescription: intHint },
      ...(allowString ? [{ type: 'string' as const }] : []),
      {
        type: 'object' as const,
        properties: {
          [propName]: { type: 'integer' as const, markdownDescription: propHint },
          ...commonCommandProperties
        }
      }
    ],
    markdownDescription
  })

  const selectorCommand = (markdownDescription: string, stringHint: string) => ({
    oneOf: [
      { type: 'string' as const, markdownDescription: stringHint },
      {
        type: 'object' as const,
        properties: { ...elementSelectorSchema.properties, ...commonCommandProperties }
      }
    ],
    markdownDescription
  })

  // ── 命令定义 ──

  const commandSchema = {
    title: s('cmdTitle'),
    markdownDescription: s('cmdDesc'),
    oneOf: [
      {
        type: 'string' as const,
        enum: [
          'launchApp',
          'stopApp',
          'killApp',
          'clearState',
          'clearKeychain',
          'scroll',
          'back',
          'hideKeyboard',
          'hide keyboard',
          'pasteText',
          'eraseText',
          'inputRandomText',
          'inputRandomNumber',
          'inputRandomEmail',
          'inputRandomPersonName',
          'waitForAnimationToEnd'
        ],
        markdownEnumDescriptions: [
          s('enumLaunchApp'),
          s('enumStopApp'),
          s('enumKillApp'),
          s('enumClearState'),
          s('enumClearKeychain'),
          s('enumScroll'),
          s('enumBack'),
          s('enumHideKeyboard'),
          s('enumHideKeyboardAlias'),
          s('enumPasteText'),
          s('enumEraseText'),
          s('enumInputRandomText'),
          s('enumInputRandomNumber'),
          s('enumInputRandomEmail'),
          s('enumInputRandomPersonName'),
          s('enumWaitForAnimationToEnd')
        ]
      },
      {
        type: 'object' as const,
        properties: {
          // ═══ App Lifecycle ═══

          launchApp: {
            oneOf: [
              { type: 'string', markdownDescription: s('launchAppAppIdHint') },
              {
                type: 'object',
                properties: {
                  appId: { type: 'string', markdownDescription: s('launchAppAppIdHint') },
                  clearState: {
                    type: 'boolean',
                    markdownDescription: s('launchAppClearState')
                  },
                  stopApp: {
                    type: 'boolean',
                    markdownDescription: s('launchAppStopApp')
                  },
                  clearKeychain: {
                    type: 'boolean',
                    markdownDescription: s('launchAppClearKeychain')
                  },
                  permissions: {
                    type: 'object',
                    markdownDescription: s('launchAppPermissions'),
                    additionalProperties: { type: 'string', enum: ['allow', 'deny'] }
                  },
                  arguments: {
                    type: 'object',
                    markdownDescription: s('launchAppArguments'),
                    additionalProperties: { type: 'string' }
                  },
                  ...commonCommandProperties
                }
              }
            ],
            markdownDescription: s('launchAppDesc')
          },
          stopApp: appIdCommand(s('stopAppDesc')),
          killApp: appIdCommand(s('killAppDesc')),
          clearState: appIdCommand(s('clearStateDesc')),

          // ═══ Tap & Click ═══

          tapOn: tapLikeCommand(s('tapOnDesc'), s('tapOnHint')),
          longPressOn: tapLikeCommand(s('longPressOnDesc'), s('longPressOnHint')),
          doubleTapOn: tapLikeCommand(s('doubleTapOnDesc'), s('doubleTapOnHint')),

          // ═══ Swipe & Scroll ═══

          swipe: {
            oneOf: [
              {
                type: 'string',
                enum: ['UP', 'DOWN', 'LEFT', 'RIGHT'],
                markdownEnumDescriptions: [
                  s('swipeEnumUp'),
                  s('swipeEnumDown'),
                  s('swipeEnumLeft'),
                  s('swipeEnumRight')
                ]
              },
              {
                type: 'object',
                properties: {
                  direction: {
                    type: 'string',
                    enum: ['UP', 'DOWN', 'LEFT', 'RIGHT'],
                    markdownEnumDescriptions: [
                      s('swipeEnumUp'),
                      s('swipeEnumDown'),
                      s('swipeEnumLeft'),
                      s('swipeEnumRight')
                    ],
                    markdownDescription: s('swipeDirection')
                  },
                  duration: msOrRandomRange(s('swipeDuration')),
                  start: {
                    type: 'string',
                    markdownDescription: s('swipeStart')
                  },
                  end: { type: 'string', markdownDescription: s('swipeEnd') },
                  from: {
                    $ref: '#/definitions/elementSelector',
                    markdownDescription: s('swipeFrom')
                  },
                  waitToSettleTimeoutMs: {
                    type: 'integer',
                    markdownDescription: s('swipeWaitToSettleTimeoutMs')
                  },
                  ...commonCommandProperties
                }
              }
            ],
            markdownDescription: s('swipeDesc')
          },
          scroll: {
            type: 'object',
            properties: { ...commonCommandProperties },
            markdownDescription: s('scrollDesc')
          },
          scrollUntilVisible: {
            type: 'object',
            properties: {
              element: {
                $ref: '#/definitions/elementSelector',
                markdownDescription: s('scrollUntilVisibleElement')
              },
              direction: {
                type: 'string',
                enum: ['DOWN', 'UP', 'LEFT', 'RIGHT'],
                default: 'DOWN',
                markdownDescription: s('scrollUntilVisibleDirection')
              },
              timeout: intOrString(s('scrollUntilVisibleTimeout')),
              speed: {
                type: 'integer',
                markdownDescription: s('scrollUntilVisibleSpeed')
              },
              visibilityPercentage: {
                type: 'integer',
                markdownDescription: s('scrollUntilVisibleVisibilityPct')
              },
              centerElement: {
                type: 'boolean',
                markdownDescription: s('scrollUntilVisibleCenterElement')
              },
              waitToSettleTimeoutMs: {
                type: 'integer',
                markdownDescription: s('scrollUntilVisibleWaitToSettle')
              },
              from: {
                $ref: '#/definitions/elementSelector',
                markdownDescription: s('scrollUntilVisibleFrom')
              },
              ...commonCommandProperties
            },
            required: ['element'],
            markdownDescription: s('scrollUntilVisibleDesc')
          },

          // ═══ Text Input ═══

          inputText: {
            oneOf: [{ type: 'string' }, { type: 'number' }],
            markdownDescription: s('inputTextDesc')
          },
          eraseText: intOrObjectCommand(
            s('eraseTextDesc'),
            s('eraseTextIntHint'),
            'charactersToErase',
            s('eraseTextPropHint'),
            true
          ),
          inputRandomText: intOrObjectCommand(
            s('inputRandomTextDesc'),
            s('inputRandomTextIntHint'),
            'length',
            s('inputRandomTextPropHint')
          ),
          inputRandomNumber: intOrObjectCommand(
            s('inputRandomNumberDesc'),
            s('inputRandomNumberIntHint'),
            'length',
            s('inputRandomNumberPropHint')
          ),
          inputRandomEmail: bareCommand(s('inputRandomEmailDesc')),
          inputRandomPersonName: bareCommand(s('inputRandomPersonNameDesc')),

          // ═══ Key & Keyboard ═══

          pressKey: {
            oneOf: [
              {
                type: 'string',
                markdownDescription: s('pressKeyStringHint')
              },
              {
                type: 'integer',
                markdownDescription: s('pressKeyIntHint')
              }
            ],
            markdownDescription: s('pressKeyDesc')
          },
          hideKeyboard: bareCommand(s('hideKeyboardDesc')),
          back: bareCommand(s('backDesc')),

          // ═══ Assertions ═══

          assertVisible: selectorCommand(s('assertVisibleDesc'), s('assertVisibleHint')),
          assertNotVisible: selectorCommand(s('assertNotVisibleDesc'), s('assertNotVisibleHint')),
          assertTrue: {
            type: 'string',
            markdownDescription: s('assertTrueDesc')
          },

          // ═══ Wait ═══

          sleep: {
            oneOf: [
              { type: 'integer', markdownDescription: s('sleepFixedMs') },
              {
                type: 'array',
                items: { type: 'integer' },
                minItems: 2,
                maxItems: 2,
                markdownDescription: s('sleepRandomRange')
              },
              {
                type: 'object',
                properties: {
                  duration: { type: 'integer', markdownDescription: s('sleepDuration') },
                  min: { type: 'integer', markdownDescription: s('sleepMin') },
                  max: { type: 'integer', markdownDescription: s('sleepMax') },
                  ...commonCommandProperties
                }
              }
            ],
            markdownDescription: s('sleepDesc')
          },
          waitForAnimationToEnd: {
            oneOf: [
              { type: 'boolean', markdownDescription: s('waitAnimDefault') },
              { type: 'integer', markdownDescription: s('waitAnimCustom') },
              {
                type: 'object',
                properties: {
                  timeout: { type: 'integer', markdownDescription: s('waitAnimTimeout') },
                  ...commonCommandProperties
                }
              }
            ],
            markdownDescription: s('waitAnimDesc')
          },
          extendedWaitUntil: {
            type: 'object',
            properties: {
              visible: {
                $ref: '#/definitions/elementSelector',
                markdownDescription: s('extWaitVisible')
              },
              notVisible: {
                $ref: '#/definitions/elementSelector',
                markdownDescription: s('extWaitNotVisible')
              },
              timeout: intOrString(s('extWaitTimeout')),
              ...commonCommandProperties
            },
            markdownDescription: s('extWaitDesc')
          },

          // ═══ Flow Control ═══

          repeat: {
            type: 'object',
            properties: {
              times: intOrString(s('repeatTimes')),
              duration: {
                oneOf: [
                  { type: 'integer' },
                  { type: 'string' },
                  {
                    type: 'array',
                    items: { type: 'integer' },
                    minItems: 2,
                    maxItems: 2,
                    markdownDescription: s('repeatDurationRandom')
                  }
                ],
                markdownDescription: s('repeatDuration')
              },
              while: {
                $ref: '#/definitions/condition',
                markdownDescription: s('repeatWhile')
              },
              commands: {
                type: 'array',
                items: { $ref: '#/definitions/command' },
                markdownDescription: s('repeatCommands')
              },
              ...commonCommandProperties
            },
            required: ['commands'],
            markdownDescription: s('repeatDesc')
          },
          retry: {
            type: 'object',
            properties: {
              maxRetries: intOrString(s('retryMaxRetries')),
              commands: {
                type: 'array',
                items: { $ref: '#/definitions/command' },
                markdownDescription: s('retryCommands')
              },
              ...commonCommandProperties
            },
            required: ['commands'],
            markdownDescription: s('retryDesc')
          },
          runFlow: {
            oneOf: [
              { type: 'string', markdownDescription: s('runFlowStringHint') },
              {
                type: 'object',
                properties: {
                  commands: {
                    type: 'array',
                    items: { $ref: '#/definitions/command' },
                    markdownDescription: s('runFlowCommands')
                  },
                  file: {
                    type: 'string',
                    markdownDescription: s('runFlowFile')
                  },
                  env: {
                    type: 'object',
                    additionalProperties: { type: 'string' },
                    markdownDescription: s('runFlowEnv')
                  },
                  ...commonCommandProperties
                }
              }
            ],
            markdownDescription: s('runFlowDesc')
          },
          branch: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                when: {
                  $ref: '#/definitions/condition',
                  markdownDescription: s('branchWhen')
                },
                commands: {
                  type: 'array',
                  items: { $ref: '#/definitions/command' },
                  markdownDescription: s('branchCommands')
                }
              },
              required: ['commands']
            },
            markdownDescription: s('branchDesc')
          },

          // ═══ Variables & Script ═══

          defineVariables: {
            type: 'object',
            properties: { ...whenChanceProperties },
            additionalProperties: { type: 'string' },
            markdownDescription: s('defineVariablesDesc')
          },
          evalScript: {
            type: 'string',
            markdownDescription: s('evalScriptDesc')
          },
          runScript: {
            oneOf: [
              { type: 'string', markdownDescription: s('runScriptStringHint') },
              {
                type: 'object',
                properties: {
                  script: { type: 'string', markdownDescription: s('runScriptScript') },
                  file: {
                    type: 'string',
                    markdownDescription: s('runScriptFile')
                  },
                  env: {
                    type: 'object',
                    additionalProperties: { type: 'string' },
                    markdownDescription: s('runScriptEnv')
                  },
                  ...commonCommandProperties
                }
              }
            ],
            markdownDescription: s('runScriptDesc')
          },

          // ═══ Clipboard ═══

          copyTextFrom: selectorCommand(s('copyTextFromDesc'), s('copyTextFromHint')),
          pasteText: bareCommand(s('pasteTextCmdDesc')),
          setClipboard: {
            type: 'string',
            markdownDescription: s('setClipboardDesc')
          },

          // ═══ Device ═══

          setLocation: {
            type: 'object',
            properties: {
              latitude: {
                type: 'string',
                markdownDescription: s('setLocationLatitude')
              },
              longitude: {
                type: 'string',
                markdownDescription: s('setLocationLongitude')
              },
              ...commonCommandProperties
            },
            required: ['latitude', 'longitude'],
            markdownDescription: s('setLocationDesc')
          },
          openLink: {
            oneOf: [
              { type: 'string', markdownDescription: s('openLinkStringHint') },
              {
                type: 'object',
                properties: {
                  link: {
                    type: 'string',
                    markdownDescription: s('openLinkLink')
                  },
                  autoVerify: {
                    type: 'boolean',
                    markdownDescription: s('openLinkAutoVerify')
                  },
                  browser: {
                    type: 'boolean',
                    markdownDescription: s('openLinkBrowser')
                  },
                  ...commonCommandProperties
                }
              }
            ],
            markdownDescription: s('openLinkDesc')
          },
          takeScreenshot: { type: 'string', markdownDescription: s('takeScreenshotDesc') },
          setPermissions: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                markdownDescription: s('appIdDesc')
              },
              permissions: {
                type: 'object',
                additionalProperties: { type: 'string', enum: ['allow', 'deny'] },
                markdownDescription: s('setPermissionsPermissions')
              },
              ...commonCommandProperties
            },
            markdownDescription: s('setPermissionsDesc')
          },
          shell: stringCommand(s('shellDesc'), s('shellHint')),
          setAirplaneMode: {
            oneOf: [
              { type: 'boolean', markdownDescription: s('setAirplaneModeBool') },
              {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean', markdownDescription: s('setAirplaneModeEnabled') },
                  ...commonCommandProperties
                }
              }
            ],
            markdownDescription: s('setAirplaneModeDesc')
          },

          // ═══ HTTP ═══

          httpRequest: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                markdownDescription: s('httpUrl')
              },
              method: {
                type: 'string',
                enum: ['GET', 'POST'],
                markdownDescription: s('httpMethod'),
                markdownEnumDescriptions: [s('httpEnumGet'), s('httpEnumPost')]
              },
              headers: {
                type: 'object',
                additionalProperties: { type: 'string' },
                markdownDescription: s('httpHeaders')
              },
              body: {
                type: 'object',
                markdownDescription: s('httpBody')
              },
              outputVariable: {
                type: 'string',
                markdownDescription: s('httpOutputVariable')
              },
              jsonPath: {
                type: 'string',
                markdownDescription: s('httpJsonPath')
              },
              retry: {
                type: 'object',
                properties: {
                  times: {
                    type: 'integer',
                    markdownDescription: s('httpRetryTimes')
                  },
                  interval: msOrRandomRange(s('httpRetryInterval'))
                },
                markdownDescription: s('httpRetry')
              },
              ...commonCommandProperties
            },
            required: ['url'],
            markdownDescription: s('httpDesc')
          }
        }
      }
    ]
  }

  // ── 导出 ──

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    definitions: {
      elementSelector: elementSelectorSchema,
      condition: conditionSchema,
      command: commandSchema
    },
    oneOf: [
      {
        type: 'object' as const,
        title: s('configTitle'),
        markdownDescription: s('configDesc'),
        properties: {
          appId: {
            type: 'string',
            markdownDescription: s('configAppId')
          },
          name: { type: 'string', markdownDescription: s('configName') },
          url: {
            type: 'string',
            markdownDescription: s('configUrl')
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            markdownDescription: s('configTags')
          },
          env: {
            type: 'object',
            additionalProperties: { type: 'string' },
            markdownDescription: s('configEnv')
          },
          onFlowStart: {
            type: 'array',
            items: { $ref: '#/definitions/command' },
            markdownDescription: s('configOnFlowStart')
          },
          onFlowComplete: {
            type: 'array',
            items: { $ref: '#/definitions/command' },
            markdownDescription: s('configOnFlowComplete')
          },
          exceptionHandlers: {
            type: 'array',
            items: {
              oneOf: [
                { type: 'string', markdownDescription: s('configExceptionText') },
                {
                  type: 'object',
                  properties: {
                    text: {
                      type: 'string',
                      markdownDescription: s('configExceptionTextProp')
                    },
                    id: { type: 'string', markdownDescription: s('configExceptionId') },
                    maxTriggerCount: {
                      type: 'integer',
                      markdownDescription: s('configExceptionMaxTrigger')
                    },
                    below: {
                      $ref: '#/definitions/elementSelector',
                      markdownDescription: s('configExceptionBelow')
                    }
                  }
                }
              ]
            },
            markdownDescription: s('configExceptionHandlers')
          },
          properties: {
            type: 'object',
            markdownDescription: s('configProperties')
          }
        }
      },
      {
        type: 'array' as const,
        title: s('commandListTitle'),
        markdownDescription: s('commandListDesc'),
        items: { $ref: '#/definitions/command' }
      }
    ]
  }
}
