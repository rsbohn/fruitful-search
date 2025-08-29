"""
Download the Adafruit product catalog as JSON and save to data/raw/adafruit_catalog.json.

References:
- Adafruit Products API: https://www.adafruit.com/products_api
- Compliance: See docs/devlog/2025-08-29-compliance.md
"""
import requests
import time
import os

API_URL = "https://www.adafruit.com/api/products"
OUT_PATH = "data/raw/adafruit_catalog.json"
MAX_PER_MIN = 5


def download_catalog():
    print(f"Downloading Adafruit catalog from {API_URL}...")
    resp = requests.get(API_URL)
    resp.raise_for_status()
    catalog = resp.json()
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        import json
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    print(f"Saved catalog to {OUT_PATH}.")


def main():
    download_catalog()
    print("Done.")

if __name__ == "__main__":
    main()
