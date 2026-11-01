import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'

const sirenSource = require('../../assets/sounds/new-order.wav') as number

let player: AudioPlayer | null = null
let playing = false

function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(sirenSource)
    player.loop = true
    player.volume = 1
  }

  return player
}

export async function startSiren(): Promise<void> {
  if (playing) {
    return
  }

  playing = true

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    })
  } catch {
    // Audio mode is best-effort; playback below may still work.
  }

  const current = getPlayer()
  current.loop = true
  current.volume = 1
  current.play()
}

export function stopSiren(): void {
  playing = false

  if (!player) {
    return
  }

  player.pause()
  void player.seekTo(0)
}

export function isSirenPlaying(): boolean {
  return playing
}
