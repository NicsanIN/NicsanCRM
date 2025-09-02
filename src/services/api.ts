// API Service Layer for Nicsan CRM
// Handles all communication with the backend

const API_BASE = '/api';

// Types for API responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'ops' | 'founder';
  };
}

export interface Policy {
  id: string;
  policy_number: string;
  vehicle_number: string;
  insurer: string;
  total_premium: number;
  brokerage: number;
  cashback: number;
  net_premium: number;
  policy_type?: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyCreateRequest {
  policy_number: string;
  vehicle_number: string;
  insurer: string;
  total_premium: number;
  brokerage: number;
  cashback: number;
  net_premium: number;
  policy_type?: string;
  start_date?: string;
  end_date?: string;
}

export interface PDFUpload {
  id: string;
  filename: string;
  s3_key: string;
  file_size: number;
  mime_type: string;
  upload_status: 'pending' | 'completed' | 'failed' | 'review';
  extracted_data?: any;
  confidence_score?: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  total_gwp: number;
  total_brokerage: number;
  total_cashback: number;
  net_revenue: number;
  total_policies: number;
  total_uploads: number;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

type ApiOpts = {
  query?: Record<string, string | number | boolean | (string | number | boolean)[] | undefined>;
  body?: any;
  headers?: Record<string, string>;
};

export async function apiCall(method: HttpMethod, path: string, opts: ApiOpts = {}) {
  const { query, body, headers } = opts;

  // build query string safely (supports arrays)
  const qs = query
    ? '?' +
      new URLSearchParams(
        Object.entries(query)
          .flatMap(([k, v]) => {
            if (v === undefined || v === null) return [];
            return Array.isArray(v) ? v.map(iv => [k, String(iv)]) : [[k, String(v)]];
          })
      ).toString()
    : '';

  // ✅ CORRECT: /api + path (NOT /api + method + path)
  const url = `${API_BASE}${path}${qs}`;

  const token = localStorage.getItem('authToken');

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(headers || {}),
    },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || res.statusText);
  }

  // allow empty JSON
  try {
    const data = await res.json();
    // Convert backend response format {ok: true, data: {...}} to frontend format {success: true, data: {...}}
    if (data && typeof data === 'object') {
      if ('ok' in data) {
        return {
          success: data.ok,
          data: data.data,
          error: data.error,
          message: data.message
        };
      }
    }
    return data;
  } catch {
    return undefined;
  }
}

// Helpers for Confirm & Save payload (Zod-shaped)
const asNum = (v: any) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const wrapField = (val: any, src: 'manual' | 'extracted' = 'manual') => {
  if (val && typeof val === 'object' && 'value' in val) return val as any;
  const maybeNum = asNum(val);
  return {
    value: maybeNum !== undefined ? maybeNum : (val ?? ''),
    source: src,
    confidence: 1,
  };
};

const normalizeInsurer = (v: any) => {
  if (typeof v !== 'string') return v;
  const s = v.trim().toUpperCase();
  if (s === 'TATA AIG' || s === 'TATA_AIG') return 'TATA_AIG';
  if (s === 'DIGIT') return 'DIGIT';
  return v; // leave as-is; backend will validate
};

export const buildConfirmPayload = (form: any) => ({
  schema_version: '1.0',
  insurer:        wrapField(normalizeInsurer(form?.insurer)),
  policy_number:  wrapField(form?.policy_number),
  vehicle_number: wrapField(form?.vehicle_number),
  issue_date:     wrapField(form?.issue_date),
  expiry_date:    wrapField(form?.expiry_date),
  total_premium:  wrapField(form?.total_premium),
  idv:            wrapField(form?.idv),
  product_type:   (form?.product_type ?? 'MOTOR'),
  vehicle_type:   (form?.vehicle_type ?? 'PRIVATE'),
  make:           wrapField(form?.make),
  model:          wrapField(form?.model),
  manual_extras:  form?.manual_extras ?? {},
});

// Authentication API
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    console.log('🔍 Debug: Login API called with:', credentials);
    const response = await apiCall('POST', '/auth/login', {
      body: credentials,
    });
    console.log('🔍 Debug: Login API response:', response);
    return response;
  },

  register: async (userData: any): Promise<ApiResponse<any>> => {
    return apiCall('POST', '/auth/register', {
      body: userData,
    });
  },

  getProfile: async (): Promise<ApiResponse<any>> => {
    return apiCall('GET', '/auth/profile');
  },

  changePassword: async (passwordData: any): Promise<ApiResponse<any>> => {
    return apiCall('PUT', '/auth/change-password', {
      body: passwordData,
    });
  },
};

