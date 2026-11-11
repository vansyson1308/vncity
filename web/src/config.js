// Ba mức chất lượng. Game tự chọn theo máy, tự hạ khi khung hình tụt (engine/renderer.js) và người chơi đổi được trong menu.
export const QUALITY = {
  low: { name: 'low', dpr: 1, minDpr: 0.6, post: false, msaa: 0, shadow: 0, shadowRange: 0, shadowEvery: 0, view: 380, near: 80, fog: 0.0044, texSize: 256, aniso: 2, clouds: false, traffic: 50, cars: 5, crowd: 10, treeDetail: 0 },
  medium: { name: 'medium', dpr: 1.25, minDpr: 0.7, post: true, msaa: 2, shadow: 1536, shadowRange: 60, shadowEvery: 3, view: 560, near: 105, fog: 0.0031, texSize: 256, aniso: 4, clouds: true, traffic: 100, cars: 9, crowd: 20, treeDetail: 1 },
  high: { name: 'high', dpr: 1.75, minDpr: 0.8, post: true, msaa: 4, shadow: 2048, shadowRange: 75, shadowEvery: 2, view: 760, near: 135, fog: 0.0023, texSize: 512, aniso: 8, clouds: true, traffic: 160, cars: 14, crowd: 32, treeDetail: 1 },
};

export function pickQuality(params) {
  const q = params.get('q');
  if (q && QUALITY[q]) return QUALITY[q];
  try { const s = localStorage.getItem('hn-quality'); if (s && QUALITY[s]) return QUALITY[s]; } catch { /* chế độ riêng tư */ }
  const touch = matchMedia('(pointer: coarse)').matches, mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  if (touch) return mem >= 6 && cores >= 8 ? QUALITY.medium : QUALITY.low;
  return cores >= 8 && mem >= 8 ? QUALITY.high : QUALITY.medium;
}
