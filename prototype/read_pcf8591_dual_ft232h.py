#!/usr/bin/env python3
"""
Read 8 analog channels using two Adafruit PCF8591 boards via an FT232H USB-to-I2C bridge.

This uses CircuitPython Blinka with the FT232H (pyftdi) backend. It does not require
Linux i2c-dev; works on macOS/Windows/Linux.

Setup (host):
  pip install adafruit-blinka pyftdi
  export BLINKA_FT232H=1

Examples:
  python prototype/read_pcf8591_dual_ft232h.py
  python prototype/read_pcf8591_dual_ft232h.py --loop --hz 2 --vcc 5.0 --addr-a 0x4A --addr-b 0x4B

Note: FT232H GPIO is 3.3V only (not 5V tolerant). Use a level shifter if needed.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from typing import Optional


def parse_hex_addr(value: str) -> int:
    v = value.strip().lower()
    if v.startswith("0x"):
        return int(v, 16)
    return int(v)


def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Read two PCF8591 boards over I2C via FT232H (Blinka)")
    ap.add_argument("--addr-a", type=parse_hex_addr, default=0x48, help="I2C address for board A (default: 0x48)")
    ap.add_argument("--addr-b", type=parse_hex_addr, default=0x49, help="I2C address for board B (default: 0x49)")
    ap.add_argument("--no-a", action="store_true", help="Skip reading board A")
    ap.add_argument("--no-b", action="store_true", help="Skip reading board B")
    ap.add_argument("--channels", type=str, default="0,1,2,3", help="Comma-separated channel list (0-3)")
    ap.add_argument("--vcc", type=float, default=3.3, help="Board supply voltage in volts (default: 3.3)")
    ap.add_argument("--loop", action="store_true", help="Continuously read and print")
    ap.add_argument("--hz", type=float, default=1.0, help="Loop frequency in Hz (default: 1.0)")
    ap.add_argument("--csv", action="store_true", help="Output readings as CSV rows instead of pretty text")
    args = ap.parse_args(argv)

    channels = [int(x) for x in args.channels.split(",") if x.strip() != ""]
    for ch in channels:
        if ch < 0 or ch > 3:
            ap.error("Channels must be in 0..3 for PCF8591")

    # Force Blinka to use FT232H backend
    os.environ.setdefault("BLINKA_FT232H", "1")
    try:
        import board  # type: ignore
        import busio  # type: ignore
    except Exception as e:
        print("Blinka not available. Install with: pip install adafruit-blinka pyftdi", file=sys.stderr)
        return 2

    try:
        i2c = busio.I2C(board.SCL, board.SDA)
    except Exception as e:
        print(f"Failed to open FT232H I2C: {e}", file=sys.stderr)
        return 2

    addrs = []
    if not args.no_a:
        addrs.append(("A", args.addr_a))
    if not args.no_b:
        addrs.append(("B", args.addr_b))
    if not addrs:
        print("Nothing to do: both boards disabled with --no-a and --no-b", file=sys.stderr)
        return 2

    period = 1.0 / args.hz if args.hz > 0 else 0.0

    def read_channel(addr: int, ch: int) -> int:
        # Control byte: 0x40 selects single-ended inputs; low bits choose 0-3
        ctrl = bytes([0x40 | (ch & 0x03)])
        # Select channel
        i2c.writeto(addr, ctrl)
        # Dummy read returns previous sample; discard
        buf = bytearray(1)
        i2c.readfrom_into(addr, buf)
        # Actual reading
        i2c.readfrom_into(addr, buf)
        return int(buf[0])

    def print_header():
        if args.csv:
            cols = ["ts"]
            for label, _ in addrs:
                for ch in channels:
                    cols.append(f"{label}{ch}_raw")
            for label, _ in addrs:
                for ch in channels:
                    cols.append(f"{label}{ch}_V")
            print(",".join(cols))

    def print_row(ts: float, readings: dict[str, list[int]]):
        if args.csv:
            row: list[str] = [f"{ts:.3f}"]
            for label, _ in addrs:
                for ch in channels:
                    row.append(str(readings[label][ch]))
            for label, _ in addrs:
                for ch in channels:
                    v = readings[label][ch] * args.vcc / 255.0
                    row.append(f"{v:.4f}")
            print(",".join(row))
        else:
            tstr = time.strftime("%H:%M:%S", time.localtime(ts))
            print(f"[{tstr}] PCF8591 readings (VCC={args.vcc:.2f}V)")
            for label, _ in addrs:
                raws = [readings[label][ch] for ch in channels]
                volts = [r * args.vcc / 255.0 for r in raws]
                raw_str = " ".join(f"{r:3d}" for r in raws)
                v_str = " ".join(f"{v:5.3f}V" for v in volts)
                print(f"  Board {label}: RAW [{raw_str}]  VOLT [{v_str}]")

    print_header()

    try:
        while True:
            ts = time.time()
            readings: dict[str, list[int]] = {}
            for label, addr in addrs:
                vals: list[int] = []
                for ch in channels:
                    try:
                        vals.append(read_channel(addr, ch))
                    except Exception:
                        vals.append(0)
                readings[label] = {ch: vals[i] for i, ch in enumerate(channels)}  # type: ignore
            print_row(ts, readings)
            if not args.loop:
                break
            if period > 0:
                time.sleep(period)
    finally:
        try:
            i2c.deinit()
        except Exception:
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

