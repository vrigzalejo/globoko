/**
 * Major annual meteor showers. Day-of-year windows are approximate IMO peaks.
 * Radiants are J2000 right ascension (hours) and declination (degrees).
 */

/** @type {Array<{
 *   id: string,
 *   name: string,
 *   constellation: string,
 *   peakMonth: number,
 *   peakDay: number,
 *   before: number,
 *   after: number,
 *   zhr: number,
 *   radiant: { ra: number, dec: number }
 * }>} */
export const SHOWERS = [
  {
    id: 'quadrantids',
    name: 'Quadrantids',
    constellation: 'Bootes',
    peakMonth: 1,
    peakDay: 3,
    before: 2,
    after: 2,
    zhr: 120,
    radiant: { ra: 15.3, dec: 49.5 },
  },
  {
    id: 'lyrids',
    name: 'Lyrids',
    constellation: 'Lyra',
    peakMonth: 4,
    peakDay: 22,
    before: 5,
    after: 3,
    zhr: 18,
    radiant: { ra: 18.13, dec: 34.0 },
  },
  {
    id: 'eta-aquariids',
    name: 'Eta Aquariids',
    constellation: 'Aquarius',
    peakMonth: 5,
    peakDay: 6,
    before: 7,
    after: 5,
    zhr: 50,
    radiant: { ra: 22.53, dec: -1.0 },
  },
  {
    id: 'delta-aquariids',
    name: 'Southern Delta Aquariids',
    constellation: 'Aquarius',
    peakMonth: 7,
    peakDay: 30,
    before: 10,
    after: 8,
    zhr: 25,
    radiant: { ra: 22.7, dec: -16.0 },
  },
  {
    id: 'perseids',
    name: 'Perseids',
    constellation: 'Perseus',
    peakMonth: 8,
    peakDay: 12,
    before: 10,
    after: 5,
    zhr: 100,
    radiant: { ra: 3.07, dec: 58.0 },
  },
  {
    id: 'orionids',
    name: 'Orionids',
    constellation: 'Orion',
    peakMonth: 10,
    peakDay: 21,
    before: 8,
    after: 6,
    zhr: 20,
    radiant: { ra: 6.33, dec: 15.5 },
  },
  {
    id: 'leonids',
    name: 'Leonids',
    constellation: 'Leo',
    peakMonth: 11,
    peakDay: 17,
    before: 5,
    after: 4,
    zhr: 15,
    radiant: { ra: 10.13, dec: 21.6 },
  },
  {
    id: 'geminids',
    name: 'Geminids',
    constellation: 'Gemini',
    peakMonth: 12,
    peakDay: 14,
    before: 7,
    after: 3,
    zhr: 150,
    radiant: { ra: 7.47, dec: 32.3 },
  },
  {
    id: 'ursids',
    name: 'Ursids',
    constellation: 'Ursa Minor',
    peakMonth: 12,
    peakDay: 22,
    before: 3,
    after: 3,
    zhr: 10,
    radiant: { ra: 14.47, dec: 76.0 },
  },
];

function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((now - start) / 86400000);
}

function peakDayOfYear(year, month, day) {
  return dayOfYear(new Date(Date.UTC(year, month - 1, day)));
}

function wrapYearDay(day, yearLength) {
  if (day < 1) return day + yearLength;
  if (day > yearLength) return day - yearLength;
  return day;
}

function yearLength(year) {
  return dayOfYear(new Date(Date.UTC(year, 11, 31)));
}

/**
 * Showers whose active window covers `date` (UTC calendar day).
 * Near a peak, `nearPeak` is true within ±1 day.
 */
export function activeShowers(date = new Date()) {
  const year = date.getUTCFullYear();
  const today = dayOfYear(date);
  const length = yearLength(year);
  return SHOWERS
    .map((shower) => {
      const peak = peakDayOfYear(year, shower.peakMonth, shower.peakDay);
      const start = wrapYearDay(peak - shower.before, length);
      const end = wrapYearDay(peak + shower.after, length);
      let active;
      if (start <= end) active = today >= start && today <= end;
      else active = today >= start || today <= end;
      if (!active) return null;
      let daysFromPeak = today - peak;
      if (daysFromPeak > length / 2) daysFromPeak -= length;
      if (daysFromPeak < -length / 2) daysFromPeak += length;
      return {
        ...shower,
        peak,
        daysFromPeak,
        nearPeak: Math.abs(daysFromPeak) <= 1,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(a.daysFromPeak) - Math.abs(b.daysFromPeak));
}

export function peakLabel(shower) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[shower.peakMonth - 1]} ${shower.peakDay}`;
}
