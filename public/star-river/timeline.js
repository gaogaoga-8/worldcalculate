/*
 * 三颗星的位置与动画时间线。
 *
 * 状态字段：x / y 为视口比例（0–1），scale 为星点缩放，glow 为光晕亮度（1 = 已点亮）。
 * 阶段字段：
 *   name      阶段名
 *   duration  时长（毫秒）
 *   stars     每颗星的 { from, to }，可写：
 *               'current'            沿用阶段开始时的状态
 *               状态对象             没写的字段沿用当前值
 *               (galaxy) => 状态     由用户星系计算（星系在三颗星都填完后生成）
 *   motion    可选，({ key, from, to, t, galaxy }) => 状态，t 为 0–1 的阶段进度；
 *             不提供时在 from 与 to 之间缓动插值
 *   onStart   可选，(galaxy, stage) => void，阶段开始时调用
 * 时间线按数组顺序播放，在末尾追加阶段即可延长。
 */
(() => {
  const KEYS = ['origin', 'birth', 'sign'];
  const each = (fn) => Object.fromEntries(KEYS.map((k) => [k, fn(k)]));

  const HOME = {
    origin: { x: 0.20, y: 0.23, scale: 1, glow: 1 },
    birth: { x: 0.60, y: 0.07, scale: 1, glow: 1 },
    sign: { x: 0.70, y: 0.17, scale: 1, glow: 1 },
  };

  const TIMELINE = [
    {
      // 三颗星离开漂移位置，飞向「来处」决定的落点，围成一个三角
      name: '聚集',
      duration: 2600,
      stars: each((k) => ({ from: 'current', to: (g) => g.gatherState(k) })),
    },
    {
      // 绕彼此旋转，越转越近、越转越快
      name: '运行',
      duration: 4600,
      stars: each((k) => ({ from: (g) => g.gatherState(k), to: (g) => g.tightState(k) })),
      motion: ({ key, t, galaxy }) => galaxy.spiralState(key, t),
    },
    {
      // 最紧处各分出一颗伴星，六颗星旋开到各自轨道
      name: '归位',
      duration: 3600,
      onStart: (galaxy, stage) => galaxy.spawnCompanions(stage.duration),
      stars: each((k) => ({ from: (g) => g.tightState(k), to: (g) => g.orbitState(k) })),
      motion: ({ key, t, galaxy }) => galaxy.settleState(key, t),
    },
  ];

  window.STAR_HOME = HOME;
  window.STAR_TIMELINE = TIMELINE;
})();
