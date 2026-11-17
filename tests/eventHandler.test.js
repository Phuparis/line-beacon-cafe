const test = require('node:test');
const assert = require('node:assert');
const { createEventHandler } = require('../src/eventHandler');
const { CooldownStore } = require('../src/cooldownStore');
const { buildSimulatedBeaconEvent } = require('../src/simulator');

const HOUR = 60 * 60 * 1000;
const beacons = [
  { hwid: '0123456789', name: 'ประตูหน้าร้าน', zone: 'entrance' },
  { hwid: 'abcdef0123', name: 'เคาน์เตอร์', zone: 'counter' },
];

function setup() {
  const sent = [];
  const client = {
    replyMessage: async (req) => sent.push({ via: 'reply', ...req }),
    pushMessage: async (req) => sent.push({ via: 'push', ...req }),
  };
  let clock = new Date('2026-11-17T02:00:00Z'); // 09:00 เวลาไทย
  const config = {
    shopName: 'Beacon Brew',
    findBeacon: (hwid) => beacons.find((b) => b.hwid === hwid),
  };
  const store = new CooldownStore(null, 24 * HOUR);
  const handle = createEventHandler({ client, store, config, now: () => clock });
  return { handle, sent, advance: (ms) => (clock = new Date(clock.getTime() + ms)) };
}

const enter = (hwid, extra = {}) => ({
  type: 'beacon',
  replyToken: 'token-' + Math.random(),
  webhookEventId: 'evt-' + Math.random(),
  source: { type: 'user', userId: 'U1' },
  beacon: { hwid, type: 'enter' },
  ...extra,
});

test('มาร้านครั้งแรกได้คูปองต้อนรับ และตอบด้วย reply', async () => {
  const { handle, sent } = setup();
  const r = await handle(enter('0123456789'));
  assert.strictEqual(r.status, 'sent');
  assert.strictEqual(sent[0].via, 'reply');
  assert.match(sent[0].messages[1].text, /WELCOME10/);
});

test('เดินผ่าน beacon เดิมซ้ำภายใน cooldown ไม่ส่งซ้ำ', async () => {
  const { handle, sent, advance } = setup();
  await handle(enter('0123456789'));
  advance(10 * 60 * 1000);
  const r = await handle(enter('0123456789'));
  assert.strictEqual(r.status, 'skipped');
  assert.strictEqual(r.reason, 'cooldown');
  assert.strictEqual(sent.length, 1);
});

test('ครบ cooldown แล้วส่งได้อีก และนับเป็นการมาร้านครั้งที่ 2', async () => {
  const { handle, sent, advance } = setup();
  await handle(enter('0123456789'));
  advance(25 * HOUR);
  const r = await handle(enter('0123456789'));
  assert.strictEqual(r.status, 'sent');
  assert.match(sent[1].messages[0].text, /ยินดีต้อนรับกลับมา/);
});

test('beacon คนละจุดมี cooldown แยกกัน', async () => {
  const { handle } = setup();
  await handle(enter('0123456789'));
  const r = await handle(enter('abcdef0123'));
  assert.strictEqual(r.status, 'sent');
});

test('ครั้งที่ 5 ได้เครื่องดื่มฟรี', async () => {
  const { handle, sent, advance } = setup();
  for (let i = 0; i < 5; i++) {
    await handle(enter('0123456789'));
    advance(25 * HOUR);
  }
  assert.match(sent[4].messages[1].text, /FREECUP/);
});

test('ไม่ตอบ beacon ที่ร้านไม่ได้ลงทะเบียน (กัน beacon ปลอม)', async () => {
  const { handle, sent } = setup();
  const r = await handle(enter('ffffffffff'));
  assert.strictEqual(r.reason, 'unknown-beacon');
  assert.strictEqual(sent.length, 0);
});

test('event เดิมที่ LINE ส่งซ้ำ (webhookEventId เดิม) ทำแค่ครั้งเดียว', async () => {
  const { handle, sent } = setup();
  const e = enter('0123456789');
  await handle(e);
  const r = await handle({ ...e, deliveryContext: { isRedelivery: true } });
  assert.strictEqual(r.reason, 'duplicate-event');
  assert.strictEqual(sent.length, 1);
});

test('event จากหน้าเว็บจำลองไม่มี replyToken จึงส่งแบบ push', async () => {
  const { handle, sent } = setup();
  const r = await handle(buildSimulatedBeaconEvent({ hwid: '0123456789', userId: 'U1' }));
  assert.strictEqual(r.via, 'push');
  assert.strictEqual(sent[0].to, 'U1');
});

test('พิมพ์ myid แล้ว bot ตอบ user ID กลับ', async () => {
  const { handle, sent } = setup();
  await handle({
    type: 'message',
    replyToken: 't',
    webhookEventId: 'e-myid',
    source: { type: 'user', userId: 'U1' },
    message: { type: 'text', text: ' MyID ' },
  });
  assert.match(sent[0].messages[0].text, /U1/);
});

test('จำคนที่แอดเพื่อนหรือทักแชท ไว้เป็นผู้รับข้อความของหน้าเว็บจำลอง', async () => {
  const seen = [];
  const client = { replyMessage: async () => {}, pushMessage: async () => {} };
  const store = new CooldownStore(null, HOUR);
  const config = { shopName: 'x', findBeacon: () => null };
  const handle = createEventHandler({ client, store, config, onUser: (id) => seen.push(id) });
  await handle({ type: 'follow', replyToken: 't', webhookEventId: 'f1', source: { userId: 'U9' } });
  await handle({ type: 'message', replyToken: 't', webhookEventId: 'm1', source: { userId: 'U9' }, message: { type: 'text', text: 'hi' } });
  assert.deepStrictEqual(seen, ['U9', 'U9']);
});
