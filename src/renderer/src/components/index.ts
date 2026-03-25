import type { Component } from 'vue'
import VmosTable from './table/index.vue'
import VmosDialog from './dialog/index.vue'
import SvgIcon from './icon/index.vue'
import CopyText from './copyText/index.vue'
import UploadCert from './uploadCert/index.vue'
import VmosTabs from './tabs/index.vue'
import VmosJson from './json/index.vue'

// 导出全局组件映射
export const globalComponents: { [key: string]: Component } = {
  VmosTable,
  VmosDialog,
  SvgIcon,
  CopyText,
  UploadCert,
  VmosTabs,
  VmosJson
}

// 导出组件，方便按需导入
export { VmosTable, VmosDialog, SvgIcon, CopyText, UploadCert, VmosTabs, VmosJson, AiAssistant }
