// API Service Layer for Nicsan CRM
// Handles all communication with the backend
// frontend/src/api.ts

function makeUrl(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return p.startsWith('/api/') ? p : `/api${p}`; // always via Vite proxy (5174)
}

export async function apiCall(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('authToken') || '';
  const isForm = opts.body instanceof FormData;

  const headers = new Headers(opts.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!isForm && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(makeUrl(path), { ...opts, headers });
  const text = await res.text().catch(() => '');
  let data: any = null; try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) { const e: any = new Error(data?.error || res.statusText || 'Request failed'); e.status = res.status; e.data = data; throw e; }
  return data ?? {};
}

export async function uploadPDF(file: File, insurer: string) {
  const form = new FormData();
  form.append('pdf', file);        // ← field name MUST be "pdf"
  form.append('insurer', insurer); // e.g., "TATA_AIG" | "DIGIT"
  return apiCall('/upload/pdf/file', { method: 'POST', body: form });
}

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
    const response = await apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    return response;
  },

  register: async (userData: any): Promise<ApiResponse<any>> => {
    return apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  getProfile: async (): Promise<ApiResponse<any>> => {
    return apiCall('/api/auth/profile', {
      method: 'GET',
    });
  },

  changePassword: async (passwordData: any): Promise<ApiResponse<any>> => {
    return apiCall('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(passwordData),
    });
  },
};

// Policies API
export const policiesAPI = {
  getAll: async (page = 1, limit = 50, filters?: any): Promise<ApiResponse<{ policies: Policy[]; total: number }>> => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(filters && { filters: JSON.stringify(filters) }),
    });
    return apiCall(`/policies?${params}`, {
      method: 'GET',
    });
  },

  getById: async (id: string): Promise<ApiResponse<Policy>> => {
    return apiCall(`/policies/${id}`, {
      method: 'GET',
    });
  },

  create: async (policy: PolicyCreateRequest): Promise<ApiResponse<Policy>> => {
    return apiCall('/policies', {
      method: 'POST',
      body: JSON.stringify(policy),
    });
  },

  update: async (id: string, policy: Partial<PolicyCreateRequest>): Promise<ApiResponse<Policy>> => {
    return apiCall(`/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(policy),
    });
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    return apiCall(`/policies/${id}`, {
      method: 'DELETE',
    });
  },

  bulkCreate: async (policies: PolicyCreateRequest[]): Promise<ApiResponse<any>> => {
    return apiCall('/policies/bulk', {
      method: 'POST',
      body: JSON.stringify({ policies }),
    });
  },

  getRecent: async (limit = 6): Promise<ApiResponse<any[]>> => {
    return apiCall(`/policies/recent?limit=${limit}`, {
      method: 'GET',
    });
  },
};

// PDF Upload API
export const uploadAPI = {
  uploadPDF: uploadPDF, // Use the standalone function

  getUploads: async (page = 1, limit = 50, statuses?: string[]): Promise<PDFUpload[]> => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(statuses?.length && { status: statuses.join(',') }),
      });
      const resp = await apiCall(`/upload/pdf?${params}`, {
        method: 'GET',
      });
      // Coerce various possible backend shapes to a plain array of uploads
      // Supported shapes:
      // - { success: true, data: { items: [...] } }
      // - { ok: true, data: { items: [...] } }  (converted by apiCall to { success, data })
      // - { items: [...] }
      // - [...]
      const maybeItems =
        (resp as any)?.data?.items ??
        (resp as any)?.items ??
        (Array.isArray(resp) ? resp : undefined) ??
        (Array.isArray((resp as any)?.data) ? (resp as any).data : undefined);

      return Array.isArray(maybeItems) ? (maybeItems as PDFUpload[]) : [];
    } catch (e) {
      console.warn('getUploads failed, returning []', e);
      return []; // never bubble error to UI
    }
  },

  getUploadById: async (uploadId: string): Promise<ApiResponse<PDFUpload>> => {
    return apiCall(`/upload/pdf/${uploadId}`, {
      method: 'GET',
    });
  },

  getReview: async (uploadId: string): Promise<ApiResponse<any>> => {
    return apiCall(`/uploads/${uploadId}/review`, {
      method: 'GET',
    });
  },

  // Create minimal upload record - REMOVED: use /upload/pdf/file instead

  getUploadStatus: async (s3Key: string): Promise<ApiResponse<PDFUpload>> => {
    return apiCall(`/upload/internal/by-s3key/${encodeURIComponent(s3Key)}`, {
      method: 'GET',
    });
  },

  retryProcessing: async (id: string): Promise<ApiResponse<any>> => {
    return apiCall(`/upload/pdf/${id}/retry`, {
      method: 'POST',
    });
  },

  confirmAndSave: async (uploadId: string, form: any): Promise<ApiResponse<any>> => {
    const payload = buildConfirmPayload(form);
    console.debug('🔧 confirm-save payload', payload);
    return apiCall(`/uploads/${uploadId}/confirm-save`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// Dashboard API
export const dashboardAPI = {
  getMetrics: async (): Promise<ApiResponse<DashboardMetrics>> => {
    return apiCall('/dashboard/metrics', {
      method: 'GET',
    });
  },

  getSalesReps: async (): Promise<ApiResponse<any[]>> => {
    return apiCall('/dashboard/sales-reps', {
      method: 'GET',
    });
  },

  getTrends: async (period = 'month'): Promise<ApiResponse<any[]>> => {
    return apiCall(`/dashboard/trends?period=${period}`, {
      method: 'GET',
    });
  },

  getDataSources: async (): Promise<ApiResponse<any[]>> => {
    return apiCall('/dashboard/data-sources', {
      method: 'GET',
    });
  },

  getVehicleAnalysis: async (): Promise<ApiResponse<any[]>> => {
    return apiCall('/dashboard/vehicle-analysis', {
      method: 'GET',
    });
  },

  getKPIs: async (): Promise<ApiResponse<any>> => {
    return apiCall('/dashboard/kpis', {
      method: 'GET',
    });
  },
};

// Users API
export const usersAPI = {
  getAll: async (): Promise<ApiResponse<any[]>> => {
    return apiCall('/users', {
      method: 'GET',
    });
  },

  getById: async (id: string): Promise<ApiResponse<any>> => {
    return apiCall(`/users/${id}`, {
      method: 'GET',
    });
  },

  update: async (id: string, userData: any): Promise<ApiResponse<any>> => {
    return apiCall(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    return apiCall(`/users/${id}`, {
      method: 'DELETE',
    });
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
    localStorage.setItem('authToken', token);
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
