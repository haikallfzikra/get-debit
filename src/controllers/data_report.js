import { DateTime } from 'luxon';
import { prismaClient } from '../application/database.js';


export async function processSensorTableData2Menit(options = {}) {
  const {
    from_date,
    to_date
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

          // kelompokkan per JAM, bukan per 2 menit
          const roundedHour = ts.set({ minute: 0, second: 0, millisecond: 0 });
          const key = roundedHour.toFormat("yyyy-MM-dd HH:00");

          if (!grouped[key]) {
            grouped[key] = {
              waktu: key,
              debit: 0,
              count: 0
            };
          }

          grouped[key].debit += parseFloat(d.debit) || 0;
          grouped[key].count++;
        });
      }
    } catch (e) {
      console.error("Parse error:", e.message, "RAW:", r.message);
    }
  });

  const fullResult = Object.entries(grouped).map(([_, val]) => ({
    waktu: val.waktu,
    debit: parseFloat((val.debit / val.count).toFixed(3))
  }));

  fullResult.sort((a, b) => new Date(a.waktu) - new Date(b.waktu));

  const total_debit = fullResult.reduce((sum, x) => sum + x.debit, 0);

  return {
    data: fullResult,
    total_debit: parseFloat(total_debit.toFixed(3))
  };
}










