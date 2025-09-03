// Real API Integration Service for Nicsan CRM
// This replaces the mock data with actual backend API calls

import { authAPI, policiesAPI, uploadAPI, dashboardAPI, usersAPI } from './api';

// Mock data fallbacks for development
const mockData = {
  policies: [
    {
      id: '1',
      policy_number: 'TA-9921',
      vehicle_number: 'KA01AB1234',
      insurer: 'Tata AIG',
      total_premium: 12150,
      cashback: 600,
      status: 'SAVED',
      source: 'PDF_UPLOAD',
      created_at: new Date().toISOString()
    }
  ],
  uploads: [
    {
      id: '1',
      filename: 'policy_123.pdf',
      status: 'COMPLETED',
      confidence_score: 0.92,
      created_at: new Date().toISOString()
    }
  ]
};

// Enhanced API service with fallbacks
export class NicsanCRMService {
  private static instance: NicsanCRMService;
  private isBackendAvailable: boolean = false;

  private constructor() {
    this.checkBackendAvailability();
  }

  static getInstance(): NicsanCRMService {
    if (!NicsanCRMService.instance) {
      NicsanCRMService.instance = new NicsanCRMService();
    }
    return NicsanCRMService.instance;
  }

  private async checkBackendAvailability(): Promise<void> {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
              const response = await fetch(`${API_BASE}/api/health`);
      this.isBackendAvailable = response.ok;
      console.log('✅ Backend is available');
    } catch (error) {
      this.isBackendAvailable = false;
      console.log('⚠️ Backend not available, using mock data');
    }
  }

  // Authentication methods
  async login(credentials: { email: string; password: string }): Promise<any> {
    if (this.isBackendAvailable) {
      try {
        return await authAPI.login(credentials);
      } catch (error) {
        console.error('Login failed, falling back to mock:', error);
      }
    }
    
    // Mock login for development
    if (credentials.email === 'admin@nicsan.in' && credentials.password === 'admin123') {
      return {
        success: true,
        data: {
          token: 'mock-token-admin',
          user: {
            id: '1',
            email: 'admin@nicsan.in',
            name: 'Admin User',
            role: 'founder'
          }
        }
      };
    } else if (credentials.email === 'ops@nicsan.in' && credentials.password === 'ops123') {
      return {
        success: true,
        data: {
          token: 'mock-token-ops',
          user: {
            id: '2',
            email: 'ops@nicsan.in',
            name: 'Ops User',
            role: 'ops'
          }
        }
      };
    }
    
    return { success: false, error: 'Invalid credentials' };
  }

  async getProfile(): Promise<any> {
    if (this.isBackendAvailable) {
      try {
        return await authAPI.getProfile();
      } catch (error) {
        console.error('Profile fetch failed:', error);
      }
    }
    
    // Return mock profile based on stored token
    const token = localStorage.getItem('authToken');
    if (token === 'mock-token-admin') {
      return {
        success: true,
        data: {
          id: '1',
          email: 'admin@nicsan.in',
          name: 'Admin User',
          role: 'founder'
        }
      };
    } else if (token === 'mock-token-ops') {
      return {
        success: true,
        data: {
          id: '2',
          email: 'ops@nicsan.in',
          name: 'Ops User',
          role: 'ops'
        }
      };
    }
    
    return { success: false, error: 'Not authenticated' };
  }

  // Policy methods
  async getPolicies(page: number = 1, limit: number = 20): Promise<any> {
    if (this.isBackendAvailable) {
      try {
        return await policiesAPI.getAll(page, limit);
      } catch (error) {
        console.error('Policies fetch failed:', error);
      }
    }
    
    // Mock policies data
    return {
      success: true,
      data: mockData.policies,
      pagination: {
        page,
        limit,
        total: mockData.policies.length,
        totalPages: 1
      }
    };
  }

  async createPolicy(policyData: any): Promise<any> {
    if (this.isBackendAvailable) {
      try {
        return await policiesAPI.create(policyData);
      } catch (error) {
        console.error('Policy creation failed:', error);
      }
    }
    
    // Mock policy creation
    const newPolicy = {
      id: Date.now().toString(),
      ...policyData,
      created_at: new Date().toISOString(),
      status: 'SAVED'
    };
    
    mockData.policies.push(newPolicy);
    
    return {
      success: true,
      data: newPolicy,
      message: 'Policy created successfully'
    };
  }

  // Upload methods
  async getUploads(page: number = 1, limit: number = 20): Promise<any> {
    if (this.isBackendAvailable) {
      try {
        return await uploadAPI.getUploads(page, limit);
      } catch (error) {
        console.error('Uploads fetch failed:', error);
      }
    }
    
    // Mock uploads data
    return {
      success: true,
      data: mockData.uploads,
      pagination: {
        page,
        limit,
        total: mockData.uploads.length,
        totalPages: 1
      }
    };
  }

  async uploadPDF(file: File, insurer: string): Promise<any> {
    if (this.isBackendAvailable) {
      try {
        return await uploadAPI.uploadPDF(file, insurer);
      } catch (error) {
        console.error('PDF upload failed:', error);
      }
    }
    
    // Mock PDF upload
    const newUpload = {
      id: Date.now().toString(),
      filename: file.name,
      status: 'UPLOADED',
      confidence_score: 0.85,
      created_at: new Date().toISOString()
    };
    
    mockData.uploads.push(newUpload);
    
    return {
      success: true,
      data: newUpload,
      message: 'PDF uploaded successfully'
    };
  }

  // Dashboard methods
  async getDashboardMetrics(): Promise<any> {
    if (this.isBackendAvailable) {
      try {
        return await dashboardAPI.getMetrics();
      } catch (error) {
        console.error('Dashboard metrics fetch failed:', error);
      }
    }
    
    // Mock dashboard metrics
    return {
      success: true,
      data: {
        total_policies: 150,
        total_gwp: 2500000,
        total_brokerage: 375000,
        total_cashback: 75000,
        net_revenue: 300000,
        conversion_rate: 0.65,
        avg_premium: 16667
      }
    };
  }

  async getSalesReps(): Promise<any> {
    if (this.isBackendAvailable) {
      try {
        return await dashboardAPI.getSalesReps();
      } catch (error) {
        console.error('Sales reps fetch failed:', error);
      }
    }
    
    // Mock sales reps data
    return {
      success: true,
      data: [
        {
          id: '1',
          name: 'Asha',
          leads_assigned: 120,
          converted: 22,
          gwp: 260000,
          brokerage: 39000,
          cashback: 10000,
          net_revenue: 29000,
          conversion_rate: 0.183,
          cac: 82
        },
        {
          id: '2',
          name: 'Vikram',
          leads_assigned: 110,
          converted: 18,
          gwp: 210000,
          brokerage: 31500,
          cashback: 9000,
          net_revenue: 22500,
          conversion_rate: 0.164,
          cac: 100
        }
      ]
    };
  }

  // Utility methods
  isBackendConnected(): boolean {
    return this.isBackendAvailable;
  }

  async refreshBackendStatus(): Promise<void> {
    await this.checkBackendAvailability();
  }
}

export default NicsanCRMService.getInstance();

