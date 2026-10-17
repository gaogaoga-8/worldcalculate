# 星河 · 项目说明（供开发者与 AI 模型阅读）

一个纯前端、零依赖的手机竖屏单页。整页只有一张照片（黑洞与吸积盘），用户点击照片里的三颗星填写信息，三颗星运动后生成属于用户的小星系，之后随聊天次数缓慢变多变亮。

- 无框架、无构建步骤、无外部请求。直接双击 `index.html` 即可运行，也可用任意静态服务器（如 `python3 -m http.server`）。
- 全部为普通 `<script>`（非 ES module），以便 `file://` 下可用；模块之间通过少量 `window.*` 全局变量通信。

---

## 1. 产品约束（修改时必须保持）

这些是需求方明确提出的要求，改动代码前请逐条确认不会破坏：

1. **画面**：照片是整页唯一画面，铺满视口，`cover` 居中，不变形。**不加**标题、卡片、导航、状态栏或说明文字。唯一例外是 `?debug` 下的模拟聊天按钮。
2. **黑洞和吸积盘保持静止**；只有照片中稀疏区域的星点作为独立图层漂移。
3. **背景星点**：全部缓慢漂移，速度各不相同，带轻微明灭；运动连续循环，**不允许突然跳位**。
4. **三颗可输入的星**，名字固定为「来处」「降生」「符号」。它们比背景星略亮但要**融入星河**（需求方反馈过"太突出"）；名称紧贴星点、跟随移动；未点击时也参与漂移。
5. **输入**：只有这三颗星可点击。点击后星点**停在原地**，在旁边**就地展开**对应输入框，不跳转整页表单。
   - 来处 → 地点（文本）
   - 降生 → 出生日期 + 时间（原生 date / time 控件）
   - 符号 → 名字（文本）
   - 确认前可修改；确认后该星保持点亮并回到漂移；三颗星互相独立，可按任意顺序填写。
6. **动画**：三颗星用**同一组 DOM 对象**贯穿输入和动画，**不得在动画开始时替换成新元素**。三颗都完成后播放时间线，播放期间不可再输入。
7. **时间线**是可追加的阶段列表（目前三段：聚集、运行、归位），每段写明时长和三颗星的起止状态。
8. **减少动态效果**（`prefers-reduced-motion: reduce`）：星点停止漂移与明灭，时间线直接呈现最终结果，星系不公转，新星直接出现。

---

## 2. 文件结构与加载顺序

```
index.html        页面结构：两层 canvas + 三个 .seed（星 + 输入面板）
style.css         三颗星、名称、输入面板样式；debug 按钮样式
assets/sky.js     照片的 data URL（window.SKY_IMAGE），由 sky.jpg 生成
assets/sky.jpg    原图（500×1024），sky.js 的来源；运行时仅作兜底
galaxy.js         用户星系：生成规则、轨道、伴星诞生、尘带、聊天增长、绘制
timeline.js       三颗星初始位置 + 动画时间线（可追加阶段）
main.js           主程序：星点分离、背景绘制、输入交互、时间线播放、持久化、对外 API
```

`index.html` 中脚本顺序固定为：`assets/sky.js` → `galaxy.js` → `timeline.js` → `main.js`。

| 全局变量 | 定义于 | 用途 |
|---|---|---|
| `window.SKY_IMAGE` | assets/sky.js | 照片的 data URL |
| `window.createGalaxy` | galaxy.js | 星系工厂函数 |
| `window.STAR_HOME` | timeline.js | 三颗星的初始位置 |
| `window.STAR_TIMELINE` | timeline.js | 动画阶段数组 |
| `window.starRiver` | main.js | 对外 API（聊天接入、重置） |

**为什么用 data URL**：以 `file://` 打开时，从文件加载的图片会污染 canvas，`getImageData` 抛错，星点无法分离。data URL 不会污染画布。若替换照片，需重新生成 `sky.js`：

```bash
python3 -c "import base64;b=base64.b64encode(open('assets/sky.jpg','rb').read()).decode();open('assets/sky.js','w').write('window.SKY_IMAGE = \"data:image/jpeg;base64,'+b+'\";\n')"
```

---

## 3. 图层（自下而上）

1. `#sky` canvas：静态底图 + 漂移星点层（约 30fps 节流重绘）。
2. `#galaxy` canvas：用户星系（伴星、尘带、新星、光尾、闪光），每帧重绘，`pointer-events: none`。
3. `.seed` × 3（DOM，`position: fixed`，每帧写 `transform`）：三颗可输入的星及其输入面板。

坐标约定：三颗星的状态 `{ x, y, scale, glow }` 中 `x / y` 是**视口比例**（0–1）；背景星点用**原图像素坐标**，绘制时经 cover 变换（`k = max(W/imgW, H/imgH)`，居中偏移）。

