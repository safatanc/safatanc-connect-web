import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware((to, from) => {
  // Skip middleware on server
  if (process.server) return;

  const authStore = useAuthStore();

  // If user is not authenticated, redirect to login page
  if (!authStore.isAuthenticated) {
    return navigateTo({
      path: "/auth/login",
      query: { redirect: to.fullPath },
    });
  }

  // Redirect authenticated users away from auth pages
  if (
    to.path.startsWith("/auth/") &&
    to.name !== "auth-logout" &&
    authStore.isAuthenticated
  ) {
    return navigateTo("/");
  }
});
