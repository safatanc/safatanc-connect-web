<script setup lang="ts">
import "@/assets/css/tailwind.css";
import { useAuthStore } from '~/stores/auth';

// Initialize auth on client side
onMounted(() => {
  if (import.meta.client) {
    const authStore = useAuthStore();
    authStore.initAuth();
  }
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
