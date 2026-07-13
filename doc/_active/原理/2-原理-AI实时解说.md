# AI 实时解说 — 原理

> 2026-07-08

## 概述

AI 实时解说系统通过监听游戏事件，调用大语言模型（LLM）生成捧哏风格的解说文本，再通过 TTS 语音合成朗读出来。支持两种 TTS 引擎：浏览器内置 SpeechSynthesis 和小米 MiMo 语音克隆（可复刻特定人物音色，如于谦的捧哏声线）。LLM 调用失败时自动降级到预设模板。

## 架构

```
游戏事件（10 种）
    ↓  queue(eventType, context)
CommentaryService
    ├─ 优先级队列（0-5 级，数字越小越优先）
    ├─ 冷却检查（各类事件独立 CD）
    ├─ 去重（同类型事件不重复入队）
    ├─ 文本生成
    │   ├─ useLLM=true  → fetch() → DeepSeek API → 成功返回捧哏文本
    │   │                            └─ 失败/超时(5s) → 降级模板
    │   └─ useLLM=false → 随机选模板
    └─ TTS 播放（双引擎）
        ├─ 浏览器内置：SpeechSynthesisUtterance（zh-CN）
        └─ MiMo 语音克隆：mimo-v2.5-tts-voiceclone API
             ├─ POST 文本 + base64 语音样本 → 返回 base64 音频
             ├─ Web Audio API decodeAudioData → BufferSource 播放
             └─ 失败降级到浏览器内置 TTS
```

## 事件表

| 事件 | 优先级 | 冷却 | 调 LLM | 触发位置 |
|------|--------|------|--------|---------|
| player_death | 0（最高） | 无 | 是 | GameScene.update() HP=0 |
| victory | 0 | 无 | 是 | GameScene._respawnEnemies() wave>=5 |
| game_start | 1 | 无 | 是 | GameScene.startGame() |
| wave_start | 1 | 5s | 是 | GameScene._respawnEnemies() |
| new_record | 1 | 5s | 是 | GameScene._checkHighScore() |
| wave_clear | 2 | 3s | 是 | GameScene.update() 敌全灭 |
| low_hp | 2 | 8s | 是 | GameScene.update() HP≤30 |
| enemy_kill | 3 | 2.5s | 否 | Game.update() 射击击杀 |
| player_hurt | 3 | 3s | 否 | Player.takeDamage() |
| health_pickup | 4 | 5s | 否 | Player.pickupItems() |
| pause/unpause | 5 | 2s | 否 | Game keydown P 键 |

## LLM 调用

使用 OpenAI 兼容的 Chat Completions API，支持 DeepSeek 等任何兼容端点。

```
POST {endpoint}
Body: {
    model: "deepseek-v4-pro",
    messages: [
        { role: "system", content: "<解说风格 prompt>" },
        { role: "user", content: "<事件上下文>" }
    ],
    max_tokens: 80,
    temperature: 0.9
}
```

每个 LLM 事件有对应的 `PROMPT_BUILDERS` 函数，将游戏状态（HP、分数、波次、敌人数等）拼成简短提示词。请求超时 5 秒（AbortController），失败静默降级。

## TTS 播放

### 浏览器内置（默认）

```js
const utter = new SpeechSynthesisUtterance(text)
utter.lang = "zh-CN"
utter.rate = 1.05
utter.voice = voices.find(v => v.lang.startsWith("zh-CN"))
speechSynthesis.speak(utter)
```

零依赖、零延迟。通过 `onend` / `onerror` 回调驱动队列。

### MiMo 语音克隆（于谦捧哏）

调用小米 MiMo v2.5 语音克隆 API，用预先上传的于谦语音样本（3-10 秒 wav）复刻音色：

```
POST https://api.xiaomimimo.com/v1/chat/completions
Header: api-key: <MIMO_API_KEY>
Body: {
    model: "mimo-v2.5-tts-voiceclone",
    messages: [{ role: "assistant", content: "<解说文本>" }],
    audio: { voice: "data:audio/wav;base64,<语音样本>", format: "wav" }
}
Response: choices[0].message.audio.data → base64 wav
```

返回的 base64 音频通过 Web Audio API 解码播放：

```js
const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer)
const source = audioCtx.createBufferSource()
source.buffer = audioBuffer
source.connect(audioCtx.destination)
source.start()
```

MiMo TTS 失败时自动降级到浏览器内置 TTS。

## 配置持久化

设置面板的值通过 `localStorage` 持久化：

`commentary_config`：
```json
{
    "endpoint": "https://api.deepseek.com/v1/chat/completions",
    "apiKey": "sk-...",
    "model": "deepseek-v4-pro",
    "ttsEnabled": true,
    "ttsVolume": 0.8,
    "commentaryEnabled": true,
    "ttsProvider": "mimo",
    "mimoApiKey": "sk-..."
}
```

`commentary_voice_sample`：语音样本的 base64 编码（单独存储，避免 JSON 体积过大）。

## 关键设计决策

- **LLM 为主、模板兜底**：LLM 带来不可预测的趣味性，模板保证最低可用
- **高频事件不调 LLM**：击杀和受伤每秒可能触发多次，全调 API 费用高、延迟积压
- **优先级中断**：死亡/胜利时立即打断当前播放（浏览器 TTS 用 `speechSynthesis.cancel()`，MiMo 用 `source.stop()`）
- **去重机制**：同类型事件已在队列中或正在等 LLM 响应时，新事件直接丢弃
- **双 TTS 引擎**：MiMo 语音克隆可复刻于谦的捧哏音色，失败自动降级到浏览器内置 TTS
- **语音样本分离存储**：base64 样本单独存 `commentary_voice_sample` key，避免 JSON 过大
