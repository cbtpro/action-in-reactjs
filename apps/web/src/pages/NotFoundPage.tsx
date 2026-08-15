import { Link } from 'react-router-dom'

/**
 * 404 兜底页
 */
export default function NotFoundPage() {
  return (
    <section className="page">
      <h1>404</h1>
      <p className="page__desc">页面不存在</p>
      <Link to="/" className="link">
        返回首页
      </Link>
    </section>
  )
}
