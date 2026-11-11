#!/usr/bin/env python3
"""Download split-adjusted daily closes from Yahoo Finance into compact JSON.

Writes data/market.json (GitHub Pages source) and public/data/market.json (Vite).
Does not invent prices. Symbols that fail are listed and omitted.
"""

from __future__ import annotations

import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUTS = [ROOT / "data" / "market.json", ROOT / "public" / "data" / "market.json"]
NY = ZoneInfo("America/New_York")
PERIOD1 = 631152000  # 1990-01-01 UTC
PERIOD2 = 1900000000

SYMBOLS = [
    ("AAPL", "Apple", "stock"),
    ("MSFT", "Microsoft", "stock"),
    ("NVDA", "NVIDIA", "stock"),
    ("TSLA", "Tesla", "stock"),
    ("AMZN", "Amazon", "stock"),
    ("KO", "Coca-Cola", "stock"),
    ("JNJ", "Johnson & Johnson", "stock"),
    ("XOM", "Exxon Mobil", "stock"),
    ("GE", "GE", "stock"),
    ("GOOGL", "Alphabet", "stock"),
    ("META", "Meta Platforms", "stock"),
    ("JPM", "JPMorgan Chase", "stock"),
    ("WMT", "Walmart", "stock"),
    ("DIS", "Walt Disney", "stock"),
    ("IBM", "IBM", "stock"),
    ("INTC", "Intel", "stock"),
    ("CSCO", "Cisco", "stock"),
    ("PFE", "Pfizer", "stock"),
    ("BA", "Boeing", "stock"),
    ("CAT", "Caterpillar", "stock"),
    ("NKE", "Nike", "stock"),
    ("MCD", "McDonald's", "stock"),
    ("HD", "Home Depot", "stock"),
    ("V", "Visa", "stock"),
    ("MA", "Mastercard", "stock"),
    ("UNH", "UnitedHealth", "stock"),
    ("PG", "Procter & Gamble", "stock"),
    ("PEP", "PepsiCo", "stock"),
    ("COST", "Costco", "stock"),
    ("NFLX", "Netflix", "stock"),
    ("AMD", "AMD", "stock"),
    ("ORCL", "Oracle", "stock"),
    ("CRM", "Salesforce", "stock"),
    ("ADBE", "Adobe", "stock"),
    ("QCOM", "Qualcomm", "stock"),
    ("T", "AT&T", "stock"),
    ("VZ", "Verizon", "stock"),
    ("CVX", "Chevron", "stock"),
    ("BAC", "Bank of America", "stock"),
    ("WFC", "Wells Fargo", "stock"),
    ("GS", "Goldman Sachs", "stock"),
    ("F", "Ford", "stock"),
    ("GM", "General Motors", "stock"),
    ("SPY", "SPDR S&P 500 ETF", "etf"),
    ("QQQ", "Invesco QQQ", "etf"),
    ("GLD", "SPDR Gold Shares", "etf"),
    ("TLT", "iShares 20+ Year Treasury Bond ETF", "etf"),
    ("DIA", "SPDR Dow Jones Industrial Average ETF", "etf"),
    ("IWM", "iShares Russell 2000 ETF", "etf"),
    ("EEM", "iShares MSCI Emerging Markets ETF", "etf"),
    ("^GSPC", "S&P 500", "index"),
    ("BTC-USD", "Bitcoin", "crypto"),
]


def round_px(price: float) -> float:
    if price >= 1000:
        return round(price, 2)
    if price >= 1:
        return round(price, 4)
    return round(price, 6)


def ymd(ts: int) -> int:
    dt = datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(NY)
    return dt.year * 10000 + dt.month * 100 + dt.day


def to_date(num: int):
    return datetime(num // 10000, (num // 100) % 100, num % 100)


def fetch(symbol: str):
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        + urllib.request.quote(symbol)
        + f"?period1={PERIOD1}&period2={PERIOD2}&interval=1d&includeAdjustedClose=true"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as res:
        payload = json.load(res)
    result = payload["chart"]["result"][0]
    stamps = result["timestamp"]
    quote = result["indicators"]["quote"][0]["close"]
    adj = result["indicators"].get("adjclose", [{}])[0].get("adjclose") or quote
    rows = []
    last_ymd = None
    for ts, raw, adj_px in zip(stamps, quote, adj):
        price = adj_px if isinstance(adj_px, (int, float)) else raw
        if not isinstance(price, (int, float)) or price <= 0:
            continue
        day = ymd(ts)
        if last_ymd is not None and day <= last_ymd:
            continue
        rows.append((day, round_px(float(price))))
        last_ymd = day
    if len(rows) < 140:
        raise RuntimeError(f"{symbol} returned only {len(rows)} rows")
    t0 = rows[0][0]
    prev = to_date(t0)
    gaps = [0]
    closes = [rows[0][1]]
    for day, price in rows[1:]:
        current = to_date(day)
        gaps.append((current - prev).days)
        closes.append(price)
        prev = current
    return {"t0": t0, "g": gaps, "c": closes}


def main():
    symbols = {}
    failed = []
    for symbol, name, kind in SYMBOLS:
        try:
            packed = fetch(symbol)
            packed["name"] = name
            packed["kind"] = kind
            symbols[symbol] = packed
            print(f"ok {symbol} {len(packed['c'])} {packed['t0']} -> {packed['c'][-1]}")
        except Exception as exc:
            failed.append(f"{symbol}: {exc}")
            print(f"FAIL {symbol}: {exc}")
        time.sleep(0.25)
    if len(symbols) < 40:
        raise SystemExit(f"only {len(symbols)} symbols downloaded; refusing to write a thin file")
    doc = {
        "source": "Yahoo Finance",
        "sourceUrl": "https://finance.yahoo.com/",
        "field": "adjclose",
        "note": "Split-adjusted daily closes from the Yahoo Finance chart endpoint. Prices are not invented. This is not financial advice.",
        "fetched": datetime.now(timezone.utc).date().isoformat(),
        "symbols": symbols,
    }
    raw = json.dumps(doc, separators=(",", ":")).encode()
    for path in OUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
        print(f"wrote {path} {len(raw)} bytes, {len(symbols)} symbols")
    if failed:
        print("FAILED")
        for line in failed:
            print(line)


if __name__ == "__main__":
    main()
