# Raycasting

一个纯 JavaScript 实现的 Wolfenstein 风格伪 3D 引擎，基于 DDA（Digital Differential Analysis）光线投射算法。

## 特性

- **DDA 光线投射**：标准数字差分分析算法，每帧对屏幕每列像素发射射线
- **鱼眼校正**：采用垂直距离计算，消除广角下的画面扭曲
- **双视图显示**：左侧小地图（Top-down）+ 右侧 3D 视野
- **碰撞检测**：分轴碰撞检测 + 贴墙滑行
- **面着色**：根据墙面朝 向（X面/Y面）和距离进行明暗衰减，增强立体感

## 操作

| 按键 | 动作 |
|------|------|
| `W` | 前进 |
| `S` | 后退 |
| `A` | 左转 |
| `D` | 右转 |
| `Q` | 左平移 |
| `E` | 右平移 |

## 运行

直接在浏览器中打开 `raycasting.html` 即可体验。

## 技术细节

- **FOV**：约 66°（2 × atan(0.66)）
- **帧率无关移动**：所有移动速度基于 deltaTime 计算
- **地图尺寸**：10 × 10 格 Demo 地图
- **墙面类型**：4 种颜色（红、蓝、绿、橙）
- **抗死循环**：DDA 循环带有安全上限

## 项目结构

```
raycasting/
├── raycasting.html     # 入口 HTML
├── index.js            # 主程序入口
├── utils.js            # 工具函数（Color, Vec, drawRect, drawLine 等）
├── Player.js           # 玩家控制（移动、旋转、碰撞）
├── Background.js       # 地图数据与 2D 小地图绘制
└── game/
    ├── Game.js         # 游戏主循环、输入处理
    ├── GameScene.js    # 场景管理器
    └── Screen.js       # 3D 视图光线投射核心算法
```
