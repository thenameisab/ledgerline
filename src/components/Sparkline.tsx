export function Sparkline({
  data,
  width = 80,
  height = 24,
  stroke = "var(--color-viz-1)",
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
