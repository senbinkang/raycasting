# AI 实时解说 — 面试口语版讲解

> 2026-07-14

## 整体概括（一句话版）

**事件驱动的实时语音解说流水线**：游戏事件 → 优先级队列调度 → LLM 生成文本（模板兜底）→ 语音克隆 TTS 朗读。模板事件音频预生成即时播放，LLM 事件实时克隆 + 失败降级。全链路浏览器端运行，零后端依赖。

---

## 一、事件怎么来的（12 种游戏事件）

代码分散在几个文件里，事件发生时一行 `queue()` 就完事：

| 事件 | 触发位置 | 例子 |
|------|---------|------|
| `enemy_kill` | `Game.js` — 射击杀死敌人 | `queue("enemy_kill", { enemyType: "tank" })` |
| `player_hurt` | `Player.js` — 玩家受伤 | `queue("player_hurt", { damage: 10, hp: 50 })` |
| `low_hp` | `GameScene.js` — HP ≤ 30 | `queue("low_hp", { hp: 20, enemyCount: 3 })` |
| `player_death` | `GameScene.js` — HP = 0 | `queue("player_death", { score: 500 })` |
| `victory` | `GameScene.js` — 5 波全清 | `queue("victory", { score: 1200 })` |
| `game_start` | `GameScene.js` — 开局 | `queue("game_start")` |
| `wave_start` | `GameScene.js` — 新波次 | `queue("wave_start", { wave: 3 })` |
| `wave_clear` | `GameScene.js` — 波次清完 | `queue("wave_clear", { wave: 2 })` |
| `new_record` | `GameScene.js` — 破最高分 | `queue("new_record", { score: 1500 })` |
| `health_pickup` | `Player.js` — 捡血包 | `queue("health_pickup", { hp: 80 })` |
| `pause` / `unpause` | `Game.js` — 按 P 键 | `queue("pause")` |

核心入口就一个单例：`window.commentaryService`（`CommentaryService.js` 428 行）。

---

## 二、队列怎么调度（4 个关键机制）

### 2.1 优先级中断

12 种事件分 6 个优先级（0 最高，5 最低）：

| 优先级 | 事件 |
|--------|------|
| 0（最高） | 死亡、通关 — **可打断当前语音** |
| 1 | 开局、新波次、新纪录 |
| 2 | 波次清完、残血 |
| 3 | 击杀、受伤 |
| 4 | 捡血包 |
| 5（最低） | 暂停/继续 |

死亡/通关来了，直接 `speechSynthesis.cancel()` 掐掉当前语音 + `AbortController.abort()` 取消进行中的 LLM 请求 + 停掉 MiMo 音频。

### 2.2 冷却（CD）

每类事件独立冷却时间：
- 击杀 2.5 秒（连杀不刷屏）
- 受伤 3 秒
- 残血 8 秒（别一直喊"你要死了"）
- 波次变化 3-5 秒

### 2.3 去重

同类型事件已排队或正在等 LLM 响应时，新事件直接丢弃。保证不出现三句一样的。

### 2.4 只播最新一条

`_processNext()` 从队列取最后一条，清空队列。旧事件直接丢弃——

> 设计理念：**宁可少播一句，也不能播过时的内容。** 这是保证"实时感"的关键。

---

## 三、文本怎么生成（LLM + 模板 双轨制）

### 3.1 为什么分两轨

| | 调 LLM | 用模板 |
|------|--------|--------|
| 事件 | 开局/通关/死亡/新纪录/残血/波次变化（6 种） | 击杀/受伤/捡血包/暂停（5 种） |
| 频率 | 低 | 高 |
| 要求 | 需要上下文、"有梗" | 快速、零延迟 |
| 成本 | API 调用费 | 零 |

高频事件全调 LLM，费用扛不住，延迟也跟不上。

### 3.2 LLM 调用细节

```
POST {endpoint}（OpenAI 兼容，DeepSeek / GPT 随便换）
Body: {
    model: "deepseek-v4-pro",
    messages: [
        { role: "system", content: "你是捧哏风格解说员，1-2句话，不超过40字..." },
        { role: "user", content: "第3波来了！共6个敌人。HP: 80/100，当前分数: 350" }
    ],
    max_tokens: 80,    // 捧哏就一两句话，80 token 绰绰有余
    temperature: 0.9   // 稍微发散，避免每次都说一样
}
```

- System prompt 把风格定死：**相声捧哏、短促接话、用"你"直呼玩家、不加任何格式标记**
- 每个 LLM 事件有对应的 `PROMPT_BUILDERS`，把游戏状态（HP/分数/波次/敌人数）拼成简短提示词
- 5 秒超时（`AbortController`），失败静默降级到模板

