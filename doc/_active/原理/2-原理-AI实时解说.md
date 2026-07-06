# AI 实时解说 — 原理

> 2026-07-07

## 概述

AI 实时解说系统通过监听游戏事件，调用大语言模型（LLM）生成幽默吐槽风格的解说文本，再通过浏览器内置的 Web Speech API 朗读出来。LLM 调用失败时自动降级到预设模板，保证解说不会中断。

## 架构

```
游戏事件（10 种）
    ↓  queue(eventType, context)
CommentaryService
    ├─ 优先级队列（0-5 级，数字越小越优先）
    ├─ 冷却检查（各类事件独立 CD）
    ├─ 去重（同类型事件不重复入队）
    ├─ 文本生成
    │   ├─ useLLM=true  → fetch() → LLM API → 成功返回文本
    │   │                            └─ 失败/超时(5s) → 降级模板
    │   └─ useLLM=false → 随机选模板
    └─ TTS 播放
        ├─ SpeechSynthesisUtterance（zh-CN）
        ├─ 优先级 0 事件可中断当前播放（speechSynthesis.cancel()）
        └─ onend/onerror 自动处理下一条
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

Web Speech API 的 `SpeechSynthesis`，无需任何外部依赖：

```js
const utter = new SpeechSynthesisUtterance(text)
utter.lang = "zh-CN"
utter.rate = 1.05
utter.voice = voices.find(v => v.lang.startsWith("zh-CN"))
speechSynthesis.speak(utter)
```

播放通过 `onend` / `onerror` 回调驱动队列自动消费下一条。

## 配置持久化

设置面板的值通过 `localStorage` 持久化，key 为 `commentary_config`：

```json
{
    "endpoint": "https://api.deepseek.com/v1/chat/completions",
    "apiKey": "sk-...",
    "model": "deepseek-v4-pro",
    "ttsEnabled": true,
    "ttsVolume": 0.8,
    "commentaryEnabled": true
}
```

## 关键设计决策

- **LLM 为主、模板兜底**：LLM 带来不可预测的趣味性，模板保证最低可用
- **高频事件不调 LLM**：击杀和受伤每秒可能触发多次，全调 API 费用高、延迟积压
- **优先级中断**：死亡/胜利时立即打断当前播放，不排队等待
- **去重机制**：同类型事件已在队列中或正在等 LLM 响应时，新事件直接丢弃
