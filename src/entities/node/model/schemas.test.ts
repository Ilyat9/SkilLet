import { describe, expect, it } from 'vitest'
import { parseResources } from './schemas'

describe('parseResources', () => {
  it('парсит валидный массив ресурсов', () => {
    const input = [
      { type: 'video', url: 'https://example.com/video', title: 'Видео' },
      { type: 'article', url: 'https://example.com/article', title: 'Статья' },
    ]
    expect(parseResources(input)).toEqual(input)
  })

  it('возвращает пустой массив для не-массива (Json из Prisma может быть любым)', () => {
    expect(parseResources(null)).toEqual([])
    expect(parseResources(undefined)).toEqual([])
    expect(parseResources({})).toEqual([])
    expect(parseResources('video')).toEqual([])
  })

  it('отбрасывает элементы с неверным типом/url целиком', () => {
    const input = [
      { type: 'podcast', url: 'https://example.com/a', title: 'A' }, // неверный enum
      { type: 'article', url: 'not-a-url', title: 'B' }, // невалидный url
      { type: 'video', url: 'https://example.com/ok', title: 'C' },
    ]
    expect(parseResources(input)).toEqual([
      { type: 'video', url: 'https://example.com/ok', title: 'C' },
    ])
  })

  it('пустой массив остаётся пустым массивом', () => {
    expect(parseResources([])).toEqual([])
  })
})
