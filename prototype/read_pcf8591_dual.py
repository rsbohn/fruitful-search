#!/usr/bin/env python3
"""
Read 8 analog channels using two Adafruit PCF8591 (Quad 8-bit ADC + 8-bit DAC) boards.

Defaults assume addresses 0x48 and 0x49 on I2C bus 1, VCC=3.3V.

Examples:
  - One-shot read (default):
      python prototype/read_pcf8591_dual.py
  - Loop at 2 Hz, 5V supply, custom addresses 0x4A and 0x4B:
      python prototype/read_pcf8591_dual.py --loop --hz 2 --vcc 5.0 --addr-a 0x4A --addr-b 0x4B

Notes:
  - First read after selecting a channel is a “dummy”; it returns the previous sample.
    This script issues a dummy read and then reads again to get the current value.
  - Voltage conversion uses VCC as the reference (val * VCC / 255.0).
  - If only one board is connected, you can omit the other using --no-b or --no-a.
"""

from __future__ import annotations

import argparse
import sys
import time
from typing import Iterable, Optional, Tuple


def _import_bus():
    try:
        from smbus2 import SMBus  # type: ignore

        return SMBus
    except Exception:
        try:
            from smbus import SMBus  # type: ignore

            return SMBus
        except Exception as e:  # pragma: no cover
            print(
                "Error: could not import smbus2 or smbus. Install one on your target system.",
                file=sys.stderr,
            )
            raise


def parse_hex_addr(value: str) -> int:
    v = value.strip().lower()
    if v.startswith("0x"):
        return int(v, 16)
    return int(v)


def read_single_channel(bus, addr: int, ch: int) -> int:
    # Control byte: 0x40 selects ADC input mode; low bits select channel 0-3
    ctrl = 0x40 | (ch & 0x03)
    bus.write_byte(addr, ctrl)
    # Dummy read (discard)
    try:
        bus.read_byte(addr)
    except OSError:
        # Some adapters require a small delay before the first read
        time.sleep(0.002)
        bus.read_byte(addr)
    # Actual sample
    val = bus.read_byte(addr)
    return int(val & 0xFF)


def read_board(bus, addr: int, channels: Iterable[int]) -> Tuple[list[int], list[int]]:
    raw: list[int] = []
    errs: list[int] = []
    for ch in channels:
        try:
            raw.append(read_single_channel(bus, addr, ch))
            errs.append(0)
        except Exception:
            raw.append(0)
            errs.append(1)
    return raw, errs


def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Read two PCF8591 boards over I2C")
    ap.add_argument("--bus", type=int, default=1, help="I2C bus number (default: 1)")
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

    SMBus = _import_bus()
    try:
        bus = SMBus(args.bus)
    except Exception as e:
        print(f"Failed to open I2C bus {args.bus}: {e}", file=sys.stderr)
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
                raw, errs = read_board(bus, addr, channels)
                readings[label] = {ch: raw[i] for i, ch in enumerate(channels)}  # type: ignore
                if any(errs):
                    print(
                        f"Warning: read errors on board {label} at 0x{addr:02X} (channels with errors set to 0)",
                        file=sys.stderr,
                    )
            print_row(ts, readings)
            if not args.loop:
                break
            if period > 0:
                time.sleep(period)
    finally:
        try:
            bus.close()
        except Exception:
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

