import { api, type QueryParams } from '@/lib/api/client'

export interface UploadedFile {
  id: number
  name: string
  mime_type: string
  size_bytes: number
  url: string
  thumbnail_url: string | null
  url_expires_at: string
  created_at: string
}

export const filesApi = {
  upload: (file: File, purpose: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('purpose', purpose)
    return api.upload<UploadedFile>('/files', form)
  },
}

export async function openFile(url: string, params?: QueryParams) {
  const target = window.open('', '_blank')
  try {
    const blob = await api.blob(url, params)
    const href = URL.createObjectURL(blob)
    if (target) target.location.href = href
    else window.location.href = href
    window.setTimeout(() => URL.revokeObjectURL(href), 60_000)
  } catch (error) {
    target?.close()
    throw error
  }
}

export async function downloadFile(url: string, filename: string, params?: QueryParams) {
  const blob = await api.blob(url, params)
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(href), 10_000)
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