---

## 4. 背景星点分离（main.js `separate()`）

运行时从照片中把"稀疏区域里的小星点"切成贴片，底图里减去它们：

1. 亮度 `L = max(r, g, b)`。
2. 形态学开运算（5×5 最小值滤波再最大值滤波）得到去掉小亮点后的背景 `opened`。
3. 局部密度 = 半径 10 的盒式均值；稀疏权重 `sparse = clamp((40 - density) / 22)`。吸积盘等密集区域权重为 0，因此保持静止。
4. 残差 `res = (L - opened) * sparse`；`res > 6` 的像素膨胀 1px 后做 4 连通分量；保留峰值 ≥ 12 且包围盒 ≤ 13×13 的分量（约 6000 颗）。
5. 每个分量按比例拆分颜色：底图像素 `keep = round(v * (1 - f))`，贴片像素 `v - keep`。所有贴片打包进一张 2048 宽的贴图集（atlas）。
6. 绘制时以 `lighter`（相加）合成：星点在原位时，底图 + 贴片与原图**逐像素一致**。

每颗星的运动（typed arrays `S.*`）：
- 沿一个随机旋转的小椭圆闭合轨道循环；偏移量减去 t=0 时的值，因此 t=0 时恰在原位。
- 幅度 8–26 原图像素，周期 20–60 秒，方向随机。
- 明灭：`alpha = 1 - depth * (0.5 - 0.5cos(ωt))`，depth 0.15–0.55，周期 2–7 秒。

调快、调慢漂移：修改 `separate()` 末尾的 `amp`（幅度）与 `S.om`（角速度）。

兜底：若 `getImageData` 仍抛错，则整图静态显示（`sky.n = 0`），输入功能不受影响。

---

## 5. 状态机（main.js）

```
input ──三颗都确认──▶ pending ──700ms──▶ playing ──时间线结束──▶ settled
  ▲                                                                │
  └──────────── 刷新且 localStorage 有存档时直接进入 settled ◀──────┘
```

| phase | 三颗星位置来源 | 可点击 |
|---|---|---|
| `input` | `HOME[key]` + 自身漂移偏移（打开面板时该星的时钟暂停） | 是 |
| `pending` | 同上 | 否（`body.locked`） |
| `playing` | 时间线（`stepTimeline`） | 否 |
| `settled` | `galaxy.orbitState(key)`，随星系公转 | 否 |

三颗星的漂移使用**各自的本地时钟** `s.clock`：只在未打开、且未开启减少动态效果时前进，因此暂停、恢复都不会跳位。

输入面板细节：
- 点击面板外部 = 取消。已完成的星恢复为上次确认的值，未完成的星保留草稿。
- 回车提交时跳过输入法组字（`isComposing` / `keyCode 229`）。
- 面板贴近屏幕边缘时，通过 `--shift` 变量自动内收；星点偏右（`x > 0.55`）时面板改为右对齐（`flip-x`）。

---

## 6. 时间线（timeline.js）

```js
{
  name: '归位',
  duration: 3600,                         // 毫秒
  onStart: (galaxy, stage) => { ... },    // 可选，阶段开始时调用
  stars: {                                // 每颗星的起止状态
    origin: { from, to },
    birth:  { from, to },
    sign:   { from, to },
  },
  motion: ({ key, from, to, t, galaxy }) => state, // 可选；t ∈ [0,1]，不写则 easeInOut 插值
}
```

`from` / `to` 可以写成：
- `'current'`：沿用阶段开始时的状态；
- 部分状态对象：未写的字段沿用当前值；
- `(galaxy) => state`：由用户星系计算。

**追加阶段**：在 `TIMELINE` 数组末尾 push 即可。注意最后一个阶段的终点应等于 `galaxy.orbitState(key)`（时钟为 0 时的轨道位置），否则进入 `settled` 时会跳位。

减少动态效果时，`finishTimeline()` 会依次调用每个阶段的 `onStart`、解析起止状态，然后直接进入 `settled`。

现有三段：

| 阶段 | 时长 | 运动 | galaxy 方法 |
|---|---|---|---|
| 聚集 | 2600 | 从当前位置缓动到落点周围的三角（极坐标半径 1.5） | `gatherState` |
| 运行 | 4600 | 三星互绕：半径 1.5→0.35，角度加速转 2.2 圈 | `spiralState` / `tightState` |
| 归位 | 3600 | 开始时分出三颗伴星；六颗星旋开到各自轨道 | `spawnCompanions` / `settleState` / `orbitState` |

---

## 7. 用户星系（galaxy.js）

