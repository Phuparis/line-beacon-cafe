const test = require('node:test');
const assert = require('node:assert');
const { buildAdvertisingData, toHex } = require('../src/lineSimpleBeacon');

test('สร้างข้อมูลตรงกับตัวอย่างที่ 2 ในสเปก LINE Simple Beacon', () => {
  const bytes = buildAdvertisingData('8ADFAF4326', '20170228');
  assert.strictEqual(toHex(bytes), '02 01 06 03 03 6F FE 0E 16 6F FE 02 8A DF AF 43 26 7F 20 17 02 28');
});

test('สร้างข้อมูลตรงกับตัวอย่างที่ 1 ในสเปก (device message ยาวสุด 13 ไบต์)', () => {
  const bytes = buildAdvertisingData('32AF519E88', '0032006900FAFFFF000199FF88');
  assert.strictEqual(bytes.length, 31);
  assert.strictEqual(
    toHex(bytes),
    '02 01 06 03 03 6F FE 17 16 6F FE 02 32 AF 51 9E 88 7F 00 32 00 69 00 FA FF FF 00 01 99 FF 88'
  );
});

test('ปฏิเสธ HWID ที่ไม่ใช่เลขฐานสิบหก 10 ตัว', () => {
  assert.throws(() => buildAdvertisingData('12345', '00'));
  assert.throws(() => buildAdvertisingData('zzzzzzzzzz', '00'));
});
