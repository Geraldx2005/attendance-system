function parseTimeToMinutes(time) {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatMinutes(min) {
  if (!min || min <= 0 || isNaN(min)) return "0h 0m";
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function calcDayStats(logs) {
  if (!logs || logs.length === 0) {
    return {
      daySummary: "0h 0m",
      working: "0h 0m",
      breaks: "0h 0m",
      firstIn: null,
      lastOut: null,
    };
  }

  const sorted = [...logs].sort(
    (a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
  );

  const firstIn = sorted.find(l => l.type === "IN") || null;
  const lastOut = [...sorted].reverse().find(l => l.type === "OUT") || null;

  // Day Summary = FIRST IN → LAST OUT
  const daySummaryMinutes =
    firstIn && lastOut
      ? parseTimeToMinutes(lastOut.time) - parseTimeToMinutes(firstIn.time)
      : 0;

  // Breaks
  let breakMinutes = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].type === "OUT" && sorted[i + 1].type === "IN") {
      breakMinutes +=
        parseTimeToMinutes(sorted[i + 1].time) -
        parseTimeToMinutes(sorted[i].time);
    }
  }

  // Working = Day Summary − Breaks
  const workingMinutes = Math.max(daySummaryMinutes - breakMinutes, 0);

  return {
    daySummary: formatMinutes(daySummaryMinutes),
    working: formatMinutes(workingMinutes),
    breaks: formatMinutes(breakMinutes),
    firstIn,
    lastOut,
  };
}