`createGalaxy(values, env, chats)`：
- `values = { origin: {place}, birth: {date:'YYYY-MM-DD', time:'HH:MM'}, sign: {name} }`
- `env = { W, H, now(), reduced }`
- `chats` 为已保存的消息哈希数组（用于恢复）

**确定性**：所有随机量都来自 `hash(name|place|date|time)` 驱动的 `mulberry32`，相同输入得到相同星系。

| 输入 | 影响 |
|---|---|
| 符号（名字） | 中心星色调（`CENTER_TINTS`），整体种子 |
| 来处（地点） | 星系中心：x ∈ [0.42, 0.58]，y ∈ [0.13, 0.17]（视口比例，位于照片上方的暗星空） |
| 降生（日期时间） | 时辰 → 起始角度 `base`；月份 → 冷暖色 `memberTint`；日期单双 → 旋转方向 `dir` |

**几何**：
- 单位长度 `u = min(W, H/2) * 0.14`。
- 轨道为倾斜椭圆，短长轴比 `RATIO = 0.4`，整体旋转 `ROLL = -0.06`，与吸积盘视角一致。
- `project(r, a)` 把极坐标转为屏幕坐标，并返回 `depth = sin(a)`：值为正表示在前方，略大略亮。
- 角速度 `omega(r) = dir · 2π / (50 + 50r)`，内快外慢。

**初始六颗星**（轨道半径，单位 u）：

| 星 | 半径 | 绘制方式 |
|---|---|---|
| 符号（中心星） | 0 | DOM |
| 来处 | 1.15 | DOM |
| 降生 | 1.8 | DOM |
| 伴星 c0（由符号分出） | 0.62 | canvas |
| 伴星 c1（由来处分出） | 2.3 | canvas |
| 伴星 c2（由降生分出） | 2.85 | canvas |

**尘带** `BANDS`：内层半径 1.45、260 粒，随伴星诞生浮现；外层半径 2.55、340 粒，在聊天约 10 次时浮现。粒子沿轨道疏密不均，外加一圈极淡的环形辉光。

**聊天增长** `addChat(text)`：
- 第 n 颗新星：半径 `0.7 + 2.6·sqrt(n/(n+40))`（有上限，不会撑出屏幕），角度 `base + n·黄金角`。
- 颜色、大小、亮度由消息哈希决定；12 秒淡入。
- 整体亮度 `B = 1 - e^(-n/25)`，作用于所有成员与尘带。
- 聊天 25 次后，中心逐渐浮现星云光晕。

**时钟**：`galaxy.clock` 只在 `settled` 且未开启减少动态效果时前进，从 0 开始。因此"归位"终点 = 时钟为 0 时的轨道位置，衔接无跳位。

---

## 8. 持久化与对外接口

`localStorage['star-river:galaxy']`：

```json
{ "values": { "origin": {"place": "杭州"}, "birth": {"date": "1996-03-12", "time": "06:40"}, "sign": {"name": "林星"} },
  "chats": [123456789, 987654321] }
```

只保存消息哈希，不保存聊天原文。

```js
window.starRiver.chat(text)   // 每条聊天消息调用一次；星系未就绪或动画未结束时返回 false
window.starRiver.chats        // 当前聊天次数
window.starRiver.reset()      // 清除存档并刷新
```

URL 参数：
- `?debug`：右下角显示"+"按钮，每点一次模拟一次聊天；
- `?reset`：启动时清除存档。

---

## 9. 测试方式（已验证项）

推荐以 390×844（DPR 2）的手机视口测试：

1. 背景画布 1 秒内约 2500 个像素变化，说明漂移在运行；减少动态效果时变化数为 0。
2. 打开某颗星的面板后，它的 `transform` 不再变化；确认后恢复漂移。
3. 三颗都确认后，`document.querySelectorAll('.seed')` 仍是同样的三个节点，三阶段依次播放、无报错。
4. 刷新后从存档直接恢复到 `settled`。
5. 用 `?debug` 或 `starRiver.chat()` 模拟 15 次、45 次聊天，观察外层尘带与星云。

---

## 10. 已知问题与可改进点

- 公转时「来处」「降生」偶尔经过同一区域，名称会短暂重叠。可考虑重叠时让较远那颗（depth 较小）的名称淡出。
- 桌面横屏下，`cover` 会裁掉照片上方的星空，星系会落在吸积盘上。目前以手机竖屏为准，未做适配。
- 星点分离阈值（`40 / 22 / 6 / 12 / 13`）针对这张照片调过；换图后可能需要重新调整。
- 背景约 6000 次 `drawImage`、30fps 节流；在低端机上若卡顿，可降低帧率或改为 WebGL 实例化绘制。
