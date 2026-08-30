/** Скриншот дерева с новым сайдбаром: node screenshot-ux.mjs <treeId> <out.png> */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'module'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const treeId = process.argv[2]
const out = process.argv[3] ?? '/tmp/ux-tree.png'

function findChrome() {
  const c = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ]
  return c.find(existsSync)
}
function loadPuppeteer() {
  try { return createRequire(join(process.cwd(), 'package.json'))('puppeteer-core') } catch {}
  const npx = join(homedir(), '.npm', '_npx')
  for (const slot of readdirSync(npx)) {
    const pkg = join(npx, slot, 'node_modules', 'puppeteer-core', 'package.json')
    if (existsSync(pkg)) return createRequire(join(npx, slot, 'node_modules/'))('puppeteer-core')
  }
  throw new Error('puppeteer-core не найден')
}

const puppeteer = loadPuppeteer()
const encode = createRequire(join(process.cwd(), 'package.json'))('next-auth/jwt').encode
const token = await encode({
  secret: process.env.AUTH_SECRET,
  salt: 'authjs.session-token',
  token: { id: process.env.DEMO_USER_ID, name: 'Demo User', email: 'demo@demo.local', sub: process.env.DEMO_USER_ID },
})

const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox', '--hide-scrollbars'] })
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 850 })
await page.setCookie({ name: 'authjs.session-token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' })

page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('console-error:', msg.text().slice(0, 300))
})
page.on('pageerror', (err) => console.log('pageerror:', String(err).slice(0, 300)))

await page.goto(`http://localhost:3000/tree/${treeId}`, { waitUntil: 'networkidle0', timeout: 60000 })
await new Promise((r) => setTimeout(r, 3000))
const bodyStart = await page.evaluate(() => document.body.innerText.slice(0, 200))
console.log('body-start:', JSON.stringify(bodyStart))
await page.waitForSelector('.react-flow__node', { timeout: 30000 })
await new Promise((r) => setTimeout(r, 1500))

// DOM-клик по первому интерактивному узлу — карточка навыка должна появиться в сайдбаре.
const clicked = await page.evaluate(() => {
  const nodes = document.querySelectorAll('.react-flow__node [role="button"]')
  for (const n of nodes) {
    if ((n.textContent || '').includes('Старт')) { n.click(); return true }
  }
  const first = nodes[0]
  if (first) { first.click(); return true }
  return false
})
console.log('dom-click-dispatched:', clicked)
await new Promise((r) => setTimeout(r, 1000))
const detailsOpen = await page.evaluate(() => {
  const aside = document.querySelector('aside') ?? document.body
  return (aside.textContent || '').includes('Материалы для прохождения') ||
    (aside.textContent || '').includes('Отметить пройденным')
    ? 'sidebar-card' : null
})
console.log('details-node:', detailsOpen)
const hasCard = detailsOpen !== null
console.log('card-opened:', hasCard)
await new Promise((r) => setTimeout(r, 1200))
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('console-error:', msg.text().slice(0, 200))
})
await page.screenshot({ path: out })
await browser.close()
console.log('saved:', out)
