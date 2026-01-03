/**
 * Bunny.net Service
 * Handles file storage for audio and images
 *
 * Features:
 * - Upload audio files (WebM)
 * - Upload images
 * - Delete files
 * - Generate CDN URLs
 */

// ==========================================
// Types
// ==========================================

export interface BunnyConfig {
  apiKey?: string
  storageZone?: string
  cdnUrl?: string
}

export interface UploadResult {
  /** The CDN URL for the uploaded file */
  url: string
  /** The storage path of the file */
  path: string
}

// ==========================================
// Constants
// ==========================================

// Bunny.net storage API - handles region routing automatically
const BUNNY_STORAGE_URL = 'https://storage.bunnycdn.com'

function getStorageUrl(): string {
  return BUNNY_STORAGE_URL
}

// ==========================================
// Mock Mode
// ==========================================

const MOCK_BUNNY = process.env.MOCK_BUNNY === 'true'

// ==========================================
// Configuration
// ==========================================

function getConfig(): Required<BunnyConfig> {
  return {
    apiKey: process.env.BUNNY_API_KEY || '',
    storageZone: process.env.BUNNY_STORAGE_ZONE || '',
    cdnUrl: process.env.BUNNY_CDN_URL || '',
  }
}

function validateConfig(config: BunnyConfig): void {
  if (!MOCK_BUNNY) {
    if (!config.apiKey) throw new Error('BUNNY_API_KEY is required')
    if (!config.storageZone) throw new Error('BUNNY_STORAGE_ZONE is required')
    if (!config.cdnUrl) throw new Error('BUNNY_CDN_URL is required')
  }
}

// ==========================================
// Path Helpers
// ==========================================

/**
 * Generate storage path for user audio
 */
export function getAudioPath(
  userId: string,
  sessionId: string,
  turnOrder: number,
  speaker: 'user' | 'ai',
  extension: string = 'webm',
): string {
  return `users/${userId}/sessions/${sessionId}/${speaker}_${String(turnOrder).padStart(3, '0')}.${extension}`
}

/**
 * Generate storage path for session image
 */
export function getImagePath(userId: string, sessionId: string): string {
  return `users/${userId}/sessions/${sessionId}/daily_image.png`
}

/**
 * Generate storage path for audio manifest
 */
export function getManifestPath(userId: string, sessionId: string): string {
  return `users/${userId}/sessions/${sessionId}/manifest.json`
}

// ==========================================
// Upload Functions
// ==========================================

/**
 * Upload a file to Bunny.net storage
 */
