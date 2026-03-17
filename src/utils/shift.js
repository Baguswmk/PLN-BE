'use strict';

/**
 * Utility function to calculate shift and date_shift based on a given date object.
 * Timezone is enforced to Asia/Jakarta (WIB).
 * 
 * Shift 1: 06:00:00 - 17:59:59 (date_shift = today)
 * Shift 2: 18:00:00 - 05:59:59 (date_shift = today if 18:00-23:59, yesterday if 00:00-05:59)
 * 
 * @param {Date} dateObj 
 * @returns {{time: string, date: string, shift: string, date_shift: string}}
 */
function getShiftDetails(dateObj) {
  /** @type {Intl.DateTimeFormatOptions} */
  const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  
  const parts = formatter.formatToParts(dateObj);
  const getPart = (type) => (parts.find(p => p.type === type) || {}).value;
  
  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10);
  const day = parseInt(getPart('day'), 10);
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const second = parseInt(getPart('second'), 10);

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000`;

  let shift;
  let dateShiftStr = dateStr;

  if (hour >= 6 && hour < 18) {
    shift = '1';
    dateShiftStr = dateStr;
  } else {
    shift = '2';
    if (hour >= 0 && hour < 6) {
      const shiftedObj = new Date(dateObj.getTime() - 6 * 60 * 60 * 1000);
      const shiftedParts = formatter.formatToParts(shiftedObj);
      const sYear = shiftedParts.find(p => p.type === 'year').value;
      const sMonth = shiftedParts.find(p => p.type === 'month').value;
      const sDay = shiftedParts.find(p => p.type === 'day').value;
      dateShiftStr = `${sYear}-${String(sMonth).padStart(2, '0')}-${String(sDay).padStart(2, '0')}`;
    }
  }

  return { time: timeStr, date: dateStr, shift, date_shift: dateShiftStr };
}

module.exports = {
  getShiftDetails
};