// Policies API
export const policiesAPI = {
  getAll: async (page = 1, limit = 50, filters?: any): Promise<ApiResponse<{ policies: Policy[]; total: number }>> => {
    return apiCall('GET', '/policies', {
      query: {
        page,
        limit,
        ...(filters && { filters: JSON.stringify(filters) }),
      },
    });
  },

  getById: async (id: string): Promise<ApiResponse<Policy>> => {
    return apiCall('GET', `/policies/${id}`);
  },

  create: async (policy: PolicyCreateRequest): Promise<ApiResponse<Policy>> => {
    return apiCall('POST', '/policies', {
      body: policy,
    });
  },

  update: async (id: string, policy: Partial<PolicyCreateRequest>): Promise<ApiResponse<Policy>> => {
    return apiCall('PUT', `/policies/${id}`, {
      body: policy,
    });
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    return apiCall('DELETE', `/policies/${id}`);
  },

  bulkCreate: async (policies: PolicyCreateRequest[]): Promise<ApiResponse<any>> => {
    return apiCall('POST', '/policies/bulk', {
      body: { policies },
    });
  },

  getRecent: async (limit = 6): Promise<ApiResponse<any[]>> => {
    return apiCall('GET', '/policies/recent', {
      query: { limit },
    });
  },
};

// PDF Upload API
export const uploadAPI = {
  uploadPDF: async (formData: FormData): Promise<ApiResponse<PDFUpload>> => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Use fetch directly for FormData since apiCall doesn't handle it well
      const response = await fetch(`${API_BASE}/upload/pdf/file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type for FormData - let browser set it with boundary
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data || data,
        message: data.message || 'PDF uploaded successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload PDF',
        message: 'Upload failed'
      };
    }
  },

  getUploads: async (page = 1, limit = 50, statuses?: string[]): Promise<PDFUpload[]> => {
    try {
      const resp = await apiCall('GET', '/upload/pdf', {
        query: {
          page,
          limit,
          ...(statuses?.length && { status: statuses }), // array ok; apiCall builds repeated ?status=A&status=B
        },
      });
      // always coerce to array
      return Array.isArray(resp?.items) ? resp.items : [];
    } catch (e) {
      console.warn('getUploads failed, returning []', e);
      return []; // never bubble error to UI
    }
  },

  getUploadById: async (uploadId: string): Promise<ApiResponse<PDFUpload>> => {
    return apiCall('GET', `/upload/pdf/${uploadId}`);
  },

  getReview: async (uploadId: string): Promise<ApiResponse<any>> => {
    return apiCall('GET', `/uploads/${uploadId}/review`);
  },

  // Create minimal upload record
  createUpload: async (filename: string, s3_key?: string, insurer?: string): Promise<ApiResponse<PDFUpload>> => {
    return apiCall('POST', '/upload/pdf', {
      body: {
        filename,
        s3_key: s3_key || null,
        insurer: insurer || null
      }
    });
  },

  getUploadStatus: async (s3Key: string): Promise<ApiResponse<PDFUpload>> => {
    return apiCall('GET', `/upload/internal/by-s3key/${encodeURIComponent(s3Key)}`);
  },

  retryProcessing: async (id: string): Promise<ApiResponse<any>> => {
    return apiCall('POST', `/upload/pdf/${id}/retry`);
  },

  confirmAndSave: async (uploadId: string, form: any): Promise<ApiResponse<any>> => {
    const payload = buildConfirmPayload(form);
    console.debug('🔧 confirm-save payload', payload);
    return apiCall('POST', `/uploads/${uploadId}/confirm-save`, {
      body: payload,
    });
  },
};

// Dashboard API
export const dashboardAPI = {
  getMetrics: async (): Promise<ApiResponse<DashboardMetrics>> => {
    return apiCall('GET', '/dashboard/metrics');
  },

  getSalesReps: async (): Promise<ApiResponse<any[]>> => {
    return apiCall('GET', '/dashboard/sales-reps');
  },

  getTrends: async (period = 'month'): Promise<ApiResponse<any[]>> => {
    return apiCall('GET', '/dashboard/trends', {
      query: { period },
    });
  },

  getDataSources: async (): Promise<ApiResponse<any[]>> => {
    return apiCall('GET', '/dashboard/data-sources');
  },

  getVehicleAnalysis: async (): Promise<ApiResponse<any[]>> => {
    return apiCall('GET', '/dashboard/vehicle-analysis');
  },

  getKPIs: async (): Promise<ApiResponse<any>> => {
    return apiCall('GET', '/dashboard/kpis');
  },
};

// Users API
export const usersAPI = {
  getAll: async (): Promise<ApiResponse<any[]>> => {
    return apiCall('GET', '/users');
  },

  getById: async (id: string): Promise<ApiResponse<any>> => {
    return apiCall('GET', `/users/${id}`);
  },

  update: async (id: string, userData: any): Promise<ApiResponse<any>> => {
    return apiCall('PUT', `/users/${id}`, {
      body: userData,
    });
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    return apiCall('DELETE', `/users/${id}`);
  },
};

// Auth utilities
export const authUtils = {
  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('authToken');
    return !!token;
  },

  getToken: (): string | null => {
    return localStorage.getItem('authToken');
  },

  setToken: (token: string): void => {
    console.log('🔍 Debug: Setting token, length:', token.length);
    localStorage.setItem('authToken', token);
    console.log('🔍 Debug: Token stored, verifying:', !!localStorage.getItem('authToken'));
  },

  removeToken: (): void => {
    localStorage.removeItem('authToken');
  },

  logout: (): void => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = '/';
  },
};

export default {
  auth: authAPI,
  policies: policiesAPI,
  upload: uploadAPI,
  dashboard: dashboardAPI,
  users: usersAPI,
  utils: authUtils,
};
