import './style.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="shell">
    <header class="brand">
      <img src="/icon.svg" alt="LunixDailies" class="brand-mark" />
      <div>
        <p class="eyebrow">LunixDailies</p>
        <h1>Daily Informatics Generator</h1>
      </div>
      <button id="installBtn" class="btn ghost" hidden>Install App</button>
    </header>

    <section class="panel form-panel">
      <h2>Generate Your Daily</h2>
      <p class="muted">Tailored post + visual prompt powered by Groq and free image APIs.</p>

      <form id="dailyForm" class="grid">
        <label>
          Topic
          <input name="topic" placeholder="AI in education" required />
        </label>

        <label>
          Audience
          <input name="audience" placeholder="Tech founders in Africa" required />
        </label>

        <label>
          Goal
          <input name="goal" placeholder="Drive channel engagement" required />
        </label>

        <label>
          Tone
          <select name="tone">
            <option value="insightful">Insightful</option>
            <option value="bold">Bold</option>
            <option value="friendly">Friendly</option>
            <option value="professional">Professional</option>
          </select>
        </label>

        <label>
          Community Mode
          <select name="community">
            <option value="general">General</option>
            <option value="26-moguls">26 Moguls</option>
          </select>
        </label>

        <div class="form-actions">
          <button type="submit" class="btn gold" id="generateBtn">Generate Daily</button>
          <button type="button" class="btn" id="generateMogulsBtn">Generate 26 Moguls Daily</button>
        </div>
      </form>

      <p class="muted tiny" id="status"></p>
      <p class="muted tiny ios-tip" id="iosTip" hidden>On iPhone: tap Share then Add to Home Screen to install.</p>
    </section>

    <section class="panel output-panel">
      <h2>Today\'s Output</h2>
      <article id="result" class="result empty">
        Generate your first daily to see your title, bullets, hashtags, and visual.
      </article>

      <div class="share-actions">
        <button class="btn" id="shareNative">Native Share</button>
        <button class="btn" id="shareFile">Share As Image File</button>
        <button class="btn" id="copyPost">Copy Post</button>
      </div>

      <div class="channel-links">
        <a id="telegramLink" target="_blank" rel="noreferrer">Telegram</a>
        <a id="whatsappLink" target="_blank" rel="noreferrer">WhatsApp</a>
        <a id="xLink" target="_blank" rel="noreferrer">X</a>
      </div>
    </section>
  </main>
`

const statusEl = document.querySelector('#status')
const resultEl = document.querySelector('#result')
const formEl = document.querySelector('#dailyForm')
const generateBtn = document.querySelector('#generateBtn')
const generateMogulsBtn = document.querySelector('#generateMogulsBtn')
const installBtn = document.querySelector('#installBtn')
const shareNativeBtn = document.querySelector('#shareNative')
const shareFileBtn = document.querySelector('#shareFile')
const copyPostBtn = document.querySelector('#copyPost')
const telegramLink = document.querySelector('#telegramLink')
const whatsappLink = document.querySelector('#whatsappLink')
const xLink = document.querySelector('#xLink')
const iosTip = document.querySelector('#iosTip')

let deferredInstallPrompt = null
let currentDaily = null
const SIGNATURE_TAGLINE = 'We do not just upskill, we make it pay out. Changing the script this year.'
const SIGN_OFF = 'Signed, TADS'

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
const inStandalone = window.matchMedia('(display-mode: standalone)').matches

if (isIos && !inStandalone) {
  iosTip.hidden = false
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredInstallPrompt = event
  installBtn.hidden = false
})

installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return
  deferredInstallPrompt.prompt()
  await deferredInstallPrompt.userChoice
  deferredInstallPrompt = null
  installBtn.hidden = true
})

formEl.addEventListener('submit', async (event) => {
  event.preventDefault()

  const fd = new FormData(formEl)
  const topic = String(fd.get('topic') || '').trim()
  const audience = String(fd.get('audience') || '').trim()
  const goal = String(fd.get('goal') || '').trim()
  const tone = String(fd.get('tone') || 'insightful').trim()
  const community = String(fd.get('community') || 'general').trim()

  generateBtn.disabled = true
  statusEl.textContent = 'Generating daily content...'

  try {
    const post = await generateWithGroq({ topic, audience, goal, tone, community })
    const normalizedPost = normalizePost(post)
    const imageUrl = await buildImageUrl(normalizedPost.imagePrompt || topic)
    currentDaily = { ...normalizedPost, imageUrl, topic, audience, goal, tone, community }
    renderResult(currentDaily)
    setShareLinks(currentDaily)
    statusEl.textContent = 'Done. Ready to share.'
  } catch (error) {
    statusEl.textContent = error.message || 'Failed to generate content.'
  } finally {
    generateBtn.disabled = false
  }
})

generateMogulsBtn.addEventListener('click', () => {
  const topicInput = formEl.elements.namedItem('topic')
  const audienceInput = formEl.elements.namedItem('audience')
  const goalInput = formEl.elements.namedItem('goal')
  const toneInput = formEl.elements.namedItem('tone')
  const communityInput = formEl.elements.namedItem('community')

  if (topicInput && !topicInput.value.trim()) {
    topicInput.value = 'Building income-ready digital skills in 2026'
  }

  audienceInput.value = '26 Moguls members'
  goalInput.value = 'Equip members with practical steps that turn skills into payout this week'
  toneInput.value = 'bold'
  communityInput.value = '26-moguls'

  formEl.requestSubmit()
})

shareNativeBtn.addEventListener('click', async () => {
  if (!currentDaily) {
    statusEl.textContent = 'Generate a daily first.'
    return
  }

  const text = buildShareText(currentDaily)

  if (!navigator.share) {
    await navigator.clipboard.writeText(text)
    statusEl.textContent = 'Native share not available. Copied text to clipboard.'
    return
  }

  try {
    await navigator.share({
      title: currentDaily.title,
      text,
      url: window.location.href,
    })
  } catch {
    statusEl.textContent = 'Share canceled.'
  }
})

shareFileBtn.addEventListener('click', async () => {
  if (!currentDaily) {
    statusEl.textContent = 'Generate a daily first.'
    return
  }

  try {
    const blob = await createShareImage(currentDaily)
    const file = new File([blob], `lunixdailies-${dateTag()}.png`, { type: 'image/png' })
    const shareText = buildShareText(currentDaily)

    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({
        title: currentDaily.title,
        text: shareText,
        files: [file],
      })
      return
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lunixdailies-${dateTag()}.png`
    a.click()
    URL.revokeObjectURL(url)
    statusEl.textContent = 'File sharing unavailable here. Downloaded image instead.'
  } catch (error) {
    statusEl.textContent = error.message || 'Could not prepare share image.'
  }
})

