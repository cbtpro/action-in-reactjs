import { configureStore } from '@reduxjs/toolkit'
import counterReducer from '@/store/slices/counterSlice'
import userReducer from '@/store/slices/userSlice'

/**
 * 应用级 Redux store
 * 组合所有 slice 的 reducer,新增模块时在此注入即可
 */
export const store = configureStore({
  reducer: {
    counter: counterReducer,
    user: userReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
