const test = require('node:test');
const assert = require('node:assert');
const { createTokenProvider, createLineClient } = require('../src/lineAuth');

function fakeFetch(tokens) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, body: opts.body });
    return { ok: true, json: async () => ({ access_token: tokens[calls.length - 1], expires_in: 2592000 }) };
  };
  return { impl, calls };
}

test('ขอ token ด้วย Channel ID + secret ตามรูปแบบที่ LINE กำหนด', async () => {
  const { impl, calls } = fakeFetch(['tok1']);
  const getToken = createTokenProvider({ channelId: '123', channelSecret: 'sec', fetchImpl: impl });
  assert.strictEqual(await getToken(), 'tok1');
  assert.strictEqual(calls[0].url, 'https://api.line.me/v2/oauth/accessToken');
  assert.strictEqual(calls[0].body, 'grant_type=client_credentials&client_id=123&client_secret=sec');
});

test('ใช้ token เดิมซ้ำจนใกล้หมดอายุ แล้วค่อยขอใหม่', async () => {
  const { impl, calls } = fakeFetch(['tok1', 'tok2']);
  let clock = 0;
  const getToken = createTokenProvider({ channelId: '1', channelSecret: 's', fetchImpl: impl, now: () => clock });
  await getToken();
  clock = 10 * 24 * 3600 * 1000;
  assert.strictEqual(await getToken(), 'tok1');
  clock = 29.5 * 24 * 3600 * 1000;
  assert.strictEqual(await getToken(), 'tok2');
  assert.strictEqual(calls.length, 2);
});

test('ขอพร้อมกันหลายครั้ง ยิงไปหา LINE แค่ครั้งเดียว', async () => {
  const { impl, calls } = fakeFetch(['tok1']);
  const getToken = createTokenProvider({ channelId: '1', channelSecret: 's', fetchImpl: impl });
  await Promise.all([getToken(), getToken(), getToken()]);
  assert.strictEqual(calls.length, 1);
});

test('ถ้าใส่ access token ไว้แล้ว ไม่ขอใหม่', async () => {
  const getToken = createTokenProvider({ staticToken: 'fixed', fetchImpl: () => assert.fail('should not fetch') });
  assert.strictEqual(await getToken(), 'fixed');
});

test('แจ้ง error ที่เข้าใจได้เมื่อ Channel ID หรือ secret ผิด', async () => {
  const getToken = createTokenProvider({
    channelId: '1',
    channelSecret: 'wrong',
    fetchImpl: async () => ({ ok: false, status: 400 }),
  });
  await assert.rejects(getToken(), /LINE_CHANNEL_ID/);
});

test('client สร้าง MessagingApiClient ใหม่เมื่อ token เปลี่ยน', async () => {
  const made = [];
  class FakeClient {
    constructor({ channelAccessToken }) {
      made.push(channelAccessToken);
    }
    async pushMessage() {}
  }
  let token = 'a';
  const client = createLineClient({ getToken: async () => token, MessagingApiClient: FakeClient });
  await client.pushMessage({});
  await client.pushMessage({});
  token = 'b';
  await client.pushMessage({});
  assert.deepStrictEqual(made, ['a', 'b']);
});