copyPostBtn.addEventListener('click', async () => {
  if (!currentDaily) {
    statusEl.textContent = 'Generate a daily first.'
    return
  }

  await navigator.clipboard.writeText(buildShareText(currentDaily))
  statusEl.textContent = 'Post copied to clipboard.'
})

async function generateWithGroq({ topic, audience, goal, tone, community }) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    throw new Error('Missing VITE_GROQ_API_KEY. Add it in your .env file.')
  }

  const isMoguls = community === '26-moguls'
  const effectiveAudience = isMoguls ? 'Members of the 26 Moguls community' : audience
  const effectiveGoal = isMoguls
    ? `${goal}. Emphasize that this community does not only upskill, it turns skills into measurable payouts.`
    : goal

  const communityInstructions = isMoguls
    ? [
        'This post is specifically for the 26 Moguls community.',
        'Address them directly as "26 Moguls" in the copy.',
        'Reinforce the mission: not just upskill, but make sure skills pay out in real outcomes.',
        'Use a confident line about changing the script this year.',
        'Keep it practical, action-heavy, and community-first.',
      ].join(' ')
    : 'This post is for a general audience.'

  const prompt = [
    'You are a social media strategist for a tech creator.',
    communityInstructions,
    'Write for cross-platform sharing: Telegram channels, WhatsApp groups, and X.',
    'Keep the copy practical and direct. Prioritize clear value and actions that can pay out quickly.',
    'Output plain text only. Do not use markdown formatting.',
    'Do not use double asterisks (**).',
    'Do not use em dash characters.',
    'Use at most 2 emojis total across the full post.',
    `Use this signature tagline idea in the close: "${SIGNATURE_TAGLINE}".`,
    `Always sign off with "${SIGN_OFF}".`,
    'Return only valid JSON with keys:',
    'title: short headline',
    'summary: 2 concise lines',
    'bullets: array of 4 high-value insights',
    'hashtags: array of 5 hashtags',
    'imagePrompt: vivid prompt for an image that matches the post.',
    `topic: ${topic}`,
    `audience: ${effectiveAudience}`,
    `goal: ${effectiveGoal}`,
    `tone: ${tone}`,
  ].join('\n')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: 'You produce structured daily social content in JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Groq request failed: ${response.status}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content

  try {
    return JSON.parse(content)
  } catch {
    const match = content?.match(/\{[\s\S]*\}/)
    if (match) {
      return JSON.parse(match[0])
    }
    throw new Error('Groq returned non-JSON content.')
  }
}

