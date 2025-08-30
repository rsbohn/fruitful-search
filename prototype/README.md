Prototype utilities

- `read_pcf8591_dual.py`: Read up to 8 analog channels using two Adafruit PCF8591 boards over I2C.
- `read_pcf8591_dual_mcp2221.py`: Same, but via MCP2221 USB–I2C using CircuitPython Blinka (no /dev/i2c needed).
- `read_pcf8591_dual_ft232h.py`: Same, but via FT232H USB–I2C using CircuitPython Blinka (pyftdi backend).

Quick start

- One-shot read (addresses 0x48 and 0x49 on I2C bus 1, VCC=3.3V):
  - `python prototype/read_pcf8591_dual.py`
- Loop at 2 Hz, 5V supply:
  - `python prototype/read_pcf8591_dual.py --loop --hz 2 --vcc 5.0`
- Custom addresses (e.g., 0x4A and 0x4B):
  - `python prototype/read_pcf8591_dual.py --addr-a 0x4A --addr-b 0x4B`
- CSV output for logging:
  - `python prototype/read_pcf8591_dual.py --loop --csv > readings.csv`

MCP2221 (USB–I2C) path

- Install deps: `pip install adafruit-blinka hidapi`
- Run (Blinka auto-selects MCP2221):
  - `python prototype/read_pcf8591_dual_mcp2221.py`
- Options mirror the smbus script: `--addr-a/--addr-b`, `--channels`, `--vcc`, `--loop`, `--hz`, `--csv`.
- Linux udev (optional): add a rule for MCP2221 to avoid sudo:
  - `SUBSYSTEM=="hidraw", ATTRS{idVendor}=="04d8", ATTRS{idProduct}=="00dd", MODE="0666"`

FT232H (USB–I2C) path

- Install deps: `pip install adafruit-blinka pyftdi`
- Set backend: `export BLINKA_FT232H=1`
- Run:
  - `python prototype/read_pcf8591_dual_ft232h.py`
- Notes: FT232H I/O is 3.3V (not 5V tolerant). Use a level shifter for 5V logic.

Notes

- Requires `smbus2` or `smbus` on the target (e.g. Raspberry Pi: `sudo apt install -y python3-smbus i2c-tools`).
- The PCF8591 uses VCC as its ADC reference; set `--vcc` to match your supply.
- The first read after changing channels is discarded automatically to get a current sample.
