// generate_audio_cache.mjs
// 一次性脚本：用 MiMo API 为所有模板文本预生成克隆音频，输出 JS 缓存文件
// 用法：node scripts/generate_audio_cache.mjs

import { readFileSync, writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

const MIMO_API_KEY = process.env.MIMO_API_KEY
if (!MIMO_API_KEY) {
    console.error("请设置 MIMO_API_KEY 环境变量")
    process.exit(1)
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

async function callMimo(text, voiceBase64) {
    const resp = await fetch("https://api.xiaomimimo.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "api-key": MIMO_API_KEY,
        },
        body: JSON.stringify({
            model: "mimo-v2.5-tts-voiceclone",
            messages: [{ role: "assistant", content: text }],
            audio: { voice: `data:audio/wav;base64,${voiceBase64}`, format: "wav" },
        }),
    })
    const data = await resp.json()
    const audio = data.choices?.[0]?.message?.audio?.data
    if (!audio) throw new Error(`MiMo 返回无音频数据: ${JSON.stringify(data)}`)
    return audio
}

async function main() {
    // 1. 读取语音样本
    const wavPath = resolve(ROOT, "assets", "yuqian_voice_sample.wav")
    const wavBuffer = readFileSync(wavPath)
    const voiceBase64 = wavBuffer.toString("base64")
    console.log(`语音样本加载完成: ${(wavBuffer.length / 1024).toFixed(1)} KB`)

    // 2. 生成 CommentaryVoiceSample.js
    const voiceSampleJS = `// CommentaryVoiceSample.js — 自动生成，勿手动编辑
// 于谦语音样本 base64，供 MiMo 语音克隆使用
window.__COMMENTARY_VOICE_SAMPLE__ = ${JSON.stringify(voiceBase64)};
`
    writeFileSync(resolve(ROOT, "game", "CommentaryVoiceSample.js"), voiceSampleJS)
    console.log("CommentaryVoiceSample.js 已生成")

    // 3. 遍历所有模板，调用 MiMo 生成音频
    const cache = {}  // { "文本": "base64音频" }
    let total = 0, done = 0
    for (const arr of Object.values(TEMPLATES)) total += arr.length

    for (const [category, texts] of Object.entries(TEMPLATES)) {
        for (const text of texts) {
            done++
            process.stdout.write(`[${done}/${total}] ${category}: ${text} ... `)
            try {
                const audioBase64 = await callMimo(text, voiceBase64)
                cache[text] = audioBase64
                console.log("OK")
            } catch (e) {
                console.log(`失败: ${e.message}`)
            }
        }
    }

    // 4. 生成 CommentaryAudioCache.js
    const cacheJS = `// CommentaryAudioCache.js — 自动生成，勿手动编辑
// 预生成的模板音频缓存，key = 文本，value = base64 WAV 音频
window.__COMMENTARY_AUDIO_CACHE__ = ${JSON.stringify(cache)};
`
    writeFileSync(resolve(ROOT, "game", "CommentaryAudioCache.js"), cacheJS)
    console.log(`\nCommentaryAudioCache.js 已生成 (${Object.keys(cache).length}/${total} 条成功)`)
}

main().catch(e => { console.error(e); process.exit(1) })
