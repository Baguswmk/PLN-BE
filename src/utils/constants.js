'use strict';

const TRANSPORTIR_CODE = {
  BKM: "A", MAI: "B", TPB: "C", MJR: "D", STL: "E", STE: "F", SKA: "G",
  ITL: "H", KTA: "I", IPLS: "J", PMA: "K", KBU: "L", LDP: "M", SKM: "N",
  ABG: "O", BKN: "P", PNS: "Q", LTE: "R", BLG: "S", WHL: "T", ACT: "U",
  MHT: "V", MSA: "W", CPS: "X", TNS: "Y", MMA: "Z", KAFA: "AA",
};

// Create reverse mapping for fast lookup
const REVERSE_TRANSPORTIR_CODE = Object.fromEntries(
  Object.entries(TRANSPORTIR_CODE).map(([k, v]) => [v, k])
);

function formatYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMd(dateStr) {
  const v = String(dateStr || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return `${v.slice(5, 7)}-${v.slice(8, 10)}`;
}

module.exports = {
  TRANSPORTIR_CODE,
  REVERSE_TRANSPORTIR_CODE,
  formatYmd,
  formatMd,
};
