/**
 * Пересъёмка docs/assets/demo.gif: живая headless-запись работающего приложения.
 *
 * Запуск:
 *   npm run build && npm start &                       # приложение на :3000
 *   node --env-file=.env scripts/capture/capture-demo.mjs
 *
 * Сессия — валидный JWT автора дерева, подписанный тем же next-auth/jwt, что и
 * приложение (GitHub OAuth в headless не пройти). Секрет читается из AUTH_SECRET
 * окружения; в скрипте нет ничего чувствительного и машинно-специфичного.
 *
 * Env (все необязательны): BASE_URL, TREE_ID, DEMO_USER_ID, GIF_OUT, CHROME_PATH, FPS.
 * Зависимости: puppeteer-core (node_modules проекта либо кэш npx), ffmpeg.
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'module'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const GIF = process.env.GIF_OUT ?? 'docs/assets/demo.gif'
const FPS = Number(process.env.FPS ?? 14)
const WEBM = join(tmpdir(), 'skillet-demo.webm')

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
  const hit = candidates.find(existsSync)
  if (hit) return hit
  // Кэш puppeteer: ~/.cache/puppeteer/chrome/<версия>/chrome-*/
  const root = join(homedir(), '.cache', 'puppeteer', 'chrome')
  if (existsSync(root)) {
    for (const v of readdirSync(root)) {
      const inner = readdirSync(join(root, v)).find((d) => d.startsWith('chrome-'))
      const bin = inner && [
        join(root, v, inner, 'Google Chrome for Testing'),
        join(root, v, inner, 'chrome-headless-shell'),
      ].find(existsSync)
      if (bin) return bin
    }
  }
  throw new Error('Chrome/Chromium не найден — укажите CHROME_PATH')
}

// puppeteer-core: из зависимостей проекта или из кэша npx (без установки из сети).
function loadPuppeteer() {
  try { return createRequire(join(process.cwd(), 'package.json'))('puppeteer-core') } catch {}
  const npx = join(homedir(), '.npm', '_npx')
  if (!existsSync(npx)) throw new Error('puppeteer-core не найден: npm i -D puppeteer-core')
  let best = null
  for (const slot of readdirSync(npx)) {
    const pkg = join(npx, slot, 'node_modules', 'puppeteer-core', 'package.json')
    if (!existsSync(pkg)) continue
    const version = JSON.parse(readFileSync(pkg, 'utf8')).version
    if (!best || version > best.version) best = { version, root: join(npx, slot, 'node_modules/') }
  }
  if (!best) throw new Error('puppeteer-core не найден: npm i -D puppeteer-core')
  return createRequire(best.root)('puppeteer-core')
}

const puppeteer = loadPuppeteer()

// --- Подготовка: дерево (из публичного API) и сессия (автор дерева) ---
const TREE_TITLE = process.env.TREE_TITLE ?? 'Frontend'
const list = await (await fetch(`${BASE}/api/trees?scope=public&limit=50`)).json()
const tree = process.env.TREE_ID
  ? { id: process.env.TREE_ID, author: null }
  : list?.data?.items?.find((t) => (t.title ?? '').includes(TREE_TITLE)) ?? list?.data?.items?.[0]
const treeId = tree?.id
if (!treeId) throw new Error('В каталоге нет деревьев — выполните npm run db:seed')

const author = tree.author ?? { id: process.env.DEMO_USER_ID, name: 'Demo User' }
if (!author?.id) throw new Error('Не определён пользователь сессии — задайте TREE_ID + DEMO_USER_ID')
if (!process.env.AUTH_SECRET) throw new Error('Не задан AUTH_SECRET (запустите с --env-file=.env)')
const encode = createRequire(join(process.cwd(), 'package.json'))('next-auth/jwt').encode
const sessionToken = await encode({
  secret: process.env.AUTH_SECRET,
  salt: 'authjs.session-token',
  token: { id: author.id, name: author.name, email: `${author.id}@demo.local`, sub: author.id },
})

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 750 })
await page.setCookie({
  name: 'authjs.session-token',
  value: sessionToken,
  domain: 'localhost',
  path: '/',
  httpOnly: true,
  sameSite: 'Lax',
})

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const deselect = () => page.evaluate(() => window.getSelection()?.removeAllRanges())

