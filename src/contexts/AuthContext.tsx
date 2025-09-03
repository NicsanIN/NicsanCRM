import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authAPI, authUtils } from '../services/api';
import type { LoginRequest } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ops' | 'founder';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // DEV SHORTCUT: Inject dev JWT token
  useEffect(() => {
    // Expose dev login function to window for console access
    (window as any).devLogin = () => {
      const devToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkZXYtdXNlci1pZCIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJmb3VuZGVyIiwiaWF0IjoxNzM0NzI5NjAwLCJleHAiOjE3MzQ4MTYwMDB9.devtoken';
      const devUser = {
        id: 'dev-user-id',
        email: 'test@example.com',
        name: 'Dev User',
        role: 'founder' as const
      };
      
      authUtils.setToken(devToken);
      setUser(devUser);
      console.log('🔧 Dev login successful!', { user: devUser });
      
      // Reload to ensure all components pick up the auth state
      window.location.reload();
    };

    // Cleanup on unmount
    return () => {
      delete (window as any).devLogin;
    };
  }, []);

  // Check if user is already logged in on app start
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = authUtils.getToken();
        if (token) {
          const response = await authAPI.getProfile();
          if (response.success && response.data) {
            setUser(response.data);
          } else {
            // Token is invalid, remove it
            authUtils.removeToken();
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        authUtils.removeToken();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials: LoginRequest): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await authAPI.login(credentials);
      
      if (response.success && response.data) {
        // Backend returns: { success: true, data: { user: {...}, token: "..." } }
        const { token, user: userData } = response.data;

        // Store token and user data
        authUtils.setToken(token);
        setUser(userData);
        
        return true;
      } else {
        console.error('Login failed:', response.error);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    authUtils.logout();
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getProfile();
      if (response.success && response.data) {
        setUser(response.data);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      logout();
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
