import { act } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CompanyMatchDemoPage from './CompanyMatchDemo'

const rect = (
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect => ({
  x: left,
  y: top,
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
  toJSON: () => ({}),
})

const runTimers = async (duration: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(duration)
  })
}

const enterCompanyNames = (names: string[]) => {
  fireEvent.change(screen.getByPlaceholderText('请输入公司名称或统一社会信用代码，每行一条'), {
    target: { value: names.join('\n') },
  })
  fireEvent.click(screen.getByRole('button', { name: '开始匹配' }))
}

describe('批量公司匹配回归', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0))
    vi.stubGlobal('cancelAnimationFrame', (handle: number) =>
      window.clearTimeout(handle))

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.classList.contains('company-match-workspace')) {
        return rect(0, 0, 900, 600)
      }
      if (this.classList.contains('company-source-item')) {
        const sourceIndex = Number(this.dataset.sourceId?.replace('source-', '') ?? 0)
        const scrollTop = this.closest<HTMLElement>('.virtual-list')?.scrollTop ?? 0
        return rect(120, 100 + sourceIndex * 84 - scrollTop, 260, 76)
      }
      if (this.classList.contains('company-result-item')) {
        return rect(620, 100, 240, 76)
      }
      return rect(0, 0, 0, 0)
    })
  })

  it('输入统一社会信用代码后展示对应标准企业', () => {
    render(<CompanyMatchDemoPage />)
    enterCompanyNames(['91440300708461136T'])

    const resultList = screen.getByRole('list', { name: '企业匹配结果' })
    expect(resultList.textContent).toContain('深圳市腾讯计算机系统有限公司')
    expect(resultList.textContent).toContain('统一社会信用代码')
    expect(resultList.textContent).toContain('100%')
  })

  it('收起和展开原始输入时保留已经输入的内容', () => {
    render(<CompanyMatchDemoPage />)
    const input = screen.getByPlaceholderText('请输入公司名称或统一社会信用代码，每行一条')
    fireEvent.change(input, { target: { value: '腾讯\n华为' } })

    fireEvent.click(screen.getByRole('button', { name: '收起原始企业名单' }))
    expect(screen.queryByPlaceholderText('请输入公司名称或统一社会信用代码，每行一条')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '展开原始企业名单' }))
    const restoredInput = screen.getByPlaceholderText(
      '请输入公司名称或统一社会信用代码，每行一条',
    ) as HTMLTextAreaElement
    expect(restoredInput.value).toBe('腾讯\n华为')
  })

  it('用户滚动时立即隐藏连线，鼠标静止时按当前位置恢复连线', async () => {
    const { container } = render(<CompanyMatchDemoPage />)
    fireEvent.click(screen.getByRole('button', { name: '开始匹配' }))

    const sourceList = screen.getByRole('list', { name: '已解析企业词条' })
    const sourceItem = Array.from(sourceList.querySelectorAll('.company-source-item'))
      .find((element) => element.textContent?.includes('华为科技'))
    expect(sourceItem).toBeDefined()
    fireEvent.mouseEnter(sourceItem!, { clientX: 220, clientY: 130 })
    await runTimers(320)
    await runTimers(200)

    expect(container.querySelectorAll('.company-match-connector__ants')).toHaveLength(1)

    sourceList.scrollTop = 20
    fireEvent.scroll(sourceList)

    expect(container.querySelectorAll('.company-match-connector__ants')).toHaveLength(0)
    await runTimers(400)
    await runTimers(200)
    expect(container.querySelectorAll('.company-match-connector__ants')).toHaveLength(1)
    expect(sourceItem?.classList.contains('is-active')).toBe(true)
    expect(document.elementFromPoint).not.toHaveBeenCalled()
  })

  it('同一页面存在多个实例时只在当前组件根节点内恢复 hover', async () => {
    const { container } = render(
      <>
        <CompanyMatchDemoPage />
        <CompanyMatchDemoPage />
      </>,
    )
    const pages = Array.from(container.querySelectorAll('.company-match-page'))
    expect(pages).toHaveLength(2)

    pages.forEach((page) => {
      const matchButton = page.querySelector<HTMLButtonElement>('[aria-label="开始匹配"]')
      expect(matchButton).not.toBeNull()
      fireEvent.click(matchButton!)
    })

    const sourceLists = pages.map((page) =>
      page.querySelector<HTMLElement>('[aria-label="已解析企业词条"]'))
    const sourceItems = pages.map((page) =>
      Array.from(page.querySelectorAll<HTMLElement>('.company-source-item'))
        .find((element) => element.textContent?.includes('华为科技')))
    expect(sourceLists.every(Boolean)).toBe(true)
    expect(sourceItems.every(Boolean)).toBe(true)

    vi.mocked(document.elementFromPoint).mockReturnValue(sourceItems[1]!)
    fireEvent.mouseEnter(sourceItems[0]!, { clientX: 220, clientY: 130 })
    sourceLists[0]!.scrollTop = 20
    fireEvent.scroll(sourceLists[0]!)

    await runTimers(400)
    await runTimers(200)

    expect(sourceItems[0]?.classList.contains('is-active')).toBe(true)
    expect(sourceItems[1]?.classList.contains('is-active')).toBe(false)
    expect(document.elementFromPoint).not.toHaveBeenCalled()
  })

  it('从去重结果反向定位到当前视口最近的重复来源', async () => {
    const { container } = render(<CompanyMatchDemoPage />)
    enterCompanyNames([
      '腾讯',
      ...Array.from({ length: 10 }, (_, index) => `不存在企业${index + 1}`),
      '腾讯',
      '不存在企业11',
      '不存在企业12',
    ])

    const sourceList = screen.getByRole('list', { name: '已解析企业词条' })
    sourceList.scrollTop = 672
    fireEvent.scroll(sourceList)

    const resultItem = Array.from(container.querySelectorAll('.company-result-item'))
      .find((element) => element.textContent?.includes('深圳市腾讯计算机系统有限公司'))
    expect(resultItem).toBeDefined()
    fireEvent.mouseEnter(resultItem!)
    await runTimers(320)
    await runTimers(200)

    expect(sourceList.scrollTop).toBe(716)
    const activeSources = Array.from(container.querySelectorAll('.company-source-item.is-active'))
    expect(activeSources).toHaveLength(1)
    expect(activeSources[0]?.textContent).toContain('12腾讯')
    expect(container.querySelectorAll('.company-match-connector__ants')).toHaveLength(1)
  })

  it('过滤至空后复原时重置滚动位置并从首条重新渲染', () => {
    render(<CompanyMatchDemoPage />)
    const unknownNames = Array.from(
      { length: 12 },
      (_, index) => `完全不存在的企业${index + 1}`,
    )
    enterCompanyNames(unknownNames)

    const resultList = screen.getByRole('list', { name: '企业匹配结果' })
    resultList.scrollTop = 504
    fireEvent.scroll(resultList)

    const filter = screen.getByRole('checkbox', { name: /过滤匹配失败项/ })
    fireEvent.click(filter)
    expect(screen.queryByText('匹配失败项已过滤')).not.toBeNull()
    expect(resultList.scrollTop).toBe(0)

    fireEvent.click(filter)
    expect(screen.queryByText('匹配失败项已过滤')).toBeNull()
    expect(resultList.scrollTop).toBe(0)
    expect(resultList.textContent).toContain(unknownNames[0])
  })
})
