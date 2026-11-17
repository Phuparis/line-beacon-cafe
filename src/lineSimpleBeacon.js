/**
 * สร้างข้อมูลที่ beacon ต้องปล่อยออกไปตามสเปก LINE Simple Beacon
 * https://github.com/line/line-simple-beacon/blob/master/README.en.md
 *
 * โครงสร้างข้อมูล (advertising data):
 *   02 01 06            Flags
 *   03 03 6F FE         Complete list of 16-bit service UUIDs = 0xFE6F
 *   LL 16 6F FE <frame> Service data ของ UUID 0xFE6F
 *
 * frame = 02 (frame type) + HWID 5 ไบต์ + 7F (measured TxPower) + device message 1-13 ไบต์
 */
const LINE_SERVICE_UUID = 'FE6F';

function hexToBytes(hex) {
  const clean = hex.replace(/\s+/g, '');
  if (!/^([0-9a-fA-F]{2})*$/.test(clean)) throw new Error(`"${hex}" ไม่ใช่เลขฐานสิบหกที่ถูกต้อง`);
  return Array.from({ length: clean.length / 2 }, (_, i) => parseInt(clean.slice(i * 2, i * 2 + 2), 16));
}

function toHex(bytes) {
  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function buildFrame(hwid, deviceMessageHex = '00') {
  if (!/^[0-9a-fA-F]{10}$/.test(hwid)) throw new Error('HWID ต้องเป็นเลขฐานสิบหก 10 ตัว เช่น 0123456789');
  const message = hexToBytes(deviceMessageHex);
  if (message.length < 1 || message.length > 13) throw new Error('device message ต้องยาว 1-13 ไบต์');
  return [0x02, ...hexToBytes(hwid), 0x7f, ...message];
}

function buildAdvertisingData(hwid, deviceMessageHex) {
  const frame = buildFrame(hwid, deviceMessageHex);
  const serviceData = [0x16, 0x6f, 0xfe, ...frame];
  return [0x02, 0x01, 0x06, 0x03, 0x03, 0x6f, 0xfe, serviceData.length, ...serviceData];
}

module.exports = { LINE_SERVICE_UUID, buildFrame, buildAdvertisingData, hexToBytes, toHex };
