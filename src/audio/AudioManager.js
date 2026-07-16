export class AudioManager {
    constructor() {
        this.ctx = null
        this.bgmGain = null
        this.bgmOsc = null
        this.bgmStarted = false
        this.stepTimer = 0
        this.stepInterval = 0.4
    }

    _init() {
        if (this.ctx) {return}
        this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    }

    _resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume()
        }
    }

    _tone(freq, duration, type = 'sine', volume = 0.3) {
        this._init()
        const ctx = this.ctx
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = type
        osc.frequency.setValueAtTime(freq, ctx.currentTime)
        gain.gain.setValueAtTime(volume, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + duration)
    }

    _noise(duration, volume = 0.3) {
        this._init()
        const ctx = this.ctx
        const bufSize = ctx.sampleRate * duration
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) {data[i] = Math.random() * 2 - 1}
        const src = ctx.createBufferSource()
        src.buffer = buf
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(volume, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
        src.connect(gain)
        gain.connect(ctx.destination)
        src.start()
    }

    playShoot() {
        this._init()
        this._resume()
        this._tone(150, 0.12, 'sawtooth', 0.4)
        this._noise(0.08, 0.3)
        this._tone(800, 0.06, 'sine', 0.1)
    }

    playHit() {
        this._init()
        this._resume()
        this._tone(220, 0.15, 'square', 0.2)
        this._noise(0.1, 0.15)
    }

    playEnemyDeath(type) {
        this._init()
        this._resume()
        const ctx = this.ctx
        let startFreq = 300,
            duration = 0.3,
            vol = 0.3
        if (type === 203) {
            startFreq = 600
            duration = 0.15
        } else if (type === 204) {
            startFreq = 120
            duration = 0.5
            vol = 0.4
        }
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(startFreq, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + duration)
        gain.gain.setValueAtTime(vol, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + duration)
    }

    playPlayerHurt() {
        this._init()
        this._resume()
        this._tone(100, 0.2, 'sawtooth', 0.35)
        this._noise(0.12, 0.25)
    }

    playStep() {
        this._init()
        this._resume()
        this._tone(80, 0.08, 'sine', 0.25)
        this._noise(0.05, 0.1)
    }

    updateStep(dt, isMoving) {
        if (!isMoving) {
            this.stepTimer = 0
            return
        }
        this.stepTimer += dt
        if (this.stepTimer >= this.stepInterval) {
            this.stepTimer = 0
            this.playStep()
        }
    }

    startBgm() {
        if (this.bgmStarted) {return}
        this._init()
        this._resume()
        const ctx = this.ctx
        const freqs = [55, 73, 110, 147]
        this.bgmGain = ctx.createGain()
        this.bgmGain.gain.setValueAtTime(0, ctx.currentTime)
        this.bgmGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.5)
        this.bgmGain.connect(ctx.destination)
        freqs.forEach((f) => {
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.value = f
            osc.connect(this.bgmGain)
            osc.start()
        })
        this.bgmStarted = true
    }

    stopBgm() {
        if (!this.bgmGain) {return}
        const ctx = this.ctx
        this.bgmGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
        setTimeout(() => {
            if (this.bgmGain) {
                this.bgmGain.disconnect()
                this.bgmGain = null
            }
        }, 600)
        this.bgmStarted = false
    }
}

window.audioManager = new AudioManager()