### 3.3 模板兜底

```js
TEMPLATES = {
    enemy_kill: ["漂亮！下一个！", "一枪带走，不送。", "这枪法还行嘛。", ...],
    player_hurt: ["哎哟！疼不疼？", "躲一下啊大哥！", "你这身法，我奶奶都比你灵活。", ...],
    health_pickup: ["回血了，珍惜这条命吧。", "续命成功！", ...],
    ...
}
```

随机抽一句。LLM 挂了玩家无感知。

---

## 四、怎么发出声音（两种 TTS 引擎）

### 4.1 浏览器内置 SpeechSynthesis

```js
const utter = new SpeechSynthesisUtterance("漂亮！下一个！")
utter.lang = "zh-CN"
utter.rate = 1.05   // 稍快，更接近自然语速
speechSynthesis.speak(utter)
```

**优点**：零依赖、零延迟、不需要 API key。**缺点**：机器声，没个性。

通过 `onend` / `onerror` 回调驱动队列，播完自动取下一条。

### 4.2 MiMo 语音克隆（于谦捧哏音色）

这是整个项目最有技术含量的部分。核心原理：

> **给 AI 一段某人 3-10 秒的录音，它就能用这个声音读任何文字。** 模型提取声学特征（音色、语调、节奏），生成新音频时把文字 + 特征一起输入，输出就是目标声音在说话。

**语音样本来源**：于谦录音的 WAV 文件 base64 化后嵌入代码（`CommentaryVoiceSample.js`，~885KB），作为默认样本。用户仍可通过 localStorage 上传自定义样本覆盖。

**完整调用链路：**

```
① 语音样本 base64 已内置在 CommentaryVoiceSample.js（window.__COMMENTARY_VOICE_SAMPLE__）
                                    ↓
② 需要播报时，POST 到 MiMo API:
   POST https://api.xiaomimimo.com/v1/chat/completions
   Header: api-key: <MIMO_API_KEY>
   Body: {
       model: "mimo-v2.5-tts-voiceclone",
       messages: [{ role: "assistant", content: "要读的文字" }],
       audio: {
           voice: "data:audio/wav;base64,<于谦声音的base64>",
           format: "wav"
       }
   }
                                    ↓
③ API 返回: choices[0].message.audio.data → base64 wav
                                    ↓
④ 客户端播放:
   const audio = new Audio()
   audio.src = "data:audio/wav;base64,<返回的base64>"
   audio.play()
```

### 4.3 模板音频预生成（关键优化）

高频模板事件（击杀/受伤/拾取/暂停等）如果每次实时调 MiMo，2-8 秒延迟会导致解说严重滞后。解决方案：**提前生成，存好直接用。**

```
开发时一次性预生成（scripts/generate_audio_cache.mjs）：
  遍历 25 条模板文本 → 逐条调 MiMo API → 返回音频 base64
  → 写入 CommentaryAudioCache.js（window.__COMMENTARY_AUDIO_CACHE__）
  → Map<文本, base64音频>，~4.4MB

运行时播放：
  事件触发 → 随机选模板文本 → O(1) 查 Map → new Audio(base64).play()
  → 零网络请求，零延迟
```

**两种事件播放路径对比：**

| | 模板事件（useLLM: false） | LLM 事件（useLLM: true） |
|------|--------------------------|---------------------------|
| 文本来源 | 随机模板 | LLM API（DeepSeek 等） |
| 音频来源 | 预生成缓存（即时） | MiMo API 实时克隆 |
| 失败降级 | 浏览器 TTS | 浏览器 TTS |
| 延迟 | 0ms | 2-8 秒 |

### 4.4 两种 TTS 的关系与降级

- 用户可在设置面板自由切换 MiMo / 浏览器内置
- 模板事件：预生成缓存命中 → 即时播放；缓存未命中（不应发生）→ 浏览器 TTS
- LLM 事件：MiMo 实时克隆 → 成功播放；失败自动降级到浏览器 TTS
- 音量独立控制，跟游戏音效（Web Audio API 合成）互不干扰

---

## 五、其他技术细节

### 5.1 竞态处理（Generation ID）

经典异步竞态 pattern：

```js
const genId = ++this._genId        // 开始任务前记 ID
const text = await this._callLLM(...)  // 异步等待
if (genId !== this._genId) return      // ID 变了说明有新任务插入，丢弃
```

