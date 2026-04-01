export function genMathQ() {
  const a = Math.floor(Math.random() * 12) + 1;
  const b = Math.floor(Math.random() * 12) + 1;
  const correct = a * b;
  const wrongs = new Set();
  while (wrongs.size < 2) {
    const w = correct + (Math.floor(Math.random() * 20) - 10);
    if (w !== correct && w > 0) wrongs.add(w);
  }
  const opts = [correct, ...wrongs].sort(() => Math.random() - 0.5);
  return { question: `${a} × ${b} = ?`, options: opts.map(String), answer: String(correct) };
}

export function genColorQ() {
  const colors = [
    { name: "RED", hex: "#E53935" },
    { name: "GREEN", hex: "#43A047" },
    { name: "BLUE", hex: "#1E88E5" },
    { name: "YELLOW", hex: "#FDD835" },
  ];
  const target = colors[Math.floor(Math.random() * 4)];
  return { prompt: `Tap ${target.name}!`, target: target.name, colors };
}

export function genHighLowQ() {
  const top = Math.floor(Math.random() * 9) + 1;
  const mid = Math.floor(Math.random() * 9) + 1;
  const bot = Math.floor(Math.random() * 9) + 1;
  return { top, mid, bot, topHigher: top > mid, botLower: bot < mid };
}
