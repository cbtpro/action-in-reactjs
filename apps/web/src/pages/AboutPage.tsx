/**
 * 关于页:静态展示页
 */
export default function AboutPage() {
  return (
    <section className="page">
      <h1>关于本项目</h1>
      <p className="page__desc">
        基于 Vite 的 React + TypeScript 基准工程,集成 React Router 与 Redux Toolkit。
      </p>
      <ul className="stack">
        <li>React 19</li>
        <li>React Router 7</li>
        <li>Redux Toolkit 2</li>
        <li>TypeScript</li>
      </ul>
    </section>
  )
}
