export interface Adi {
  id: number
  brand: string
  model: string
  asopVersion: string
  layout: string
  name: string
  pwd: string
  updateTime: string
}

export interface CustomAdi {
  id: string
  brand: string
  model: string
  model_name: string
  asopVersion: string
  layout: string
  name: string
  path: string
  updateTime: string
}

export const ADI_EVENTS = {
  GET_ADIS: 'ADI:GET_ADIS',
  GET_CUSTOM_ADIS: 'ADI:GET_CUSTOM_ADIS',
  IMPORT_CUSTOM_ADI: 'ADI:IMPORT_CUSTOM_ADI',
  DELETE_CUSTOM_ADI: 'ADI:DELETE_CUSTOM_ADI',
  UPLOAD_ADI_TO_HOST: 'ADI:UPLOAD_ADI_TO_HOST',
  UPLOAD_ADI_TO_HOST_PROGRESS: 'ADI:UPLOAD_ADI_TO_HOST_PROGRESS'
}
