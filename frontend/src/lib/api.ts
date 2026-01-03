import { useAuth } from '@clerk/clerk-react';

// Base API URL - defaults to localhost in development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Hook to create an authenticated API client
export function useApiClient() {
  const { getToken } = useAuth();

  const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  };

  return {
    get: (endpoint: string) => fetchWithAuth(endpoint),
    post: (endpoint: string, data: unknown) =>
      fetchWithAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    put: (endpoint: string, data: unknown) =>
      fetchWithAuth(endpoint, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (endpoint: string) =>
      fetchWithAuth(endpoint, {
        method: 'DELETE',
      }),
  };
}
