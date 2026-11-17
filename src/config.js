const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadBeacons(file = path.join(ROOT, 'config', 'beacons.json')) {
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const b of list) {
    if (!/^[0-9a-fA-F]{10}$/.test(b.hwid)) {
      throw new Error(`hwid "${b.hwid}" ต้องเป็นเลขฐานสิบหก 10 ตัว`);
    }
    b.hwid = b.hwid.toLowerCase();
  }
  return list;
}

function loadConfig(env = process.env) {
  const beacons = loadBeacons();
  return {
    port: Number(env.PORT || 3000),
    channelId: env.LINE_CHANNEL_ID || '',
    channelSecret: env.LINE_CHANNEL_SECRET || '',
    channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN || '',
    // URL สาธารณะของเซิร์ฟเวอร์ Render ใส่ RENDER_EXTERNAL_URL ให้อัตโนมัติ
    publicUrl: (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || '').replace(/\/$/, ''),
    autoSetWebhook: env.AUTO_SET_WEBHOOK !== 'false',
    demoUserId: env.LINE_DEMO_USER_ID || '',
    shopName: env.SHOP_NAME || 'Beacon Brew',
    cooldownMs: Number(env.COOLDOWN_HOURS || 24) * 60 * 60 * 1000,
    simulatorEnabled: env.SIMULATOR_ENABLED === 'true',
    dataFile: path.join(ROOT, 'data', 'visits.json'),
    beacons,
    findBeacon: (hwid) => beacons.find((b) => b.hwid === String(hwid || '').toLowerCase()),
  };
}

module.exports = { loadConfig, loadBeacons };
