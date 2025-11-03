import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import DashboardLayout from '@/layouts/DashboardLayout.vue';
import PublicLayout from '@/layouts/PublicLayout.vue';
import { useAuthStore } from '@/stores/auth.store';
import { supabase } from '@/services/supabase.client';

const routes: RouteRecordRaw[] = [
  // Public routes
  {
    path: '/',
    component: PublicLayout,
    meta: { public: true },
    children: [
      {
        path: '',
        name: 'landing',
        component: () => import('@/views/public/LandingView.vue'),
        meta: { public: true, title: 'Home' },
      },
      {
        path: 'pricing',
        name: 'pricing',
        component: () => import('@/views/public/PricingView.vue'),
        meta: { public: true, title: 'Pricing' },
      },
      {
        path: 'features',
        name: 'features',
        component: () => import('@/views/public/FeaturesView.vue'),
        meta: { public: true, title: 'Features' },
      },
      {
        path: 'login',
        name: 'login',
        component: () => import('@/views/auth/LoginView.vue'),
        meta: { public: true, title: 'Sign in' },
      },
      {
        path: 'register',
        name: 'register',
        component: () => import('@/views/auth/RegisterView.vue'),
        meta: { public: true, title: 'Create account' },
      },
      {
        path: 'subscribe-success',
        name: 'subscribe-success',
        component: () => import('@/views/public/SubscriptionSuccessView.vue'),
        meta: { public: true, title: 'Welcome!' },
      },
      {
        path: 'auth/callback',
        name: 'auth-callback',
        component: () => import('@/views/auth/AuthCallbackView.vue'),
        meta: { public: true, title: 'Verifying...' },
      },
      {
        path: 'terms',
        name: 'terms',
        component: () => import('@/views/public/TermsView.vue'),
        meta: { public: true, title: 'Terms of Service' },
      },
      {
        path: 'privacy',
        name: 'privacy',
        component: () => import('@/views/public/PrivacyView.vue'),
        meta: { public: true, title: 'Privacy Policy' },
      },
    ],
  },
  // Dashboard routes
  {
    path: '/dashboard',
    component: DashboardLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/dashboard/DashboardHome.vue'),
        meta: { requiresAuth: true, title: 'Dashboard' },
      },
      {
        path: 'integrations',
        name: 'integrations',
        component: () => import('@/views/dashboard/IntegrationsView.vue'),
        meta: { requiresAuth: true, title: 'Integrations' },
      },
      {
        path: 'inbox',
        name: 'inbox',
        component: () => import('@/views/dashboard/Inbox.vue'),
        meta: { requiresAuth: true, title: 'Inbox' },
        children: [
          {
            path: ':conversationId',
            name: 'conversation-detail',
            component: () => import('@/views/dashboard/ConversationDetail.vue'),
            meta: { requiresAuth: true, title: 'Inbox' },
          },
        ],
      },
      {
        path: 'templates',
        name: 'templates',
        component: () => import('@/views/dashboard/MessageTemplates.vue'),
        meta: { requiresAuth: true, title: 'Message Templates' },
      },
      {
        path: 'knowledge-base',
        name: 'knowledge-base',
        component: () => import('@/views/dashboard/KnowledgeBase.vue'),
        meta: { requiresAuth: true, title: 'Knowledge Base' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (!authStore.initialized.value) {
    await authStore.initialize();
  }

  const requiresAuth = to.matched.some((record) => record.meta?.requiresAuth);
  const isPublic = to.matched.some((record) => record.meta?.public);

  // Check session directly from Supabase instead of relying on store
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const isAuthenticated = Boolean(session);

  if (requiresAuth && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  // Allow access to login/register pages and public pages even when authenticated
  const allowAuthPages = ['login', 'register'].includes(to.name as string);
  const allowPublicPages = ['landing', 'pricing', 'features', 'terms', 'privacy'].includes(
    to.name as string,
  );
  if (isPublic && isAuthenticated && !allowAuthPages && !allowPublicPages) {
    return { name: 'dashboard' };
  }

  return true;
});

router.afterEach((to) => {
  const title = to.meta?.title
    ? `${to.meta.title} | Jeeves`
    : 'Jeeves - AI Assistant for Hospitality';
  if (typeof window !== 'undefined' && window.document) {
    window.document.title = title;
  }
});

export default router;
