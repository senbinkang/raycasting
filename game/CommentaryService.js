// CommentaryService.js
// AI 实时解说服务：事件队列 → LLM 文本生成（模板兜底）→ TTS 语音播放
// 挂到 window.commentaryService

const SYSTEM_PROMPT = `你是一个幽默吐槽风格的实时游戏解说员，为一个第一人称射击游戏（类似 Wolfenstein 3D）做解说。

规则：
- 用中文，1-2 句话，不超过 40 字
- 毒舌但友善，像损友在旁边吐槽
- 根据事件类型调整语气：击杀时夸一下，受伤时损一下，关键时刻紧张一下
- 不要每次都说一样的套话
- 不要用"玩家"来称呼，用"你"直接对玩家说话
- 不要加引号、动作描述或任何格式标记，只输出纯解说文本`

const EVENT_RULES = {
    player_death:     { priority: 0, cooldown: 0,   useLLM: true },
    victory:          { priority: 0, cooldown: 0,   useLLM: true },
    wave_start:       { priority: 1, cooldown: 5,   useLLM: true },
    new_record:       { priority: 1, cooldown: 5,   useLLM: true },
    game_start:       { priority: 1, cooldown: 0,   useLLM: true },
    wave_clear:       { priority: 2, cooldown: 3,   useLLM: true },
    low_hp:           { priority: 2, cooldown: 8,   useLLM: true },
    enemy_kill:       { priority: 3, cooldown: 2.5, useLLM: false },
    player_hurt:      { priority: 3, cooldown: 3,   useLLM: false },
    health_pickup:    { priority: 4, cooldown: 5,   useLLM: false },
    pause:            { priority: 5, cooldown: 2,   useLLM: false },
    unpause:          { priority: 5, cooldown: 2,   useLLM: false },
}

const TEMPLATES = {
    enemy_kill: [
        "漂亮！下一个！",
        "一枪带走，不送。",
        "这枪法还行嘛。",
        "击杀！敌人表示不服。",
        "又倒一个，你是来进货的吗？",
        "敌人：我还没出手就没了？",
        "可以可以，继续保持。",
    ],
    player_hurt: [
        "哎哟！疼不疼？",
        "你是用脸接子弹吗？",
        "躲一下啊大哥！",
        "又挨打了，走位走位！",
        "血量在哭泣。",
        "你这身法，我奶奶都比你灵活。",
        "疼吗？疼就对了。",
    ],
    health_pickup: [
        "回血了，珍惜这条命吧。",
        "医疗包：又救了你一命。",
        "捡到医疗包，你又可以浪了。",
        "续命成功！",
        "包扎一下，继续挨打。",
    ],
    pause: ["休息一下，喘口气。", "暂停了，敌人等你回来。", "中场休息？行吧。"],
    unpause: ["回来了！敌人还在。", "继续战斗！", "休息够了？开打！"],
}

const PROMPT_BUILDERS = {
    game_start: () => "游戏开始了！玩家进入地图准备迎战。",
    wave_start: (ctx) => `第 ${ctx.wave} 波来了！共 ${ctx.enemyCount} 个敌人。HP: ${ctx.hp}/${ctx.maxHp}，当前分数: ${ctx.score}`,
    wave_clear: (ctx) => `第 ${ctx.wave} 波全部消灭！准备进入下一波。HP: ${ctx.hp}/${ctx.maxHp}，分数: ${ctx.score}`,
    victory: (ctx) => `通关了！5 波全部消灭。最终分数: ${ctx.score}${ctx.isNewRecord ? "，新纪录！" : ""}`,
    player_death: (ctx) => `游戏结束。死在波次 ${ctx.wave}，分数: ${ctx.score}${ctx.isNewRecord ? "，不过破了纪录！" : ""}，最高分: ${ctx.highScore}`,
    low_hp: (ctx) => `血量危险！只剩 ${ctx.hp} 点血，满分 ${ctx.maxHp}。场上还有 ${ctx.enemyCount} 个敌人。`,
    new_record: (ctx) => `新纪录！${ctx.score} 分！`,
}

class CommentaryService {
    constructor() {
        this.enabled = true
        this.ttsEnabled = true
        this.ttsVolume = 0.8
        this._eventQueue = []
        this.cooldowns = {}
        this._speaking = false
        this._pendingLLM = null
    }

    queue(eventType, context = {}) {
        if (!this.enabled) return
        const rule = EVENT_RULES[eventType]
        if (!rule) return

        const now = performance.now() / 1000
        if (rule.cooldown > 0) {
            const last = this.cooldowns[eventType] || 0
            if (now - last < rule.cooldown) return
        }
        if (this._eventQueue.some(e => e.type === eventType)) return
        if (this._pendingLLM === eventType) return

        this._eventQueue.push({ type: eventType, context, priority: rule.priority, useLLM: rule.useLLM })
        this._eventQueue.sort((a, b) => a.priority - b.priority)
    }

