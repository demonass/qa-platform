/**
 * Unified API client with auth injection, 401 interception, and error normalization.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8081'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get isAuthExpired(): boolean {
    return this.status === 401 || this.message.includes('登录已过期')
  }
}

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = BACKEND_URL) {
    this.baseUrl = baseUrl
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('qa-token')
      if (token) headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      const body = await response.json().catch(() => ({ error: '登录已过期' }))
      const msg = typeof body.error === 'string' ? body.error : body.detail || '登录已过期'
      throw new ApiError(401, msg, body.detail)
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: `请求失败 (${response.status})` }))
      const msg = body.error || body.detail || `请求失败 (${response.status})`
      throw new ApiError(response.status, msg, body.detail)
    }

    return response.json() as Promise<T>
  }

  async get<T = unknown>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, { headers: this.authHeaders() })
    return this.handleResponse<T>(response)
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })
    return this.handleResponse<T>(response)
  }

  async delete<T = unknown>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    })
    return this.handleResponse<T>(response)
  }

  async upload<T = unknown>(path: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {}
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('qa-token')
      if (token) headers['Authorization'] = `Bearer ${token}`
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST', headers, body: formData,
    })
    return this.handleResponse<T>(response)
  }

  async stream(path: string, body: unknown): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    })
    if (response.status === 401) {
      throw new ApiError(401, '登录已过期，请重新登录')
    }
    if (!response.ok) {
      throw new ApiError(response.status, `请求失败 (${response.status})`)
    }
    return response
  }
}

export const api = new ApiClient()