export async function uploadFile(
  path: string,
  data: Buffer | ArrayBuffer | string,
  contentType: string,
): Promise<UploadResult> {
  const config = getConfig()
  validateConfig(config)

  // Mock mode for development
  if (MOCK_BUNNY) {
    return mockUpload(path, config.cdnUrl)
  }

  const url = `${getStorageUrl()}/${config.storageZone}/${path}`

  console.log('[Bunny.net] Uploading to:', url)

  // Convert Buffer to Uint8Array for fetch compatibility
  let body: BodyInit
  if (Buffer.isBuffer(data)) {
    body = new Uint8Array(data)
  } else if (data instanceof ArrayBuffer) {
    body = new Uint8Array(data)
  } else {
    body = data
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      AccessKey: config.apiKey,
      'Content-Type': contentType,
    },
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Bunny.net upload error: ${response.status} - ${errorText}`)
  }

  return {
    url: `${config.cdnUrl}/${path}`,
    path,
  }
}

/**
 * Upload audio data
 * @param contentType - The MIME type (e.g., 'audio/webm', 'audio/mpeg')
 */
export async function uploadAudio(
  userId: string,
  sessionId: string,
  turnOrder: number,
  speaker: 'user' | 'ai',
  audioData: Buffer | ArrayBuffer,
  contentType: string = 'audio/webm',
): Promise<UploadResult> {
  // Determine file extension from content type
  const extensionMap: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
  }
  const extension = extensionMap[contentType] || 'webm'
  const path = getAudioPath(userId, sessionId, turnOrder, speaker, extension)
  return uploadFile(path, audioData, contentType)
}

/**
 * Upload image (PNG format)
 */
export async function uploadImage(
  userId: string,
  sessionId: string,
  imageData: Buffer | ArrayBuffer,
): Promise<UploadResult> {
  const path = getImagePath(userId, sessionId)
  return uploadFile(path, imageData, 'image/png')
}

/**
 * Upload image from URL (downloads and re-uploads to Bunny)
 */
export async function uploadImageFromUrl(
  userId: string,
  sessionId: string,
  imageUrl: string,
): Promise<UploadResult> {
  // Mock mode
  if (MOCK_BUNNY) {
    return mockUpload(getImagePath(userId, sessionId), getConfig().cdnUrl)
  }

  // Download the image
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Determine content type
  const contentType = response.headers.get('content-type') || 'image/png'
  const extension = contentType.includes('jpeg') ? 'jpg' : 'png'

  // Upload to Bunny
  const path = `users/${userId}/sessions/${sessionId}/daily_image.${extension}`
  return uploadFile(path, buffer, contentType)
}

/**
 * Upload audio manifest (JSON)
 */
export async function uploadManifest(
  userId: string,
  sessionId: string,
  manifest: object,
): Promise<UploadResult> {
  const path = getManifestPath(userId, sessionId)
  const data = JSON.stringify(manifest, null, 2)
  return uploadFile(path, data, 'application/json')
}

// ==========================================
// Delete Functions
// ==========================================

/**
 * Delete a file from Bunny.net storage
 */
export async function deleteFile(path: string): Promise<void> {
  const config = getConfig()
  validateConfig(config)

  // Mock mode
  if (MOCK_BUNNY) {
    console.log(`[Bunny.net] Mock delete: ${path}`)
    return
  }

  const url = `${getStorageUrl()}/${config.storageZone}/${path}`

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      AccessKey: config.apiKey,
    },
  })

  // 404 is acceptable (file already deleted)
  if (!response.ok && response.status !== 404) {
    const errorText = await response.text()
    throw new Error(`Bunny.net delete error: ${response.status} - ${errorText}`)
  }
}

/**
 * Delete all files for a session
 */
export async function deleteSessionFiles(
  userId: string,
  sessionId: string,
): Promise<void> {
  const config = getConfig()
  validateConfig(config)

  // Mock mode
  if (MOCK_BUNNY) {
    console.log(`[Bunny.net] Mock delete session: ${userId}/${sessionId}`)
    return
  }

  // List files in the session directory
  const directoryPath = `users/${userId}/sessions/${sessionId}/`
  const files = await listFiles(directoryPath)

  // Delete each file
  for (const file of files) {
    await deleteFile(file.path)
  }
}

// ==========================================
// List Functions
// ==========================================

interface FileInfo {
  path: string
  length: number
  lastModified: Date
}

/**
 * List files in a directory
 */
export async function listFiles(directoryPath: string): Promise<FileInfo[]> {
  const config = getConfig()
  validateConfig(config)

  // Mock mode
  if (MOCK_BUNNY) {
    return []
  }

  const url = `${getStorageUrl()}/${config.storageZone}/${directoryPath}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      AccessKey: config.apiKey,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    // 404 means empty directory
    if (response.status === 404) {
      return []
    }
    const errorText = await response.text()
    throw new Error(`Bunny.net list error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()

  return (
    data as Array<{ ObjectName: string; Length: number; LastChanged: string }>
  )
    .filter((item) => !item.ObjectName.endsWith('/'))
    .map((item) => ({
      path: `${directoryPath}${item.ObjectName}`,
      length: item.Length,
      lastModified: new Date(item.LastChanged),
    }))
}

// ==========================================
// Validation
// ==========================================

/**
 * Validate Bunny.net configuration by listing root
 */
export async function validateBunnyConfig(): Promise<boolean> {
  if (MOCK_BUNNY) return true

  const config = getConfig()

  try {
    const url = `${getStorageUrl()}/${config.storageZone}/`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        AccessKey: config.apiKey,
        Accept: 'application/json',
      },
    })
    return response.ok
  } catch {
    return false
  }
}

// ==========================================
// Mock Helpers
// ==========================================

async function mockUpload(path: string, cdnUrl: string): Promise<UploadResult> {
  console.log(`[Bunny.net] Mock upload: ${path}`)

  // Simulate upload delay
  await sleep(100)

  return {
    url: cdnUrl ? `${cdnUrl}/${path}` : `https://mock-cdn.example.com/${path}`,
    path,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
