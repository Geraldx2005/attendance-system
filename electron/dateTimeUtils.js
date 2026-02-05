/**
 * Utility functions to handle different regional date/time formats
 * Supports both / and - for dates, and both : and . for times
 */

/**
 * Normalize date from regional format to YYYY-MM-DD
 * Handles: DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, YYYY-MM-DD
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return null;

  // Replace / with - for consistent parsing
  const normalized = dateStr.replace(/\//g, "-");
  const parts = normalized.split("-");

  if (parts.length !== 3) return null;

  // Check if it's already in YYYY-MM-DD format
  if (parts[0].length === 4) {
    return normalized; // Already in correct format
  }

  // Convert DD-MM-YYYY to YYYY-MM-DD
  const [day, month, year] = parts;
  
  // Validate
  if (!day || !month || !year) return null;
  
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Normalize time from regional format to HH:MM
 * Handles: HH:MM, HH.MM
 */
export function normalizeTime(timeStr) {
  if (!timeStr) return null;

  // Replace . with : for consistent format
  const normalized = timeStr.replace(/\./g, ":");
  const parts = normalized.split(":");

  if (parts.length < 2) return null;

  const [h, m] = parts.map(Number);

  // Validate
  if (isNaN(h) || isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;

  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Convert time to minutes (handles both formats)
 */
export function timeToMinutes(time) {
  const normalized = normalizeTime(time);
  if (!normalized) return null;

  const [h, m] = normalized.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Convert 24-hour time to 12-hour format (handles both formats)
 */
export function to12Hour(time24) {
  const normalized = normalizeTime(time24);
  if (!normalized) return "";

  const [h, m] = normalized.split(":").map(Number);
  
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;

  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}