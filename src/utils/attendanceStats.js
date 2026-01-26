function parseTimeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatMinutes(min) {
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function calcDayStats(logs) {
  if (!logs || logs.length === 0) {
    return {
      working: "0h 0m",
      breaks: "0h 0m",
      firstIn: null,
      lastOut: null,
    };
  }

  const sorted = [...logs].sort(
    (a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
  );

  const ins = sorted.filter(l => l.type === "IN");
  const outs = sorted.filter(l => l.type === "OUT");

  const firstIn = ins[0] || null;
  const lastOut = outs[outs.length - 1] || null;

  let workingMinutes = 0;
  let breakMinutes = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];

    if (curr.type === "IN" && next.type === "OUT") {
      workingMinutes +=
        parseTimeToMinutes(next.time) - parseTimeToMinutes(curr.time);
    }

    if (curr.type === "OUT" && next.type === "IN") {
      breakMinutes +=
        parseTimeToMinutes(next.time) - parseTimeToMinutes(curr.time);
    }
  }

  return {
    working: formatMinutes(workingMinutes),
    breaks: formatMinutes(breakMinutes),
    firstIn,
    lastOut,
  };
}
