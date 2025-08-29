# Compliance Checklist (Adafruit JSON Product API)

## 1) Use the official API (don’t scrape)
- Base endpoints (for reference): `/api/products`, `/api/categories`, `/api/product/{pid}`, `/api/category/{cid}`. ([Adafruit][1])

## 2) Follow Adafruit’s explicit API rules
- No image hotlinking. Download to your own storage or proxy through your CDN; don’t embed Adafruit image URLs directly. ([Adafruit][1])
- Throttle requests to ≤ 5/min (cache aggressively; schedule full refreshes). ([Adafruit][1])
- Copyright & permitted use. Content is © Adafruit; they authorize use for your “online store”—contact [email protected] for other use cases or questions. ([Adafruit][1])

## 3) Attribute clearly (products, images, datasheets)
- Product pages: Show a “Source: Adafruit” link that points to each item’s `product_url`. Example: “Source: Adafruit – View product”. The field is provided by the API. ([Adafruit][1])
- Images: Since you can’t hotlink, store locally/CDN and keep a visible credit like “Product image © Adafruit Industries” near the image or in your credits footer. Rule basis: “Do not hotlink images” + copyright notice. ([Adafruit][1])
- Datasheets: Prefer linking to the datasheet from the Adafruit product page rather than re-hosting (manufacturers hold separate rights). Add “Datasheet via Adafruit product page” as the attribution.

## 4) Respect the Adafruit website Terms of Service
- Your use of the site (and any linked assets) is governed by Adafruit’s ToS; if your assistant stores or redistributes substantial portions of their site content or images, get written permission. ([Adafruit][2])

## 5) Caching & freshness
- Cache whole responses (e.g., full product list) and diff updates on a schedule to minimize API hits (meets the 5/min guideline). ([Adafruit][1])
- Surface date fields like `date_added` to drive “new this week” views without hammering the API. ([Adafruit][1])

## 6) UI/UX best practices for attribution
- On every product card: product name, price, “View on Adafruit” link (to `product_url`), note that availability/price may change. The API exposes `product_url`, `product_price`, `product_stock`. ([Adafruit][1])
- Keep a site-wide Credits page that states: “Product data and images sourced from Adafruit Industries’ Products API. © Adafruit Industries.”

## 7) When in doubt, ask
- For use beyond an online store (e.g., broad data redistribution, bulk image mirrors), email [email protected]. ([Adafruit][1])

---

If desired, add an "Attribution & Usage" section to README and middleware that enforces the 5/min rate + local image caching.

[1]: https://www.adafruit.com/products_api?srsltid=AfmBOopmeSPB_YDjTLYAATDUaA_lwhW0v3R2ukjeHSa-Q48Qp9lQbtN_ "Products API"
[2]: https://www.adafruit.com/terms_of_service?srsltid=AfmBOoq7UAMyQ1cMjMUbqioEiovqGAJ5__ClkDy8kSAUPu1PTCbWx6Tl&utm_source=chatgpt.com "Terms of Service"
