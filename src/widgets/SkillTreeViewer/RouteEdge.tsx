'use client'

import { getSmoothStepPath, BaseEdge, type EdgeProps } from '@xyflow/react'

/**
 * Ребро-маршрут: пунктирная линия пути на карте с «вехой»-засечкой на середине.
 * Не bezier-стрелка по умолчанию и не цепь (игровая метафора): направление
 * подчёркивает только маленький маркер-остриё на конце.
 */
export function RouteEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
  } = props

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        {...(markerEnd ? { markerEnd } : {})}
        style={{
          stroke: 'hsl(var(--border))',
          strokeWidth: 1.5,
          strokeDasharray: '7 5',
        }}
      />
      {/* Веха на маршруте: засечка поперёк пути на его середине. */}
      <circle
        cx={labelX}
        cy={labelY}
        r={2.6}
        fill="hsl(var(--background))"
        stroke="hsl(var(--accent-strong))"
        strokeWidth={1.2}
      />
    </>
  )
}