function renderResult(daily) {
  const bullets = (daily.bullets || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')
  const tags = (daily.hashtags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')

  resultEl.classList.remove('empty')
  resultEl.innerHTML = `
    <img src="${daily.imageUrl}" alt="Visual for ${escapeHtml(daily.topic)}" class="visual" />
    <h3>${escapeHtml(daily.title)}</h3>
    <p>${escapeHtml(daily.summary)}</p>
    <ul>${bullets}</ul>
    <div class="tags">${tags}</div>
    <p class="tiny muted">${escapeHtml(SIGNATURE_TAGLINE)}<br>${escapeHtml(SIGN_OFF)}</p>
  `
}

function setShareLinks(daily) {
  const text = encodeURIComponent(buildShareText(daily))
  const url = encodeURIComponent(window.location.href)

  telegramLink.href = `https://t.me/share/url?url=${url}&text=${text}`
  whatsappLink.href = `https://wa.me/?text=${text}`
  xLink.href = `https://twitter.com/intent/tweet?text=${text}`
}

function buildShareText(daily) {
  const bullets = (daily.bullets || []).map((item) => `• ${sanitizeForChannel(item)}`).join('\n')
  const tags = (daily.hashtags || []).map((tag) => sanitizeForChannel(tag)).join(' ')
  const isMoguls = daily.community === '26-moguls'

  const raw = [
    isMoguls ? '26 Moguls Daily' : 'LunixDailies',
    '',
    sanitizeForChannel(daily.title),
    '',
    sanitizeForChannel(daily.summary),
    '',
    bullets,
    '',
    tags,
    '',
    SIGNATURE_TAGLINE,
    SIGN_OFF,
    '',
    `Generated with LunixDailies · ${new Date().toLocaleDateString()}`,
  ].join('\n')

  return limitEmojiCount(raw, 2)
}

async function buildImageUrl(prompt) {
  const pixabayApiKey = import.meta.env.VITE_PIXABAY_API_KEY
  const themed = `${prompt} technology innovation business success`

  if (pixabayApiKey) {
    const pixabayUrl = await fetchPixabayImage(themed, pixabayApiKey)
    if (pixabayUrl) {
      return pixabayUrl
    }
  }

  const fallback = `${prompt}, black and gold editorial tech visual, high contrast, modern composition`
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(fallback)}?width=1200&height=800&nologo=true&seed=${Date.now()}`
}

async function createShareImage(daily) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#080808')
  gradient.addColorStop(1, '#171204')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#caa54b'
  ctx.font = '700 64px Georgia'
  ctx.fillText('LunixDailies', 80, 130)

  ctx.fillStyle = '#f5e6b8'
  ctx.font = '700 56px Georgia'
  wrapText(ctx, daily.title, 80, 250, 920, 64)

  ctx.fillStyle = '#d6c389'
  ctx.font = '400 34px Arial'
  const text = `${daily.summary}\n\n${(daily.bullets || []).slice(0, 3).map((b) => `• ${b}`).join('\n')}`
  wrapText(ctx, text, 80, 470, 920, 44)

  ctx.fillStyle = '#8f6b1d'
  ctx.fillRect(80, 1160, 920, 2)

  ctx.fillStyle = '#e5d5a2'
  ctx.font = '500 28px Arial'
  ctx.fillText(new Date().toDateString(), 80, 1210)

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create image blob.'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = String(text).split('\n')
  let cursorY = y

  for (const line of lines) {
    const words = line.split(' ')
    let current = ''

    for (const word of words) {
      const test = current ? `${current} ${word}` : word
      const width = ctx.measureText(test).width

      if (width > maxWidth) {
        ctx.fillText(current, x, cursorY)
        current = word
        cursorY += lineHeight
      } else {
        current = test
      }
    }

    if (current) {
      ctx.fillText(current, x, cursorY)
      cursorY += lineHeight
    }
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function dateTag() {
  return new Date().toISOString().slice(0, 10)
}

async function fetchPixabayImage(query, apiKey) {
  const pixabayQuery = toPixabayQuery(query)

  const params = new URLSearchParams({
    key: apiKey,
    q: pixabayQuery,
    image_type: 'photo',
    orientation: 'horizontal',
    category: 'business',
    safesearch: 'true',
    per_page: '20',
    order: 'popular',
  })

  try {
    const response = await fetch(`https://pixabay.com/api/?${params.toString()}`)
    if (!response.ok) {
      return ''
    }

    const data = await response.json()
    const hits = Array.isArray(data?.hits) ? data.hits : []
    const picked = hits.find((item) => item.webformatURL || item.largeImageURL)
    return picked?.largeImageURL || picked?.webformatURL || ''
  } catch {
    return ''
  }
}

function normalizePost(post) {
  return {
    title: sanitizeForChannel(post?.title || ''),
    summary: sanitizeForChannel(post?.summary || ''),
    bullets: Array.isArray(post?.bullets)
      ? post.bullets.slice(0, 4).map((item) => sanitizeForChannel(item))
      : [],
    hashtags: Array.isArray(post?.hashtags)
      ? post.hashtags.slice(0, 5).map((item) => sanitizeForChannel(item))
      : [],
    imagePrompt: sanitizeForChannel(post?.imagePrompt || ''),
  }
}

function sanitizeForChannel(value) {
  return String(value)
    .replaceAll('**', '')
    .replaceAll('—', '-')
    .replaceAll('–', '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function limitEmojiCount(text, maxEmojis) {
  const emojiRegex = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu
  let seen = 0
  return String(text).replace(emojiRegex, (emoji) => {
    seen += 1
    return seen <= maxEmojis ? emoji : ''
  })
}

function toPixabayQuery(input) {
  const cleaned = String(input)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = cleaned.split(' ').filter((word) => word.length > 2)
  const limitedWords = words.slice(0, 10)
  let query = limitedWords.join(' ')

  if (!query) {
    query = 'technology business innovation'
  }

  if (query.length > 95) {
    query = query.slice(0, 95).trim()
  }

  return query
}
