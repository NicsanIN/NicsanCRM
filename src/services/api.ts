// API Service Layer for Nicsan CRM
// Handles all communication with the backend

const API_BASE_URL = 'http://localhost:3001/api';

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

// Utility function for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
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

export const buildConfirmPayload = (form: any) => ({
  schema_version: '1.0',
  insurer:        wrapField(form?.insurer),
  policy_number:  wrapField(form?.policy_number),
  vehicle_number: wrapField(form?.vehicle_number),
  issue_date:     wrapField(form?.issue_date),
  expiry_date:    wrapField(form?.expiry_date),
  total_premium:  wrapField(form?.total_premium),
  idv:            wrapField(form?.idv),
  product_type:   wrapField(form?.product_type),
  vehicle_type:   wrapField(form?.vehicle_type),
  make:           wrapField(form?.make),
  model:          wrapField(form?.model),
  manual_extras:  form?.manual_extras ?? {},
});

// Authentication API
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    console.log('🔍 Debug: Login API called with:', credentials);
    const response = await apiCall<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    console.log('🔍 Debug: Login API response:', response);
    return response;
  },

  register: async (userData: any): Promise<ApiResponse<any>> => {
    return apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  getProfile: async (): Promise<ApiResponse<any>> => {
    return apiCall('/auth/profile');
  },

  changePassword: async (passwordData: any): Promise<ApiResponse<any>> => {
    return apiCall('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(passwordData),
    });
  },
};

// Policies API
export const policiesAPI = {
  getAll: async (page = 1, limit = 50, filters?: any): Promise<ApiResponse<{ policies: Policy[]; total: number }>> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(filters && { filters: JSON.stringify(filters) }),
    });
    return apiCall(`/policies?${params}`);
  },

  getById: async (id: string): Promise<ApiResponse<Policy>> => {
    return apiCall(`/policies/${id}`);
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
};

// PDF Upload API
export const uploadAPI = {
  uploadPDF: async (formData: FormData): Promise<ApiResponse<PDFUpload>> => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/upload/pdf`, {
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

  getUploads: async (page = 1, limit = 50): Promise<ApiResponse<{ uploads: PDFUpload[]; total: number }>> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    return apiCall(`/upload/pdf?${params}`);
  },

  getUploadById: async (uploadId: string): Promise<ApiResponse<PDFUpload>> => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/upload/${uploadId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data || data,
        message: data.message || 'Upload details retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get upload details',
        message: 'Retrieval failed'
      };
    }
  },

  getUploadStatus: async (s3Key: string): Promise<ApiResponse<PDFUpload>> => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/upload/internal/by-s3key/${encodeURIComponent(s3Key)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data || data,
        message: data.message || 'Upload status retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get upload status',
        message: 'Status retrieval failed'
      };
    }
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
    return apiCall('/dashboard/metrics');
  },

  getSalesReps: async (): Promise<ApiResponse<any[]>> => {
    return apiCall('/dashboard/sales-reps');
  },

  getTrends: async (period = 'month'): Promise<ApiResponse<any[]>> => {
    return apiCall(`/dashboard/trends?period=${period}`);
  },

  getDataSources: async (): Promise<ApiResponse<any[]>> => {
    return apiCall('/dashboard/data-sources');
  },

  getVehicleAnalysis: async (): Promise<ApiResponse<any[]>> => {
    return apiCall('/dashboard/vehicle-analysis');
  },

  getKPIs: async (): Promise<ApiResponse<any>> => {
    return apiCall('/dashboard/kpis');
  },
};

// Users API
export const usersAPI = {
  getAll: async (): Promise<ApiResponse<any[]>> => {
    return apiCall('/users');
  },

  getById: async (id: string): Promise<ApiResponse<any>> => {
    return apiCall(`/users/${id}`);
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
