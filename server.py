from __future__ import annotations

from email.parser import BytesParser
from email.policy import default as email_policy
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import time
import uuid
from difflib import get_close_matches
from datetime import datetime
from html import escape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

try:
    from openpyxl import load_workbook
except ModuleNotFoundError:
    bundled_site_packages = Path.home() / ".cache" / "codex-runtimes" / "codex-primary-runtime" / "dependencies" / "python" / "Lib" / "site-packages"
    if bundled_site_packages.exists():
        sys.path.append(str(bundled_site_packages))
    from openpyxl import load_workbook


if getattr(sys, 'frozen', False):
    ROOT = Path(sys.executable).resolve().parent
    # Save writeable data in user's home folder to avoid permission errors when installed in Program Files
    DATA_DIR = Path.home() / ".tally_automation"
    DATA_DIR.mkdir(exist_ok=True)
    DB_PATH = DATA_DIR / "destock.db"
    UPLOAD_DIR = DATA_DIR / "uploads"
else:
    ROOT = Path(__file__).resolve().parent
    DB_PATH = ROOT / "destock.db"
    UPLOAD_DIR = ROOT / "uploads"

# Global variables to cache Tally process checking result (prevents rapid process spawning/cpu load)
_last_tally_check_time = 0.0
_last_tally_check_result = False
TEMPLATE_PATH = ROOT / "Tamplate" / "simple tally template..xlsx"
TEMPLATE_PATHS = {
    "purchase-credit": ROOT / "Tamplate" / "purchase credit" / "simple tally template.xlsx",
    "sale-credit": ROOT / "Tamplate" / "sale credit" / "simple tally template.xlsx",
    "payment": ROOT / "Tamplate" / "payment" / "simple tally template.xlsx",
    "received": ROOT / "Tamplate" / "received" / "simple tally template.xlsx",
    "contra": ROOT / "Tamplate" / "Contra" / "simple tally template.xlsx",
}
TALLY_URL = "http://127.0.0.1:9000"

import requests
tally_session = requests.Session()


class UploadedFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.content = content


def parse_content_type(value: str) -> tuple[str, dict[str, str]]:
    parts = [part.strip() for part in value.split(";") if part.strip()]
    if not parts:
        return "", {}
    params: dict[str, str] = {}
    for part in parts[1:]:
        if "=" in part:
            key, raw = part.split("=", 1)
            params[key.strip().lower()] = raw.strip().strip('"')
    return parts[0].lower(), params


def read_multipart_file(handler: SimpleHTTPRequestHandler, field_name: str) -> UploadedFile | None:
    content_type = handler.headers.get("Content-Type", "")
    ctype, params = parse_content_type(content_type)
    if ctype != "multipart/form-data" or not params.get("boundary"):
        return None
    length = int(handler.headers.get("Content-Length") or 0)
    body = handler.rfile.read(length)
    raw_message = (
        f"Content-Type: {content_type}\r\n"
        "MIME-Version: 1.0\r\n\r\n"
    ).encode("utf-8") + body
    message = BytesParser(policy=email_policy).parsebytes(raw_message)
    for part in message.iter_parts():
        disposition = part.get_content_disposition()
        name = part.get_param("name", header="content-disposition")
        filename = part.get_filename()
        if disposition == "form-data" and name == field_name and filename:
            return UploadedFile(Path(filename).name, part.get_payload(decode=True) or b"")
    return None

EXPECTED_COLUMNS = [
    "date",
    "invoice no",
    "voucher type",
    "party ledger or cash",
    "total amount",
]

REQUIRED_COLUMN_ALIASES = {
    "date": ["date"],
    "invoice no": ["invoice no", "invoice number", "voucher no", "voucher number"],
    "voucher type": ["voucher type", "entry type", "transaction type"],
    "party ledger or cash": ["party ledger or cash", "party ledger , income , expenses , cash dr", "party ledger, income, expenses, cash dr", "party ledger income expenses cash dr", "income / payment received", "income/payment received", "payment received", "received ledger", "receipt ledger", "debit (inflow)", "debit inflow", "inflow", "debit ledger", "party ledger", "income", "expenses", "cash dr"],
    "total amount": ["total amount", "amount", "total"],
}

OPTIONAL_COLUMN_ALIASES = {
    "CGST": ["CGST", "cgst"],
    "SGST": ["SGST", "sgst"],
    "IGST": ["IGST", "igst"],
    "gst rate": ["gst rate", "tax rate", "rate of gst", "gst_rate_pct", "st_rate_pct", "st_rate_pc", "gst rate pct", "st rate pc", "st rate pct"],
    "taxable amount": ["taxable amount", "taxable value", "basic amount", "before gst amount", "amount"],
    "cgst ledger": ["cgst ledger", "central tax ledger"],
    "sgst ledger": ["sgst ledger", "state tax ledger"],
    "igst ledger": ["igst ledger", "integrated tax ledger"],
    "item name": ["item name", "name of item", "stock item", "stock item name", "item", "tem name", "tem_name"],
    "purchase ledger": ["purchase ledger", "purchase", "sales ledger", "sale", "sales", "cash ledger", "cash / bank", "cash/bank", "bank/cash", "bank ledger", "credit (outflow)", "credit outflow", "outflow", "credit ledger", "purchase / sale / cash ledger", "purchase / sale / cash ledger / cash cr", "purchase/sale/cash ledger/cash cr", "purchase sale cash ledger cash cr", "purchase/sale/cash ledger", "purchase sale cash ledger", "entry ledger", "item ledger", "inventory ledger", "contra ledger", "account ledger", "particulars ledger", "from ledger", "to ledger", "cash cr", "account_ledger"],
    "quantity": ["quantity", "qty", "item quantity", "stock quantity", "units"],
    "rate": ["rate", "item rate", "stock rate"],
    "per": ["per", "unit", "base unit", "uom"],
    "godown": ["godown", "location", "stock location"],
    "stock group": ["stock group", "item group", "inventory group"],
    "stock category": ["stock category", "category", "item category", "inventory category"],
    "mailing name": ["mailing name"],
    "address": ["address", "party address"],
    "state": ["state"],
    "country": ["country"],
    "gst registration type": ["gst registration type", "registration type"],
    "gstin/uin": ["gstin/uin", "gstin", "uin", "party_gstin", "party gstin"],
    "place of supply": ["place of supply", "destination_state", "destination state"],
    "phone": ["phone", "mobile", "contact no", "contact number"],
    "email": ["email", "email id", "e-mail"],
    "is_inventory_based": ["is_inventory_based", "is_inventory", "inventory based", "inventory_based", "is inventory based"],
}

VOUCHER_TYPES = {
    "Credit Sale": "Sales",
    "credit sale": "Sales",
    "Credit Purchase": "Purchase",
    "credit purchase": "Purchase",
    "Payment": "Payment",
    "payment": "Payment",
    "Receipt": "Receipt",
    "receipt": "Receipt",
    "reciept": "Receipt",
    "income": "Receipt",
    "Income": "Receipt",
    "received": "Receipt",
    "Received": "Receipt",
    "Contra": "Contra",
    "contra": "Contra",
    "Journal": "Journal",
    "journal": "Journal",
    "Expense": "Payment",
    "expense": "Payment",
    "Expenses": "Payment",
    "expenses": "Payment",
    "exp": "Payment",
    "Exp": "Payment",
    "Bank entry": "Contra",
    "bank entry": "Contra",
    "Sales": "Sales",
    "sales": "Sales",
    "Purchase": "Purchase",
    "purchase": "Purchase",
}

VOUCHER_MODES = {
    "As Voucher": "Accounting Voucher View",
    "Accounting Invoice": "Invoice Voucher View",
    "Item Invoice": "Invoice Voucher View",
}

CONTRA_MODES = {"Single Entry", "Double Entry"}
PAYMENT_MODES = {"Single Entry", "Double Entry"}
RECEIPT_MODES = {"Single Entry", "Double Entry"}

DEFAULT_LEDGERS = [
    "Aarav Enterprises",
    "Kiran Medical Store",
    "Shree Ganesh Suppliers",
    "Mehta Wholesale Mart",
    "ICICI Bank",
    "HDFC Bank",
    "Office Rent Expense",
    "Exp Bill",
    "Petrol Exp",
    "Rent Receieved",
    "Cash",
    "cash",
    "Bank ICICI",
    "Sales",
    "Sales Led",
    "Sale Oni",
    "Purchase",
    "Purchase Led",
    "CGST",
    "SGST",
    "IGST",
    "Purchase Onion",
    "Purchase Phone",
    "Sabir",
    "sabir",
    "suresh",
    "sobid",
    "Goods",
    "Capital",
]

DEFAULT_STOCK_GROUPS = ["Fruites", "Primary"]
DEFAULT_STOCK_CATEGORIES = ["Fruites", "Primary"]
DEFAULT_STOCK_ITEMS = ["Onion", "Phone"]
DEFAULT_UNITS = ["Nos"]
DEFAULT_GODOWNS = ["Main Location"]


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    UPLOAD_DIR.mkdir(exist_ok=True)
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS masters (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              type TEXT NOT NULL,
              name TEXT NOT NULL,
              parent TEXT,
              raw_xml TEXT,
              updated_at TEXT NOT NULL,
              UNIQUE(type, name)
            );
            CREATE TABLE IF NOT EXISTS upload_batches (
              id TEXT PRIMARY KEY,
              entry_type TEXT NOT NULL DEFAULT 'Excel Upload',
              filename TEXT NOT NULL,
              created_at TEXT NOT NULL,
              rows_json TEXT NOT NULL DEFAULT '[]',
              validation_json TEXT NOT NULL DEFAULT '{}',
              stored_path TEXT NOT NULL DEFAULT '',
              uploaded_at TEXT NOT NULL DEFAULT '',
              row_count INTEGER NOT NULL DEFAULT 0,
              status TEXT NOT NULL DEFAULT 'uploaded'
            );
            CREATE TABLE IF NOT EXISTS validation_rows (
              id TEXT PRIMARY KEY,
              batch_id TEXT NOT NULL,
              row_no INTEGER NOT NULL,
              payload TEXT NOT NULL,
              status TEXT NOT NULL,
              errors TEXT NOT NULL,
              ignored INTEGER NOT NULL DEFAULT 0,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(batch_id) REFERENCES upload_batches(id)
            );
            CREATE TABLE IF NOT EXISTS send_history (
              id TEXT PRIMARY KEY,
              batch_id TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              result_json TEXT NOT NULL DEFAULT '{}',
              row_id TEXT,
              voucher_mode TEXT NOT NULL DEFAULT 'As Voucher',
              status TEXT NOT NULL DEFAULT '',
              message TEXT NOT NULL DEFAULT '',
              xml_request TEXT,
              xml_response TEXT
            );
            CREATE TABLE IF NOT EXISTS synced_vouchers (
              id TEXT PRIMARY KEY,
              remote_id TEXT,
              voucher_key TEXT,
              master_id TEXT,
              voucher_type TEXT NOT NULL,
              voucher_no TEXT,
              voucher_date TEXT,
              party_ledger TEXT,
              ledger_names TEXT,
              narration TEXT,
              amount REAL NOT NULL DEFAULT 0,
              persisted_view TEXT,
              raw_xml TEXT,
              updated_at TEXT NOT NULL
            );
            """
        )
        ensure_column(conn, "upload_batches", "entry_type", "TEXT NOT NULL DEFAULT 'Excel Upload'")
        ensure_column(conn, "upload_batches", "created_at", "TEXT NOT NULL DEFAULT ''")
        ensure_column(conn, "upload_batches", "rows_json", "TEXT NOT NULL DEFAULT '[]'")
        ensure_column(conn, "upload_batches", "validation_json", "TEXT NOT NULL DEFAULT '{}'")
        ensure_column(conn, "upload_batches", "stored_path", "TEXT NOT NULL DEFAULT ''")
        ensure_column(conn, "upload_batches", "uploaded_at", "TEXT NOT NULL DEFAULT ''")
        ensure_column(conn, "upload_batches", "row_count", "INTEGER NOT NULL DEFAULT 0")
        ensure_column(conn, "upload_batches", "status", "TEXT NOT NULL DEFAULT 'uploaded'")
        ensure_column(conn, "validation_rows", "ignored", "INTEGER NOT NULL DEFAULT 0")
        ensure_column(conn, "send_history", "batch_id", "TEXT NOT NULL DEFAULT ''")
        ensure_column(conn, "send_history", "result_json", "TEXT NOT NULL DEFAULT '{}'")
        ensure_column(conn, "send_history", "row_id", "TEXT")
        ensure_column(conn, "send_history", "voucher_mode", "TEXT NOT NULL DEFAULT 'As Voucher'")
        ensure_column(conn, "send_history", "status", "TEXT NOT NULL DEFAULT ''")
        ensure_column(conn, "send_history", "message", "TEXT NOT NULL DEFAULT ''")
        ensure_column(conn, "send_history", "xml_request", "TEXT")
        ensure_column(conn, "send_history", "xml_response", "TEXT")
        ensure_column(conn, "synced_vouchers", "remote_id", "TEXT")
        ensure_column(conn, "synced_vouchers", "voucher_key", "TEXT")
        ensure_column(conn, "synced_vouchers", "master_id", "TEXT")
        ensure_column(conn, "synced_vouchers", "voucher_type", "TEXT NOT NULL DEFAULT ''")
        ensure_column(conn, "synced_vouchers", "voucher_no", "TEXT")
        ensure_column(conn, "synced_vouchers", "voucher_date", "TEXT")
        ensure_column(conn, "synced_vouchers", "party_ledger", "TEXT")
        ensure_column(conn, "synced_vouchers", "ledger_names", "TEXT")
        ensure_column(conn, "synced_vouchers", "narration", "TEXT")
        ensure_column(conn, "synced_vouchers", "amount", "REAL NOT NULL DEFAULT 0")
        ensure_column(conn, "synced_vouchers", "persisted_view", "TEXT")
        ensure_column(conn, "synced_vouchers", "raw_xml", "TEXT")
        ensure_column(conn, "synced_vouchers", "updated_at", "TEXT NOT NULL DEFAULT ''")
        for ledger in DEFAULT_LEDGERS:
            conn.execute(
                """
                INSERT OR IGNORE INTO masters(type, name, parent, updated_at)
                VALUES('ledger', ?, '', ?)
                """,
                (ledger, now_iso()),
            )
        for voucher in sorted(set(VOUCHER_TYPES.values()) | set(VOUCHER_TYPES.keys())):
            conn.execute(
                """
                INSERT OR IGNORE INTO masters(type, name, parent, updated_at)
                VALUES('voucher_type', ?, '', ?)
                """,
                (voucher, now_iso()),
            )
        for tax in ["CGST", "SGST", "IGST"]:
            conn.execute(
                """
                INSERT OR IGNORE INTO masters(type, name, parent, updated_at)
                VALUES('gst_ledger', ?, '', ?)
                """,
                (tax, now_iso()),
            )
        for master_type, names in [
            ("stock_group", DEFAULT_STOCK_GROUPS),
            ("stock_category", DEFAULT_STOCK_CATEGORIES),
            ("stock_item", DEFAULT_STOCK_ITEMS),
            ("unit", DEFAULT_UNITS),
            ("godown", DEFAULT_GODOWNS),
        ]:
            for name in names:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO masters(type, name, parent, updated_at)
                    VALUES(?, ?, '', ?)
                    """,
                    (master_type, name, now_iso()),
                )


def ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = [row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


def json_response(handler: SimpleHTTPRequestHandler, data: Any, status: int = 200) -> None:
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_json(handler: SimpleHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or "0")
    if length <= 0:
        return {}
    return json.loads(handler.rfile.read(length).decode("utf-8"))


def tally_post(xml: str, timeout: Any = (30.0, 60.0)) -> tuple[bool, str]:
    try:
        t_val = timeout
        if isinstance(timeout, (int, float)) and timeout <= 15.0:
            t_val = (30.0, 60.0)
        response = tally_session.post(
            TALLY_URL,
            data=xml.encode("utf-8"),
            headers={"Content-Type": "text/xml"},
            timeout=t_val
        )
        return True, response.text
    except Exception as exc:
        return False, str(exc)


def tally_process_running() -> bool:
    if os.name != "nt":
        return False
    
    # Cache result for 5 seconds to prevent thundering herd CPU usage
    global _last_tally_check_time, _last_tally_check_result
    now = time.time()
    if (now - _last_tally_check_time) < 5.0:
        return _last_tally_check_result

    result = False
    creationflags = 0x08000000  # CREATE_NO_WINDOW: suppresses terminal window popup on Windows
    
    try:
        output = subprocess.check_output(
            ["tasklist"],
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=1,
            creationflags=creationflags
        )
        result = bool(re.search(r"\btally(?:prime)?\.exe\b", output, re.I))
    except Exception:
        try:
            output = subprocess.check_output(
                ["powershell", "-NoProfile", "-Command", "Get-Process tally,tallyprime -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName; exit 0"],
                text=True,
                stderr=subprocess.DEVNULL,
                timeout=1,
                creationflags=creationflags
            )
            result = bool(re.search(r"\btally(?:prime)?\b", output, re.I))
        except Exception:
            result = False
            
    _last_tally_check_time = now
    _last_tally_check_result = result
    return result


def tally_response_has_error(response: str) -> bool:
    return bool(re.search(r"<LINEERROR>|<ERRORS>[1-9]|<EXCEPTIONS>[1-9]", response, re.I))


def tally_response_message(response: str) -> str:
    match = re.search(r"<LINEERROR[^>]*>(.*?)</LINEERROR>", response or "", re.I | re.S)
    if match:
        return re.sub(r"\s+", " ", match.group(1)).strip()
    return "Tally rejected this request."


def xml_escape(value: Any) -> str:
    return escape(str(value or ""), quote=True)


def tally_status() -> dict[str, Any]:
    xml = """
    <ENVELOPE>
      <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>Company</ID></HEADER>
      <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
      <TDL><TDLMESSAGE><COLLECTION NAME="Company"><TYPE>Company</TYPE><FETCH>Name</FETCH></COLLECTION></TDLMESSAGE></TDL>
      </DESC></BODY>
    </ENVELOPE>
    """
    ok, text = tally_post(xml, timeout=1.5)
    if not ok:
        running = tally_process_running()
        message = "Tally is open, but XML Gateway at localhost:9000 is not reachable." if running else "Tally is offline or XML Gateway is not reachable."
        return {"online": False, "tallyRunning": running, "url": TALLY_URL, "message": message, "detail": text}
    company = ""
    match = re.search(r"<NAME[^>]*>(.*?)</NAME>", text, flags=re.I | re.S)
    if match:
        company = re.sub(r"\s+", " ", match.group(1)).strip()
    return {"online": True, "tallyRunning": True, "url": TALLY_URL, "company": company or "Company detected", "message": "Connected to local Tally XML Gateway."}


def collection_xml(collection: str, tally_type: str, fetch: str = "Name,Parent") -> str:
    return f"""
    <ENVELOPE>
      <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>{escape(collection)}</ID></HEADER>
      <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
      <TDL><TDLMESSAGE><COLLECTION NAME="{escape(collection)}"><TYPE>{escape(tally_type)}</TYPE><FETCH>{escape(fetch)}</FETCH></COLLECTION></TDLMESSAGE></TDL>
      </DESC></BODY>
    </ENVELOPE>
    """


def extract_names(xml: str) -> list[tuple[str, str, str]]:
    results: list[tuple[str, str, str]] = []
    try:
        root = ET.fromstring(sanitize_tally_xml(xml).encode("utf-8"))
        nodes = root.findall(".//COLLECTION/*")
        if not nodes:
            nodes = root.findall(".//DATA/*")
        if not nodes:
            nodes = list(root.iter())
            
        for node in nodes:
            tag = node.tag.upper()
            if tag in ("ENVELOPE", "HEADER", "BODY", "DESC", "DATA", "COLLECTION", "STATICVARIABLES"):
                continue
            name = node.attrib.get("NAME") or node.attrib.get("Name") or ""
            parent = ""
            for child in list(node):
                ctag = child.tag.upper()
                if ctag.endswith("NAME") and not name and child.text:
                    name = child.text.strip()
                if ctag.endswith("PARENT") and child.text:
                    parent = child.text.strip()
            if name and len(name) < 180:
                raw_xml = ET.tostring(node, encoding="unicode")
                results.append((name, parent, raw_xml))
    except Exception:
        for match in re.finditer(r'NAME="([^"]+)"', xml):
            results.append((match.group(1), "", f'<MASTER NAME="{match.group(1)}"/>'))
    seen = set()
    unique = []
    for name, parent, raw_xml in results:
        key = name.lower()
        if key not in seen:
            seen.add(key)
            unique.append((name, parent, raw_xml))
    return unique


def sanitize_tally_xml(xml: str) -> str:
    def replace_ref(match: re.Match[str]) -> str:
        value = int(match.group(1))
        return "" if value < 32 and value not in (9, 10, 13) else match.group(0)

    return re.sub(r"&#(\d+);", replace_ref, xml or "")


def node_text(node: ET.Element, tag_name: str) -> str:
    target = tag_name.upper()
    for child in list(node):
        if child.tag.upper() == target and child.text:
            return re.sub(r"\s+", " ", child.text).strip()
    return ""


def normalize_tally_date(value: str) -> str:
    text = str(value or "").strip()
    if re.fullmatch(r"\d{8}", text):
        return f"{text[:4]}-{text[4:6]}-{text[6:]}"
    return text


def parse_amount_text(value: str) -> float:
    cleaned = re.sub(r"[^0-9.\-]", "", str(value or ""))
    try:
        return abs(float(cleaned)) if cleaned else 0.0
    except ValueError:
        return 0.0


def voucher_ledger_names(node) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for child in node.iter():
        if child.tag.upper() != "LEDGERNAME":
            continue
        name = (child.text or "").strip()
        key = name.casefold()
        if name and key not in seen:
            seen.add(key)
            names.append(name)
    return names


def extract_vouchers(xml: str) -> list[dict[str, Any]]:
    vouchers: list[dict[str, Any]] = []
    try:
        root = ET.fromstring(sanitize_tally_xml(xml).encode("utf-8"))
        for node in root.iter():
            if node.tag.upper() != "VOUCHER":
                continue
            remote_id = node.attrib.get("REMOTEID") or ""
            voucher_key = node.attrib.get("VCHKEY") or ""
            voucher_type = node.attrib.get("VCHTYPE") or node_text(node, "VOUCHERTYPENAME") or "Voucher"
            if not remote_id and not voucher_key and not node_text(node, "VOUCHERTYPENAME"):
                continue
            master_id = node_text(node, "MASTERID")
            voucher_no = node_text(node, "VOUCHERNUMBER")
            voucher_date = normalize_tally_date(node_text(node, "DATE"))
            ledgers = voucher_ledger_names(node)
            party = node_text(node, "PARTYLEDGERNAME") or (ledgers[0] if ledgers else node_text(node, "LEDGERNAME"))
            amount = parse_amount_text(node_text(node, "AMOUNT"))
            if not amount:
                amount = max((parse_amount_text(child.text or "") for child in node.iter() if child.tag.upper() == "AMOUNT"), default=0.0)
            narration = node_text(node, "NARRATION")
            persisted_view = node_text(node, "PERSISTEDVIEW") or node.attrib.get("OBJVIEW") or ""
            voucher_id = remote_id or voucher_key or f"{voucher_type}:{voucher_no}:{voucher_date}:{party}:{amount}"
            raw_xml = ET.tostring(node, encoding="unicode")[:10000]
            vouchers.append(
                {
                    "id": voucher_id,
                    "remote_id": remote_id,
                    "voucher_key": voucher_key,
                    "master_id": master_id,
                    "voucher_type": voucher_type,
                    "voucher_no": voucher_no,
                    "voucher_date": voucher_date,
                    "party_ledger": party,
                    "ledger_names": ", ".join(ledgers),
                    "narration": narration,
                    "amount": amount,
                    "persisted_view": persisted_view,
                    "raw_xml": raw_xml,
                }
            )
    except Exception:
        return []
    seen = set()
    unique = []
    for voucher in vouchers:
        key = voucher["id"]
        if key not in seen:
            seen.add(key)
            unique.append(voucher)
    return unique


def replace_master_snapshot(conn: sqlite3.Connection, master_type: str, items: list, raw_xml: str = "") -> None:
    conn.execute("DELETE FROM masters WHERE type=?", (master_type,))
    for item in items:
        if len(item) == 3:
            name, parent, item_xml = item
        else:
            name, parent = item
            item_xml = raw_xml
        conn.execute(
            """
            INSERT INTO masters(type, name, parent, raw_xml, updated_at)
            VALUES(?, ?, ?, ?, ?)
            """,
            (master_type, name, parent, item_xml, now_iso()),
        )


def replace_voucher_snapshot(conn: sqlite3.Connection, vouchers: list[dict[str, Any]]) -> None:
    conn.execute("DELETE FROM synced_vouchers")
    for voucher in vouchers:
        conn.execute(
            """
            INSERT INTO synced_vouchers(id, remote_id, voucher_key, master_id, voucher_type, voucher_no, voucher_date, party_ledger, ledger_names, narration, amount, persisted_view, raw_xml, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                voucher["id"],
                voucher["remote_id"],
                voucher["voucher_key"],
                voucher["master_id"],
                voucher["voucher_type"],
                voucher["voucher_no"],
                voucher["voucher_date"],
                voucher["party_ledger"],
                voucher["ledger_names"],
                voucher["narration"],
                voucher["amount"],
                voucher["persisted_view"],
                voucher["raw_xml"],
                now_iso(),
            ),
        )


def voucher_delete_envelope(voucher_xml: str) -> str:
    return f"""
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          {voucher_xml}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
""".strip()


def delete_voucher_attrs(voucher: sqlite3.Row) -> str:
    voucher_date = str(voucher["voucher_date"] or "").replace("-", "")
    objview = voucher["persisted_view"] or "Accounting Voucher View"
    attrs = [
        f'DATE="{xml_escape(voucher_date)}"',
        f'VCHTYPE="{xml_escape(voucher["voucher_type"] or "Voucher")}"',
        f'TAGNAME="Voucher Number"',
        f'TAGVALUE="{xml_escape(voucher["voucher_no"] or "")}"',
        'ACTION="Delete"',
        f'OBJVIEW="{xml_escape(objview)}"',
    ]
    if voucher["remote_id"]:
        attrs.insert(0, f'REMOTEID="{xml_escape(voucher["remote_id"])}"')
    if voucher["voucher_key"]:
        attrs.insert(1 if voucher["remote_id"] else 0, f'VCHKEY="{xml_escape(voucher["voucher_key"])}"')
    return " ".join(attrs)


def build_delete_voucher_xml(voucher: sqlite3.Row) -> str:
    voucher_date = str(voucher["voucher_date"] or "").replace("-", "")
    fields = [
        ("DATE", voucher_date),
        ("VOUCHERTYPENAME", voucher["voucher_type"] or ""),
        ("VOUCHERNUMBER", voucher["voucher_no"] or ""),
        ("MASTERID", voucher["master_id"] or ""),
    ]
    field_xml = "".join(f"<{name}>{xml_escape(value)}</{name}>" for name, value in fields if value)
    return voucher_delete_envelope(f"<VOUCHER {delete_voucher_attrs(voucher)}>{field_xml}</VOUCHER>")


def build_full_delete_voucher_xml(voucher: sqlite3.Row) -> str:
    raw_xml = sanitize_tally_xml(voucher["raw_xml"] or "").strip()
    if not raw_xml:
        return build_delete_voucher_xml(voucher)
    voucher_xml = re.sub(r"<VOUCHER\b[^>]*>", f"<VOUCHER {delete_voucher_attrs(voucher)}>", raw_xml, count=1, flags=re.I)
    return voucher_delete_envelope(voucher_xml)


def delete_synced_voucher(voucher_id: str) -> dict[str, Any]:
    if not voucher_id:
        return {"ok": False, "error": "Voucher id is required."}
    status = tally_status()
    if not status["online"]:
        return {"ok": False, "error": "Tally is offline. Open Tally and sync again before deleting."}
    with db() as conn:
        voucher = conn.execute("SELECT * FROM synced_vouchers WHERE id=?", (voucher_id,)).fetchone()
    if not voucher:
        return {"ok": False, "error": "This voucher is no longer in the synced Day Book. Sync Tally again."}
    ok, response = tally_post(build_delete_voucher_xml(voucher), timeout=10.0)
    if ok and tally_response_has_error(response):
        ok, response = tally_post(build_full_delete_voucher_xml(voucher), timeout=10.0)
    if not ok:
        return {"ok": False, "error": response}
    if tally_response_has_error(response):
        return {"ok": False, "error": tally_response_message(response), "xmlResponse": response[:4000]}
    sync_result = sync_tally()
    return {"ok": True, "message": "Voucher deleted in Tally and Day Book refreshed.", "sync": sync_result, "counts": master_counts()}


def sync_tally() -> dict[str, Any]:
    status = tally_status()
    logs = []
    synced = {"company": 0, "ledger": 0, "voucher_type": 0, "stock_group": 0, "stock_category": 0, "stock_item": 0, "unit": 0, "godown": 0, "gst_ledger": 0, "voucher": 0}
    if not status["online"]:
        return {"online": False, "message": status["message"], "logs": [{"type": "status", "message": status["detail"]}], "counts": master_counts()}

    collections = [
        ("company", "Company", "Company"),
        ("ledger", "Ledgers", "Ledger"),
        ("voucher_type", "VoucherTypes", "Voucher Type"),
        ("stock_group", "StockGroups", "Stock Group"),
        ("stock_category", "StockCategories", "Stock Category"),
        ("stock_item", "StockItems", "Stock Item"),
        ("unit", "Units", "Unit"),
        ("godown", "Godowns", "Godown"),
    ]
    with db() as conn:
        for master_type, collection, tally_type in collections:
            if master_type == "stock_item":
                fetch_fields = "Name,Parent,BaseUnits"
            elif master_type == "ledger":
                fetch_fields = "Name,Parent,Address,StateName,CountryName,PhoneNumber,EMail,GSTRegistrationType,PartyGSTIN,IsBillwiseOn,OpeningBalance,TaxType,GSTDutyType,RateOfTaxCalculation"
            else:
                fetch_fields = "Name,Parent"
            ok, text = tally_post(collection_xml(collection, tally_type, fetch_fields), timeout=7.0)
            if not ok:
                logs.append({"type": master_type, "status": "failed", "message": text})
                continue
            names = extract_names(text)
            replace_master_snapshot(conn, master_type, names, text)
            synced[master_type] = len(names)
            logs.append({"type": master_type, "status": "synced", "count": len(names)})
        gst_names = [
            (row["name"], row["parent"] or "")
            for row in conn.execute(
                """
                SELECT name, parent FROM masters
                WHERE type='ledger' AND (
                  lower(name) LIKE '%cgst%' OR lower(name) LIKE '%sgst%' OR
                  lower(name) LIKE '%igst%' OR lower(name) LIKE '%gst%'
                )
                ORDER BY name
                """
            ).fetchall()
        ]
        replace_master_snapshot(conn, "gst_ledger", gst_names, "")
        synced["gst_ledger"] = len(gst_names)
        logs.append({"type": "gst_ledger", "status": "derived", "count": len(gst_names)})
        ok, text = tally_post(
            collection_xml("Vouchers", "Voucher", "Date,VoucherTypeName,VoucherNumber,PartyLedgerName,LedgerName,Amount,MasterID,Narration,PersistedView"),
            timeout=10.0,
        )
        if ok:
            vouchers = extract_vouchers(text)
            replace_voucher_snapshot(conn, vouchers)
            synced["voucher"] = len(vouchers)
            logs.append({"type": "voucher", "status": "synced", "count": len(vouchers)})
        else:
            logs.append({"type": "voucher", "status": "failed", "message": text})
        conn.execute(
            "INSERT OR REPLACE INTO settings(key, value) VALUES('last_sync', ?)",
            (now_iso(),),
        )
    return {"online": True, "message": "Synchronization complete.", "logs": logs, "synced": synced, "counts": master_counts()}


def master_counts() -> dict[str, int]:
    with db() as conn:
        rows = conn.execute("SELECT type, COUNT(*) count FROM masters GROUP BY type").fetchall()
        voucher_count = conn.execute("SELECT COUNT(*) count FROM synced_vouchers").fetchone()["count"]
    counts = {row["type"]: row["count"] for row in rows}
    return {
        "companies": counts.get("company", 0),
        "ledgers": counts.get("ledger", 0),
        "voucherTypes": counts.get("voucher_type", 0),
        "stockGroups": counts.get("stock_group", 0),
        "stockCategories": counts.get("stock_category", 0),
        "stockItems": counts.get("stock_item", 0),
        "units": counts.get("unit", 0),
        "godowns": counts.get("godown", 0),
        "gstLedgers": counts.get("gst_ledger", 0),
        "vouchers": voucher_count,
    }


def normalize_date(value: Any) -> tuple[str, int | None]:
    if value is None or value == "":
        return "", None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d"), value.day
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            dt = datetime.strptime(text, fmt)
            return dt.strftime("%Y-%m-%d"), dt.day
        except ValueError:
            pass
    return text, None


def parse_amount(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = re.sub(r"[^0-9.\-]", "", str(value))
    if cleaned in ("", ".", "-"):
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def optional_value(payload: dict[str, Any], key: str, default: Any = "") -> Any:
    value = payload.get(key)
    if value is None or value == "":
        return default
    return value


def item_name_for_payload(payload: dict[str, Any]) -> str:
    explicit = str(optional_value(payload, "item name", "")).strip()
    if explicit:
        return explicit
    ledger = str(optional_value(payload, "purchase ledger", "")).strip()
    if ledger:
        return ledger
    voucher_type = VOUCHER_TYPES.get(str(payload.get("voucher type") or ""), str(payload.get("voucher type") or ""))
    if voucher_type.lower() == "purchase":
        return "Purchase Onion"
    if voucher_type.lower() == "sales":
        return "Sale Oni"
    return str(payload.get("party ledger or cash") or "Item")


def inventory_ledger_for_payload(payload: dict[str, Any]) -> str:
    explicit = str(optional_value(payload, "purchase ledger", "")).strip()
    if explicit:
        return explicit
    voucher_type = VOUCHER_TYPES.get(str(payload.get("voucher type") or ""), str(payload.get("voucher type") or "Journal"))
    if voucher_type.lower() == "sales":
        return "Sale Oni"
    if voucher_type.lower() == "purchase":
        return "Purchase Onion"
    return invoice_particular_for_payload(payload)


def quantity_for_payload(payload: dict[str, Any]) -> float:
    quantity = parse_amount(optional_value(payload, "quantity", 1))
    return quantity if quantity and quantity > 0 else 1.0


def rate_for_payload(payload: dict[str, Any]) -> float:
    explicit = parse_amount(optional_value(payload, "rate", None))
    if explicit and explicit > 0:
        return explicit
    total = float(payload.get("total amount") or 0)
    quantity = quantity_for_payload(payload)
    return total / quantity if quantity else total


def unit_for_payload(payload: dict[str, Any]) -> str:
    return str(optional_value(payload, "per", "Nos") or "Nos")


def get_item_base_unit(item_name: str) -> str:
    if not item_name:
        return "Nos"
    try:
        with db() as conn:
            row = conn.execute("SELECT raw_xml FROM masters WHERE type='stock_item' AND lower(name)=?", (item_name.lower(),)).fetchone()
            if row and row[0]:
                sanitized = sanitize_tally_xml(row[0])
                root = ET.fromstring(sanitized.encode("utf-8"))
                bu_node = root.find("BASEUNITS")
                if bu_node is not None and bu_node.text:
                    return bu_node.text.strip()
    except Exception as e:
        print(f"Error getting base unit for item '{item_name}': {e}")
    return "Nos"


def godown_for_payload(payload: dict[str, Any]) -> str:
    return str(optional_value(payload, "godown", "Main Location") or "Main Location")


def has_inventory_details(payload: dict[str, Any]) -> bool:
    inv_based = str(payload.get("is_inventory_based") or "").strip().lower()
    if inv_based in ("false", "fales", "no", "0"):
        return False
    elif inv_based in ("true", "yes", "1"):
        return True
    return any(str(payload.get(key) or "").strip() for key in ("item name", "quantity", "rate", "per"))


def is_sales_payload(payload: dict[str, Any]) -> bool:
    voucher_type = VOUCHER_TYPES.get(str(payload.get("voucher type") or ""), str(payload.get("voucher type") or ""))
    return voucher_type.lower() == "sales"


def party_role_label(payload: dict[str, Any]) -> str:
    return "Buyer (Bill to)" if is_sales_payload(payload) else "Supplier (Bill from)"


def invoice_number_label(payload: dict[str, Any]) -> str:
    return "Sales Invoice No." if is_sales_payload(payload) else "Supplier Invoice No."


def get_master_names(master_type: str) -> set[str]:
    with db() as conn:
        rows = conn.execute("SELECT name FROM masters WHERE type=?", (master_type,)).fetchall()
    return {row["name"].strip().lower() for row in rows}


def get_master_display_names(master_type: str) -> list[str]:
    with db() as conn:
        rows = conn.execute("SELECT name FROM masters WHERE type=? ORDER BY name", (master_type,)).fetchall()
    return [row["name"].strip() for row in rows if row["name"]]


def closest_ledger_message(ledger: str) -> str:
    names = get_master_display_names("ledger") + get_master_display_names("gst_ledger")
    match = get_close_matches(ledger, names, n=1, cutoff=0.72)
    return f" Did you mean '{match[0]}'?" if match else ""


def tally_import_master_xml(inner_xml: str) -> tuple[bool, str]:
    xml = f"""
    <ENVELOPE>
      <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
      <BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC>
      <REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">{inner_xml}</TALLYMESSAGE></REQUESTDATA>
      </IMPORTDATA></BODY>
    </ENVELOPE>
    """
    return tally_post(xml, timeout=10)


def build_unit_master_xml(name: str) -> str:
    safe = escape(name)
    return f"""
      <UNIT NAME="{safe}" ACTION="Create">
        <NAME>{safe}</NAME>
        <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
        <DECIMALPLACES>0</DECIMALPLACES>
      </UNIT>
    """


def build_ledger_master_xml(
    name: str,
    parent: str = "Sundry Creditors",
    address: str = "",
    state: str = "",
    country: str = "",
    phone: str = "",
    email: str = "",
    gstin: str = "",
    gst_registration_type: str = "",
    opening_balance: str = "0",
    billwise_on: str = "No",
    tax_type: str = "",
    gst_duty_type: str = "",
    tax_rate: str = ""
) -> str:
    safe_name = escape(name)
    safe_parent = escape(parent or "Sundry Creditors")
    
    xml_parts = [
        f'<LEDGER NAME="{safe_name}" ACTION="Create">',
        f'  <NAME>{safe_name}</NAME>',
        f'  <PARENT>{safe_parent}</PARENT>',
        f'  <ISBILLWISEON>{escape(billwise_on)}</ISBILLWISEON>',
        '  <AFFECTSSTOCK>No</AFFECTSSTOCK>',
        f'  <OPENINGBALANCE>{escape(opening_balance)}</OPENINGBALANCE>'
    ]
    
    if address:
        xml_parts.append('  <ADDRESS.LIST>')
        lines = [line.strip() for line in re.split(r'[\n\r,]+', address) if line.strip()]
        for line in lines[:4]:
            xml_parts.append(f'    <ADDRESS>{escape(line)}</ADDRESS>')
        xml_parts.append('  </ADDRESS.LIST>')
        
    if state:
        xml_parts.append(f'  <STATENAME>{escape(state)}</STATENAME>')
    if country:
        xml_parts.append(f'  <COUNTRYNAME>{escape(country)}</COUNTRYNAME>')
    if phone:
        xml_parts.append(f'  <PHONENUMBER>{escape(phone)}</PHONENUMBER>')
    if email:
        xml_parts.append(f'  <EMAIL>{escape(email)}</EMAIL>')
        
    reg_type = str(gst_registration_type).strip().capitalize()
    if reg_type not in ("Regular", "Composition", "Consumer", "Unregistered"):
        reg_type = "Regular" if gstin else "Unregistered"
        
    xml_parts.append(f'  <GSTREGISTRATIONTYPE>{escape(reg_type)}</GSTREGISTRATIONTYPE>')
    
    if gstin:
        xml_parts.append(f'  <PARTYGSTIN>{escape(gstin)}</PARTYGSTIN>')
        
    if tax_type:
        xml_parts.append(f'  <TAXTYPE>{escape(tax_type)}</TAXTYPE>')
    if gst_duty_type:
        xml_parts.append(f'  <GSTDUTYTYPE>{escape(gst_duty_type)}</GSTDUTYTYPE>')
    if tax_rate:
        xml_parts.append(f'  <RATEOFTAXCALCULATION>{escape(tax_rate)}</RATEOFTAXCALCULATION>')
        
    xml_parts.append('</LEDGER>')
    return '\n'.join(xml_parts)


def build_alter_ledger_master_xml(
    old_name: str,
    new_name: str,
    parent: str = "Sundry Creditors",
    address: str = "",
    state: str = "",
    country: str = "",
    phone: str = "",
    email: str = "",
    gstin: str = "",
    gst_registration_type: str = "",
    opening_balance: str = "0",
    billwise_on: str = "No",
    tax_type: str = "",
    gst_duty_type: str = "",
    tax_rate: str = ""
) -> str:
    safe_old_name = escape(old_name)
    safe_new_name = escape(new_name)
    safe_parent = escape(parent or "Sundry Creditors")
    
    xml_parts = [
        f'<LEDGER NAME="{safe_old_name}" ACTION="Alter">',
        f'  <NAME>{safe_new_name}</NAME>',
        f'  <PARENT>{safe_parent}</PARENT>',
        f'  <ISBILLWISEON>{escape(billwise_on)}</ISBILLWISEON>',
        '  <AFFECTSSTOCK>No</AFFECTSSTOCK>',
        f'  <OPENINGBALANCE>{escape(opening_balance)}</OPENINGBALANCE>'
    ]
    
    if address:
        xml_parts.append('  <ADDRESS.LIST>')
        lines = [line.strip() for line in re.split(r'[\n\r,]+', address) if line.strip()]
        for line in lines[:4]:
            xml_parts.append(f'    <ADDRESS>{escape(line)}</ADDRESS>')
        xml_parts.append('  </ADDRESS.LIST>')
        
    if state:
        xml_parts.append(f'  <STATENAME>{escape(state)}</STATENAME>')
    if country:
        xml_parts.append(f'  <COUNTRYNAME>{escape(country)}</COUNTRYNAME>')
    if phone:
        xml_parts.append(f'  <PHONENUMBER>{escape(phone)}</PHONENUMBER>')
    if email:
        xml_parts.append(f'  <EMAIL>{escape(email)}</EMAIL>')
        
    reg_type = str(gst_registration_type).strip().capitalize()
    if reg_type not in ("Regular", "Composition", "Consumer", "Unregistered"):
        reg_type = "Regular" if gstin else "Unregistered"
        
    xml_parts.append(f'  <GSTREGISTRATIONTYPE>{escape(reg_type)}</GSTREGISTRATIONTYPE>')
    
    if gstin:
        xml_parts.append(f'  <PARTYGSTIN>{escape(gstin)}</PARTYGSTIN>')
        
    if tax_type:
        xml_parts.append(f'  <TAXTYPE>{escape(tax_type)}</TAXTYPE>')
    if gst_duty_type:
        xml_parts.append(f'  <GSTDUTYTYPE>{escape(gst_duty_type)}</GSTDUTYTYPE>')
    if tax_rate:
        xml_parts.append(f'  <RATEOFTAXCALCULATION>{escape(tax_rate)}</RATEOFTAXCALCULATION>')
        
    xml_parts.append('</LEDGER>')
    return '\n'.join(xml_parts)


def build_stock_group_master_xml(name: str, parent: str = "Primary") -> str:
    safe_name = escape(name)
    safe_parent = escape(parent or "Primary")
    return f"""
      <STOCKGROUP NAME="{safe_name}" ACTION="Create">
        <NAME>{safe_name}</NAME>
        <PARENT>{safe_parent}</PARENT>
        <ISADDABLE>Yes</ISADDABLE>
      </STOCKGROUP>
    """


def build_stock_category_master_xml(name: str, parent: str = "Primary") -> str:
    safe_name = escape(name)
    safe_parent = escape(parent or "Primary")
    return f"""
      <STOCKCATEGORY NAME="{safe_name}" ACTION="Create">
        <NAME>{safe_name}</NAME>
        <PARENT>{safe_parent}</PARENT>
      </STOCKCATEGORY>
    """


def build_godown_master_xml(name: str, parent: str = "Primary") -> str:
    safe_name = escape(name)
    safe_parent = escape(parent or "Primary")
    return f"""
      <GODOWN NAME="{safe_name}" ACTION="Create">
        <NAME>{safe_name}</NAME>
        <PARENT>{safe_parent}</PARENT>
      </GODOWN>
    """


def build_stock_item_master_xml(name: str, unit: str = "Nos", parent: str = "") -> str:
    safe_name = escape(name)
    safe_unit = escape(unit)
    safe_parent = escape(parent)
    return f"""
      <STOCKITEM NAME="{safe_name}" ACTION="Create">
        <NAME>{safe_name}</NAME>
        <PARENT>{safe_parent}</PARENT>
        <BASEUNITS>{safe_unit}</BASEUNITS>
        <OPENINGBALANCE>0 {safe_unit}</OPENINGBALANCE>
      </STOCKITEM>
    """


def validate_payloads(batch_id: str, payloads: list[dict[str, Any]], gst_enabled: bool = False, gst_mode: str = "item") -> dict[str, Any]:
    ledgers = get_master_names("ledger") | get_master_names("gst_ledger")
    voucher_types = get_master_names("voucher_type") | {v.lower() for v in VOUCHER_TYPES} | {v.lower() for v in VOUCHER_TYPES.values()}
    if gst_enabled and gst_mode == "ledger":
        for p in payloads:
            p["is_inventory_based"] = "false"
    invoice_groups: dict[str, set[tuple[str, str, str]]] = {}
    for p in payloads:
        inv = str(p.get("invoice no") or "").strip().lower()
        if inv:
            dt, day = normalize_date(p.get("date"))
            party = str(p.get("party ledger or cash") or "").strip().lower()
            vtype = str(p.get("voucher type") or "").strip().lower()
            vtype_canonical = VOUCHER_TYPES.get(vtype, vtype).lower()
            
            # Check validity before adding to duplicate checker group
            date_ok = dt and day in (1, 2)
            vtype_ok = vtype.lower() in voucher_types
            ledger_ok = party in ledgers
            
            if date_ok and vtype_ok and ledger_ok:
                if inv not in invoice_groups:
                    invoice_groups[inv] = set()
                invoice_groups[inv].add((dt, party, vtype_canonical))

    rows = []
    with db() as conn:
        conn.execute("DELETE FROM validation_rows WHERE batch_id=?", (batch_id,))
        for index, payload in enumerate(payloads, start=2):
            errors = []
            normalized_date, day = normalize_date(payload.get("date"))
            payload["date"] = normalized_date
            if not normalized_date or day is None:
                errors.append("Invalid date: enter a valid date.")
            elif day not in (1, 2):
                errors.append("Educational Mode date: use only the 1st or 2nd date of the month.")

            invoice = str(payload.get("invoice no") or "").strip()
            if not invoice:
                errors.append("Missing invoice number.")
            elif len(invoice_groups.get(invoice.lower(), set())) > 1:
                errors.append("Duplicate invoice number in this upload (used for different dates/parties/types).")

            voucher = str(payload.get("voucher type") or "").strip()
            if not voucher or voucher.lower() not in voucher_types:
                errors.append("Wrong voucher type: choose a synced Tally voucher type.")

            ledger = str(payload.get("party ledger or cash") or "").strip()
            if not ledger:
                errors.append("Missing ledger: enter party ledger or cash.")
            elif ledger.lower() not in ledgers:
                errors.append(f"Missing ledger: '{ledger}' is not found in synced Tally ledgers.{closest_ledger_message(ledger)}")

            voucher_type = VOUCHER_TYPES.get(voucher, voucher).lower()
            trade_ledger = str(optional_value(payload, "purchase ledger", "")).strip()
            if voucher_type in ("sales", "purchase"):
                if not trade_ledger:
                    errors.append("Missing trade ledger: enter the purchase/sales ledger used for this entry.")
                elif trade_ledger.lower() not in ledgers:
                    errors.append(f"Missing trade ledger: '{trade_ledger}' is not found in synced Tally ledgers.{closest_ledger_message(trade_ledger)}")
                side_problem = trade_ledger_side_problem(payload)
                if side_problem:
                    if voucher_type == "sales":
                        errors.append(f"Ledger side mismatch: Sales row is using '{trade_ledger}'. Use the correct sales ledger.")
                    else:
                        errors.append(f"Ledger side mismatch: Purchase row is using '{trade_ledger}'. Use the correct purchase ledger.")

            if not gst_enabled:
                qty = parse_amount(payload.get("quantity"))
                rate = parse_amount(payload.get("rate"))
                if qty is not None and rate is not None and qty > 0 and rate > 0:
                    total = qty * rate
                else:
                    total = parse_amount(payload.get("total amount"))
                    if total is None or total <= 0:
                        total = parse_amount(payload.get("taxable amount"))
                payload["taxable amount"] = 0.0 if total is None else total
                payload["total amount"] = 0.0 if total is None else total
                payload["CGST"] = 0.0
                payload["SGST"] = 0.0
                payload["IGST"] = 0.0
                payload["gst rate"] = 0.0
            else:
                qty = parse_amount(payload.get("quantity"))
                rate = parse_amount(payload.get("rate"))
                if qty is not None and rate is not None and qty > 0 and rate > 0:
                    payload["taxable amount"] = qty * rate

                cgst_val = payload.get("CGST")
                sgst_val = payload.get("SGST")
                igst_val = payload.get("IGST")
                if cgst_val is None and sgst_val is None and igst_val is None:
                    # Auto-calculate GST based on taxable amount
                    taxable_amt = parse_amount(payload.get("taxable amount"))
                    if taxable_amt is None:
                        taxable_amt = 0.0
                    
                    state_str = str(payload.get("place of supply") or "").strip().lower()
                    is_local = "delhi" in state_str or state_str == ""
                    if is_local:
                        cgst = round(taxable_amt * 0.09, 2)
                        sgst = round(taxable_amt * 0.09, 2)
                        igst = 0.0
                    else:
                        cgst = 0.0
                        sgst = 0.0
                        igst = round(taxable_amt * 0.18, 2)
                    
                    total = taxable_amt + cgst + sgst + igst
                    
                    payload["CGST"] = cgst
                    payload["SGST"] = sgst
                    payload["IGST"] = igst
                    payload["gst rate"] = 18.0
                    payload["taxable amount"] = taxable_amt
                    payload["total amount"] = total
                else:
                    # Existing tax columns handling
                    for tax in ("CGST", "SGST", "IGST"):
                        amount = parse_amount(payload.get(tax))
                        payload[tax] = 0.0 if amount is None else amount
                    
                    # Taxable amount priority
                    taxable_amt = parse_amount(payload.get("taxable amount"))
                    if taxable_amt is None or taxable_amt <= 0:
                        total = parse_amount(payload.get("total amount"))
                        if total is not None and total > 0:
                            taxable_amt = total - (payload["CGST"] + payload["SGST"] + payload["IGST"])
                    
                    if taxable_amt is None or taxable_amt <= 0:
                        taxable_amt = 0.0
                    
                    payload["taxable amount"] = taxable_amt
                    payload["total amount"] = taxable_amt + payload["CGST"] + payload["SGST"] + payload["IGST"]

                total = payload["total amount"]
                if total is None or total <= 0:
                    errors.append("Missing amount: enter a total amount greater than zero.")

            if "quantity" in payload:
                payload["quantity"] = quantity_for_payload(payload)
            if "rate" in payload:
                payload["rate"] = rate_for_payload(payload)
            if "per" in payload and not payload.get("per"):
                payload["per"] = "Nos"

            status = "ready" if not errors else "needs_fix"
            row_id = payload.pop("__row_id__", None) or str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO validation_rows(id, batch_id, row_no, payload, status, errors, updated_at)
                VALUES(?, ?, ?, ?, ?, ?, ?)
                """,
                (row_id, batch_id, index, json.dumps(payload), status, json.dumps(errors), now_iso()),
            )
            rows.append({"id": row_id, "rowNo": index, "payload": payload, "status": status, "errors": errors})
        conn.execute(
            "UPDATE upload_batches SET row_count=?, status=? WHERE id=?",
            (len(rows), "validated", batch_id),
        )
    return summarize_validation(batch_id)


def parse_excel(path: Path) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    wb = load_workbook(path, data_only=True)
    ws = wb[wb.sheetnames[0]]
    header = [str(c.value or "").strip() for c in ws[1] if c.value is not None]
    normalized_header = [h.strip().lower() for h in header]
    index: dict[str, int] = {}
    for canonical, aliases in REQUIRED_COLUMN_ALIASES.items():
        for alias in aliases:
            if alias.lower() in normalized_header:
                index[canonical] = normalized_header.index(alias.lower())
                break
    missing = [col for col in EXPECTED_COLUMNS if col not in index]
    if missing:
        return [], [f"Template mismatch: missing column '{col}'." for col in missing], []
    optional_index: dict[str, int] = {}
    for canonical, aliases in OPTIONAL_COLUMN_ALIASES.items():
        for alias in aliases:
            if alias.lower() in normalized_header:
                optional_index[canonical] = normalized_header.index(alias.lower())
                break
    payloads = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if all(cell is None or str(cell).strip() == "" for cell in row):
            continue
        payload = {col: row[index[col]] if index[col] < len(row) else None for col in EXPECTED_COLUMNS}
        for canonical, col_index in optional_index.items():
            payload[canonical] = row[col_index] if col_index < len(row) else None
        for key, value in list(payload.items()):
            if isinstance(value, str):
                payload[key] = value.strip()
        payloads.append(payload)
    return payloads, [], header


def summarize_validation(batch_id: str) -> dict[str, Any]:
    with db() as conn:
        batch = conn.execute("SELECT * FROM upload_batches WHERE id=?", (batch_id,)).fetchone()
        rows = conn.execute("SELECT * FROM validation_rows WHERE batch_id=? ORDER BY row_no", (batch_id,)).fetchall()
    
    headers = []
    if batch and batch["validation_json"]:
        try:
            val_data = json.loads(batch["validation_json"])
            headers = val_data.get("headers", [])
        except Exception:
            pass

    parsed = []
    ready = failed = ignored = 0
    for row in rows:
        payload = json.loads(row["payload"])
        errors = json.loads(row["errors"])
        if row["ignored"]:
            ignored += 1
        elif row["status"] == "ready":
            ready += 1
        else:
            failed += 1
        parsed.append({"id": row["id"], "rowNo": row["row_no"], "payload": payload, "status": row["status"], "errors": errors, "ignored": bool(row["ignored"])})
    return {"batch": dict(batch) if batch else None, "rows": parsed, "summary": {"total": len(parsed), "ready": ready, "needsFix": failed, "ignored": ignored}, "headers": headers}


def normalize_voucher_mode(voucher_mode: str) -> str:
    return voucher_mode if voucher_mode in VOUCHER_MODES else "As Voucher"


def normalize_contra_mode(contra_mode: str | None) -> str:
    return contra_mode if contra_mode in CONTRA_MODES else "Single Entry"


def normalize_payment_mode(payment_mode: str | None) -> str:
    return payment_mode if payment_mode in PAYMENT_MODES else "Double Entry"


def normalize_receipt_mode(receipt_mode: str | None) -> str:
    return receipt_mode if receipt_mode in RECEIPT_MODES else "Double Entry"


def contra_counter_ledger_for_payload(payload: dict[str, Any]) -> str:
    return str(optional_value(payload, "purchase ledger", "Cash") or "Cash").strip()


def payment_account_for_payload(payload: dict[str, Any]) -> str:
    return str(optional_value(payload, "purchase ledger", "Cash") or "Cash").strip()


def receipt_account_for_payload(payload: dict[str, Any]) -> str:
    return str(optional_value(payload, "purchase ledger", "Cash") or "Cash").strip()


def payment_style_account_for_payload(payload: dict[str, Any]) -> str:
    voucher_type = VOUCHER_TYPES.get(str(payload.get("voucher type") or ""), str(payload.get("voucher type") or "")).lower()
    if voucher_type == "payment":
        return payment_account_for_payload(payload)
    if voucher_type == "receipt":
        return receipt_account_for_payload(payload)
    if voucher_type == "contra":
        return str(payload.get("party ledger or cash") or "").strip()
    return str(payload.get("party ledger or cash") or "").strip()


def ledger_lines_for_payload(payload: dict[str, Any], voucher_mode: str, contra_mode: str | None = None, payment_mode: str | None = None, receipt_mode: str | None = None) -> list[dict[str, Any]]:
    voucher_type = VOUCHER_TYPES.get(str(payload.get("voucher type") or ""), str(payload.get("voucher type") or "Journal"))
    party_ledger = str(payload.get("party ledger or cash") or "").strip()
    total = float(payload.get("total amount") or 0)
    voucher_key = voucher_type.lower()

    if voucher_key == "purchase":
        purchase_ledger = invoice_particular_for_payload(payload)
        return [
            {"prefix": "To", "ledger": party_ledger, "debit": 0, "credit": total, "is_deemed_positive": "No"},
            {"prefix": "By", "ledger": purchase_ledger, "debit": total, "credit": 0, "is_deemed_positive": "Yes"},
        ]
    if voucher_key == "sales":
        sales_ledger = invoice_particular_for_payload(payload)
        return [
            {"prefix": "By", "ledger": party_ledger, "debit": total, "credit": 0, "is_deemed_positive": "Yes"},
            {"prefix": "To", "ledger": sales_ledger, "debit": 0, "credit": total, "is_deemed_positive": "No"},
        ]
    if voucher_key == "payment":
        payment_account = payment_account_for_payload(payload)
        expense_line = {"prefix": "By", "ledger": party_ledger, "debit": total, "credit": 0, "is_deemed_positive": "Yes"}
        account_line = {"prefix": "To", "ledger": payment_account, "debit": 0, "credit": total, "is_deemed_positive": "No"}
        if normalize_payment_mode(payment_mode) == "Single Entry":
            return [expense_line, account_line]
        return [
            expense_line,
            account_line,
        ]
    if voucher_key == "receipt":
        receipt_account = receipt_account_for_payload(payload)
        account_line = {"prefix": "By", "ledger": receipt_account, "debit": total, "credit": 0, "is_deemed_positive": "Yes"}
        income_line = {"prefix": "To", "ledger": party_ledger, "debit": 0, "credit": total, "is_deemed_positive": "No"}
        if normalize_receipt_mode(receipt_mode) == "Single Entry":
            return [account_line, income_line]
        return [
            income_line,
            account_line,
        ]
    if voucher_key == "contra":
        counter_ledger = contra_counter_ledger_for_payload(payload)
        account_line = {"prefix": "By", "ledger": party_ledger, "debit": total, "credit": 0, "is_deemed_positive": "Yes"}
        counter_line = {"prefix": "To", "ledger": counter_ledger, "debit": 0, "credit": total, "is_deemed_positive": "No"}
        if normalize_contra_mode(contra_mode) == "Single Entry":
            return [account_line, counter_line]
        return [
            account_line,
            counter_line,
        ]
    if voucher_key == "journal":
        original_type = str(payload.get("voucher type") or "").lower()
        debit_ledger = party_ledger
        credit_ledger = "Cash" if "expense" in original_type else "Suspense"
        return [
            {"prefix": "By", "ledger": debit_ledger, "debit": total, "credit": 0, "is_deemed_positive": "Yes"},
            {"prefix": "To", "ledger": credit_ledger, "debit": 0, "credit": total, "is_deemed_positive": "No"},
        ]
    return [
        {"prefix": "By", "ledger": party_ledger, "debit": total, "credit": 0, "is_deemed_positive": "Yes"},
        {"prefix": "To", "ledger": "Cash", "debit": 0, "credit": total, "is_deemed_positive": "No"},
    ]


def gst_tax_amounts_for_payload(payload: dict[str, Any]) -> dict[str, float]:
    return {
        "CGST": float(parse_amount(payload.get("CGST")) or 0),
        "SGST": float(parse_amount(payload.get("SGST")) or 0),
        "IGST": float(parse_amount(payload.get("IGST")) or 0),
    }


def gst_taxable_amount_for_payload(payload: dict[str, Any]) -> float:
    explicit = parse_amount(optional_value(payload, "taxable amount", None))
    if explicit and explicit > 0:
        return float(explicit)
    total = float(payload.get("total amount") or 0)
    taxes = sum(gst_tax_amounts_for_payload(payload).values())
    return max(total - taxes, 0) if taxes else total


def gst_ledger_name(payload: dict[str, Any], tax: str) -> str:
    explicit = str(optional_value(payload, f"{tax.lower()} ledger", "")).strip()
    if explicit:
        return explicit
    names = get_master_display_names("gst_ledger") + get_master_display_names("ledger")
    lowered = {name.lower(): name for name in names}
    
    # Try finding any ledger containing the tax type (e.g. "cgst", "sgst", "igst")
    needle = tax.lower()
    matches = [name for name_lower, name in lowered.items() if needle in name_lower]
    if matches:
        voucher_type = VOUCHER_TYPES.get(str(payload.get("voucher type") or ""), "")
        is_purchase = voucher_type.lower() == "purchase"
        pref_keyword = "input" if is_purchase else "output"
        
        pref_matches = [m for m in matches if pref_keyword in m.lower()]
        if pref_matches:
            return pref_matches[0]
        return matches[0]
        
    fallback = {
        "CGST": "CGST Input/Output",
        "SGST": "SGST Input/Output",
        "IGST": "IGST Input/Output",
    }[tax]
    return fallback


def gst_lines_for_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    voucher_type = VOUCHER_TYPES.get(str(payload.get("voucher type") or ""), str(payload.get("voucher type") or ""))
    voucher_key = voucher_type.lower()
    if voucher_key not in ("purchase", "sales"):
        return []
    party_ledger = str(payload.get("party ledger or cash") or "").strip()
    trade_ledger = invoice_particular_for_payload(payload)
    taxable = gst_taxable_amount_for_payload(payload)
    tax_amounts = gst_tax_amounts_for_payload(payload)
    gross = taxable + sum(tax_amounts.values())
    if voucher_key == "purchase":
        lines = [
            {"ledger": party_ledger, "amount": gross, "is_deemed_positive": "No", "is_party": "Yes"},
            {"ledger": trade_ledger, "amount": -taxable, "is_deemed_positive": "Yes", "is_party": "No"},
        ]
        for tax, amount in tax_amounts.items():
            if amount:
                lines.append({"ledger": gst_ledger_name(payload, tax), "amount": -amount, "is_deemed_positive": "Yes", "is_party": "No"})
        return lines
    lines = [
        {"ledger": party_ledger, "amount": -gross, "is_deemed_positive": "Yes", "is_party": "Yes"},
        {"ledger": trade_ledger, "amount": taxable, "is_deemed_positive": "No", "is_party": "No"},
    ]
    for tax, amount in tax_amounts.items():
        if amount:
            lines.append({"ledger": gst_ledger_name(payload, tax), "amount": amount, "is_deemed_positive": "No", "is_party": "No"})
    return lines


def ledger_problems_for_payload(payload: dict[str, Any], voucher_mode: str, contra_mode: str | None = None, payment_mode: str | None = None, receipt_mode: str | None = None) -> list[str]:
    ledgers = get_master_names("ledger") | get_master_names("gst_ledger")
    required = []
    voucher_type = VOUCHER_TYPES.get(str(payload.get("voucher type") or ""), str(payload.get("voucher type") or "")).lower()
    entry_mode = {
        "contra": normalize_contra_mode(contra_mode),
        "payment": normalize_payment_mode(payment_mode),
        "receipt": normalize_receipt_mode(receipt_mode),
    }.get(voucher_type, "")
    if voucher_type in ("contra", "payment", "receipt") and entry_mode == "Single Entry":
        account_ledger = str(payment_style_account_for_payload(payload) or "").strip()
        if account_ledger and account_ledger.lower() not in ledgers:
            required.append(account_ledger)
    for line in ledger_lines_for_payload(payload, voucher_mode, contra_mode, payment_mode, receipt_mode):
        ledger = str(line["ledger"] or "").strip()
        if ledger and ledger.lower() not in ledgers:
            required.append(ledger)
    return sorted(set(required), key=str.lower)


def master_problems_for_payload(payload: dict[str, Any], voucher_mode: str, contra_mode: str | None = None, payment_mode: str | None = None, receipt_mode: str | None = None) -> list[dict[str, str]]:
    problems = [{"type": "ledger", "name": name} for name in ledger_problems_for_payload(payload, voucher_mode, contra_mode, payment_mode, receipt_mode)]
    side_problem = trade_ledger_side_problem(payload)
    if side_problem:
        problems.append(side_problem)
    if normalize_voucher_mode(voucher_mode) == "Item Invoice":
        if has_inventory_details(payload):
            stock_items = get_master_names("stock_item")
            item_name = item_name_for_payload(payload).strip()
            if item_name and item_name.lower() not in stock_items:
                problems.append({"type": "stock_item", "name": item_name})
            units = get_master_names("unit")
            unit = unit_for_payload(payload).strip()
            if unit and units and unit.lower() not in units:
                problems.append({"type": "unit", "name": unit})
            godowns = get_master_names("godown")
            godown = godown_for_payload(payload).strip()
            if godown and godowns and godown.lower() not in godowns:
                problems.append({"type": "godown", "name": godown})
    return problems


def gst_master_problems_for_payload(payload: dict[str, Any], voucher_mode: str) -> list[dict[str, str]]:
    ledgers = get_master_names("ledger") | get_master_names("gst_ledger")
    problems = [{"type": "ledger", "name": str(line["ledger"])} for line in gst_lines_for_payload(payload) if str(line["ledger"]).strip().lower() not in ledgers]
    if normalize_voucher_mode(voucher_mode) == "Item Invoice" and has_inventory_details(payload):
        stock_items = get_master_names("stock_item")
        item_name = item_name_for_payload(payload).strip()
        if item_name and item_name.lower() not in stock_items:
            problems.append({"type": "stock_item", "name": item_name})
    return problems


def trade_ledger_side_problem(payload: dict[str, Any]) -> dict[str, str] | None:
    voucher_type = VOUCHER_TYPES.get(str(payload.get("voucher type") or ""), str(payload.get("voucher type") or "")).lower()
    ledger = str(optional_value(payload, "purchase ledger", "")).strip()
    if not ledger or voucher_type not in ("sales", "purchase"):
        return None
    normalized = ledger.lower()
    if voucher_type == "sales" and "purchase" in normalized:
        return {"type": "ledger_side", "name": ledger}
    if voucher_type == "purchase" and "sale" in normalized:
        return {"type": "ledger_side", "name": ledger}
    return None


def invoice_particular_for_payload(payload: dict[str, Any]) -> str:
    voucher_type = VOUCHER_TYPES.get(str(payload.get("voucher type") or ""), str(payload.get("voucher type") or "Journal"))
    voucher_key = voucher_type.lower()
    explicit_ledger = str(optional_value(payload, "purchase ledger", "")).strip()
    if explicit_ledger:
        return explicit_ledger
    if voucher_key == "purchase":
        return "Purchase Onion"
    if voucher_key == "sales":
        return "Sale Oni"
    if voucher_key == "payment":
        return str(payload.get("party ledger or cash") or "Payment")
    if voucher_key == "receipt":
        return str(payload.get("party ledger or cash") or "Receipt")
    if voucher_key == "contra":
        return str(payload.get("party ledger or cash") or "Cash / Bank")
    return str(payload.get("party ledger or cash") or "Ledger")


def voucher_preview(payload: dict[str, Any], voucher_mode: str, contra_mode: str | None = None, payment_mode: str | None = None, receipt_mode: str | None = None) -> dict[str, Any]:
    mode = normalize_voucher_mode(voucher_mode)
    contra_entry_mode = normalize_contra_mode(contra_mode)
    payment_entry_mode = normalize_payment_mode(payment_mode)
    receipt_entry_mode = normalize_receipt_mode(receipt_mode)
    voucher_type = VOUCHER_TYPES.get(str(payload.get("voucher type") or ""), str(payload.get("voucher type") or "Journal"))
    lines = ledger_lines_for_payload(payload, mode, contra_entry_mode, payment_entry_mode, receipt_entry_mode)
    preview = {
        "mode": mode,
        "tallyView": VOUCHER_MODES[mode],
        "contraMode": contra_entry_mode if voucher_type.lower() == "contra" else "",
        "paymentMode": payment_entry_mode if voucher_type.lower() == "payment" else "",
        "receiptMode": receipt_entry_mode if voucher_type.lower() == "receipt" else "",
        "voucherType": voucher_type,
        "invoiceNo": str(payload.get("invoice no") or ""),
        "date": str(payload.get("date") or ""),
        "partyLedger": str(payload.get("party ledger or cash") or ""),
        "lines": [{"prefix": l["prefix"], "ledger": l["ledger"], "debit": l["debit"], "credit": l["credit"]} for l in lines],
        "totalDebit": sum(float(l["debit"] or 0) for l in lines),
        "totalCredit": sum(float(l["credit"] or 0) for l in lines),
    }
    if mode == "Accounting Invoice":
        preview["invoiceLayout"] = {
            "partyAccountName": str(payload.get("party ledger or cash") or ""),
            "invoiceNoLabel": invoice_number_label(payload),
            "invoiceNo": str(payload.get("invoice no") or ""),
            "particulars": invoice_particular_for_payload(payload),
            "rate": "",
            "per": "",
            "amount": float(payload.get("total amount") or 0),
            "partyDetails": {
                "role": party_role_label(payload),
                "name": str(payload.get("party ledger or cash") or ""),
                "mailingName": str(optional_value(payload, "mailing name", payload.get("party ledger or cash") or "")),
                "address": str(optional_value(payload, "address", "")),
                "state": str(optional_value(payload, "state", "")),
                "country": str(optional_value(payload, "country", "")),
                "gstRegistrationType": str(optional_value(payload, "gst registration type", "")),
                "gstin": str(optional_value(payload, "gstin/uin", "")),
                "placeOfSupply": str(optional_value(payload, "place of supply", "")),
                "phone": str(optional_value(payload, "phone", "")),
                "email": str(optional_value(payload, "email", "")),
            },
        }
    if mode == "Item Invoice":
        uses_inventory = has_inventory_details(payload)
        preview["itemInvoiceLayout"] = {
            "partyAccountName": str(payload.get("party ledger or cash") or ""),
            "invoiceNoLabel": invoice_number_label(payload),
            "invoiceNo": str(payload.get("invoice no") or ""),
            "inventoryLedger": inventory_ledger_for_payload(payload),
            "itemName": item_name_for_payload(payload) if uses_inventory else "",
            "quantity": quantity_for_payload(payload) if uses_inventory else "",
            "rate": rate_for_payload(payload) if uses_inventory else "",
            "per": unit_for_payload(payload) if uses_inventory else "",
            "godown": godown_for_payload(payload) if uses_inventory else "",
            "amount": float(payload.get("total amount") or 0),
            "usesInventory": uses_inventory,
            "partyDetails": {
                "role": party_role_label(payload),
                "name": str(payload.get("party ledger or cash") or ""),
                "mailingName": str(optional_value(payload, "mailing name", payload.get("party ledger or cash") or "")),
                "address": str(optional_value(payload, "address", "")),
                "state": str(optional_value(payload, "state", "")),
                "country": str(optional_value(payload, "country", "")),
                "gstRegistrationType": str(optional_value(payload, "gst registration type", "")),
                "gstin": str(optional_value(payload, "gstin/uin", "")),
                "placeOfSupply": str(optional_value(payload, "place of supply", "")),
                "phone": str(optional_value(payload, "phone", "")),
                "email": str(optional_value(payload, "email", "")),
            },
        }
    if voucher_type.lower() == "contra":
        preview["contraLayout"] = {
            "mode": contra_entry_mode,
            "account": str(payload.get("party ledger or cash") or ""),
            "particulars": contra_counter_ledger_for_payload(payload),
            "amount": float(payload.get("total amount") or 0),
        }
    if voucher_type.lower() == "payment":
        preview["paymentLayout"] = {
            "mode": payment_entry_mode,
            "account": payment_account_for_payload(payload),
            "particulars": str(payload.get("party ledger or cash") or ""),
            "amount": float(payload.get("total amount") or 0),
        }
    if voucher_type.lower() == "receipt":
        preview["receiptLayout"] = {
            "mode": receipt_entry_mode,
            "account": receipt_account_for_payload(payload),
            "particulars": str(payload.get("party ledger or cash") or ""),
            "amount": float(payload.get("total amount") or 0),
        }
    return preview


def build_party_details_xml(p0: dict[str, Any]) -> str:
    mailing_name_raw = str(optional_value(p0, "mailing name", "")).strip()
    if not mailing_name_raw:
        mailing_name_raw = str(p0.get("party ledger or cash") or "").strip()
    party_mailing_name = escape(mailing_name_raw)

    state_val = str(optional_value(p0, "state", "")).strip()
    if not state_val:
        state_val = str(optional_value(p0, "place of supply", "")).strip()
    resolved_state = state_val.title() if state_val else ""

    country_val = str(optional_value(p0, "country", "")).strip()
    if not country_val:
        gstin_val = str(optional_value(p0, "gstin/uin", "")).strip()
        if resolved_state or gstin_val:
            country_val = "India"
    resolved_country = country_val.title() if country_val else ""

    supply_val = str(optional_value(p0, "place of supply", "")).strip()
    resolved_supply = supply_val.title() if supply_val else ""

    gstin_val = str(optional_value(p0, "gstin/uin", "")).strip()
    party_gstin_xml = f"<PARTYGSTIN>{escape(gstin_val)}</PARTYGSTIN>" if gstin_val else ""

    address_val = str(optional_value(p0, "address", "")).strip()
    address_lines = []
    if address_val:
        address_lines = [line.strip() for line in re.split(r'[\n\r,]+', address_val) if line.strip()]
    if not address_lines:
        address_lines = [str(p0.get("party ledger or cash") or "").strip()]

    address_xml_parts = ["<ADDRESS.LIST>"]
    for line in address_lines:
        if line:
            address_xml_parts.append(f"  <ADDRESS>{escape(line)}</ADDRESS>")
    address_xml_parts.append("</ADDRESS.LIST>")
    address_xml = "\n".join(address_xml_parts)

    state_xml = f"<STATENAME>{escape(resolved_state)}</STATENAME>" if resolved_state else ""
    country_xml = f"<COUNTRYOFRESIDENCE>{escape(resolved_country)}</COUNTRYOFRESIDENCE>" if resolved_country else ""
    supply_xml = f"<PLACEOFSUPPLY>{escape(resolved_supply)}</PLACEOFSUPPLY>" if resolved_supply else ""

    return f"""
          <BASICBUYERNAME>{party_mailing_name}</BASICBUYERNAME>
          <BASICBASEPARTYNAME>{party_mailing_name}</BASICBASEPARTYNAME>
          {state_xml}
          {country_xml}
          {supply_xml}
          {party_gstin_xml}
          {address_xml}
    """


def build_voucher_xml(payloads: list[dict[str, Any]] | dict[str, Any], voucher_mode: str, contra_mode: str | None = None, payment_mode: str | None = None, receipt_mode: str | None = None) -> str:
    if not isinstance(payloads, list):
        payloads = [payloads]
        
    p0 = payloads[0]
    mode = normalize_voucher_mode(voucher_mode)
    contra_entry_mode = normalize_contra_mode(contra_mode)
    payment_entry_mode = normalize_payment_mode(payment_mode)
    receipt_entry_mode = normalize_receipt_mode(receipt_mode)
    
    voucher_type = VOUCHER_TYPES.get(str(p0.get("voucher type") or ""), str(p0.get("voucher type") or "Journal"))
    voucher_key = voucher_type.lower()
    
    any_has_inventory = any(has_inventory_details(p) for p in payloads)
    if any_has_inventory and voucher_key in ("purchase", "sales"):
        mode = "Item Invoice"
        
    date = str(p0.get("date") or "").replace("-", "")
    invoice = escape(str(p0.get("invoice no") or ""))
    party_ledger_value = str(p0.get("party ledger or cash") or "")
    party_ledger = escape(party_ledger_value)
    narration = escape(f"Imported by Destock as {mode}")
    obj_view_value = VOUCHER_MODES[mode]
    
    payment_style_voucher = voucher_type.lower() in ("contra", "payment", "receipt")
    payment_style_entry_mode = {
        "contra": contra_entry_mode,
        "payment": payment_entry_mode,
        "receipt": receipt_entry_mode,
    }.get(voucher_type.lower(), "")
    
    if payment_style_voucher and payment_style_entry_mode == "Single Entry":
        party_ledger = escape(payment_style_account_for_payload(p0))
        
    party_ledger_xml = f"<PARTYLEDGERNAME>{party_ledger}</PARTYLEDGERNAME>" if not (payment_style_voucher and payment_style_entry_mode == "Double Entry") else ""
    if payment_style_voucher:
        obj_view_value = "Accounting Voucher View"
    obj_view = escape(obj_view_value)
    
    persisted_view_value = "Double Entry" if payment_style_voucher and payment_style_entry_mode == "Double Entry" else obj_view_value
    persisted_view = escape(persisted_view_value)
    
    is_invoice = "Yes" if mode in ("Accounting Invoice", "Item Invoice") else "No"
    
    accounting_invoice_xml = ""
    if mode in ("Accounting Invoice", "Item Invoice"):
        party_details_xml = build_party_details_xml(p0)
        accounting_invoice_xml = f"""
          <BASICPURCHASEORDERNO>{invoice}</BASICPURCHASEORDERNO>
          {party_details_xml}"""
          
    any_has_inventory = any(has_inventory_details(p) for p in payloads)
    if mode == "Item Invoice" and not any_has_inventory:
        mode = "Accounting Invoice"
        
    ledger_xml = []
    inventory_xml = []
    
    total_gross = sum(float(p.get("total amount") or 0) for p in payloads)
    voucher_key = voucher_type.lower()
    
    ledger_tag = "LEDGERENTRIES.LIST" if mode in ("Accounting Invoice", "Item Invoice") else "ALLLEDGERENTRIES.LIST"
    
    if voucher_key == "purchase":
        party_deemed_positive = "No"
        party_amount = total_gross
        trade_deemed_positive = "Yes"
        trade_sign = -1.0
    elif voucher_key == "sales":
        party_deemed_positive = "Yes"
        party_amount = -total_gross
        trade_deemed_positive = "No"
        trade_sign = 1.0
    else:
        # Payment, Receipt, Contra, Journal
        raw_lines = []
        for p in payloads:
            raw_lines.extend(ledger_lines_for_payload(p, mode, contra_entry_mode, payment_entry_mode, receipt_mode))
            
        consolidated = {}
        for line in raw_lines:
            ledger_name = line["ledger"]
            debit = float(line["debit"] or 0)
            credit = float(line["credit"] or 0)
            is_deemed = line["is_deemed_positive"]
            is_party = line["is_party"] if "is_party" in line else ("Yes" if ledger_name.lower() == party_ledger_value.lower() else "No")
            
            key = (ledger_name.lower(), is_deemed)
            if key not in consolidated:
                consolidated[key] = {"ledger": ledger_name, "debit": 0.0, "credit": 0.0, "is_deemed_positive": is_deemed, "is_party": is_party}
            consolidated[key]["debit"] += debit
            consolidated[key]["credit"] += credit
            
        for line in consolidated.values():
            amount = float(line["credit"]) if line["credit"] > 0 else -float(line["debit"])
            bill_xml = ""
            if line["is_party"] == "Yes" and not payment_style_voucher:
                bill_xml = f"""
                <BILLALLOCATIONS.LIST>
                  <NAME>{invoice}</NAME>
                  <BILLTYPE>New Ref</BILLTYPE>
                  <AMOUNT>{amount:.2f}</AMOUNT>
                </BILLALLOCATIONS.LIST>"""
            ledger_xml.append(f"""
          <{ledger_tag}>
            <LEDGERNAME>{escape(str(line["ledger"]))}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>{line["is_deemed_positive"]}</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>{line["is_party"]}</ISPARTYLEDGER>
            <AMOUNT>{amount:.2f}</AMOUNT>
            {bill_xml}
          </{ledger_tag}>""")
          
        return f"""
        <ENVELOPE>
          <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
          <BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
          <REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="{escape(voucher_type)}" ACTION="Create" OBJVIEW="{obj_view}">
              <DATE>{date}</DATE>
              <VOUCHERTYPENAME>{escape(voucher_type)}</VOUCHERTYPENAME>
              <VOUCHERNUMBER>{invoice}</VOUCHERNUMBER>
              {party_ledger_xml}
              <PERSISTEDVIEW>{persisted_view}</PERSISTEDVIEW>
              <OBJVIEW>{obj_view}</OBJVIEW>
              <ISINVOICE>{is_invoice}</ISINVOICE>
              {accounting_invoice_xml}
              <NARRATION>{narration}</NARRATION>
              {"".join(ledger_xml)}
            </VOUCHER>
          </TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY>
        </ENVELOPE>
        """

    # For standard sales/purchase
    bill_xml = f"""
    <BILLALLOCATIONS.LIST>
      <NAME>{invoice}</NAME>
      <BILLTYPE>New Ref</BILLTYPE>
      <AMOUNT>{party_amount:.2f}</AMOUNT>
    </BILLALLOCATIONS.LIST>"""
    
    ledger_xml.append(f"""
          <{ledger_tag}>
            <LEDGERNAME>{party_ledger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>{party_deemed_positive}</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
            <AMOUNT>{party_amount:.2f}</AMOUNT>
            {bill_xml}
          </{ledger_tag}>""")
          
    if mode == "Item Invoice":
        grouped_inventory = {}
        non_inventory_entries = []
        for p in payloads:
            row_amt = float(p.get("total amount") or 0)
            trade_ledger = escape(invoice_particular_for_payload(p))
            amount = row_amt * trade_sign
            
            if has_inventory_details(p):
                item_name = escape(item_name_for_payload(p))
                quantity = quantity_for_payload(p)
                rate = rate_for_payload(p)
                base_unit = get_item_base_unit(item_name_for_payload(p))
                if base_unit:
                    unit = escape(base_unit)
                else:
                    unit = escape(unit_for_payload(p))
                godown = escape(godown_for_payload(p))
                
                if trade_ledger not in grouped_inventory:
                    grouped_inventory[trade_ledger] = []
                grouped_inventory[trade_ledger].append({
                    "item_name": item_name,
                    "amount": amount,
                    "quantity": quantity,
                    "rate": rate,
                    "unit": unit,
                    "godown": godown
                })
            else:
                non_inventory_entries.append({
                    "trade_ledger": trade_ledger,
                    "amount": amount
                })
                
        for trade_ledger, items in grouped_inventory.items():
            # Add root-level ledger entry without Amount to link it as the Common Purchase/Sales Ledger in Tally UI
            ledger_xml.append(f"""
          <{ledger_tag}>
            <LEDGERNAME>{trade_ledger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>{trade_deemed_positive}</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
          </{ledger_tag}>""")
            for item in items:
                alloc_amt = item["amount"]
                qty_str = f"{item['quantity']:.2f} {item['unit']}"
                rate_str = f"{item['rate']:.2f}/{item['unit']}"
                
                batch_xml = f"""
                <BATCHALLOCATIONS.LIST>
                  <GODOWNNAME>{item['godown']}</GODOWNNAME>
                  <BATCHNAME>Primary Batch</BATCHNAME>
                  <DESTINATIONGODOWNNAME>{item['godown']}</DESTINATIONGODOWNNAME>
                  <AMOUNT>{alloc_amt:.2f}</AMOUNT>
                  <ACTUALQTY>{qty_str}</ACTUALQTY>
                  <BILLEDQTY>{qty_str}</BILLEDQTY>
                </BATCHALLOCATIONS.LIST>"""
                
                inventory_xml.append(f"""
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>{item['item_name']}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>{trade_deemed_positive}</ISDEEMEDPOSITIVE>
            <RATE>{rate_str}</RATE>
            <AMOUNT>{alloc_amt:.2f}</AMOUNT>
            <ACTUALQTY>{qty_str}</ACTUALQTY>
            <BILLEDQTY>{qty_str}</BILLEDQTY>
            {batch_xml}
            <ACCOUNTINGALLOCATIONS.LIST>
              <LEDGERNAME>{trade_ledger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>{trade_deemed_positive}</ISDEEMEDPOSITIVE>
              <AMOUNT>{alloc_amt:.2f}</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>""")
          
        for entry in non_inventory_entries:
            ledger_xml.append(f"""
          <{ledger_tag}>
            <LEDGERNAME>{entry['trade_ledger']}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>{trade_deemed_positive}</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>{entry['amount']:.2f}</AMOUNT>
          </{ledger_tag}>""")
    else:
        for p in payloads:
            row_amt = float(p.get("total amount") or 0)
            trade_ledger = escape(invoice_particular_for_payload(p))
            amount = row_amt * trade_sign
            
            ledger_xml.append(f"""
          <{ledger_tag}>
            <LEDGERNAME>{trade_ledger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>{trade_deemed_positive}</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>{amount:.2f}</AMOUNT>
          </{ledger_tag}>""")
          
    return f"""
    <ENVELOPE>
      <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
      <BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
      <REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="{escape(voucher_type)}" ACTION="Create" OBJVIEW="{obj_view}">
          <DATE>{date}</DATE>
          <VOUCHERTYPENAME>{escape(voucher_type)}</VOUCHERTYPENAME>
          <VOUCHERNUMBER>{invoice}</VOUCHERNUMBER>
          {party_ledger_xml}
          <PERSISTEDVIEW>{persisted_view}</PERSISTEDVIEW>
          <OBJVIEW>{obj_view}</OBJVIEW>
          <ISINVOICE>{is_invoice}</ISINVOICE>
          {accounting_invoice_xml}
          <NARRATION>{narration}</NARRATION>
          {"".join(ledger_xml)}
          {"".join(inventory_xml)}
        </VOUCHER>
      </TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY>
    </ENVELOPE>
    """


def build_gst_voucher_xml(payloads: list[dict[str, Any]] | dict[str, Any], voucher_mode: str, gst_mode: str = "item") -> str:
    if not isinstance(payloads, list):
        payloads = [payloads]
        
    p0 = payloads[0]
    any_has_inventory = any(has_inventory_details(p) for p in payloads)
    voucher_type = VOUCHER_TYPES.get(str(p0.get("voucher type") or ""), str(p0.get("voucher type") or "Purchase"))
    voucher_key = voucher_type.lower()
    
    mode = normalize_voucher_mode(voucher_mode)
    if any_has_inventory and voucher_key in ("purchase", "sales"):
        mode = "Item Invoice"
    elif mode == "As Voucher":
        if any_has_inventory or gst_mode == "ledger":
            mode = "Accounting Invoice"
            
    if mode == "Item Invoice" and not any_has_inventory:
        mode = "Accounting Invoice"
    date = str(p0.get("date") or "").replace("-", "")
    invoice = escape(str(p0.get("invoice no") or ""))
    party_ledger = escape(str(p0.get("party ledger or cash") or ""))
    
    if mode in ("Accounting Invoice", "Item Invoice"):
        obj_view = "Invoice Voucher View"
    else:
        obj_view = "Accounting Voucher View"
        
    is_invoice = "Yes" if mode in ("Accounting Invoice", "Item Invoice") else "No"
    
    total_gross = sum(float(p.get("total amount") or 0) for p in payloads)
    total_cgst = sum(float(p.get("CGST") or 0) for p in payloads)
    total_sgst = sum(float(p.get("SGST") or 0) for p in payloads)
    total_igst = sum(float(p.get("IGST") or 0) for p in payloads)
    
    voucher_key = voucher_type.lower()
    is_purchase = voucher_key == "purchase"
    
    party_deemed_positive = "No" if is_purchase else "Yes"
    party_amount = total_gross if is_purchase else -total_gross
    
    bill_xml = f"""
    <BILLALLOCATIONS.LIST>
      <NAME>{invoice}</NAME>
      <BILLTYPE>New Ref</BILLTYPE>
      <AMOUNT>{party_amount:.2f}</AMOUNT>
    </BILLALLOCATIONS.LIST>"""
    
    ledger_tag = "LEDGERENTRIES.LIST" if mode in ("Accounting Invoice", "Item Invoice") else "ALLLEDGERENTRIES.LIST"
    ledger_xml = []
    
    # 1. Party Ledger Entry
    ledger_xml.append(f"""
          <{ledger_tag}>
            <LEDGERNAME>{party_ledger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>{party_deemed_positive}</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
            <AMOUNT>{party_amount:.2f}</AMOUNT>
            {bill_xml}
          </{ledger_tag}>""")
          
    # 2. Trade Ledger Entries (e.g. Onion Procurement A/c or Onion Revenue A/c)
    inventory_xml = []
    trade_deemed_positive = "Yes" if is_purchase else "No"
    trade_sign = -1.0 if is_purchase else 1.0
    
    if mode == "Item Invoice":
        grouped_inventory = {}
        non_inventory_entries = []
        for p in payloads:
            taxable = gst_taxable_amount_for_payload(p)
            trade_ledger = escape(invoice_particular_for_payload(p))
            amount = taxable * trade_sign
            
            if has_inventory_details(p):
                item_name = escape(item_name_for_payload(p))
                quantity = quantity_for_payload(p)
                rate = rate_for_payload(p)
                base_unit = get_item_base_unit(item_name_for_payload(p))
                if base_unit:
                    unit = escape(base_unit)
                else:
                    unit = escape(unit_for_payload(p))
                godown = escape(godown_for_payload(p))
                
                if trade_ledger not in grouped_inventory:
                    grouped_inventory[trade_ledger] = []
                grouped_inventory[trade_ledger].append({
                    "item_name": item_name,
                    "amount": amount,
                    "quantity": quantity,
                    "rate": rate,
                    "unit": unit,
                    "godown": godown
                })
            else:
                non_inventory_entries.append({
                    "trade_ledger": trade_ledger,
                    "amount": amount
                })
                
        for trade_ledger, items in grouped_inventory.items():
            # Add root-level ledger entry without Amount to link it as the Common Purchase/Sales Ledger in Tally UI
            ledger_xml.append(f"""
          <{ledger_tag}>
            <LEDGERNAME>{trade_ledger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>{trade_deemed_positive}</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
          </{ledger_tag}>""")
            for item in items:
                alloc_amt = item["amount"]
                qty_str = f"{item['quantity']:.2f} {item['unit']}"
                rate_str = f"{item['rate']:.2f}/{item['unit']}"
                
                batch_xml = f"""
                <BATCHALLOCATIONS.LIST>
                  <GODOWNNAME>{item['godown']}</GODOWNNAME>
                  <BATCHNAME>Primary Batch</BATCHNAME>
                  <DESTINATIONGODOWNNAME>{item['godown']}</DESTINATIONGODOWNNAME>
                  <AMOUNT>{alloc_amt:.2f}</AMOUNT>
                  <ACTUALQTY>{qty_str}</ACTUALQTY>
                  <BILLEDQTY>{qty_str}</BILLEDQTY>
                </BATCHALLOCATIONS.LIST>"""
                
                inventory_xml.append(f"""
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>{item['item_name']}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>{trade_deemed_positive}</ISDEEMEDPOSITIVE>
            <RATE>{rate_str}</RATE>
            <AMOUNT>{alloc_amt:.2f}</AMOUNT>
            <ACTUALQTY>{qty_str}</ACTUALQTY>
            <BILLEDQTY>{qty_str}</BILLEDQTY>
            {batch_xml}
            <ACCOUNTINGALLOCATIONS.LIST>
              <LEDGERNAME>{trade_ledger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>{trade_deemed_positive}</ISDEEMEDPOSITIVE>
              <AMOUNT>{alloc_amt:.2f}</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>""")
          
        for entry in non_inventory_entries:
            ledger_xml.append(f"""
          <{ledger_tag}>
            <LEDGERNAME>{entry['trade_ledger']}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>{trade_deemed_positive}</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>{entry['amount']:.2f}</AMOUNT>
          </{ledger_tag}>""")
    else:
        for p in payloads:
            taxable = gst_taxable_amount_for_payload(p)
            trade_ledger = escape(invoice_particular_for_payload(p))
            amount = taxable * trade_sign
            
            ledger_xml.append(f"""
          <{ledger_tag}>
            <LEDGERNAME>{trade_ledger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>{trade_deemed_positive}</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>{amount:.2f}</AMOUNT>
          </{ledger_tag}>""")
          
    # 3. Tax Ledger Entries (CGST / SGST / IGST)
    tax_deemed_positive = "Yes" if is_purchase else "No"
    tax_sign = -1.0 if is_purchase else 1.0
    
    if total_cgst > 0:
        cgst_ledger = gst_ledger_name(p0, "CGST")
        ledger_xml.append(f"""
          <{ledger_tag}>
            <LEDGERNAME>{escape(cgst_ledger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>{tax_deemed_positive}</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>{(total_cgst * tax_sign):.2f}</AMOUNT>
          </{ledger_tag}>""")
          
    if total_sgst > 0:
        sgst_ledger = gst_ledger_name(p0, "SGST")
        ledger_xml.append(f"""
          <{ledger_tag}>
            <LEDGERNAME>{escape(sgst_ledger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>{tax_deemed_positive}</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>{(total_sgst * tax_sign):.2f}</AMOUNT>
          </{ledger_tag}>""")
          
    if total_igst > 0:
        igst_ledger = gst_ledger_name(p0, "IGST")
        ledger_xml.append(f"""
          <{ledger_tag}>
            <LEDGERNAME>{escape(igst_ledger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>{tax_deemed_positive}</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>{(total_igst * tax_sign):.2f}</AMOUNT>
          </{ledger_tag}>""")
          
    return f"""
    <ENVELOPE>
      <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
      <BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
      <REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="{escape(voucher_type)}" ACTION="Create" OBJVIEW="{obj_view}">
          <DATE>{date}</DATE>
          <VOUCHERTYPENAME>{escape(voucher_type)}</VOUCHERTYPENAME>
          <VOUCHERNUMBER>{invoice}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>{party_ledger}</PARTYLEDGERNAME>
          <PERSISTEDVIEW>{obj_view}</PERSISTEDVIEW>
          <OBJVIEW>{obj_view}</OBJVIEW>
          <ISINVOICE>{is_invoice}</ISINVOICE>
          {build_party_details_xml(p0)}
          <NARRATION>{escape(f"Imported by Destock GST as {mode}")}</NARRATION>
          {"".join(ledger_xml)}
          {"".join(inventory_xml)}
        </VOUCHER>
      </TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY>
    </ENVELOPE>
    """


def send_rows(batch_id: str, voucher_mode: str, row_ids: list[str] | None = None, contra_mode: str | None = None, payment_mode: str | None = None, receipt_mode: str | None = None, gst_enabled: bool = False, gst_mode: str = "item", on_chunk_complete: Any = None) -> dict[str, Any]:
    voucher_mode = normalize_voucher_mode(voucher_mode)
    contra_mode = normalize_contra_mode(contra_mode)
    payment_mode = normalize_payment_mode(payment_mode)
    receipt_mode = normalize_receipt_mode(receipt_mode)
    status = tally_status()
    
    with db() as conn:
        query = "SELECT * FROM validation_rows WHERE batch_id=? AND status='ready' AND ignored=0"
        params: list[Any] = [batch_id]
        if row_ids:
            placeholders = ",".join("?" for _ in row_ids)
            query += f" AND id IN ({placeholders})"
            params.extend(row_ids)
        rows = conn.execute(query + " ORDER BY row_no", params).fetchall()
        rows_list = [dict(r) for r in rows]
        
    any_has_inventory = False
    for row in rows_list:
        p = json.loads(row["payload"])
        if has_inventory_details(p):
            any_has_inventory = True
            break
    if any_has_inventory or (gst_enabled and gst_mode == "item"):
        voucher_mode = "Item Invoice"
        
    grouped_rows = {}
    for row in rows_list:
        key = row["id"]
        grouped_rows[key] = [row]
        
    results = []
    task_list = []
    
    # 1. Main thread pre-validation (spelling and Tally master checks)
    for key, group in grouped_rows.items():
        payloads = [json.loads(r["payload"]) for r in group]
        
        group_problems = []
        for r in group:
            p = json.loads(r["payload"])
            voucher_type = VOUCHER_TYPES.get(str(p.get("voucher type") or ""), str(p.get("voucher type") or ""))
            use_gst = bool(gst_enabled and voucher_type.lower() in ("purchase", "sales"))
            row_problems = gst_master_problems_for_payload(p, voucher_mode) if use_gst else master_problems_for_payload(p, voucher_mode, contra_mode, payment_mode, receipt_mode)
            group_problems.extend(row_problems)
            
        if group_problems:
            seen_problems = set()
            deduped = []
            for prob in group_problems:
                pkey = (prob.get("type"), prob.get("name"))
                if pkey not in seen_problems:
                    seen_problems.add(pkey)
                    deduped.append(prob)
            labels = [f"{p['type'].replace('_', ' ')} '{p['name']}'" for p in deduped]
            message = "Master/ledger mismatch: create or correct " + ", ".join(labels) + " before sending."
            suggestions = [closest_ledger_message(p["name"]).strip() for p in deduped if p["type"] == "ledger"]
            suggestions = [s for s in suggestions if s]
            if suggestions:
                message += " " + " ".join(suggestions)
                
            for r in group:
                results.append({
                    "rowId": r["id"],
                    "rowNo": r["row_no"],
                    "status": "failed",
                    "message": message,
                    "xml": "",
                    "response": "",
                    "voucherMode": voucher_mode,
                    "preview": voucher_preview(json.loads(r["payload"]), voucher_mode, contra_mode, payment_mode, receipt_mode)
                })
            continue
            
        first_payload = payloads[0]
        voucher_type = VOUCHER_TYPES.get(str(first_payload.get("voucher type") or ""), str(first_payload.get("voucher type") or ""))
        use_gst = bool(gst_enabled and voucher_type.lower() in ("purchase", "sales"))
        
        xml = build_gst_voucher_xml(payloads, voucher_mode, gst_mode) if use_gst else build_voucher_xml(payloads, voucher_mode, contra_mode, payment_mode, receipt_mode)
        task_list.append((group, xml, voucher_mode))

    # 2. Parallel posting to Tally (no database locking)
    import concurrent.futures
    
    def build_bulk_envelope(chunk_tasks):
        messages = []
        for group, xml, v_mode in chunk_tasks:
            match = re.search(r"(<TALLYMESSAGE\b.*?</TALLYMESSAGE>)", xml, re.DOTALL | re.IGNORECASE)
            if match:
                messages.append(match.group(1))
        
        return f"""<ENVELOPE>
          <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
          <BODY>
            <IMPORTDATA>
              <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
              <REQUESTDATA>
                {"".join(messages)}
              </REQUESTDATA>
            </IMPORTDATA>
          </BODY>
        </ENVELOPE>"""

    def post_chunk(chunk_idx, chunk_tasks):
        bulk_xml = build_bulk_envelope(chunk_tasks)
        if status["online"] or status.get("tallyRunning"):
            ok, response = tally_post(bulk_xml, timeout=(30.0, 60.0))
            if ok and not tally_response_has_error(response):
                chunk_results = []
                for group, xml, v_mode in chunk_tasks:
                    chunk_results.append((group, "imported", "Imported into Tally.", xml, response, v_mode))
                return chunk_idx, chunk_results, True
        
        # Fallback to row-by-row
        chunk_results = []
        for group, xml, v_mode in chunk_tasks:
            if status["online"] or status.get("tallyRunning"):
                ok, response = tally_post(xml, timeout=(30.0, 60.0))
                sent_status = "imported" if ok and not tally_response_has_error(response) else "failed"
                if sent_status == "imported":
                    message = "Imported into Tally."
                else:
                    if ok:
                        message = f"Tally rejected: {tally_response_message(response)}"
                    else:
                        message = f"Tally communication error: {response}"
            else:
                ok, response = False, status.get("detail") or status["message"]
                sent_status = "failed"
                message = "Tally is offline. Start Tally and enable XML Gateway at localhost:9000."
            chunk_results.append((group, sent_status, message, xml, response, v_mode))
        return chunk_idx, chunk_results, False

    chunk_size = 200
    chunks = [task_list[i:i + chunk_size] for i in range(0, len(task_list), chunk_size)]
    
    tally_results = []
    if chunks:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(post_chunk, i, chunk): i for i, chunk in enumerate(chunks)}
            for fut in concurrent.futures.as_completed(futures):
                try:
                    chunk_idx, chunk_results, is_bulk = fut.result()
                    tally_results.extend(chunk_results)
                    
                    if on_chunk_complete:
                        ui_results = []
                        imported_count = 0
                        failed_count = 0
                        for group, sent_status, message, xml, response, v_mode in chunk_results:
                            if sent_status == "imported":
                                imported_count += 1
                            else:
                                failed_count += 1
                            for r in group:
                                ui_results.append({
                                    "rowId": r["id"],
                                    "rowNo": r["row_no"],
                                    "status": sent_status,
                                    "message": message,
                                })
                        on_chunk_complete({
                            "results": ui_results,
                            "summary": {"imported": imported_count, "failed": failed_count}
                        })
                except Exception:
                    pass

    # 3. Main thread database writes (sequential and safe)
    with db() as conn:
        for res in results:
            if res["status"] == "failed" and res["xml"] == "":
                history_id = str(uuid.uuid4())
                conn.execute(
                    """
                    INSERT INTO send_history(id, batch_id, created_at, result_json, row_id, voucher_mode, status, message, xml_request, xml_response)
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (history_id, batch_id, now_iso(), json.dumps({"rowId": res["rowId"], "status": "failed", "message": res["message"]}), res["rowId"], res["voucherMode"], "failed", res["message"], "", ""),
                )
                
        for group, sent_status, message, xml, response, v_mode in tally_results:
            for r in group:
                history_id = str(uuid.uuid4())
                conn.execute(
                    """
                    INSERT INTO send_history(id, batch_id, created_at, result_json, row_id, voucher_mode, status, message, xml_request, xml_response)
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (history_id, batch_id, now_iso(), json.dumps({"rowId": r["id"], "status": sent_status, "message": message}), r["id"], v_mode, sent_status, message, xml, response),
                )
                results.append({
                    "rowId": r["id"],
                    "rowNo": r["row_no"],
                    "status": sent_status,
                    "message": message,
                    "preview": voucher_preview(json.loads(r["payload"]), v_mode, contra_mode, payment_mode, receipt_mode)
                })
                
    results.sort(key=lambda x: x["rowNo"])
    return {"online": status["online"], "voucherMode": voucher_mode, "contraMode": contra_mode, "paymentMode": payment_mode, "receiptMode": receipt_mode, "gstEnabled": gst_enabled, "gstMode": gst_mode, "results": results, "summary": {"imported": sum(r["status"] == "imported" for r in results), "failed": sum(r["status"] == "failed" for r in results), "skipped": 0}}


