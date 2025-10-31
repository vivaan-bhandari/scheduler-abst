import { apiService, API_ENDPOINTS } from './api';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

class AuthService {
  private tokenKey = 'authToken';
  private userKey = 'user';

  // Login user
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      console.log('🌐 AuthService: Making login request to:', API_ENDPOINTS.LOGIN);
      const response = await apiService.post<AuthResponse>(API_ENDPOINTS.LOGIN, credentials);
      console.log('📦 AuthService: Received response:', response);
      
      // Store token and user data
      this.setToken(response.token);
      this.setUser(response.user);
      console.log('💾 AuthService: Stored token and user data');
      
      return response;
    } catch (error) {
      console.error('🚨 AuthService: Login error:', error);
      throw error;
    }
  }

  // Register user
  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthResponse>(API_ENDPOINTS.REGISTER, userData);
      
      // Store token and user data
      this.setToken(response.token);
      this.setUser(response.user);
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      // Call logout endpoint if available
      if (this.isAuthenticated()) {
        await apiService.post(API_ENDPOINTS.LOGOUT);
      }
    } catch (error) {
      // Even if logout fails, clear local data
      console.warn('Logout request failed, clearing local data:', error);
    } finally {
      // Clear local storage
      this.clearAuth();
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Get current token
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Get current user
  getUser(): User | null {
    const userStr = localStorage.getItem(this.userKey);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  }

  // Check if user is staff
  isStaff(): boolean {
    const user = this.getUser();
    return user?.is_staff || false;
  }

  // Check if user is superuser
  isSuperuser(): boolean {
    const user = this.getUser();
    return user?.is_superuser || false;
  }

  // Set token in localStorage
  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  // Set user in localStorage
  private setUser(user: User): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  // Clear authentication data
  private clearAuth(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  // Refresh user data from server
  async refreshUser(): Promise<User | null> {
    try {
      const user = await apiService.get<User>(API_ENDPOINTS.USER_PROFILE);
      this.setUser(user);
      return user;
    } catch (error) {
      console.error('Error refreshing user data:', error);
      return null;
    }
  }
}

export const authService = new AuthService();
export default authService;
