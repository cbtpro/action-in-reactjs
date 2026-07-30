import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/app/store'

/**
 * 类型安全的 dispatch / selector 钩子
 * 使用方式与原生 hook 一致,自动推断 state 类型
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
