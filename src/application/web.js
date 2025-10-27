import express from 'express'
import cors from 'cors';
import { DateTime } from 'luxon';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';
// import authRoutes from '../routes/auth.js';
import { exportExcelPerHari } from '../controllers/client_report.js';
import { processSensorTableDataDaily } from '../controllers/data_report.js';
import { processSensorTableData2Menit } from '../controllers/data_report.js';


const app = express()
app.use(express.json())

const allowedOrigins = [
  'http://localhost:5177',
  'http://192.168.1.56:5177',
  'https://v2.cbi.mdtapps.id',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();

app.post('/download/2menit', async (req, res) => {
  try {
    const { from_date, to_date } = req.body;

    const fromDate = DateTime.fromISO(from_date); 
    const toDate = DateTime.fromISO(to_date);     

    const buffer = await exportExcel2Menit(fromDate, toDate);

    const filename = `report_${fromDate.toFormat("yyyyMMdd")}_to_${toDate.toFormat("yyyyMMdd")}.xlsx`;

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${filename}`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate Excel" });
  }
});

app.post('/download/hourly', async (req, res) => {
  try {
    const { from_date, to_date } = req.body;

    const fromDate = DateTime.fromISO(from_date);
    const toDate = DateTime.fromISO(to_date);

    const buffer = await exportExcelPerJam(fromDate, toDate);

    const filename = `report_hourly_${fromDate.toFormat("yyyyMMdd")}_to_${toDate.toFormat("yyyyMMdd")}.xlsx`;

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${filename}`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate hourly Excel" });
  }
});

app.post('/download/daily', async (req, res) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ error: "Month and year are required" });
    }

    const fromDate = DateTime.local(Number(year), Number(month), 1).startOf("day");
    const toDate = fromDate.endOf("month").endOf("day");

    console.log("Daily fromDate:", fromDate.toISO(), "toDate:", toDate.toISO());

    const buffer = await exportExcelPerHari(fromDate, toDate);

    const filename = `report_daily_${year}_${month}.xlsx`;

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${filename}`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate daily Excel" });
  }
});

app.post('/data/2menit', async (req, res) => {
  try {
    const result = await processSensorTableData2Menit(req.body);
    res.json(result);
    console.log('result', result);
  } catch (err) {
    console.error('[ERROR] /api/sensor-table', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/data/hourly', async (req, res) => {
  try {
    const result = await processSensorTableDataHourly(req.body);
    res.json(result);
  } catch (err) {
    console.error('[ERROR] /api/sensor-table-hourly', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/data/daily', async (req, res) => {
  try {
    const result = await processSensorTableDataDaily(req.body);
    res.json(result);
    console.log('result', result);
    
  } catch (err) {
    console.error('[ERROR] /api/sensor-table-daily', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});






router.get('/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../../public/export', req.params.filename);
  res.download(filePath, req.params.filename, (err) => {
    if (err) {
      console.error(err);
      res.status(404).json({ error: 'File not found' });
    }
  });
});

// app.use('/auth', authRoutes);

app.use(router)

app.listen(3000, '0.0.0.0', () => {
  console.log("Server running on http://0.0.0.0:3000");
});