    update(_dt) {
        if (this._eventQueue.length === 0) return
        if (this._speaking) {
            if (this._eventQueue[0].priority === 0) {
                speechSynthesis.cancel()
                this._speaking = false
            } else {
                return
            }
        }
        this._processNext()
    }

    async _processNext() {
        if (this._eventQueue.length === 0) return
        const event = this._eventQueue.shift()

        this.cooldowns[event.type] = performance.now() / 1000

        const text = await this._generateText(event.type, event.context)
        if (text) this._speak(text)
        else this._processNext()
    }

    async _generateText(eventType, context) {
        const rule = EVENT_RULES[eventType]
        if (rule && rule.useLLM) {
            this._pendingLLM = eventType
            const llmText = await this._callLLM(eventType, context)
            this._pendingLLM = null
            if (llmText) return llmText
        }
        return this._getTemplate(eventType)
    }

    _getTemplate(eventType) {
        const arr = TEMPLATES[eventType]
        if (!arr || arr.length === 0) return null
        return arr[Math.floor(Math.random() * arr.length)]
    }

    async _callLLM(eventType, context) {
        const config = this.loadConfig()
        if (!config.apiKey || !config.endpoint) return null

        const prompt = PROMPT_BUILDERS[eventType] ? PROMPT_BUILDERS[eventType](context) : ""
        if (!prompt) return null

        try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 5000)

            const resp = await fetch(config.endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model || "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 80,
                    temperature: 0.9
                }),
                signal: controller.signal
            })
            clearTimeout(timeout)
            const data = await resp.json()
            const text = data.choices?.[0]?.message?.content?.trim()
            return text || null
        } catch (_e) {
            return null
        }
    }

    _speak(text) {
        if (!text) { this._processNext(); return }
        if (!this.ttsEnabled) { this._processNext(); return }

        const voices = speechSynthesis.getVoices()
        const zhVoice = voices.find(v => v.lang.startsWith("zh-CN")) ||
                        voices.find(v => v.lang.startsWith("zh"))

        const utter = new SpeechSynthesisUtterance(text)
        utter.lang = "zh-CN"
        utter.rate = 1.05
        utter.pitch = 1.0
        utter.volume = this.ttsVolume
        if (zhVoice) utter.voice = zhVoice

        this._speaking = true
        utter.onend = () => { this._speaking = false; this._processNext() }
        utter.onerror = () => { this._speaking = false; this._processNext() }
        speechSynthesis.speak(utter)
    }

    loadConfig() {
        try { return JSON.parse(localStorage.getItem("commentary_config") || "{}") }
        catch (_) { return {} }
    }

    saveConfig(config) {
        try { localStorage.setItem("commentary_config", JSON.stringify(config)) }
        catch (_) { /* quota exceeded, ignore */ }
    }

    initUI() {
        const cfg = this.loadConfig()

        const endpointEl = document.getElementById("cfg-endpoint")
        const apikeyEl = document.getElementById("cfg-apikey")
        const modelEl = document.getElementById("cfg-model")
        const ttsEl = document.getElementById("cfg-tts")
        const volumeEl = document.getElementById("cfg-volume")
        const enabledEl = document.getElementById("cfg-enabled")

        if (endpointEl) endpointEl.value = cfg.endpoint || "https://api.deepseek.com/v1/chat/completions"
        if (apikeyEl) apikeyEl.value = cfg.apiKey || ""
        if (modelEl) modelEl.value = cfg.model || "deepseek-v4-pro"
        if (ttsEl) ttsEl.checked = cfg.ttsEnabled !== false
        if (volumeEl) volumeEl.value = (cfg.ttsVolume !== undefined ? cfg.ttsVolume : 0.8) * 100
        if (enabledEl) enabledEl.checked = cfg.commentaryEnabled !== false

        this.enabled = cfg.commentaryEnabled !== false
        this.ttsEnabled = cfg.ttsEnabled !== false
        this.ttsVolume = cfg.ttsVolume !== undefined ? cfg.ttsVolume : 0.8

        const save = () => {
            const newCfg = {
                endpoint: endpointEl?.value || "",
                apiKey: apikeyEl?.value || "",
                model: modelEl?.value || "gpt-3.5-turbo",
                ttsEnabled: ttsEl?.checked ?? true,
                ttsVolume: (parseInt(volumeEl?.value) || 80) / 100,
                commentaryEnabled: enabledEl?.checked ?? true,
            }
            this.saveConfig(newCfg)
            this.enabled = newCfg.commentaryEnabled
            this.ttsEnabled = newCfg.ttsEnabled
            this.ttsVolume = newCfg.ttsVolume
        }

        endpointEl?.addEventListener("input", save)
        apikeyEl?.addEventListener("input", save)
        modelEl?.addEventListener("input", save)
        ttsEl?.addEventListener("change", save)
        volumeEl?.addEventListener("input", save)
        enabledEl?.addEventListener("change", save)
    }
}

window.commentaryService = new CommentaryService()
