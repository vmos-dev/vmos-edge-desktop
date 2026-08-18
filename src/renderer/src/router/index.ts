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
          meta: { title: 'layout.cloud' }
        },
        {
          path: '/host',
          name: 'Host',
          component: () => import('@renderer/views/host/index.vue'),
          meta: { title: 'layout.host' }
        },
        {
          path: '/image',
          name: 'Image',
          component: () => import('@renderer/views/image/index.vue'),
          meta: { title: 'layout.image' }
        },
        {
          path: '/proxy',
          name: 'Proxy',
          component: () => import('@renderer/views/proxy/index.vue'),
          meta: { title: 'layout.proxy' }
        },
        {
          path: '/adi',
          name: 'Adi',
          component: () => import('@renderer/views/adi/index.vue'),
          meta: { title: 'layout.header.machineSettings' }
        },
        {
          path: '/general',
          name: 'General',
          component: () => import('@renderer/views/general/index.vue'),
          meta: { title: 'layout.header.generalSettings' }
        },
        {
          path: '/ai-agent',
          name: 'AiAgent',
          component: () => import('@renderer/views/aiAgent/index.vue'),
          meta: { title: 'layout.aiAgent' }
        },
        {
          path: '/frp',
          name: 'Frp',
          component: () => import('@renderer/views/frp/index.vue'),
          meta: { title: 'layout.frp' }
        },
        {
          path: '/automation',
          name: 'Automation',
          component: () => import('@renderer/views/workflow/AutomationView.vue'),
          meta: { title: 'layout.automation' }
        },
        {
          path: '/automation/workflow/:id',
          name: 'WorkflowEdit',
          component: () => import('@renderer/views/workflow/EditView.vue'),
          meta: { title: 'layout.automation' }
        },
        {
          path: '/automation/task/:id',
          name: 'TaskDetail',
          component: () => import('@renderer/views/taskCenter/TaskDetailView.vue'),
          meta: { title: 'layout.automation' }
        }
      ]
    },
    {
      path: '/phone',
      name: 'Phone',
      component: () => import('@renderer/views/phone/index.vue'),
      meta: { title: 'layout.phone' }
    }
  ]
})

export default router
