import { createBrowserRouter } from 'react-router-dom'
import Layout from '@/components/Layout'
import HomePage from '@/pages/HomePage'
import AboutPage from '@/pages/AboutPage'
import ChartsPage from '@/pages/ChartsPage'
import FormPage from '@/pages/form'
import NotFoundPage from '@/pages/NotFoundPage'
import DemoPage from '@/pages/demo/Index'

/**
 * 路由配置
 * 新增路由时在 children 中追加条目即可,无需改动页面组件
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'demo', element: <DemoPage /> },
      { path: 'charts', element: <ChartsPage /> },
      { path: 'form', element: <FormPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
