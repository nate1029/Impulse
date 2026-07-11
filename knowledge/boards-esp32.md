# ESP32 boards — quick reference

## Common FQBNs
- `esp32:esp32:esp32` — generic ESP32 dev board
- `esp32:esp32:esp32s3` — ESP32-S3 dev board
- `esp32:esp32:esp32c3` — ESP32-C3 dev board
- `esp32:esp32:esp32wrover` — ESP32 WROVER (has PSRAM)

## Default I²C pins (Arduino-ESP32 core)
- ESP32: SDA=21, SCL=22
- ESP32-S3: SDA=8, SCL=9 (varies by devkit — verify with `list_ports` + user)
- ESP32-C3: SDA=8, SCL=9

## SPI pins (VSPI default)
- ESP32: MOSI=23, MISO=19, SCK=18, SS=5

## Serial
- Native USB CDC on S3/C3 needs `USBSerial` or `Serial` with `USB_CDC_ON_BOOT=1` build flag.
- Classic ESP32 uses UART0 on GPIO 1/3 for Serial. Do not use these for user I/O.

## Gotchas
- GPIOs 6–11 are wired to internal SPI flash. Never touch on classic ESP32.
- GPIO 34–39 are input-only (no pull-up, no output).
- Boot mode: GPIO 0 must be HIGH at boot for normal run; LOW enters flash mode.
- Deep sleep wake pins: RTC GPIOs only (0, 2, 4, 12–15, 25–27, 32–39).

## Power
- 3.3V logic. 5V-tolerant only on some pins — assume NOT tolerant unless verified.
- USB current from most devkits: ~500mA usable.
