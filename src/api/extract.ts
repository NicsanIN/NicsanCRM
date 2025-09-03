import { apiCall } from '../services/api';

export const extractAPI = {
  extractPDF: async (uploadId: string, model: 'primary' | 'secondary' = 'primary') => {
    // Ensure we pass the selected uploadId and token every time
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }
    
    return apiCall(`/extract/pdf/${uploadId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }, // <-- required
      body: JSON.stringify({ model })
    });
  },
  
  extractOCR: async (uploadId: string) => {
    // Ensure we pass the selected uploadId and token every time
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }
    
    return apiCall(`/extract/pdf/${uploadId}/ocr`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }, // <-- required
    });
  }
};

