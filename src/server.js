require('dotenv').config();
const path = require('path');
const express = require('express');
const line = require('@line/bot-sdk');

const { loadConfig } = require('./config');
const { CooldownStore } = require('./cooldownStore');
const { createEventHandler } = require('./eventHandler');
const { buildSimulatedBeaconEvent } = require('./simulator');

const config = loadConfig();

const missing = ['channelSecret', 'channelAccessToken'].filter((k) => !config[k]);
if (missing.length) {
  console.error('ยังไม่ได้ใส่ LINE_CHANNEL_SECRET หรือ LINE_CHANNEL_ACCESS_TOKEN ในไฟล์ .env');
  console.error('ดูวิธีในไฟล์ .env.example');
  process.exit(1);
}

const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: config.channelAccessToken });
const store = new CooldownStore(config.dataFile, config.cooldownMs);
const handleEvent = createEventHandler({ client, store, config });

const app = express();

// Webhook จาก LINE
// line.middleware ตรวจ signature ให้ว่าข้อมูลมาจาก LINE จริง ถ้าไม่ใช่จะตอบ 401 ทันที
app.post('/webhook', line.middleware({ channelSecret: config.channelSecret }), (req, res) => {
  // ตอบ 200 กลับไปหา LINE ก่อน แล้วค่อยประมวลผล LINE จะได้ไม่ส่ง event ซ้ำเพราะรอนาน
  res.sendStatus(200);

  for (const event of req.body.events) {
    handleEvent(event)
      .then((result) => console.log(`[${event.type}]`, JSON.stringify(result)))
      .catch((err) => console.error(`[${event.type}] ส่งข้อความไม่สำเร็จ:`, err.message));
  }
});

// หน้าเว็บจำลอง
if (config.simulatorEnabled) {
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/beacons', (req, res) => {
    res.json({
      shopName: config.shopName,
      cooldownHours: config.cooldownMs / 3600000,
      beacons: config.beacons.map(({ hwid, name, zone }) => ({ hwid, name, zone })),
      demoUserReady: Boolean(config.demoUserId),
    });
  });

  app.post('/api/simulate/beacon', express.json(), async (req, res) => {
    if (!config.demoUserId) {
      return res.status(400).json({ error: 'ยังไม่ได้ใส่ LINE_DEMO_USER_ID ในไฟล์ .env' });
    }
    const event = buildSimulatedBeaconEvent({ hwid: req.body.hwid, userId: config.demoUserId });
    try {
      const result = await handleEvent(event);
      res.json({ event, result });
    } catch (err) {
      res.status(502).json({ event, error: `LINE ปฏิเสธการส่ง: ${err.message}` });
    }
  });

  app.post('/api/simulate/reset', (req, res) => {
    store.reset(config.demoUserId);
    res.json({ ok: true });
  });
}

app.listen(config.port, () => {
  console.log(`${config.shopName} bot พร้อมแล้วที่ http://localhost:${config.port}`);
  console.log(`Webhook URL: https://<โดเมนของคุณ>/webhook`);
  if (config.simulatorEnabled) console.log(`หน้าเว็บจำลอง: http://localhost:${config.port}`);
});
