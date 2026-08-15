import { configureStore } from '@reduxjs/toolkit'
import counterReducer from '@/store/slices/counterSlice'

/**
 * 应用级 Redux store
 * 组合所有 slice 的 reducer,新增模块时在此注入即可
 */
export const store = configureStore({
  reducer: {
    counter: counterReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
