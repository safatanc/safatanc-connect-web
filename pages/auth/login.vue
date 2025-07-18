<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { Icon } from '@iconify/vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import type { OAuthProvider } from '~/types/api';
import { useAuthApi } from '~/composables/useAuthApi';

definePageMeta({
  layout: 'auth'
});

// SEO Meta Tags
useSeoMeta({
  title: 'Login - Safatanc Connect',
  description: 'Log in to Safatanc Connect to access your account. Seamless connectivity for all your Safatanc services.',
  // Open Graph
  ogTitle: 'Login to Safatanc Connect',
  ogDescription: 'Log in to Safatanc Connect to access your account. Seamless connectivity for all your Safatanc services.',
  ogImage: '/images/stech_logo_gradient.png',
  ogUrl: 'https://connect.safatanc.com/auth/login',
  ogType: 'website',
  // Twitter Card
  twitterCard: 'summary',
  twitterTitle: 'Login to Safatanc Connect',
  twitterDescription: 'Log in to Safatanc Connect to access your account. Seamless connectivity for all your Safatanc services.',
  twitterImage: '/images/stech_logo_gradient.png',
  // Theme Color
  themeColor: '#ffbf00', // Using brand color
}, { mode: 'server' });

const route = useRoute();
const authStore = useAuthStore();
const { login, initiateOAuthLogin } = useAuthApi();

// Check for redirect_uri and close_on_success in query parameters
const redirectUri = route.query.redirect_uri ? String(route.query.redirect_uri) : undefined;

const showLogin = ref(!authStore.isAuthenticated);

// Form values
const email = ref('');
const password = ref('');

// Define validation schema
const validationSchema = toTypedSchema(z.object({
  email: z.string().email('Please enter a valid email').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
}));

// Initialize form with vee-validate
const { handleSubmit, isSubmitting, errors } = useForm({
  validationSchema,
  initialValues: {
    email: '',
    password: ''
  }
});

const apiError = ref<string>('');
const loginSuccess = ref<boolean>(false);
const oauthLoading = ref<OAuthProvider | null>(null);

const onSubmit = handleSubmit(async (values) => {
  apiError.value = '';

  try {
    const response = await login({
      email: values.email,
      password: values.password
    });

    loginSuccess.value = response.success;

    // Redirect to dashboard or specified redirect URI after a short delay
    setTimeout(() => {
      if (redirectUri && response.data) {
        const redirectUriWithToken = new URL(redirectUri);
        redirectUriWithToken.searchParams.set('token', response.data.token);
        redirectUriWithToken.searchParams.set('refresh_token', response.data.refresh_token);

        navigateTo(redirectUriWithToken, { external: true });
      } else {
        navigateTo('/account');
      }
    }, 800);
  } catch (err: any) {
    apiError.value = err.message || 'Login failed. Please check your credentials.';
  }
});

// Handle OAuth login
const loginWithOAuth = (provider: OAuthProvider) => {
  apiError.value = '';
  oauthLoading.value = provider;

  try {
    initiateOAuthLogin(provider, redirectUri);
  } catch (err: any) {
    oauthLoading.value = null;
    apiError.value = err.message || `Failed to initiate ${provider} login`;
  }
};

const handleContinue = async () => {
  if (redirectUri) {
    const redirectUriWithToken = new URL(redirectUri);
    redirectUriWithToken.searchParams.set('token', authStore.token || '');
    redirectUriWithToken.searchParams.set('refresh_token', authStore.refresh_token || '');

    await navigateTo(redirectUriWithToken.toString(), { external: true });
  } else {
    await navigateTo('/account');
  }
};
</script>