// Виртуальный курсор: SVG-стрелка + круг-отклик на клик. Инжектится на каждую
// навигацию, позиция синхронизируется с реальной мышью puppeteer — screencast снимает его как настоящий.
await page.evaluateOnNewDocument(() => {
  const install = () => {
    if (document.getElementById('__demo_cursor')) return
    const cur = document.createElement('div')
    cur.id = '__demo_cursor'
    cur.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transition:transform 70ms linear;will-change:transform;opacity:0;transform:translate(-100px,-100px);'
    cur.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 1l5.5 17 3.2-7.3L18 8.4z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    document.body.appendChild(cur)
    window.__cursorTo = (x, y) => {
      cur.style.opacity = x > 0 || y > 0 ? '1' : '0'
      cur.style.transform = `translate(${x}px, ${y}px)`
    }
    window.__ripple = (x, y) => {
      const r = document.createElement('div')
      r.style.cssText = `position:fixed;left:${x - 14}px;top:${y - 14}px;width:28px;height:28px;border:2px solid #34d399;border-radius:50%;pointer-events:none;z-index:2147483646;animation:__rip .45s ease-out forwards;`
      const st = document.createElement('style')
      st.textContent = '@keyframes __rip{from{transform:scale(.4);opacity:.9}to{transform:scale(1.6);opacity:0}}'
      document.head.appendChild(st)
      document.body.appendChild(r)
      setTimeout(() => { r.remove(); st.remove() }, 500)
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install)
  else install()
})

const toCursor = (x, y) =>
  page.evaluate(({ x, y }) => { window.__cursorTo?.(x, y) }, { x, y })
const clickRipple = (x, y) =>
  page.evaluate(({ x, y }) => { window.__ripple?.(x, y) }, { x, y })

// Плавность: все движения по ease-in-out (разгон → торможение), скролл —
// инкрементальными шагами вместо мгновенных прыжков колеса.
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
let mouseX = 0
let mouseY = 0

async function humanMove(x, y) {
  const x0 = mouseX
  const y0 = mouseY
  const steps = 30
  for (let i = 1; i <= steps; i++) {
    const t = easeInOut(i / steps)
    const px = x0 + (x - x0) * t
    const py = y0 + (y - y0) * t
    await page.mouse.move(px, py)
    await toCursor(px, py)
    await wait(14)
  }
  mouseX = x
  mouseY = y
}

async function smoothWheel(deltaY, steps = 14, stepMs = 28) {
  for (let i = 1; i <= steps; i++) {
    await page.mouse.wheel({ deltaY: deltaY / steps })
    await wait(stepMs)
  }
}

async function clickAt(x, y) {
  await clickRipple(x, y)
  await page.mouse.click(x, y)
}

async function clickByText(text) {
  for (const h of await page.$$('button, a, [role="button"]')) {
    if ((await h.evaluate((el) => el.textContent || '')).includes(text)) {
      const box = await h.boundingBox()
      if (box) {
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2
        await humanMove(cx, cy)
        await clickAt(cx, cy)
      } else {
        await h.click()
      }
      return
    }
  }
}

// --- Сценарий: запись стартует до первой навигации ---
const recorder = await page.screencast({ path: WEBM, format: 'webm' })

// Лендинг
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 60000 })
await wait(1200)
await smoothWheel(400); await wait(600)
await smoothWheel(-400); await wait(700)

