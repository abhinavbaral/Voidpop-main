import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CoverWall from '../components/CoverWall'
import SwipeButton from '../components/SwipeButton'
import Logo from '../components/Logo' // your existing countdown-ring V logo; adjust the path or name
import { getCoversForWelcome } from '../lib/swipeCovers'

const COPY = {
  title: 'Track every anime, manga and novel',
  sub: 'Keep your lists, get airing alerts and find what to watch or read next.',
  button: 'Swipe to start',
}

export default function WelcomeScreen({ onStart }) {
  const insets = useSafeAreaInsets()
  const [covers, setCovers] = useState(null)

  useEffect(() => {
    let live = true
    getCoversForWelcome().then((c) => live && setCovers(c)).catch(() => {})
    return () => { live = false }
  }, [])

  return (
    <View style={s.root}>
      {covers && <CoverWall covers={covers} />}
      <View style={[s.content, { paddingBottom: insets.bottom + 28 }]}>
        <Logo size={72} />
        <Text style={s.title} accessibilityRole="header">{COPY.title}</Text>
        <Text style={s.sub}>{COPY.sub}</Text>
        <SwipeButton
          label={COPY.button}
          knobSource={require('../../assets/voidmon/voidmon-corrupted-knob.png')}
          onComplete={onStart}
        />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 28, gap: 14 },
  title: { color: '#fff', fontSize: 36, fontWeight: '800', textAlign: 'center', lineHeight: 42, marginTop: 10 },
  sub: { color: 'rgba(255,255,255,0.78)', fontSize: 16, lineHeight: 23, textAlign: 'center', marginBottom: 18, maxWidth: 340 },
})