<template>
  <div class="auth-container">
    <div>
      <div v-if="!showLogin"
        class="p-8 bg-dark-2 border border-dark rounded-3xl transition-all duration-300 hover:shadow-xl">
        <h2 class="text-center text-white">Confirmation</h2>
        <div class="flex justify-center items-center gap-2 my-5">
          <Icon icon="tabler:user-circle" class="text-white" width="64" height="64" />
          <div>
            <h3 class="text-white">{{ authStore.user?.full_name }}</h3>
            <p class="text-white/70">{{ authStore.user?.email }}</p>
          </div>
        </div>
        <h4 class="text-center text-white">You are already logged in, do you want to login with another account or
          continue with this account?</h4>
        <div class="mt-5">
          <Button bg="bg-white/5 hover:bg-white/10" color="text-white" class="w-full" @click="showLogin = true">
            <template #icon>
              <Icon icon="tabler:logout" width="24" height="24" />
            </template>
            <template #text>
              <p class="text-xs md:text-base">Login with another account</p>
            </template>
          </Button>
          <Button bg="bg-brand" color="text-black" class="w-full mt-5" @click="handleContinue">
            <template #icon>
              <Icon icon="tabler:arrow-right" width="24" height="24" />
            </template>
            <template #text>
              <p class="text-xs md:text-base">Continue with this account</p>
            </template>
          </Button>
        </div>
      </div>
      <div v-else="showLogin"
        class="p-8 bg-dark-2 border border-dark rounded-3xl transition-all duration-300 hover:shadow-xl">
        <h2 class="text-2xl font-bold text-center text-white">Login</h2>

        <form @submit.prevent="onSubmit" class="space-y-6 mt-8">
          <transition name="fade">
            <div v-if="apiError"
              class="p-4 rounded-3xl bg-red-900/30 border border-red-500 text-red-200 text-sm mb-4 shake">
              {{ apiError }}
            </div>
          </transition>

          <transition name="fade">
            <div v-if="loginSuccess"
              class="p-4 rounded-3xl bg-green-900/30 border border-green-500 text-green-200 text-sm mb-4">
              Login successful! Redirecting to your account...
            </div>
          </transition>

          <div class="form-field">
            <InputField name="email" type="email" label="Email" icon="tabler:mail" autocomplete="email"
              placeholder="Enter your email" rules="required|email" v-model="email" />
          </div>

          <div class="form-field">
            <InputField name="password" type="password" label="Password" icon="tabler:lock"
              autocomplete="current-password" placeholder="Enter your password" rules="required" v-model="password" />
            <div>
              <p class="text-sm text-white/70">
                Forgot your password?
                <NuxtLink to="/auth/password-reset-request" class="text-brand hover:text-opacity-80 transition-opacity">
                  Reset it
                </NuxtLink>
              </p>
            </div>
          </div>

          <div>
            <Button type="submit" :disabled="isSubmitting" bg="bg-brand" color="text-black" class="w-full">
              <template #icon>
                <Icon icon="tabler:login" width="24" height="24" />
              </template>
              <template #text>
                <span class="relative">
                  <transition name="fade" mode="out-in">
                    <span v-if="isSubmitting" key="loading">Logging in...</span>
                    <span v-else key="default">Login</span>
                  </transition>
                </span>
              </template>
            </Button>
          </div>
        </form>
        <!-- OAuth Buttons -->
        <div class="relative mt-8 mb-4">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-dark"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-dark-2 text-gray-400">Or continue with</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <!-- Google -->
          <Button bg="bg-white/5 hover:bg-white/10" color="text-white" class="w-full" @click="loginWithOAuth('google')">
            <template #icon>
              <Icon v-if="oauthLoading === 'google'" icon="tabler:loader" class="text-white animate-spin" width="24"
                height="24" />
              <Icon v-else icon="tabler:brand-google-filled" class="text-white" width="24" height="24" />
            </template>
            <template #text>
              <p v-if="oauthLoading === 'google'"></p>
              <p v-else>Google</p>
            </template>
          </Button>

          <!-- GitHub -->
          <Button bg="bg-white/5 hover:bg-white/10" color="text-white" class="w-full" @click="loginWithOAuth('github')">
            <template #icon>
              <Icon v-if="oauthLoading === 'github'" icon="tabler:loader" class="text-white animate-spin" width="24"
                height="24" />
              <Icon v-else icon="tabler:brand-github" class="text-white" width="24" height="24" />
            </template>
            <template #text>
              <p v-if="oauthLoading === 'github'"></p>
              <p v-else>GitHub</p>
            </template>
          </Button>
        </div>
      </div>
      <div class="mt-5">
        <p v-if="redirectUri" class="text-center text-white/70 text-xs italic">
          You will be redirected to <NuxtLink :to="redirectUri" target="_blank" class="text-brand">{{ redirectUri }}
          </NuxtLink> after
          login
        </p>
      </div>
    </div>
  </div>
</template>