import { to12Hour as convertTo12Hour } from '../../electron/dateTimeUtils.js';

export function to12Hour(time24) {
  return convertTo12Hour(time24);
}