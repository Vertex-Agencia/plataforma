import { supabase } from '@/lib/supabase'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const SIGNED_URL_EXPIRES_IN = 3600 // 60 minutos

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase()
}

export interface UploadResult {
  path: string
  signedUrl: string
}

export interface UploadError {
  message: string
}

export async function uploadContrato(
  file: File,
  clienteId: number
): Promise<{ data: UploadResult | null; error: UploadError | null }> {

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      data: null,
      error: { message: 'Tipo de arquivo não permitido. Use PDF ou DOCX.' },
    }
  }

  if (file.size > MAX_SIZE_BYTES) {
    return {
      data: null,
      error: { message: 'Arquivo muito grande. Tamanho máximo: 10MB.' },
    }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      data: null,
      error: { message: 'Usuário não autenticado.' },
    }
  }

  const safeName = sanitizeFileName(file.name)
  const timestamp = Date.now()
  const path = `${user.id}/${clienteId}/${timestamp}_${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('contratos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    return {
      data: null,
      error: { message: `Erro no upload: ${uploadError.message}` },
    }
  }

  const { data: signedData, error: signError } = await supabase.storage
    .from('contratos')
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN)

  if (signError || !signedData) {
    return {
      data: null,
      error: { message: 'Erro ao gerar URL de acesso ao arquivo.' },
    }
  }

  return {
    data: {
      path,
      signedUrl: signedData.signedUrl,
    },
    error: null,
  }
}

export async function getContratoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('contratos')
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN)

  if (error || !data) return null
  return data.signedUrl
}