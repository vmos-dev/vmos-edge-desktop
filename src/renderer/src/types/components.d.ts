import VmosTable from '../components/table/index.vue'
import VmosDialog from '../components/dialog/index.vue'
import SvgIcon from '../components/icon/index.vue'
import CopyText from '../components/copyText/index.vue'
import UploadCert from '../components/uploadCert/index.vue'
import VmosTabs from '../components/tabs/index.vue'
import VmosJson from '../components/json/index.vue'

declare module 'vue' {
  export interface GlobalComponents {
    VmosTable: typeof VmosTable
    VmosDialog: typeof VmosDialog
    SvgIcon: typeof SvgIcon
    CopyText: typeof CopyText
    UploadCert: typeof UploadCert
    VmosTabs: typeof VmosTabs
    VmosJson: typeof VmosJson
  }
}
