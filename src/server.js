require('dotenv').config();
const path = require('path');
const express = require('express');
const line = require('@line/bot-sdk');

const { loadConfig } = require('./config');
const { CooldownStore } = require('./cooldownStore');
const { createEventHandler } = require('./eventHandler');
const { buildSimulatedBeaconEvent } = require('./simulator');
const { createTokenProvider, createLineClient } = require('./lineAuth');

const config = loadConfig();

if (!config.channelSecret || !(config.channelAccessToken || config.channelId)) {
  console.error('ต้องใส่ LINE_CHANNEL_SECRET และ LINE_CHANNEL_ID (หรือ LINE_CHANNEL_ACCESS_TOKEN)');
  console.error('ดูวิธีในไฟล์ .env.example');
  process.exit(1);
}

const getToken = createTokenProvider({
  staticToken: config.channelAccessToken,
  channelId: config.channelId,
  channelSecret: config.channelSecret,
});
const client = createLineClient({ getToken, MessagingApiClient: line.messagingApi.MessagingApiClient });
const store = new CooldownStore(config.dataFile, config.cooldownMs);

// ผู้รับข้อความจากหน้าเว็บจำลอง: ใช้ค่าใน .env ถ้ามี
// ถ้าไม่มี ใช้คนล่าสุดที่แอดเพื่อนหรือทักแชทร้าน
const getDemoUser = () => config.demoUserId || store.getDemoUser();
const onUser = (userId) => {
  if (!config.demoUserId) store.setDemoUser(userId);
};

const handleEvent = createEventHandler({ client, store, config, onUser });

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

app.get('/health', (req, res) => res.json({ ok: true }));

// หน้าเว็บจำลอง
if (config.simulatorEnabled) {
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/beacons', (req, res) => {
    res.json({
      shopName: config.shopName,
      cooldownHours: config.cooldownMs / 3600000,
      beacons: config.beacons.map(({ hwid, name, zone }) => ({ hwid, name, zone })),
      demoUserReady: Boolean(getDemoUser()),
    });
  });

  app.post('/api/simulate/beacon', express.json(), async (req, res) => {
    const userId = getDemoUser();
    if (!userId) {
      return res.status(400).json({
        error: 'ยังไม่รู้ว่าจะส่งข้อความหาใคร ให้แอดร้านเป็นเพื่อนใน LINE แล้วพิมพ์อะไรก็ได้หาร้าน 1 ครั้ง',
      });
    }
    const event = buildSimulatedBeaconEvent({ hwid: req.body.hwid, userId });
    try {
      const result = await handleEvent(event);
      res.json({ event, result });
    } catch (err) {
      res.status(502).json({ event, error: `LINE ปฏิเสธการส่ง: ${err.message}` });
    }
  });

  app.post('/api/simulate/reset', (req, res) => {
    const userId = getDemoUser();
    if (userId) store.reset(userId);
    res.json({ ok: true });
  });
}

// ตั้ง Webhook URL ใน LINE ให้อัตโนมัติ เมื่อรู้ URL สาธารณะของเซิร์ฟเวอร์ (เช่น บน Render)
async function registerWebhook() {
  if (!config.publicUrl || !config.autoSetWebhook) return;
  const endpoint = `${config.publicUrl}/webhook`;
  try {
    await client.setWebhookEndpoint({ endpoint });
    console.log(`ตั้ง Webhook URL ใน LINE แล้ว: ${endpoint}`);
  } catch (err) {
    console.error(`ตั้ง Webhook URL อัตโนมัติไม่สำเร็จ ให้ไปใส่เองที่ LINE Developers Console: ${err.message}`);
  }
}

app.listen(config.port, () => {
  console.log(`${config.shopName} bot พร้อมแล้วที่พอร์ต ${config.port}`);
  if (config.simulatorEnabled) console.log(`หน้าเว็บจำลอง: ${config.publicUrl || `http://localhost:${config.port}`}`);
  registerWebhook();
});
