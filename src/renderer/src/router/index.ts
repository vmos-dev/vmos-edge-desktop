import { createRouter, createWebHashHistory } from 'vue-router'
import Layout from '../layout/index.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: Layout,
      redirect: '/cloud',
      children: [
        {
          path: '/cloud',
          name: 'Cloud',
          component: () => import('@renderer/views/cloudPhone/index.vue'),
          meta: { title: '云机' }
        },
        {
          path: '/host',
          name: 'Host',
          component: () => import('@renderer/views/host/index.vue'),
          meta: { title: '主机' }
        },
        {
          path: '/image',
          name: 'Image',
          component: () => import('@renderer/views/image/index.vue'),
          meta: { title: '镜像' }
        },
        {
          path: '/proxy',
          name: 'Proxy',
          component: () => import('@renderer/views/proxy/index.vue'),
          meta: { title: '代理' }
        },
        {
          path: '/adi',
          name: 'Adi',
          component: () => import('@renderer/views/adi/index.vue'),
          meta: { title: '机型设置' }
        },
        {
          path: '/general',
          name: 'General',
          component: () => import('@renderer/views/general/index.vue'),
          meta: { title: '通用设置' }
        }
      ]
    },
    {
      path: '/phone',
      name: 'Phone',
      component: () => import('@renderer/views/phone/index.vue'),
      meta: { title: '手机' }
    }
  ]
})

export default router
