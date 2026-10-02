export interface ConnectorPath {
  id: string
  d: string
}

export interface ConnectorLayer {
  width: number
  height: number
  paths: ConnectorPath[]
}

export interface ConnectorSvgLayerProps {
  layer: ConnectorLayer
}

/**
 * 两侧虚拟列表之间的连线绘图层：纯展示组件，只读取已经算好的路径数据。
 *
 * 连线本身是两个 DOM 元素中心点换算出的几何路径，测量和防抖调度都在
 * CompanyMatchDemo 中完成，这里只负责把路径画出来，避免把定位逻辑和
 * SVG 渲染耦合在一起。
 */
export function ConnectorSvgLayer({ layer }: ConnectorSvgLayerProps) {
  return (
    <svg
      className="company-match-connectors"
      viewBox={`0 0 ${layer.width} ${layer.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {layer.paths.map((path) => (
        <g key={path.id}>
          <path className="company-match-connector__outline" d={path.d} />
          <path className="company-match-connector__ants" d={path.d} />
        </g>
      ))}
    </svg>
  )
}
