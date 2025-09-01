// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ops' | 'founder';
  password?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserCreate {
  email: string;
  name: string;
  password: string;
  role: 'ops' | 'founder';
}

export interface UserLogin {
  email: string;
  password: string;
}

// Policy Types
export interface Policy {
  id: string;
  policy_number: string;
  vehicle_number: string;
  insurer: string;
  product_type: string;
  vehicle_type: string;
  make: string;
  model?: string;
  cc?: string;
  manufacturing_year?: string;
  issue_date: Date;
  expiry_date: Date;
  idv: number;
  ncb: number;
  discount: number;
  net_od: number;
  ref?: string;
  total_od: number;
  net_premium: number;
  total_premium: number;
  cashback_percentage: number;
  cashback_amount: number;
  customer_paid: number;
  customer_cheque_no?: string;
  our_cheque_no?: string;
  executive: string;
  caller_name: string;
  mobile: string;
  rollover?: string;
  remark?: string;
  source: 'PDF_UPLOAD' | 'MANUAL_FORM' | 'MANUAL_GRID' | 'CSV_IMPORT';
  confidence_score?: number;
  status: 'DRAFT' | 'PARSING' | 'NEEDS_REVIEW' | 'SAVED' | 'REJECTED';
  brokerage: number;
  cashback: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface PolicyCreate {
  policy_number: string;
  vehicle_number: string;
  insurer: string;
  product_type: string;
  vehicle_type: string;
  make: string;
  model?: string;
  cc?: string;
  manufacturing_year?: string;
  issue_date: Date;
  expiry_date: Date;
  idv: number;
  ncb: number;
  discount: number;
  net_od: number;
  ref?: string;
  total_od: number;
  net_premium: number;
  total_premium: number;
  cashback_percentage: number;
  cashback_amount: number;
  customer_paid: number;
  customer_cheque_no?: string;
  our_cheque_no?: string;
  executive: string;
  caller_name: string;
  mobile: string;
  rollover?: string;
  remark?: string;
  source: 'PDF_UPLOAD' | 'MANUAL_FORM' | 'MANUAL_GRID' | 'CSV_IMPORT';
  brokerage?: number;
  cashback?: number;
}

// PDF Upload Types
export interface PDFUpload {
  id: string;
  filename: string;
  original_name: string;
  s3_key: string;
  s3_url: string;
  file_size: number;
  mime_type: string;
  status: 'UPLOADED' | 'PROCESSING' | 'REVIEW' | 'FAILED';
  confidence_score?: number;
  extracted_data?: any;
  error_message?: string;
  uploaded_by: string;
  created_at: Date;
  updated_at: Date;
}

// Dashboard Types
export interface DashboardMetrics {
  total_policies: number;
  total_gwp: number;
  total_brokerage: number;
  total_cashback: number;
  net_revenue: number;
  conversion_rate: number;
  avg_premium: number;
}

export interface SalesRepPerformance {
  id: string;
  name: string;
  leads_assigned: number;
  converted: number;
  gwp: number;
  brokerage: number;
  cashback: number;
  net_revenue: number;
  conversion_rate: number;
  cac: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  email: string;
  role: 'ops' | 'founder';
  iat: number;
  exp: number;
}

// Request with User
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// File Upload
export interface FileUploadRequest {
  file: Express.Multer.File;
  metadata?: {
    policy_number?: string;
    vehicle_number?: string;
    insurer?: string;
  };
}
