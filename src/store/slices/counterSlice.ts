import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/**
 * 计数器模块的状态结构
 */
interface CounterState {
  value: number
}

const initialState: CounterState = {
  value: 0,
}

/**
 * 计数器 slice
 * 新增 reducer 时只需在此处追加,无需改动调用方
 */
const counterSlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    incremented(state) {
      state.value += 1
    },
    decremented(state) {
      state.value -= 1
    },
    reset(state) {
      state.value = initialState.value
    },
    set(state, action: PayloadAction<number>) {
      state.value = action.payload
    },
  },
})

export const { incremented, decremented, reset, set } = counterSlice.actions
export default counterSlice.reducer
