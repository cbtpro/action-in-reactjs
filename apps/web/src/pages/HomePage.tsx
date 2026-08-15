import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { decremented, incremented, reset } from '@/store/slices/counterSlice'

/**
 * 首页:演示 Redux 状态读写
 */
export default function HomePage() {
  const count = useAppSelector((state) => state.counter.value)
  const dispatch = useAppDispatch()

  return (
    <section className="page">
      <h1>React + TS + Router + Redux</h1>
      <p className="page__desc">
        基准项目已就绪,可在 <code>src/store/slices</code> 扩展状态,
        在 <code>src/app/router.tsx</code> 扩展路由。
      </p>

      <div className="counter">
        <button type="button" onClick={() => dispatch(decremented())}>
          -
        </button>
        <span className="counter__value">{count}</span>
        <button type="button" onClick={() => dispatch(incremented())}>
          +
        </button>
      </div>

      <button type="button" className="link" onClick={() => dispatch(reset())}>
        重置
      </button>
    </section>
  )
}
