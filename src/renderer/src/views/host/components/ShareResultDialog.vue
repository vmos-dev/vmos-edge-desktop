<script setup lang="ts">
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'ShareResultDialog' })

interface FailedItem {
  ip: string
  reason: string
}

type ShareOperation = 'join-share' | 'close-share'

interface ShareResult {
  successCount: number
  failedItems: FailedItem[]
  operation: ShareOperation
}

const { t } = useI18n()
const visible = shallowRef(false)
const result = shallowRef<ShareResult>({
  successCount: 0,
  failedItems: [],
  operation: 'join-share'
})

const init = (data: ShareResult) => {
  result.value = data
  visible.value = true
}

defineExpose({ init })
</script>

<template>
  <vmos-dialog v-model="visible" :title="t('host.shareResultTitle')" width="520px">
    <div class="share-result">
      <div class="share-result__summary">
        <span class="share-result__success">
          {{ t('host.shareSuccess') }} {{ result.successCount }}
        </span>
        <span class="share-result__fail">
          {{ t('host.shareFail') }} {{ result.failedItems.length }}
        </span>
      </div>

      <div v-if="result.failedItems.length" class="share-result__table-wrap">
        <table class="share-result__table">
          <thead>
            <tr>
              <th class="share-result__th share-result__col-ip">
                {{ t('host.columnHostIp') }}
              </th>
              <th class="share-result__th share-result__col-reason">
                {{ t('host.shareFailedReason') }}
              </th>
            </tr>
          </thead>
        </table>
        <div class="share-result__body">
          <table class="share-result__table">
            <colgroup>
              <col class="share-result__col-ip" />
              <col class="share-result__col-reason" />
            </colgroup>
            <tbody>
              <tr v-for="item in result.failedItems" :key="item.ip">
                <td class="share-result__td" :title="item.ip">
                  {{ item.ip }}
                </td>
                <td class="share-result__td share-result__td--danger" :title="item.reason">
                  {{ item.reason }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </vmos-dialog>
</template>

<style scoped lang="scss">
.share-result {
  &__summary {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
  }

  &__success {
    color: var(--el-color-success);
    font-weight: 600;
  }

  &__fail {
    color: var(--el-color-danger);
    font-weight: 600;
  }

  &__table-wrap {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    overflow: hidden;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 13px;
  }

  &__col-ip {
    width: 40%;
  }

  &__col-reason {
    width: 60%;
  }

  &__th {
    padding: 8px 12px;
    text-align: left;
    font-weight: 500;
    background: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__body {
    max-height: 220px;
    overflow-y: auto;
  }

  &__td {
    padding: 8px 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-bottom: 1px solid var(--el-border-color-lighter);
    color: var(--el-text-color-regular);

    &--danger {
      color: var(--el-color-danger);
    }
  }
}
</style>
