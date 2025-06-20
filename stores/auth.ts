import { defineStore } from "pinia";
import type {
  ApiResponse,
  User,
  OAuthProvider,
  OAuthResponse,
} from "~/types/api";

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  avatar_url?: string;
  [key: string]: any;
}

interface PasswordResetData {
  token: string;
  new_password: string;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    user: null,
    token: null,
    refreshToken: null,
  }),

  getters: {
    isAuthenticated: (state: AuthState): boolean => !!state.token,
    getUser: (state: AuthState): User | null => state.user,
  },

  actions: {
    setUser(user: User): void {
      this.user = user;
    },

    setTokens(token: string, refreshToken: string | null): void {
      this.token = token;
      this.refreshToken = refreshToken;

      // Store tokens in local storage for persistence
      if (import.meta.client) {
        localStorage.setItem("authToken", token);
        if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
      }
    },

    clearTokens(): void {
      this.token = null;
      this.refreshToken = null;

      // Remove tokens from local storage
      if (import.meta.client) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("refreshToken");
      }
    },

    async register(userData: RegisterData): Promise<ApiResponse<User>> {
      const config = useRuntimeConfig();
      console.log("Auth store register with data:", userData);

      try {
        const { data, error } = await useFetch<ApiResponse<User>>(
          `${config.public.apiBaseUrl}/auth/register`,
          {
            method: "POST",
            body: userData,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        console.log("Register response:", {
          data: data.value,
          error: error.value,
        });

        if (error.value) {
          // Try to extract more detailed error message if available
          const errorDetail = this.getErrorDetail(error.value);
          console.log("Error detail:", errorDetail);
          throw new Error(
            errorDetail || error.value?.message || "Registration failed"
          );
        }

        return data.value as ApiResponse<User>;
      } catch (err) {
        console.error("Register exception:", err);
        throw err;
      }
    },

    // Helper method to extract more detailed error information
    getErrorDetail(error: any): string | null {
      if (!error) return null;

      // Try to parse responseText if it exists and looks like JSON
      try {
        if (error.data && typeof error.data === "object") {
          return error.data.message || null;
        }

        // For useFetch errors
        if (error.message) {
          return error.message;
        }
      } catch (parseError) {
        console.error("Error parsing error response:", parseError);
      }

      return null;
    },

    async login({
      email,
      password,
    }: LoginCredentials): Promise<
      ApiResponse<{ user: User; token: string; refresh_token: string }>
    > {
      const config = useRuntimeConfig();

      const { data, error } = await useFetch<
        ApiResponse<{ user: User; token: string; refresh_token: string }>
      >(`${config.public.apiBaseUrl}/auth/login`, {
        method: "POST",
        body: { email, password },
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (error.value) {
        // Try to extract more detailed error message if available
        const errorDetail = this.getErrorDetail(error.value);
        throw new Error(errorDetail || error.value?.message || "Login failed");
      }

      if (data.value?.success && data.value?.data) {
        this.setTokens(
          data.value.data.token,
          data.value.data.refresh_token || null
        );
        this.setUser(data.value.data.user);
        return data.value;
      }

      throw new Error(data.value?.message || "Invalid response from server");
    },

    // Updated OAuth login methods
    async initiateOAuthLogin(
      provider: OAuthProvider,
      customRedirectUri?: string
    ): Promise<void> {
      if (!import.meta.client) return;

      const config = useRuntimeConfig();

      try {
        // Build request URL with query parameters
        let url = `${config.public.apiBaseUrl}/auth/oauth/${provider}`;

        // Add redirect_uri parameter if provided
        if (customRedirectUri) {
          url += `?redirect_uri=${encodeURIComponent(customRedirectUri)}`;
        } else {
          url += `?redirect_uri=${encodeURIComponent(
            useRequestURL().origin
          )}/auth/callback`;
        }

        // Get the OAuth URL from the backend
        const { data, error } = await useFetch<ApiResponse<{ url: string }>>(
          url,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (error.value) {
          const errorDetail = this.getErrorDetail(error.value);
          throw new Error(
            errorDetail ||
              error.value?.message ||
              `Failed to initiate ${provider} login`
          );
        }

        if (data.value?.success && data.value?.data?.url) {
          // Redirect to OAuth provider
          window.location.href = data.value.data.url;
        } else {
          throw new Error(
            data.value?.message || "Invalid response from server"
          );
        }
      } catch (err) {
        console.error("OAuth initiation error:", err);
        throw err;
      }
    },

    // Process OAuth callback tokens
    async processOAuthCallback(
      token: string,
      refreshToken: string,
      redirectUri: string
    ) {
      if (!token) {
        throw new Error("No token received from OAuth provider");
      }

      // Set tokens in store and localStorage
      this.setTokens(token, refreshToken);

      // Sleep for 1 second to ensure tokens are set
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const user = await this.fetchCurrentUser();

      if (!user) {
        throw new Error("Failed to fetch user data");
      }

      if (redirectUri && redirectUri != "") {
        // Example redirectUriL https://tipspace.com/auth/callback
        const redirectUriParsed = new URL(redirectUri);

        // Set token and refresh token in URL
        redirectUriParsed.searchParams.set("token", token);
        redirectUriParsed.searchParams.set("refresh_token", refreshToken);

        setTimeout(() => {
          navigateTo(redirectUriParsed.toString(), { external: true });
        }, 1000);
      } else {
        setTimeout(() => {
          navigateTo("/account");
        }, 1000);
      }
    },

    async fetchCurrentUser(): Promise<User | null> {
      if (!this.token) return null;

      const config = useRuntimeConfig();

      const { data, error } = await useFetch<ApiResponse<User>>(
        `${config.public.apiBaseUrl}/auth/me`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      if (error.value) {
        if (error.value.statusCode === 401) {
          // Token expired, try to refresh
          try {
            await this.refreshAccessToken();
            return this.fetchCurrentUser();
          } catch (refreshError) {
            this.logout();
            throw refreshError;
          }
        }
        throw new Error(error.value?.message || "Failed to fetch user data");
      }

      if (data.value?.success && data.value?.data) {
        this.setUser(data.value.data);
        return data.value.data;
      }

      return null;
    },

    async refreshAccessToken(): Promise<ApiResponse<{ token: string }>> {
      if (!this.refreshToken) throw new Error("No refresh token available");

      const config = useRuntimeConfig();

      const { data, error } = await useFetch<ApiResponse<{ token: string }>>(
        `${config.public.apiBaseUrl}/auth/refresh`,
        {
          method: "POST",
          body: {
            refresh_token: this.refreshToken,
          },
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (error.value) {
        this.logout();
        throw new Error(error.value?.message || "Token refresh failed");
      }

      if (data.value?.success && data.value?.data?.token) {
        this.setTokens(data.value.data.token, this.refreshToken);
        return data.value;
      }

      throw new Error(data.value?.message || "Invalid response from server");
    },

    async logout(): Promise<void> {
      if (!this.token || !this.refreshToken) return;

      try {
        const config = useRuntimeConfig();

        await useFetch<ApiResponse<string>>(
          `${config.public.apiBaseUrl}/auth/logout`,
          {
            method: "POST",
            body: {
              refresh_token: this.refreshToken,
            },
            headers: {
              Authorization: `Bearer ${this.token}`,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (error) {
        console.error("Logout API error:", error);
      } finally {
        this.clearTokens();
        this.user = null;
      }
    },

    async requestPasswordReset(email: string): Promise<ApiResponse<string>> {
      const config = useRuntimeConfig();

      const { data, error } = await useFetch<ApiResponse<string>>(
        `${config.public.apiBaseUrl}/auth/request-password-reset`,
        {
          method: "POST",
          body: { email },
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (error.value) {
        throw new Error(
          error.value?.message || "Password reset request failed"
        );
      }

      return data.value as ApiResponse<string>;
    },

    async resetPassword({
      token,
      new_password,
    }: PasswordResetData): Promise<ApiResponse<User>> {
      const config = useRuntimeConfig();

      const { data, error } = await useFetch<ApiResponse<User>>(
        `${config.public.apiBaseUrl}/auth/reset-password`,
        {
          method: "POST",
          body: {
            token,
            new_password,
          },
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (error.value) {
        throw new Error(error.value?.message || "Password reset failed");
      }

      return data.value as ApiResponse<User>;
    },

    // Implement missing resend verification email endpoint
    async resendVerificationEmail(): Promise<ApiResponse<string>> {
      if (!this.token) throw new Error("You must be logged in");

      const config = useRuntimeConfig();

      const { data, error } = await useFetch<ApiResponse<string>>(
        `${config.public.apiBaseUrl}/auth/resend-verification-email`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (error.value) {
        throw new Error(
          error.value?.message || "Failed to resend verification email"
        );
      }

      return data.value as ApiResponse<string>;
    },

    // Initialize auth from localStorage (call this in a plugin)
    initAuth(): void {
      if (!import.meta.client) return;

      const token = localStorage.getItem("authToken");
      const refreshToken = localStorage.getItem("refreshToken");

      if (token) {
        this.setTokens(token, refreshToken);
        this.fetchCurrentUser().catch(() => this.clearTokens());
      }
    },
  },
});
