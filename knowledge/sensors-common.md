# Common IoT sensors — wiring & library cheatsheet

## DHT22 / DHT11 (temp + humidity, 1-wire)
- Lib: `DHT sensor library` by Adafruit + `Adafruit Unified Sensor`.
- Wiring: VCC→3.3V or 5V, GND→GND, DATA→any digital pin, 10kΩ pull-up between VCC and DATA.
- `#include <DHT.h>` → `DHT dht(pin, DHT22);` → `dht.begin();` → `dht.readTemperature();`
- Cold-start delay: ~2s before first read.

## BMP280 / BME280 (pressure/temp/humidity, I²C)
- Lib: `Adafruit BMP280 Library` or `Adafruit BME280 Library`.
- I²C address: 0x76 or 0x77 (check board's SDO pin).
- BME280 = BMP280 + humidity. Same footprint, different die.

## MPU6050 (accel + gyro, I²C)
- Lib: `MPU6050` by Electronic Cats or `Adafruit MPU6050`.
- I²C address: 0x68 (AD0=LOW) or 0x69 (AD0=HIGH).
- Needs `Wire.begin()` before `mpu.begin()`.

## HC-SR04 (ultrasonic distance)
- No library needed. Pulse TRIG for 10µs, measure ECHO with `pulseIn()`.
- Distance cm = pulse µs / 58.
- 5V module — level-shift ECHO for ESP32 (3.3V), or use a divider.

## SSD1306 OLED (128×64, I²C)
- Lib: `Adafruit SSD1306` + `Adafruit GFX`.
- I²C address: 0x3C typical (0x3D on some).
- Init: `display.begin(SSD1306_SWITCHCAPVCC, 0x3C)`.

## NeoPixel / WS2812
- Lib: `Adafruit NeoPixel` or `FastLED`.
- Needs 5V logic. ESP32/3.3V may need a level shifter (74HCT245 or similar) for reliable data.
- Add a ~1000µF capacitor across VCC/GND on the strip.
- 300–500Ω resistor in series with the data line.

## SD card (SPI)
- Lib: builtin `SD` on classic AVR/ESP. `SD_MMC` for ESP32 SDIO mode.
- Format: FAT32 only.
- CS pin must NOT float — pull HIGH before init if using multiple SPI devices.