def history() -> dict[str, Any]:
    with db() as conn:
        uploads = rows_to_dicts(conn.execute("SELECT * FROM upload_batches ORDER BY uploaded_at DESC LIMIT 8").fetchall())
        sends = rows_to_dicts(conn.execute("SELECT * FROM send_history ORDER BY created_at DESC LIMIT 20").fetchall())
        tally_vouchers = rows_to_dicts(
            conn.execute(
                """
                SELECT id, remote_id, voucher_key, master_id, voucher_date, voucher_type, voucher_no, party_ledger, ledger_names, narration, amount, persisted_view, updated_at
                FROM synced_vouchers
                ORDER BY voucher_date DESC, voucher_no DESC
                """
            ).fetchall()
        )
        last_sync = conn.execute("SELECT value FROM settings WHERE key='last_sync'").fetchone()
    return {"uploads": uploads, "sends": sends, "tallyVouchers": tally_vouchers, "lastSync": last_sync["value"] if last_sync else None}


def get_ledger_details(raw_xml: str) -> dict[str, Any]:
    details = {
        "address": "",
        "state": "",
        "country": "",
        "phone": "",
        "email": "",
        "gstin": "",
        "gstRegistrationType": "",
        "openingBalance": "0",
        "billwiseOn": "No",
        "taxType": "",
        "gstDutyType": "",
        "taxRate": ""
    }
    if not raw_xml:
        return details
    try:
        # Tally XML sometimes has namespace declarations or other tags, so we wrap it
        wrapped = f"<ROOT>{raw_xml.strip()}</ROOT>"
        root = ET.fromstring(wrapped)
        
        # Address list
        addr_list = []
        for addr_node in root.findall(".//ADDRESS"):
            if addr_node.text:
                addr_list.append(addr_node.text.strip())
        details["address"] = "\n".join(addr_list)
        
        # Single nodes
        state_node = root.find(".//STATENAME")
        if state_node is not None and state_node.text:
            details["state"] = state_node.text.strip()
            
        country_node = root.find(".//COUNTRYNAME")
        if country_node is not None and country_node.text:
            details["country"] = country_node.text.strip()
            
        phone_node = root.find(".//PHONENUMBER")
        if phone_node is not None and phone_node.text:
            details["phone"] = phone_node.text.strip()
            
        email_node = root.find(".//EMAIL")
        if email_node is not None and email_node.text:
            details["email"] = email_node.text.strip()
            
        gstin_node = root.find(".//PARTYGSTIN")
        if gstin_node is not None and gstin_node.text:
            details["gstin"] = gstin_node.text.strip()
            
        reg_node = root.find(".//GSTREGISTRATIONTYPE")
        if reg_node is not None and reg_node.text:
            details["gstRegistrationType"] = reg_node.text.strip()
            
        bal_node = root.find(".//OPENINGBALANCE")
        if bal_node is not None and bal_node.text:
            details["openingBalance"] = bal_node.text.strip()
            
        billwise_node = root.find(".//ISBILLWISEON")
        if billwise_node is not None and billwise_node.text:
            details["billwiseOn"] = billwise_node.text.strip()
            
        taxtype_node = root.find(".//TAXTYPE")
        if taxtype_node is not None and taxtype_node.text:
            details["taxType"] = taxtype_node.text.strip()
            
        duty_node = root.find(".//GSTDUTYTYPE")
        if duty_node is not None and duty_node.text:
            details["gstDutyType"] = duty_node.text.strip()
            
        rate_node = root.find(".//RATEOFTAXCALCULATION")
        if rate_node is not None and rate_node.text:
            details["taxRate"] = rate_node.text.strip()
    except Exception:
        # Fallback to regex
        addr_matches = re.findall(r"<ADDRESS[^>]*>(.*?)</ADDRESS>", raw_xml, re.I | re.S)
        if addr_matches:
            details["address"] = "\n".join([m.strip() for m in addr_matches])
        
        for key, tag in [
            ("state", "STATENAME"),
            ("country", "COUNTRYNAME"),
            ("phone", "PHONENUMBER"),
            ("email", "EMAIL"),
            ("gstin", "PARTYGSTIN"),
            ("gstRegistrationType", "GSTREGISTRATIONTYPE"),
            ("openingBalance", "OPENINGBALANCE"),
            ("billwiseOn", "ISBILLWISEON"),
            ("taxType", "TAXTYPE"),
            ("gstDutyType", "GSTDUTYTYPE"),
            ("taxRate", "RATEOFTAXCALCULATION")
        ]:
            match = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", raw_xml, re.I | re.S)
            if match:
                details[key] = match.group(1).strip()
    return details


class DestockHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def translate_path(self, path: str) -> str:
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean == "/":
            return str(ROOT / "index.html")
        return str(ROOT / clean.lstrip("/"))

    def do_GET(self) -> None:
        if self.path.startswith("/api/ping"):
            json_response(self, {"ok": True})
            return
        if self.path.startswith("/api/tally/status"):
            json_response(self, tally_status())
            return
        if self.path.startswith("/api/masters"):
            with db() as conn:
                rows = rows_to_dicts(conn.execute("SELECT type, name, parent FROM masters ORDER BY type, name").fetchall())
            json_response(self, {"counts": master_counts(), "masters": rows})
            return
        if self.path.startswith("/api/tally/get-master"):
            query = parse_qs(urlparse(self.path).query)
            master_type = (query.get("type") or ["ledger"])[0]
            name = (query.get("name") or [""])[0]
            with db() as conn:
                row = conn.execute("SELECT raw_xml, parent FROM masters WHERE type=? AND name=?", (master_type, name)).fetchone()
            if row:
                raw_xml = row["raw_xml"] or ""
                parent = row["parent"] or ""
                details = get_ledger_details(raw_xml)
                details["name"] = name
                details["parent"] = parent
                json_response(self, {"ok": True, "ledger": details})
            else:
                json_response(self, {"ok": False, "error": f"Master '{name}' not found locally."}, 404)
            return
        if self.path.startswith("/api/history"):
            json_response(self, history())
            return
        if self.path.startswith("/api/template"):
            query = parse_qs(urlparse(self.path).query)
            template_type = (query.get("type") or ["purchase-credit"])[0]
            mode = (query.get("mode") or ["item"])[0]
            
            if template_type == "purchase-credit":
                if mode == "ledger":
                    template_path = ROOT / "Tamplate" / "Purchase GST" / "Purchase GST without items.xlsx"
                else:
                    template_path = ROOT / "Tamplate" / "Purchase GST" / "tally_purchase_gst_with items.xlsx"
            elif template_type == "sale-credit":
                if mode == "ledger":
                    template_path = ROOT / "Tamplate" / "Sale GST" / "Sale GST without items.xlsx"
                else:
                    template_path = ROOT / "Tamplate" / "Sale GST" / "Sales_gst with items.xlsx"
            elif template_type == "payment":
                template_path = ROOT / "Tamplate" / "payment" / "simple tally template.xlsx"
            elif template_type == "received":
                template_path = ROOT / "Tamplate" / "received" / "simple tally template.xlsx"
            elif template_type == "contra":
                template_path = ROOT / "Tamplate" / "Contra" / "simple tally template.xlsx"
            else:
                template_path = TEMPLATE_PATH
                
            filename = f"{template_type.replace('-', '_')}_template.xlsx"
            if template_path.exists():
                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.end_headers()
                with template_path.open("rb") as fh:
                    shutil.copyfileobj(fh, self.wfile)
            else:
                json_response(self, {"error": "Template file not found."}, 404)
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path.startswith("/api/tally/sync"):
            json_response(self, sync_tally())
            return
        if self.path.startswith("/api/validation/update-row"):
            data = read_json(self)
            try:
                with open("C:/Users/SAHIR/.gemini/antigravity/brain/5fd9e200-72d3-4765-9576-275c44d20a0e/scratch/last_update_request.json", "w") as f:
                    json.dump(data, f, indent=2)
            except Exception as e:
                pass
            row_id = data.get("id")
            new_payload = data.get("payload")
            gst_enabled = bool(data.get("gstEnabled") or False)
            gst_mode = str(data.get("gstMode") or "item").lower()
            if not row_id or not new_payload:
                json_response(self, {"error": "id and payload are required."}, 400)
                return
            
            with db() as conn:
                row = conn.execute("SELECT * FROM validation_rows WHERE id=?", (row_id,)).fetchone()
                if not row:
                    json_response(self, {"error": "Row not found."}, 404)
                    return
                batch_id = row["batch_id"]
                old_payload = json.loads(row["payload"])
                
                if gst_enabled:
                    if old_payload.get("total amount") != new_payload.get("total amount"):
                        new_payload["taxable amount"] = new_payload["total amount"]

                # Auto-recalculate taxes if dependent fields changed
                recalc_fields = ["place of supply", "taxable amount", "quantity", "rate", "total amount"]
                should_recalc = False
                for field in recalc_fields:
                    if old_payload.get(field) != new_payload.get(field):
                        should_recalc = True
                        break
                if should_recalc and gst_enabled:
                    new_payload.pop("CGST", None)
                    new_payload.pop("SGST", None)
                    new_payload.pop("IGST", None)
                
                all_rows = conn.execute("SELECT id, payload FROM validation_rows WHERE batch_id=? ORDER BY row_no", (batch_id,)).fetchall()
                
            payloads = []
            for r in all_rows:
                p = json.loads(r["payload"])
                if r["id"] == row_id:
                    p = new_payload
                p["__row_id__"] = r["id"]
                payloads.append(p)
                
            result = validate_payloads(batch_id, payloads, gst_enabled, gst_mode)
            json_response(self, result)
            return
        if self.path.startswith("/api/validation/bulk-update"):
            data = read_json(self)
            batch_id = data.get("batchId")
            row_ids = data.get("rowIds")
            column = data.get("column")
            value = data.get("value")
            gst_enabled = bool(data.get("gstEnabled") or False)
            gst_mode = str(data.get("gstMode") or "item").lower()
            
            if not batch_id or not row_ids or not column or value is None:
                json_response(self, {"error": "batchId, rowIds, column, and value are required."}, 400)
                return
            
            with db() as conn:
                all_rows = conn.execute("SELECT id, payload FROM validation_rows WHERE batch_id=? ORDER BY row_no", (batch_id,)).fetchall()
                
            payloads = []
            recalc_fields = ["place of supply", "taxable amount", "quantity", "rate", "total amount"]
            for r in all_rows:
                p = json.loads(r["payload"])
                p["__row_id__"] = r["id"]
                if r["id"] in row_ids:
                    p[column] = value
                    if column == "total amount" and gst_enabled:
                        p["taxable amount"] = value
                    if column in recalc_fields and gst_enabled:
                        p.pop("CGST", None)
                        p.pop("SGST", None)
                        p.pop("IGST", None)
                payloads.append(p)
                
            result = validate_payloads(batch_id, payloads, gst_enabled, gst_mode)
            json_response(self, result)
            return
        if self.path.startswith("/api/validation/auto-map"):
            data = read_json(self)
            batch_id = data.get("batchId")
            gst_enabled = bool(data.get("gstEnabled") or False)
            gst_mode = str(data.get("gstMode") or "item").lower()
            if not batch_id:
                json_response(self, {"error": "batchId is required."}, 400)
                return
            
            from difflib import get_close_matches
            with db() as conn:
                rows = conn.execute("SELECT id, payload FROM validation_rows WHERE batch_id=? ORDER BY row_no", (batch_id,)).fetchall()
                ledger_names = get_master_display_names("ledger") + get_master_display_names("gst_ledger")
                
            payloads = []
            updated_count = 0
            for row in rows:
                p = json.loads(row["payload"])
                p["__row_id__"] = row["id"]
                
                # Check party ledger
                party = str(p.get("party ledger or cash") or "").strip()
                if party and party.lower() not in {n.lower() for n in ledger_names}:
                    matches = get_close_matches(party, ledger_names, n=1, cutoff=0.6)
                    if matches:
                        p["party ledger or cash"] = matches[0]
                        updated_count += 1
                        
                # Check trade ledger (purchase ledger)
                trade = str(p.get("purchase ledger") or "").strip()
                if trade and trade.lower() not in {n.lower() for n in ledger_names}:
                    matches = get_close_matches(trade, ledger_names, n=1, cutoff=0.6)
                    if matches:
                        p["purchase ledger"] = matches[0]
                        updated_count += 1
                        
                payloads.append(p)
                
            result = validate_payloads(batch_id, payloads, gst_enabled, gst_mode)
            result["autoMappedCount"] = updated_count
            json_response(self, result)
            return
        if self.path.startswith("/api/upload"):
            file_item = read_multipart_file(self, "file")
            if file_item is None:
                json_response(self, {"error": "Upload must be multipart/form-data."}, 400)
                return
            if not file_item.filename:
                json_response(self, {"error": "No Excel file received."}, 400)
                return
            query = parse_qs(urlparse(self.path).query)
            gst_enabled = (query.get("gstEnabled") or ["false"])[0].lower() == "true"
            gst_mode = (query.get("gstMode") or ["item"])[0].lower()
            batch_id = str(uuid.uuid4())
            filename = file_item.filename
            stored = UPLOAD_DIR / f"{batch_id}_{filename}"
            with stored.open("wb") as fh:
                fh.write(file_item.content)
            payloads, errors, header = parse_excel(stored)
            if errors:
                json_response(self, {"error": "Template validation failed.", "errors": errors}, 400)
                return
            with db() as conn:
                uploaded_at = now_iso()
                conn.execute(
                    """
                    INSERT INTO upload_batches(id, entry_type, filename, created_at, rows_json, validation_json, stored_path, uploaded_at, row_count, status)
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (batch_id, "Excel Upload", filename, uploaded_at, json.dumps(payloads, default=str), json.dumps({"headers": header}), str(stored), uploaded_at, len(payloads), "uploaded"),
                )
            result = validate_payloads(batch_id, payloads, gst_enabled, gst_mode)
            json_response(self, result)
            return
        if self.path.startswith("/api/validate"):
            data = read_json(self)
            batch_id = data.get("batchId")
            gst_enabled = bool(data.get("gstEnabled") or False)
            gst_mode = str(data.get("gstMode") or "item").lower()
            if not batch_id:
                json_response(self, {"error": "batchId is required."}, 400)
                return
            with db() as conn:
                rows = conn.execute("SELECT id, payload FROM validation_rows WHERE batch_id=? ORDER BY row_no", (batch_id,)).fetchall()
            payloads = []
            for row in rows:
                p = json.loads(row["payload"])
                p["__row_id__"] = row["id"]
                payloads.append(p)
            json_response(self, validate_payloads(batch_id, payloads, gst_enabled, gst_mode))
            return
        if self.path.startswith("/api/tally/send"):
            data = read_json(self)
            batch_id = data.get("batchId")
            voucher_mode = data.get("voucherMode") or "As Voucher"
            contra_mode = data.get("contraMode") or "Single Entry"
            payment_mode = data.get("paymentMode") or "Double Entry"
            receipt_mode = data.get("receiptMode") or "Double Entry"
            gst_enabled = bool(data.get("gstEnabled") or False)
            gst_mode = str(data.get("gstMode") or "item").lower()
            if not batch_id:
                json_response(self, {"error": "batchId is required."}, 400)
                return
            
            # Send streaming headers
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            
            def on_chunk(chunk_data):
                try:
                    self.wfile.write((json.dumps(chunk_data, ensure_ascii=False) + "\n").encode("utf-8"))
                    self.wfile.flush()
                except Exception:
                    pass
            
            result = send_rows(
                batch_id, voucher_mode, data.get("rowIds"), 
                contra_mode, payment_mode, receipt_mode, 
                gst_enabled, gst_mode, on_chunk_complete=on_chunk
            )
            
            try:
                self.wfile.write((json.dumps({"final": True, "data": result}, ensure_ascii=False) + "\n").encode("utf-8"))
                self.wfile.flush()
            except Exception:
                pass
            return
        if self.path.startswith("/api/tally/delete-voucher"):
            data = read_json(self)
            result = delete_synced_voucher(str(data.get("id") or ""))
            json_response(self, result, 200 if result.get("ok") else 400)
            return
        if self.path.startswith("/api/tally/create-master"):
            data = read_json(self)
            name = str(data.get("name") or "").strip()
            master_type = str(data.get("type") or "ledger").strip()
            if not name:
                json_response(self, {"error": "Master name is required."}, 400)
                return
            tally_message = "Saved locally."
            built_xml = ""
            if master_type == "ledger":
                parent = str(data.get("parent") or "Sundry Creditors").strip() or "Sundry Creditors"
                address = str(data.get("address") or "").strip()
                state = str(data.get("state") or "").strip()
                country = str(data.get("country") or "").strip()
                phone = str(data.get("phone") or "").strip()
                email = str(data.get("email") or "").strip()
                gstin = str(data.get("gstin") or "").strip()
                gst_registration_type = str(data.get("gstRegistrationType") or "").strip()
                opening_balance = str(data.get("openingBalance") or "0").strip()
                billwise_on = str(data.get("billwiseOn") or "No").strip()
                tax_type = str(data.get("taxType") or "").strip()
                gst_duty_type = str(data.get("gstDutyType") or "").strip()
                tax_rate = str(data.get("taxRate") or "").strip()
                
                built_xml = build_ledger_master_xml(
                    name,
                    parent,
                    address=address,
                    state=state,
                    country=country,
                    phone=phone,
                    email=email,
                    gstin=gstin,
                    gst_registration_type=gst_registration_type,
                    opening_balance=opening_balance,
                    billwise_on=billwise_on,
                    tax_type=tax_type,
                    gst_duty_type=gst_duty_type,
                    tax_rate=tax_rate
                )
                ok, response = tally_import_master_xml(built_xml) if tally_status()["online"] else (False, "")
                tally_message = "Created in Tally." if ok and not tally_response_has_error(response) else f"Saved locally; Tally did not confirm ledger creation. Details: {response}"
            elif master_type == "unit":
                built_xml = build_unit_master_xml(name)
                ok, response = tally_import_master_xml(built_xml) if tally_status()["online"] else (False, "")
                tally_message = "Created in Tally." if ok and not tally_response_has_error(response) else "Saved locally; Tally did not confirm unit creation."
            elif master_type == "stock_group":
                parent = str(data.get("parent") or "Primary").strip() or "Primary"
                built_xml = build_stock_group_master_xml(name, parent)
                ok, response = tally_import_master_xml(built_xml) if tally_status()["online"] else (False, "")
                tally_message = "Created in Tally." if ok and not tally_response_has_error(response) else "Saved locally; Tally did not confirm stock group creation."
            elif master_type == "stock_category":
                parent = str(data.get("parent") or "Primary").strip() or "Primary"
                built_xml = build_stock_category_master_xml(name, parent)
                ok, response = tally_import_master_xml(built_xml) if tally_status()["online"] else (False, "")
                tally_message = "Created in Tally." if ok and not tally_response_has_error(response) else "Saved locally; Tally did not confirm stock category creation."
            elif master_type == "godown":
                parent = str(data.get("parent") or "Primary").strip() or "Primary"
                built_xml = build_godown_master_xml(name, parent)
                ok, response = tally_import_master_xml(built_xml) if tally_status()["online"] else (False, "")
                tally_message = "Created in Tally." if ok and not tally_response_has_error(response) else "Saved locally; Tally did not confirm godown creation."
            elif master_type == "stock_item":
                unit = str(data.get("unit") or "Nos").strip() or "Nos"
                parent = str(data.get("parent") or "").strip()
                if tally_status()["online"]:
                    tally_import_master_xml(build_unit_master_xml(unit))
                    built_xml = build_stock_item_master_xml(name, unit, parent)
                    ok, response = tally_import_master_xml(built_xml)
                    tally_message = "Created in Tally." if ok and not tally_response_has_error(response) else "Saved locally; Tally did not confirm stock item creation."
                else:
                    built_xml = build_stock_item_master_xml(name, unit, parent)
                with db() as conn:
                    conn.execute(
                        "INSERT OR IGNORE INTO masters(type, name, parent, raw_xml, updated_at) VALUES('unit', ?, '', ?, ?)",
                        (unit, build_unit_master_xml(unit), now_iso()),
                    )
            with db() as conn:
                conn.execute(
                    "INSERT OR REPLACE INTO masters(type, name, parent, raw_xml, updated_at) VALUES(?, ?, ?, ?, ?)",
                    (master_type, name, data.get("parent") or ("Sundry Creditors" if master_type == "ledger" else ""), built_xml or None, now_iso()),
                )
            json_response(self, {"ok": True, "message": f"{name}: {tally_message}", "counts": master_counts()})
            return
        if self.path.startswith("/api/tally/alter-master"):
            data = read_json(self)
            old_name = str(data.get("oldName") or "").strip()
            new_name = str(data.get("newName") or "").strip()
            master_type = str(data.get("type") or "ledger").strip()
            if not old_name or not new_name:
                json_response(self, {"error": "oldName and newName are required."}, 400)
                return
            tally_message = "Saved locally."
            if master_type in ("ledger", "gst_ledger"):
                parent = str(data.get("parent") or "Sundry Creditors").strip() or "Sundry Creditors"
                address = str(data.get("address") or "").strip()
                state = str(data.get("state") or "").strip()
                country = str(data.get("country") or "").strip()
                phone = str(data.get("phone") or "").strip()
                email = str(data.get("email") or "").strip()
                gstin = str(data.get("gstin") or "").strip()
                gst_registration_type = str(data.get("gstRegistrationType") or "").strip()
                opening_balance = str(data.get("openingBalance") or "0").strip()
                billwise_on = str(data.get("billwiseOn") or "No").strip()
                tax_type = str(data.get("taxType") or "").strip()
                gst_duty_type = str(data.get("gstDutyType") or "").strip()
                tax_rate = str(data.get("taxRate") or "").strip()
                
                built_xml = build_alter_ledger_master_xml(
                    old_name=old_name,
                    new_name=new_name,
                    parent=parent,
                    address=address,
                    state=state,
                    country=country,
                    phone=phone,
                    email=email,
                    gstin=gstin,
                    gst_registration_type=gst_registration_type,
                    opening_balance=opening_balance,
                    billwise_on=billwise_on,
                    tax_type=tax_type,
                    gst_duty_type=gst_duty_type,
                    tax_rate=tax_rate
                )
                ok, response = tally_import_master_xml(built_xml) if tally_status()["online"] else (False, "")
                tally_message = "Altered in Tally." if ok and not tally_response_has_error(response) else f"Saved locally; Tally did not confirm alteration. Details: {response}"
                
                simulated_create_xml = build_ledger_master_xml(
                    new_name,
                    parent,
                    address=address,
                    state=state,
                    country=country,
                    phone=phone,
                    email=email,
                    gstin=gstin,
                    gst_registration_type=gst_registration_type,
                    opening_balance=opening_balance,
                    billwise_on=billwise_on,
                    tax_type=tax_type,
                    gst_duty_type=gst_duty_type,
                    tax_rate=tax_rate
                )
                with db() as conn:
                    conn.execute(
                        """
                        UPDATE masters 
                        SET name=?, parent=?, raw_xml=?, updated_at=?
                        WHERE type=? AND name=?
                        """,
                        (new_name, parent, simulated_create_xml, now_iso(), master_type, old_name)
                    )
            else:
                with db() as conn:
                    conn.execute("UPDATE masters SET name=?, updated_at=? WHERE type=? AND name=?", (new_name, now_iso(), master_type, old_name))
            json_response(self, {"ok": True, "message": f"{new_name}: {tally_message}", "counts": master_counts()})
            return
        if self.path.startswith("/api/tally/delete-master"):
            data = read_json(self)
            name = str(data.get("name") or "").strip()
            master_type = str(data.get("type") or "ledger").strip()
            with db() as conn:
                conn.execute("DELETE FROM masters WHERE type=? AND name=?", (master_type, name))
            json_response(self, {"ok": True, "message": "Master removed locally.", "counts": master_counts()})
            return
        json_response(self, {"error": "Not found"}, 404)


def main() -> None:
    init_db()
    port = int(os.environ.get("PORT", os.environ.get("DESTOCK_PORT", "4173")))
    server = ThreadingHTTPServer(("0.0.0.0", port), DestockHandler)
    print(f"Destock running at http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
