import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';
import { mount } from '@vue/test-utils';
import App from './App.vue';

describe('App', () => {
  it('renders the current route view', async () => {
    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        name: 'login',
        component: {
          template: '<div class="test-login">Login Screen</div>',
        },
      },
    ];

    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    });

    const pinia = createPinia();

    router.push('/');
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, router],
      },
    });

    expect(wrapper.find('.test-login').exists()).toBe(true);
  });
});
