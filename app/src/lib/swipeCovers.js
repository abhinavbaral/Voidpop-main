import AsyncStorage from '@react-native-async-storage/async-storage'
import { Image } from 'expo-image'

const SET_KEY = 'swipe-set'
const LAST_KEY = 'swipe-last-first'
const DAY = 86400000
const POOL = 15 // 3 columns x 5 covers; fewer than 5 per column breaks the seamless loop

const QUERY = `query { Page(perPage: 30) {
  media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { id coverImage { extraLarge color } } } }`

// Used until the first download finishes. Colour tiles only, so no artwork ships inside the app.
export const FALLBACK = [
  '#2a1340', '#1a0f2e', '#3b1d5c', '#14081f', '#2e1458', '#1d0e33', '#40226b', '#120a1f',
  '#331a52', '#1b0d2b', '#2b1648', '#190c2a', '#3a1f60', '#150a24', '#2d1650',
].map((color, i) => ({ id: `f${i}`, color }))

const sleep = (ms) => new Promise((r) => setTimeout(() => r(null), ms))

// Fetches fresh covers, saves them to disk, and only then replaces the stored set.
async function refresh() {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY }),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const media = (await res.json())?.data?.Page?.media ?? []
    const items = media
      .filter((m) => m.coverImage?.extraLarge)
      .slice(0, POOL)
      .map((m) => ({ id: m.id, uri: m.coverImage.extraLarge, color: m.coverImage.color }))
    if (items.length < POOL) return null
    const ok = await Promise.all(items.map((i) => Image.prefetch(i.uri)))
    if (!ok.every(Boolean)) return null // keep the old set if any image failed
    await AsyncStorage.setItem(SET_KEY, JSON.stringify({ at: Date.now(), items }))
    return items
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function loadSet() {
  const raw = await AsyncStorage.getItem(SET_KEY)
  const cached = raw ? JSON.parse(raw) : null
  if (!cached || Date.now() - cached.at > DAY) {
    const fresh = refresh()
    // First ever launch: wait briefly so the first screen can already show real covers.
    if (!cached) return (await Promise.race([fresh, sleep(2500)])) ?? FALLBACK
    // Otherwise refresh in the background; the new set appears on the next open.
  }
  return cached?.items ?? FALLBACK
}

// A different order every open, and never the same cover first twice in a row.
export async function getCoversForWelcome() {
  const set = await loadSet()
  const order = [...set]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const last = await AsyncStorage.getItem(LAST_KEY)
  if (order.length > 1 && String(order[0].id) === last) order.push(order.shift())
  await AsyncStorage.setItem(LAST_KEY, String(order[0].id))
  return order
}