比如你正在等 LLM 返回击杀台词，突然你死了——死亡事件会让 `_genId++`，等 LLM 返回后 genId 对不上，直接丢弃。**避免"人死了还在喊漂亮"的尴尬。**

### 5.2 全部配置存 localStorage

```js
commentary_config → { endpoint, apiKey, model, ttsEnabled, ttsVolume, ttsProvider, mimoApiKey }
commentary_voice_sample → 用户自定义语音样本 base64（可选，覆盖默认于谦样本）
```

- 不需要后端，纯前端运行
- API key 存在用户自己浏览器里，不存在服务端泄漏风险
- 每次改设置自动保存，刷新不丢
- 语音样本默认内置（`CommentaryVoiceSample.js`），用户可上传覆盖

### 5.3 设置面板

HTML `<details>` 折叠面板，纯原生 JS 绑定，零依赖。MiMo 配置行在选择 "browser" 模式时自动隐藏。语音样本显示"已内置（于谦）"，无需用户上传。

### 5.4 预生成音频缓存文件

两个自动生成的 JS 文件，通过 `<script>` 标签注入全局变量，兼容 `file://` 和 HTTP 双协议：

```
game/CommentaryVoiceSample.js   → window.__COMMENTARY_VOICE_SAMPLE__    (~885KB)
game/CommentaryAudioCache.js    → window.__COMMENTARY_AUDIO_CACHE__     (~4.4MB, 25 条)
```

一次性生成脚本 `scripts/generate_audio_cache.mjs`，修改模板文本后重新运行即可更新缓存。

### 5.5 两个音频系统独立

| | AudioManager | CommentaryService |
|------|-------------|-------------------|
| 用途 | 游戏音效（枪声/脚步/BGM） | AI 解说语音 |
| 技术 | Web Audio API（OscillatorNode 合成） | SpeechSynthesis / HTMLAudioElement |
| 关系 | 互不干扰，各自独立 |

---

## 六、面试时怎么讲（1-2 分钟版本）

> 开场：**"这个 AI 解说系统是一个事件驱动的实时语音解说流水线，分三步：捕获游戏事件 → 生成解说文本 → TTS 朗读。"**
>
> 展开：**"游戏里定义了 12 种事件，通过一个优先级队列汇聚到 CommentaryService 单例。调度上有几个设计点：优先级中断保证重要事件不被阻塞，冷却和去重防止高频事件刷屏，队列只保留最新事件保证实时感。"**
>
> 文本生成：**"采用 LLM + 模板双轨制。低频重要事件调 LLM，把游戏状态拼成 prompt 让 AI 即兴创作捧哏台词；高频事件直接从事先写好的模板里随机抽，避免 API 成本和延迟。"**
>
> TTS：**"支持两种引擎。浏览器内置 SpeechSynthesis 零延迟零依赖；MiMo 语音克隆是亮点——于谦语音样本内置在代码中，调用 MiMo v2.5 API 用克隆的音色朗读。高频模板事件更进一步：25 条模板音频一次性预生成嵌入代码，触发即播零延迟；LLM 动态事件实时调 MiMo，失败自动降级浏览器 TTS。"**
>
> 收尾：**"工程上还做了预生成音频缓存去除实时 API 延迟、5 秒超时静默降级、generation ID 处理异步竞态、全部配置 localStorage 持久化，整个系统纯浏览器端运行不需要后端。"**

---

## 七、面试官可能追问

**Q: "语音克隆的原理是什么？"**

> TTS 模型在训练时学会了从参考音频提取声学特征（音色、语调、说话节奏）。推理时输入两样东西：目标文字 + 参考音频，模型把文字内容和提取的声学特征一起解码，生成目标声音在说新内容的音频。我们用的是 MiMo v2.5 的 voice clone API，传 base64 语音样本 + 文本，拿回 base64 音频。

**Q: "怎么保证实时性？"**

> 几个手段：高频模板事件音频预生成嵌入代码，触发即播零延迟；队列只保留最新事件，旧的直接丢；高频事件不调 LLM 用模板，避免网络延迟积压；5 秒超时 + 静默降级，LLM 慢了不会卡住整个系统。

**Q: "LLM 为什么 max_tokens 只设 80？"**

> 捧哏就一两句话的事，40 字以内，80 token 绰绰有余。设小一点响应更快、成本更低。

**Q: "双轨制的比例怎么定的？"**

> 6 种低频但需要创造性的场景用 LLM（开局/通关/死亡/新纪录/残血/波次变化），5 种高频场景用模板（击杀/受伤/捡血包/暂停）。既保留了 AI 的趣味性，又控制了成本和延迟。
