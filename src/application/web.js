import express from 'express'
import cors from 'cors';
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


const router = express.Router();



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



// app.use('/auth', authRoutes);

app.use(router)

app.listen(3000, '0.0.0.0', () => {
  console.log("Server running on http://0.0.0.0:3000");
});
