export function durationHours(seconds: number) {
  return Number((seconds / 3600).toFixed(6));
}

export function formatDurationHours(seconds: number) {
  return `${durationHours(seconds).toLocaleString("ko-KR", { maximumFractionDigits: 6 })}시간`;
}
