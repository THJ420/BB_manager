import { Buffer } from 'node:buffer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sampleRate = 44100
const seconds = 4
const totalSamples = sampleRate * seconds
const data = Buffer.alloc(44 + totalSamples * 2)

data.write('RIFF', 0)
data.writeUInt32LE(36 + totalSamples * 2, 4)
data.write('WAVE', 8)
data.write('fmt ', 12)
data.writeUInt32LE(16, 16)
data.writeUInt16LE(1, 20)
data.writeUInt16LE(1, 22)
data.writeUInt32LE(sampleRate, 24)
data.writeUInt32LE(sampleRate * 2, 28)
data.writeUInt16LE(2, 32)
data.writeUInt16LE(16, 34)
data.write('data', 36)
data.writeUInt32LE(totalSamples * 2, 40)

const fadeSamples = Math.round(sampleRate * 0.012)

for (let i = 0; i < totalSamples; i += 1) {
  const time = i / sampleRate
  const period = 0.25
  const highTone = Math.floor(time / period) % 2 === 0
  const frequency = highTone ? 880 : 660
  const fade = Math.min(1, i / fadeSamples, (totalSamples - 1 - i) / fadeSamples)
  const value = Math.sin(2 * Math.PI * frequency * time) * 0.35 * fade
  data.writeInt16LE(Math.round(value * 32767), 44 + i * 2)
}

const here = dirname(fileURLToPath(import.meta.url))
const output = resolve(here, '../assets/sounds/new-order.wav')
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, data)
console.log(`Wrote ${output} (${data.length} bytes, ${seconds}s)`)
