import type { Component } from 'vue'
import VmosTable from './table/index.vue'
import VmosDialog from './dialog/index.vue'
import SvgIcon from './icon/index.vue'
import CopyText from './copyText/index.vue'
import UploadCert from './uploadCert/index.vue'
import VmosTabs from './tabs/index.vue'
import VmosJson from './json/index.vue'

export const globalComponents: { [key: string]: Component } = {
  VmosTable,
  VmosDialog,
  SvgIcon,
  CopyText,
  UploadCert,
  VmosTabs,
  VmosJson
}

export { VmosTable, VmosDialog, SvgIcon, CopyText, UploadCert, VmosTabs, VmosJson }
