import { logger } from '../application/logger.js';
import { DateTime } from 'luxon';
import { prismaClient } from '../application/database.js';


export async function processSensorTableData2Menit(options = {}) {
  const {
    from_date,
    to_date,
    page = 1,
    per_page = 20
  } = options;

  if (!from_date || !to_date) {
    console.log(`[SKIP] invalid params from_date: ${from_date}, to_date: ${to_date}`);
    return null;
  }

  const fromDate = DateTime.fromISO(from_date, { zone: "Asia/Jakarta" });
  const toDate = DateTime.fromISO(to_date, { zone: "Asia/Jakarta" });

  if (!fromDate.isValid || !toDate.isValid) {
    console.error(`[ERROR] Invalid DateTime: from=${fromDate.toISO()} to=${toDate.toISO()}`);
    return null;
  }

  const rows = await prismaClient.datalogger_refrences_hourly.findMany({
    where: { message: { not: null } },
    orderBy: { id: "desc" } 
  });

  let grouped = {};

  rows.forEach(r => {
    try {
      if (!r.message || r.message.trim() === "") return;

      const safeMsg = r.message
        .replace(/'/g, '"')
        .replace(/\b(\w+)\b(?=\s*:)/g, '"$1"');

      let msg;
      try {
        msg = JSON.parse(safeMsg);
      } catch (e) {
        console.error("❌ JSON.parse gagal:", e.message, "RAW:", r.message);
        return;
      }

      if (msg?.data && Array.isArray(msg.data)) {
        msg.data.forEach(d => {
          const ts = DateTime.fromSeconds(d.datetime).setZone("Asia/Jakarta");
          if (ts < fromDate || ts > toDate) return;

          const rounded = ts.set({
            second: 0,
            millisecond: 0,
            minute: Math.floor(ts.minute / 2) * 2
          });

          const key = rounded.toFormat("yyyy-MM-dd HH:mm");

          if (!grouped[key]) {
            grouped[key] = {
              count: 0,
              waktu: key,
              debit: 0,
              volume: 0 // <-- tambahkan field volume
            };
          }

          const debit = parseFloat(d.debit) || 0;
          const intervalHours = 120 / 3600; // 120 detik = 2 menit = 1/30 jam
          const volume = debit * intervalHours;

          grouped[key].count++;
          grouped[key].debit += debit;
          grouped[key].volume += volume; // <-- akumulasi volume per waktu
        });
      }
    } catch (e) {
      console.error("Parse error:", e.message, "RAW:", r.message);
    }
  });

  const fullResult = Object.entries(grouped).map(([_, val]) => ({
    waktu: val.waktu,
    debit: val.debit / val.count,
    volume: val.volume // total kubikasi (m³) untuk rentang waktu tersebut
  }));

  // total keseluruhan volume dari semua data
  const total_volume = fullResult.reduce((sum, x) => sum + x.volume, 0);

  const total = fullResult.length;
  const total_pages = Math.ceil(total / per_page);
  const start = (page - 1) * per_page;
  const paginated = fullResult.slice(start, start + per_page);

  return {
    data: paginated,
    page,
    per_page,
    total,
    total_pages,
    total_volume // tampilkan total keseluruhan volume (akumulasi)
  };
}



export async function processSensorTableDataDaily(options = {}) {
  const {
    from_date,
    to_date,
    page = 1,
    per_page = 20
  } = options;

  if (!from_date || !to_date) {
    console.log(`[SKIP] invalid params from_date: ${from_date}, to_date: ${to_date}`);
    return null;
  }

  const fromDate = DateTime.fromISO(from_date, { zone: "Asia/Jakarta" });
  const toDate = DateTime.fromISO(to_date, { zone: "Asia/Jakarta" });

  if (!fromDate.isValid || !toDate.isValid) {
    console.error(`[ERROR] Invalid DateTime: from=${fromDate.toISO()} to=${toDate.toISO()}`);
    return null;
  }

  const rows = await prismaClient.datalogger_refrences_hourly.findMany({
    where: { message: { not: null } },
    orderBy: { id: "desc" }
  });

  let grouped = {};

  rows.forEach(r => {
    try {
      if (!r.message || r.message.trim() === "") {
        return; // skip kalau kosong
      }

      const safeMsg = r.message
        .replace(/'/g, '"')
        .replace(/\b(\w+)\b(?=\s*:)/g, '"$1"');

      let msg;
      try {
        msg = JSON.parse(safeMsg);
      } catch (e) {
        console.error("❌ JSON.parse gagal:", e.message, "RAW:", r.message);
        return;
      }

      if (msg?.data && Array.isArray(msg.data)) {
        msg.data.forEach(d => {
          const ts = DateTime.fromSeconds(d.datetime).setZone("Asia/Jakarta");
          if (ts < fromDate || ts > toDate) return;

          // 🔑 Rounding ke HARI penuh
          const rounded = ts.startOf("day");

          const key = rounded.toFormat("yyyy-MM-dd");

          if (!grouped[key]) {
            grouped[key] = {
              count: 0,
              waktu: key,
              pH: 0,
              cod: 0,
              tss: 0,
              nh3n: 0,
              debit: 0
            };
          }

          grouped[key].count++;
          grouped[key].pH += parseFloat(d.pH) || 0;
          grouped[key].cod += parseFloat(d.cod) || 0;
          grouped[key].tss += parseFloat(d.tss) || 0;
          grouped[key].nh3n += parseFloat(d.nh3n) || 0;
          grouped[key].debit += parseFloat(d.debit) || 0;
        });
      }
    } catch (e) {
      console.error("Parse error:", e.message, "RAW:", r.message);
    }
  });

  const fullResult = Object.entries(grouped).map(([_, val]) => ({
    waktu: val.waktu,
    pH: Number((val.pH / val.count).toFixed(2)),
    cod: Number((val.cod / val.count).toFixed(2)),
    tss: Number((val.tss / val.count).toFixed(2)),
    nh3n: Number((val.nh3n / val.count).toFixed(2)),
    debit: Number((val.debit / val.count).toFixed(2))
  }));

  const total = fullResult.length;
  const total_pages = Math.ceil(total / per_page);
  const start = (page - 1) * per_page;
  const paginated = fullResult.slice(start, start + per_page);

  return {
    data: paginated,
    page,
    per_page,
    total,
    total_pages
  };
}









