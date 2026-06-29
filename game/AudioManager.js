// AudioManager.js
// Web Audio API 封装：程序化合成所有游戏音效，无需音频文件
// 用法：window.audioManager.playShoot() / playStep() / playDoor() / playHit() / playBgm()

class AudioManager {
    constructor() {
        this.ctx = null
        this.bgmGain = null
        this.bgmOsc = null
        this.bgmStarted = false
        this.stepTimer = 0
        this.stepInterval = 0.4   // 走路脚步声间隔（秒）
    }

    _init() {
        if (this.ctx) return
        this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    }

    _resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume()
        }
    }

    // 合成一个指定频率、时长的正弦波
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

    // 噪声缓冲
    _noise(duration, volume = 0.3) {
        this._init()
        const ctx = this.ctx
        const bufSize = ctx.sampleRate * duration
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
        const src = ctx.createBufferSource()
        src.buffer = buf
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(volume, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
        src.connect(gain)
        gain.connect(ctx.destination)
        src.start()
    }

    // 射击：高频"砰"一声
    playShoot() {
        this._init()
        this._resume()
        // 低频主体
        this._tone(150, 0.12, 'sawtooth', 0.4)
        // 噪声叠加
        this._noise(0.08, 0.3)
        // 高频"嗖"
        this._tone(800, 0.06, 'sine', 0.1)
    }

    // 敌人受伤：短促中频
    playHit() {
        this._init()
        this._resume()
        this._tone(220, 0.15, 'square', 0.2)
        this._noise(0.1, 0.15)
    }

    // 敌人死亡：下行音调
    playEnemyDeath() {
        this._init()
        this._resume()
        const ctx = this.ctx
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(300, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.3)
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.3)
    }

    // 走路脚步声：低频"咚咚"，每 stepInterval 秒触发一次
    playStep() {
        this._init()
        this._resume()
        this._tone(80, 0.08, 'sine', 0.25)
        this._noise(0.05, 0.1)
    }

    // 按间隔自动触发脚步声（调用方每帧传入 dt）
    updateStep(dt, isMoving) {
        if (!isMoving) { this.stepTimer = 0; return }
        this.stepTimer += dt
        if (this.stepTimer >= this.stepInterval) {
            this.stepTimer = 0
            this.playStep()
        }
    }

    // 背景音乐：低频持续环境音（简单循环）
    startBgm() {
        if (this.bgmStarted) return
        this._init()
        this._resume()
        const ctx = this.ctx
        // 叠加几个低频振荡器，营造低沉环境音
        const freqs = [55, 73, 110, 147]
        this.bgmGain = ctx.createGain()
        this.bgmGain.gain.setValueAtTime(0, ctx.currentTime)
        this.bgmGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.5)
        this.bgmGain.connect(ctx.destination)
        freqs.forEach(f => {
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.value = f
            osc.connect(this.bgmGain)
            osc.start()
        })
        this.bgmStarted = true
    }

    stopBgm() {
        if (!this.bgmGain) return
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

// 挂到全局，供其他模块调用
window.audioManager = new AudioManager()
