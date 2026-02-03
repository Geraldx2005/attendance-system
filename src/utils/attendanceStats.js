// attendanceStats.js
// Punch-only attendance derivation (NO type column)

/**
 * Derives attendance status from raw punches
 * @param {Array} punches - Array of {date, time} objects sorted by time
 * @returns {Object} - {firstIn, lastOut, workedMinutes, status}
 */
export function deriveAttendanceFromPunches(punches) {
  if (!punches || punches.length === 0) {
    return {
      firstIn: null,
      lastOut: null,
      workedMinutes: 0,
      status: "Absent",
    };
  }

  const firstIn = punches[0].time;
  const lastOut = punches[punches.length - 1].time;

  const inMin = timeToMinutes(firstIn);
  const outMin = timeToMinutes(lastOut);

  let workedMinutes = 0;
  let status = "Absent";

  if (inMin !== null && outMin !== null && outMin > inMin) {
    workedMinutes = outMin - inMin;

    if (workedMinutes >= 8 * 60) {
      status = "Present";
    } else if (workedMinutes >= 5 * 60) {
      status = "Half Day";
    }
  }

  return {
    firstIn,
    lastOut,
    workedMinutes,
    status,
  };
}

/**
 * Calculates day stats from punch logs
 * Derives IN/OUT pairs and calculates working time vs break time
 * @param {Array} logs - Array of {date, time, source} objects
 * @returns {Object} - {working, breaks, firstIn, lastOut}
 */
export function calcDayStats(logs) {
  if (!logs || logs.length === 0) {
    return {
      working: "0h 0m",
      breaks: "0h 0m",
      firstIn: null,
      lastOut: null,
    };
  }

  // Sort by time to ensure chronological order
  const sorted = [...logs].sort((a, b) => a.time.localeCompare(b.time));

  const firstIn = sorted[0];
  const lastOut = sorted[sorted.length - 1];

  // Derive IN/OUT pairs from punches
  // Odd punches = IN, Even punches = OUT
  const pairs = [];
  
  for (let i = 0; i < sorted.length; i += 2) {
    const inPunch = sorted[i];
    const outPunch = sorted[i + 1];

    if (outPunch) {
      pairs.push({
        in: inPunch.time,
        out: outPunch.time,
      });
    }
  }

  // Calculate working time (sum of all pairs)
  let totalWorkingMinutes = 0;
  
  for (const pair of pairs) {
    const inMin = timeToMinutes(pair.in);
    const outMin = timeToMinutes(pair.out);
    
    if (inMin !== null && outMin !== null && outMin > inMin) {
      totalWorkingMinutes += outMin - inMin;
    }
  }

  // Calculate break time (gaps between OUT and next IN)
  let totalBreakMinutes = 0;
  
  for (let i = 0; i < pairs.length - 1; i++) {
    const currentOut = pairs[i].out;
    const nextIn = pairs[i + 1].in;
    
    const outMin = timeToMinutes(currentOut);
    const inMin = timeToMinutes(nextIn);
    
    if (outMin !== null && inMin !== null && inMin > outMin) {
      totalBreakMinutes += inMin - outMin;
    }
  }

  return {
    working: formatDuration(totalWorkingMinutes),
    breaks: formatDuration(totalBreakMinutes),
    firstIn,
    lastOut,
  };
}

/* ---------------- HELPERS ---------------- */

/**
 * Converts time string (HH:mm:ss or HH:mm) to minutes
 * @param {string} time - Time string
 * @returns {number|null} - Minutes since midnight or null if invalid
 */
export function timeToMinutes(time) {
  if (!time) return null;

  const parts = time.split(":").map(Number);
  const h = parts[0];
  const m = parts[1];
  const s = parts[2] || 0;

  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  return h * 60 + m + (s ? s / 60 : 0);
}

/**
 * Formats minutes into "Xh Ym" format
 * @param {number} minutes - Total minutes
 * @returns {string} - Formatted duration
 */
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h}h ${m}m`;
}