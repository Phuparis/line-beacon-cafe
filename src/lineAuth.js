/**
 * ขอ channel access token จาก LINE เองโดยใช้ Channel ID + Channel secret
 * ไม่ต้องเข้า LINE Developers Console ไปกด Issue
 *
 * LINE เรียก token แบบนี้ว่า short-lived channel access token อายุ 30 วัน
 * ขอได้สูงสุด 30 อันต่อ channel ถ้าเกิน LINE จะยกเลิกอันเก่าสุดให้เอง
 * https://developers.line.biz/en/reference/messaging-api/#issue-shortlived-channel-access-token
 */
const TOKEN_URL = 'https://api.line.me/v2/oauth/accessToken';
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000; // ขอใหม่ก่อนหมดอายุ 1 วัน

async function issueShortLivedToken({ channelId, channelSecret, fetchImpl = fetch }) {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: channelId,
      client_secret: channelSecret,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`ขอ access token จาก LINE ไม่สำเร็จ (${res.status}) เช็ก LINE_CHANNEL_ID และ LINE_CHANNEL_SECRET`);
  }
  return res.json(); // { access_token, expires_in, token_type }
}

/**
 * คืนฟังก์ชัน getToken()
 * - ถ้าใส่ LINE_CHANNEL_ACCESS_TOKEN ไว้ ใช้ค่านั้นเลย
 * - ถ้าไม่ได้ใส่ ขอ token เองแล้วจำไว้ใช้ซ้ำจนใกล้หมดอายุ
 */
function createTokenProvider({ staticToken, channelId, channelSecret, fetchImpl, now = () => Date.now() }) {
  let cached = null;
  let pending = null;

  return async function getToken() {
    if (staticToken) return staticToken;
    if (cached && now() < cached.expiresAt - RENEW_BEFORE_MS) return cached.token;
    if (!pending) {
      pending = issueShortLivedToken({ channelId, channelSecret, fetchImpl })
        .then((r) => {
          cached = { token: r.access_token, expiresAt: now() + r.expires_in * 1000 };
          return cached.token;
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  };
}

/**
 * ตัวส่งข้อความที่ดึง token ล่าสุดก่อนเรียก LINE ทุกครั้ง
 * MessagingApiClient มาจาก @line/bot-sdk (ตอนเทสต์ใส่ตัวปลอมได้)
 */
function createLineClient({ getToken, MessagingApiClient }) {
  let current = { token: null, client: null };

  async function client() {
    const token = await getToken();
    if (token !== current.token) {
      current = { token, client: new MessagingApiClient({ channelAccessToken: token }) };
    }
    return current.client;
  }

  return {
    replyMessage: async (req) => (await client()).replyMessage(req),
    pushMessage: async (req) => (await client()).pushMessage(req),
    setWebhookEndpoint: async (req) => (await client()).setWebhookEndpoint(req),
  };
}

module.exports = { issueShortLivedToken, createTokenProvider, createLineClient };
