/*
 * ESP32 เป็น LINE Simple Beacon
 *
 * วิธีใช้:
 * 1. ขอ Hardware ID จาก LINE Official Account Manager (หน้า LINE Beacon)
 * 2. ใส่ HWID ด้านล่าง (เลขฐานสิบหก 10 ตัว)
 * 3. Arduino IDE: ติดตั้งบอร์ด "esp32" by Espressif แล้วอัปโหลด
 *
 * สเปก: https://github.com/line/line-simple-beacon/blob/master/README.en.md
 *
 * ข้อมูลที่ปล่อยออกไป:
 *   02 01 06                 Flags
 *   03 03 6F FE              Service UUID 0xFE6F
 *   LL 16 6F FE 02 <HWID 5 ไบต์> 7F <device message>
 */

#include <BLEDevice.h>
#include <esp_gap_ble_api.h>
#include <esp_bt.h>

// ---- ตั้งค่าตรงนี้ ----
const char *HWID = "0123456789";             // Hardware ID ที่ได้จาก LINE
const uint8_t DEVICE_MESSAGE[] = {0x00};     // 1-13 ไบต์ จะไปโผล่เป็น beacon.dm ใน webhook
const esp_power_level_t TX_POWER = ESP_PWR_LVL_N12;  // ลดกำลังส่ง ให้สัญญาณครอบคลุมแค่ในร้าน
// ----------------------

uint8_t hexNibble(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return 0;
}

void setup() {
  Serial.begin(115200);
  BLEDevice::init("LINE Beacon");

  uint8_t adv[31];
  size_t n = 0;

  // Flags
  adv[n++] = 0x02; adv[n++] = 0x01; adv[n++] = 0x06;
  // Complete list of 16-bit service UUIDs: 0xFE6F
  adv[n++] = 0x03; adv[n++] = 0x03; adv[n++] = 0x6F; adv[n++] = 0xFE;
  // Service data
  const size_t msgLen = sizeof(DEVICE_MESSAGE);
  adv[n++] = 3 + 1 + 5 + 1 + msgLen;  // ความยาว: AD type + UUID + frame
  adv[n++] = 0x16;
  adv[n++] = 0x6F; adv[n++] = 0xFE;
  adv[n++] = 0x02;                                  // frame type
  for (int i = 0; i < 5; i++) {                     // HWID 5 ไบต์
    adv[n++] = (hexNibble(HWID[i * 2]) << 4) | hexNibble(HWID[i * 2 + 1]);
  }
  adv[n++] = 0x7F;                                  // measured TxPower (สเปกกำหนดให้เป็น 0x7F)
  for (size_t i = 0; i < msgLen; i++) adv[n++] = DEVICE_MESSAGE[i];

  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_ADV, TX_POWER);
  esp_ble_gap_config_adv_data_raw(adv, n);
  delay(100);  // รอให้ตั้งค่าข้อมูลเสร็จก่อนเริ่มปล่อยสัญญาณ

  esp_ble_adv_params_t params = {};
  params.adv_int_min = 0xF4;  // 244 x 0.625 ms = 152.5 ms
  params.adv_int_max = 0xF4;
  params.adv_type = ADV_TYPE_NONCONN_IND;
  params.own_addr_type = BLE_ADDR_TYPE_PUBLIC;
  params.channel_map = ADV_CHNL_ALL;
  params.adv_filter_policy = ADV_FILTER_ALLOW_SCAN_ANY_CON_ANY;
  esp_ble_gap_start_advertising(&params);

  Serial.print("LINE Simple Beacon started, HWID = ");
  Serial.println(HWID);
}

void loop() {
  delay(1000);
}
