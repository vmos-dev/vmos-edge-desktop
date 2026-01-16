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

export const ADI_EVENTS = {
  GET_ADIS: 'ADI:GET_ADIS',
  UPLOAD_ADI_TO_HOST: 'ADI:UPLOAD_ADI_TO_HOST',
  UPLOAD_ADI_TO_HOST_PROGRESS: 'ADI:UPLOAD_ADI_TO_HOST_PROGRESS'
}
