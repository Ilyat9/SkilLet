/**
 * Пересъёмка скриншотов docs/assets/*.png с живого работающего приложения.
 *
 * Запуск:
 *   npm run build && PORT=3100 npm start &
 *   BASE_URL=http://localhost:3100 node --env-file=.env scripts/capture/capture-screens.mjs
 *
 * Сессия — тот же механизм, что в capture-demo.mjs: JWT автора дерева,
 * подписанный AUTH_SECRET проекта.
 */
import { createRequire } from 'node:module'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const OUT = 'docs/assets'

function loadPuppeteer() {
  try {
    return createRequire(join(process.cwd(), 'package.json'))('puppeteer-core')
  } catch {}
  const npx = join(homedir(), '.npm', '_npx')
  for (const slot of readdirSync(npx)) {
    const pkg = join(npx, slot, 'node_modules', 'puppeteer-core', 'package.json')
    if (!existsSync(pkg)) continue
    return createRequire(join(npx, slot, 'node_modules/'))('puppeteer-core')
  }
  throw new Error('puppeteer-core не найден')
}

if (!process.env.AUTH_SECRET) throw new Error('Не задан AUTH_SECRET (запустите с --env-file=.env)')
const req = createRequire(join(process.cwd(), 'package.json'))
const { encode } = req('next-auth/jwt')
const puppeteer = loadPuppeteer()

const list = await (await fetch(`${BASE}/api/trees?scope=public&limit=50`)).json()
const tree = list?.data?.items?.find((t) => (t.title ?? '').includes('Frontend')) ?? list?.data?.items?.[0]
if (!tree?.id) throw new Error('В каталоге нет деревьев — выполните npm run db:seed')
const author = tree.author
if (!author?.id) throw new Error('У дерева из каталога нет автора в ответе API')

const sessionToken = await encode({
  secret: process.env.AUTH_SECRET,
  salt: 'authjs.session-token',
  token: { id: author.id, name: author.name, email: `${author.id}@demo.local`, sub: author.id },
})

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 })
const host = new URL(BASE).hostname
await page.setCookie({
  name: 'authjs.session-token',
  value: sessionToken,
  domain: host,
  path: '/',
  httpOnly: true,
  sameSite: 'Lax',
})

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const shots = [
  { file: 'landing.png', url: `${BASE}/`, delay: 1800 },
  { file: 'login.png', url: `${BASE}/login`, delay: 1200 },
  { file: 'explore.png', url: `${BASE}/explore`, delay: 1800 },
  { file: 'tree-view.png', url: `${BASE}/tree/${tree.id}`, delay: 2500, waitSelector: '.react-flow__node' },
  { file: 'tree-new.png', url: `${BASE}/tree/new`, delay: 1800 },
]

for (const shot of shots) {
  await page.goto(shot.url, { waitUntil: 'networkidle0', timeout: 60000 })
  if (shot.waitSelector) await page.waitForSelector(shot.waitSelector, { timeout: 30000 })
  await wait(shot.delay)
  await page.screenshot({ path: join(OUT, shot.file) })
  console.log(`done: ${OUT}/${shot.file}`)
}

await browser.close()
console.log(`все скриншоты обновлены (дерево для tree-view: ${tree.title})`)