// Каталог: сортировка и живой поиск
await page.goto(`${BASE}/explore`, { waitUntil: 'networkidle0', timeout: 60000 })
await wait(1200)
await clickByText('По дате'); await wait(1600)
await clickByText('По популярности'); await wait(1600)
const search = await page.$('input[placeholder*="Поиск"]')
if (search) {
  const sb = await search.boundingBox()
  if (sb) await humanMove(sb.x + sb.width / 2, sb.y + sb.height / 2)
  await search.click()
  await search.type('frontend', { delay: 90 })
  await wait(2000) // debounce + подгрузка
  for (let i = 0; i < 8; i++) await page.keyboard.press('Backspace')
  await wait(1400)
}

// Дерево: пан графа (без выделения текста), лёгкий зум для крупных узлов
await page.goto(`${BASE}/tree/${treeId}`, { waitUntil: 'networkidle0', timeout: 60000 })
await page.waitForSelector('.react-flow__node', { timeout: 30000 })
await wait(1200)
const pane = await page.$('.react-flow__pane')
if (pane) {
  const b = await pane.boundingBox()
  const cx = b.x + b.width * 0.62, cy = b.y + b.height * 0.7
  await page.mouse.move(cx, cy); await toCursor(cx, cy)
  mouseX = cx; mouseY = cy
  await page.mouse.down()
  const panSteps = 44
  for (let i = 1; i <= panSteps; i++) {
    // траектория пана + ease-in-out поверх, чтобы старт/финиш не дёргались
    const nx = cx + 60 - i * 6, ny = cy + 40 - i * 4
    const sx = cx + (nx - cx) * easeInOut(Math.min(1, (i / panSteps) * 1.2))
    const sy = cy + (ny - cy) * easeInOut(Math.min(1, (i / panSteps) * 1.2))
    await page.mouse.move(sx, sy); await toCursor(sx, sy); await wait(24)
  }
  await page.mouse.up(); await deselect(); await wait(600)
  await humanMove(450, 380)
  await smoothWheel(-240); await wait(400)
  await smoothWheel(-120); await wait(500)
}

// Прогресс: два узла — разблокировка пререквизитов + тосты достижений.
// Узлы задаются через TREE_NODES (по умолчанию — узлы сид-дерева «Frontend»);
// если узел с таким названием не найден, отмечается первый попавшийся.
const NODES = (process.env.TREE_NODES ?? 'Flexbox,Grid').split(',').map((s) => s.trim()).filter(Boolean)
async function markNode(title) {
  const nodes = await page.$$('.react-flow__node')
  let target = null
  for (const n of nodes) {
    if ((await n.evaluate((el) => el.textContent || '')).includes(title)) { target = n; break }
  }
  if (!target) {
    for (const n of nodes) {
      if (!(await n.evaluate((el) => el.getAttribute('aria-label') || '')).includes('заблокирован')) { target = n; break }
    }
    target ??= nodes[0]
  }
  if (!target) return
  const box = await target.boundingBox()
  await humanMove(box.x + box.width / 2, box.y + box.height / 2)
  await clickAt(box.x + box.width / 2, box.y + box.height / 2)
  await wait(800)
  await clickByText('Отметить пройденным')
  await wait(1800)
  await deselect()
}
for (const title of NODES) await markNode(title)

// Лайк — настоящим кликом по кнопке
const like = await page.$('button[aria-label^="Поставить лайк"]')
if (like) {
  const lb = await like.boundingBox()
  if (lb) {
    await humanMove(lb.x + lb.width / 2, lb.y + lb.height / 2)
    await clickAt(lb.x + lb.width / 2, lb.y + lb.height / 2)
  } else {
    await like.click()
  }
  await wait(1800)
}

// Дашборд: прогресс, streak, достижения
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle0', timeout: 60000 })
await wait(1800)
await smoothWheel(350); await wait(1300)

await recorder.stop()
await browser.close()

// --- Сборка GIF (palettegen/paletteuse, как у предыдущих артефактов) ---
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', WEBM, '-vf',
  `fps=${FPS},scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`,
  '-loop', '0', GIF])
console.log(`done: ${GIF} (webm-исходник: ${WEBM})`)
