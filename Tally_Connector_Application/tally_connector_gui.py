"""
Tally Automation Bridge v2.0 (Enterprise Desktop Edition)
Native Windows Desktop Application
High Performance, Zero-Crash, Native Win32 Tkinter Engine
"""

import sys
import os
import time
import json
import re
import threading
import tkinter as tk
from tkinter import scrolledtext
from urllib.request import Request, urlopen
from urllib.error import URLError

def get_resource_path(relative_path: str) -> str:
    """ Get absolute path to resource, works for dev and for PyInstaller """
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

def count_tally_vouchers(xml_text: str) -> int:
    """ Count genuine vouchers in Tally XML response """
    if not xml_text:
        return 0
    data_match = re.search(r'<DATA\b[^>]*>(.*?)</DATA>', xml_text, re.DOTALL | re.I)
    target = data_match.group(1) if data_match else xml_text
    matches = re.findall(r'<VOUCHER\b[^>]*\b(VCHTYPE|DATE|REMOTEID|VCHKEY)\s*=', target, flags=re.I)
    return len(matches)

def count_tally_ledgers(xml_text: str) -> int:
    """ Count genuine ledgers in Tally XML response """
    if not xml_text:
        return 0
    data_match = re.search(r'<DATA\b[^>]*>(.*?)</DATA>', xml_text, re.DOTALL | re.I)
    target = data_match.group(1) if data_match else xml_text
    matches = re.findall(r'<LEDGER\b[^>]*\bNAME\s*=', target, flags=re.I)
    return len(matches)


class TallyConnectorGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Tally Automation Bridge v2.0 (Enterprise Desktop Edition)")
        self.root.geometry("740x700")
        self.root.minsize(700, 660)
        self.root.configure(bg="#07090e")

        # Thread-safe lock for state variables
        self.lock = threading.Lock()

        # Thread-safe config values
        self.cfg_web_url = "https://tally-automation.onrender.com"
        self.cfg_tally_url = "http://127.0.0.1:9000"
        self.cfg_username = "guest-01"

        # UI StringVars (UI Main Thread ONLY)
        self.var_web_url = tk.StringVar(value=self.cfg_web_url)
        self.var_username = tk.StringVar(value=self.cfg_username)

        # Live State variables
        self.tally_online = False
        self.web_online = False
        self.active_company = "Not Detected"
        self.daybook_vouchers_count = 0
        self.vouchers_dispatched_count = 0
        self.ledgers_synced_count = 0
        self.poll_running = True

        # Activity State & Non-Blocking Typewriter Engine
        self.current_activity_title = "Ready • All systems operational"
        self.current_activity_sub = "Waiting for actions or automatic sync"
        self.current_activity_badge = "✅"
        self.activity_history = []
        self._anim_id = 0
        self._typing_timer_id = None

        self.setup_ui()
        self.record_activity("System Initialized", "Tally Automation Bridge desktop software ready", "🚀")
        self.start_background_worker()

    def _sync_cfg_from_ui(self):
        """ Copies current UI input values to thread-safe cfg attributes. Must run on UI thread. """
        with self.lock:
            self.cfg_web_url = self.var_web_url.get().strip().rstrip("/")
            self.cfg_username = self.var_username.get().strip()

    def setup_ui(self):
        container = tk.Frame(self.root, bg="#07090e", padx=20, pady=16)
        container.pack(fill="both", expand=True)

        # ------------------------------------------------------------------
        # 1. HEADER SECTION (High-Definition Textured Logo + Title + Pro Badge)
        # ------------------------------------------------------------------
        header_frame = tk.Frame(container, bg="#07090e")
        header_frame.pack(fill="x", pady=(0, 16))

        logo_loaded = False
        try:
            logo_path = get_resource_path("logo.png")
            if os.path.exists(logo_path):
                self.logo_img = tk.PhotoImage(file=logo_path)
                lbl_logo = tk.Label(header_frame, image=self.logo_img, bg="#07090e", bd=0, highlightthickness=0)
                lbl_logo.pack(side="left", padx=(0, 12))
                logo_loaded = True
        except Exception:
            logo_loaded = False

        if not logo_loaded:
            icon_canvas = tk.Canvas(header_frame, width=48, height=48, bg="#07090e", highlightthickness=0)
            icon_canvas.pack(side="left", padx=(0, 12))
            icon_canvas.create_oval(2, 2, 46, 46, fill="#0f172a", outline="#3b82f6", width=2)
            icon_canvas.create_oval(5, 5, 43, 43, fill="#1d3557", outline="#60a5fa", width=1)
            icon_canvas.create_text(25, 25, text="T", fill="#000000", font=("Segoe UI", 18, "bold"))
            icon_canvas.create_text(24, 24, text="T", fill="#e0f2fe", font=("Segoe UI", 18, "bold"))

        title_box = tk.Frame(header_frame, bg="#07090e")
        title_box.pack(side="left", fill="both")

        top_line = tk.Frame(title_box, bg="#07090e")
        top_line.pack(anchor="w")
        lbl_app_name = tk.Label(top_line, text="Tally Automation Bridge", font=("Segoe UI", 15, "bold"), fg="#f8fafc", bg="#07090e")
        lbl_app_name.pack(side="left")

        badge_pro = tk.Label(top_line, text="PRO v2.0", font=("Segoe UI", 8, "bold"), fg="#60a5fa", bg="#132247", padx=6, pady=1)
        badge_pro.pack(side="left", padx=(8, 0))

        lbl_app_sub = tk.Label(title_box, text="Enterprise Desktop ↔ Cloud Web Bridge", font=("Segoe UI", 9), fg="#94a3b8", bg="#07090e")
        lbl_app_sub.pack(anchor="w")

        # ------------------------------------------------------------------
        # 2. DUAL STATUS CARDS (Tally Gateway & Cloud Bridge)
        # ------------------------------------------------------------------
        cards_row = tk.Frame(container, bg="#07090e")
        cards_row.pack(fill="x", pady=(0, 14))

        # Card Left: TallyPrime Gateway
        self.card_tally = tk.Frame(cards_row, bg="#0c1322", highlightbackground="#1e293b", highlightthickness=1, padx=14, pady=12)
        self.card_tally.pack(side="left", fill="both", expand=True, padx=(0, 7))

        tally_top = tk.Frame(self.card_tally, bg="#0c1322")
        tally_top.pack(fill="x")
        tk.Label(tally_top, text="TALLYPRIME GATEWAY", font=("Segoe UI", 8, "bold"), fg="#64748b", bg="#0c1322").pack(side="left")
        self.badge_tally = tk.Label(tally_top, text="● OFFLINE", font=("Segoe UI", 8, "bold"), fg="#ef4444", bg="#2a1215", padx=7, pady=2)
        self.badge_tally.pack(side="right")

        self.lbl_tally_comp = tk.Label(self.card_tally, text="Not Detected", font=("Segoe UI", 12, "bold"), fg="#f1f5f9", bg="#0c1322")
        self.lbl_tally_comp.pack(anchor="w", pady=(6, 0))

        self.lbl_tally_sub = tk.Label(self.card_tally, text="Port 9000 • XML Gateway Active", font=("Consolas", 8), fg="#64748b", bg="#0c1322")
        self.lbl_tally_sub.pack(anchor="w", pady=(2, 0))

        # Card Right: Cloud Web Bridge
        self.card_web = tk.Frame(cards_row, bg="#0c1322", highlightbackground="#1e293b", highlightthickness=1, padx=14, pady=12)
        self.card_web.pack(side="left", fill="both", expand=True, padx=(7, 0))

        web_top = tk.Frame(self.card_web, bg="#0c1322")
        web_top.pack(fill="x")
        tk.Label(web_top, text="CLOUD WEB BRIDGE", font=("Segoe UI", 8, "bold"), fg="#64748b", bg="#0c1322").pack(side="left")
        self.badge_web = tk.Label(web_top, text="● UNPAIRED", font=("Segoe UI", 8, "bold"), fg="#f59e0b", bg="#291e0a", padx=7, pady=2)
        self.badge_web.pack(side="right")

        self.lbl_web_user = tk.Label(self.card_web, text="guest-01 (Offline)", font=("Segoe UI", 12, "bold"), fg="#f1f5f9", bg="#0c1322")
        self.lbl_web_user.pack(anchor="w", pady=(6, 0))

        self.lbl_web_sub = tk.Label(self.card_web, text="https://tally-automation.onrender.com", font=("Consolas", 8), fg="#64748b", bg="#0c1322")
        self.lbl_web_sub.pack(anchor="w", pady=(2, 0))

        # ------------------------------------------------------------------
        # 3. SETTINGS & ACTIONS CARD
        # ------------------------------------------------------------------
        cfg_card = tk.Frame(container, bg="#0c1322", highlightbackground="#1e293b", highlightthickness=1, padx=14, pady=14)
        cfg_card.pack(fill="x", pady=(0, 14))

        # Server URL & Username fields
        inputs_row = tk.Frame(cfg_card, bg="#0c1322")
        inputs_row.pack(fill="x", pady=(0, 10))

        col_url = tk.Frame(inputs_row, bg="#0c1322")
        col_url.pack(side="left", fill="x", expand=True, padx=(0, 10))
        tk.Label(col_url, text="Web Application Server (Render / Cloud)", font=("Segoe UI", 8, "bold"), fg="#94a3b8", bg="#0c1322").pack(anchor="w", pady=(0, 4))
        self.ent_url = tk.Entry(col_url, textvariable=self.var_web_url, bg="#131e33", fg="#ffffff", font=("Segoe UI", 9), relief="flat", insertbackground="white", highlightbackground="#1e293b", highlightthickness=1)
        self.ent_url.pack(fill="x", ipady=4)

        col_user = tk.Frame(inputs_row, bg="#0c1322")
        col_user.pack(side="left", fill="x", expand=True)
        tk.Label(col_user, text="Bridge Username", font=("Segoe UI", 8, "bold"), fg="#94a3b8", bg="#0c1322").pack(anchor="w", pady=(0, 4))
        self.ent_user = tk.Entry(col_user, textvariable=self.var_username, bg="#131e33", fg="#ffffff", font=("Segoe UI", 9), relief="flat", insertbackground="white", highlightbackground="#1e293b", highlightthickness=1)
        self.ent_user.pack(fill="x", ipady=4)

        # Action Buttons
        btn_bar = tk.Frame(cfg_card, bg="#0c1322")
        btn_bar.pack(fill="x", pady=(4, 0))

        self.btn_detect = tk.Button(
            btn_bar, text="🔍 Detect Company", font=("Segoe UI", 9, "bold"),
            bg="#0284c7", fg="#ffffff", activebackground="#0369a1", activeforeground="#ffffff",
            relief="flat", cursor="hand2", padx=14, pady=6, command=self.action_detect_company
        )
        self.btn_detect.pack(side="left", padx=(0, 8))

        self.btn_sync = tk.Button(
            btn_bar, text="🔄 Sync Masters & Vouchers", font=("Segoe UI", 9, "bold"),
            bg="#059669", fg="#ffffff", activebackground="#047857", activeforeground="#ffffff",
            relief="flat", cursor="hand2", padx=14, pady=6, command=self.action_sync_all
        )
        self.btn_sync.pack(side="left", padx=(0, 8))

        self.btn_save = tk.Button(
            btn_bar, text="⚙ Save & Connect", font=("Segoe UI", 9, "bold"),
            bg="#1e293b", fg="#f1f5f9", activebackground="#334155", activeforeground="#ffffff",
            relief="flat", cursor="hand2", padx=14, pady=6, command=self.action_save_connect
        )
        self.btn_save.pack(side="right")

        # ------------------------------------------------------------------
        # 4. THREE METRIC STAT CARDS
        # ------------------------------------------------------------------
        stats_row = tk.Frame(container, bg="#07090e")
        stats_row.pack(fill="x", pady=(0, 14))

        # Stat 1: Day Book Vouchers
        s1 = tk.Frame(stats_row, bg="#0c1322", highlightbackground="#1e293b", highlightthickness=1, padx=14, pady=12)
        s1.pack(side="left", fill="both", expand=True, padx=(0, 5))
        tk.Label(s1, text="DAY BOOK VOUCHERS", font=("Segoe UI", 8, "bold"), fg="#64748b", bg="#0c1322").pack(anchor="w")
        self.lbl_stat_daybook = tk.Label(s1, text="0", font=("Segoe UI", 24, "bold"), fg="#38bdf8", bg="#0c1322")
        self.lbl_stat_daybook.pack(anchor="w", pady=(4, 0))
        self.lbl_stat_dispatched = tk.Label(s1, text="Dispatched: 0", font=("Consolas", 8), fg="#94a3b8", bg="#0c1322")
        self.lbl_stat_dispatched.pack(anchor="w", pady=(2, 0))

        # Stat 2: Masters Synchronized
        s2 = tk.Frame(stats_row, bg="#0c1322", highlightbackground="#1e293b", highlightthickness=1, padx=14, pady=12)
        s2.pack(side="left", fill="both", expand=True, padx=(4, 4))
        tk.Label(s2, text="MASTERS SYNCHRONIZED", font=("Segoe UI", 8, "bold"), fg="#64748b", bg="#0c1322").pack(anchor="w")
        self.lbl_stat_masters = tk.Label(s2, text="0", font=("Segoe UI", 24, "bold"), fg="#34d399", bg="#0c1322")
        self.lbl_stat_masters.pack(anchor="w", pady=(4, 0))
        tk.Label(s2, text="Ledgers in Web Cloud", font=("Consolas", 8), fg="#94a3b8", bg="#0c1322").pack(anchor="w", pady=(2, 0))

        # Stat 3: Anti-Lag Throttle
        s3 = tk.Frame(stats_row, bg="#0c1322", highlightbackground="#1e293b", highlightthickness=1, padx=14, pady=12)
        s3.pack(side="left", fill="both", expand=True, padx=(5, 0))
        tk.Label(s3, text="ANTI-LAG THROTTLE", font=("Segoe UI", 8, "bold"), fg="#64748b", bg="#0c1322").pack(anchor="w")
        tk.Label(s3, text="Active (60ms)", font=("Segoe UI", 16, "bold"), fg="#a78bfa", bg="#0c1322").pack(anchor="w", pady=(8, 0))
        tk.Label(s3, text="Tally UI Safe Guarded", font=("Consolas", 8), fg="#94a3b8", bg="#0c1322").pack(anchor="w", pady=(2, 0))

        # ------------------------------------------------------------------
        # 5. LIVE SYSTEM ACTIVITY (SMOOTH TYPEWRITER BANNER + HISTORY BUTTON)
        # ------------------------------------------------------------------
        act_header = tk.Frame(container, bg="#07090e")
        act_header.pack(fill="x", pady=(0, 6))
        tk.Label(act_header, text="LIVE SYSTEM ACTIVITY", font=("Segoe UI", 8, "bold"), fg="#64748b", bg="#07090e").pack(side="left")

        btn_history = tk.Button(
            act_header, text="📋 View Activity History", font=("Segoe UI", 8, "bold"),
            bg="#131e33", fg="#38bdf8", activebackground="#1e293b", activeforeground="#60a5fa",
            relief="flat", cursor="hand2", padx=8, pady=2, command=self.open_history_window
        )
        btn_history.pack(side="right")

        # Single-Line Status Box (Clean, non-cluttered, smooth typewriter animation)
        self.act_card = tk.Frame(container, bg="#0c1322", highlightbackground="#1e293b", highlightthickness=1, padx=14, pady=12)
        self.act_card.pack(fill="x")

        act_inner = tk.Frame(self.act_card, bg="#0c1322")
        act_inner.pack(fill="x")

        self.lbl_act_icon = tk.Label(act_inner, text="🚀", font=("Segoe UI", 14), bg="#0c1322")
        self.lbl_act_icon.pack(side="left", padx=(0, 10))

        act_text_box = tk.Frame(act_inner, bg="#0c1322")
        act_text_box.pack(side="left", fill="both", expand=True)

        self.lbl_act_title = tk.Label(act_text_box, text=self.current_activity_title, font=("Segoe UI", 10, "bold"), fg="#f8fafc", bg="#0c1322")
        self.lbl_act_title.pack(anchor="w")

        self.lbl_act_sub = tk.Label(act_text_box, text=self.current_activity_sub, font=("Segoe UI", 9), fg="#94a3b8", bg="#0c1322")
        self.lbl_act_sub.pack(anchor="w", pady=(2, 0))

        # Footer
        footer = tk.Frame(container, bg="#07090e")
        footer.pack(fill="x", pady=(14, 0))
        tk.Label(footer, text="🔒 Secure TLS Outbound Bridge • Local TallyPrime Port 9000 • Render Cloud Portal", font=("Segoe UI", 8), fg="#475569", bg="#07090e").pack(anchor="w")

    # ------------------------------------------------------------------
    # RECORD ACTIVITY (SMOOTH, ELEGANT, NON-BLOCKING TYPEWRITER ENGINE)
    # ------------------------------------------------------------------
    def record_activity(self, title: str, subtitle: str, badge: str = "ℹ️", status: str = "INFO"):
        """ Thread-safe activity recording. Safely queues typewriter animation on main thread. """
        now_str = time.strftime("%I:%M:%S %p")
        full_sub = f"{subtitle} ({now_str})"
        with self.lock:
            self.current_activity_title = title
            self.current_activity_sub = full_sub
            self.current_activity_badge = badge
            self.activity_history.append({
                "time": now_str,
                "badge": badge,
                "title": title,
                "subtitle": subtitle,
                "status": status
            })
            if len(self.activity_history) > 200:
                self.activity_history.pop(0)

        # Dispatch smooth typewriter animation strictly to UI thread
        try:
            self.root.after(0, self._start_typing_activity, title, full_sub, badge)
        except Exception:
            pass

    def _start_typing_activity(self, title: str, full_sub: str, badge: str):
        """ Runs on Main Thread. Starts a fresh writing sequence, gracefully replacing any pending animation. """
        self._anim_id += 1
        current_anim_id = self._anim_id

        if self._typing_timer_id is not None:
            try:
                self.root.after_cancel(self._typing_timer_id)
            except Exception:
                pass
            self._typing_timer_id = None

        try:
            self.lbl_act_icon.config(text=badge)
            self.lbl_act_title.config(text="")
            self.lbl_act_sub.config(text="")
        except Exception:
            return

        self._type_step(current_anim_id, title, full_sub, 0, 0)

    def _type_step(self, anim_id: int, target_title: str, target_sub: str, title_idx: int, sub_idx: int):
        """ Smooth typing cadence (35ms ticks, 2-3 chars per tick for natural writing appearance). """
        # If a newer activity arrived, stop this animation immediately so queues never accumulate
        if anim_id != self._anim_id:
            return

        try:
            if title_idx < len(target_title):
                # Smooth title streaming (advance 2-3 chars per 32ms)
                next_t = min(len(target_title), title_idx + 2)
                cursor = " ▎" if next_t < len(target_title) else ""
                self.lbl_act_title.config(text=target_title[:next_t] + cursor)
                self._typing_timer_id = self.root.after(32, self._type_step, anim_id, target_title, target_sub, next_t, 0)
            elif sub_idx < len(target_sub):
                # Title complete, finalize title and stream subtitle (advance 3-4 chars per 28ms)
                self.lbl_act_title.config(text=target_title)
                next_s = min(len(target_sub), sub_idx + 4)
                cursor = " ▎" if next_s < len(target_sub) else ""
                self.lbl_act_sub.config(text=target_sub[:next_s] + cursor)
                self._typing_timer_id = self.root.after(28, self._type_step, anim_id, target_title, target_sub, len(target_title), next_s)
            else:
                # Finished smoothly without cursor
                self.lbl_act_title.config(text=target_title)
                self.lbl_act_sub.config(text=target_sub)
                self._typing_timer_id = None
        except tk.TclError:
            self._typing_timer_id = None

    # ------------------------------------------------------------------
    # ACTIVITY HISTORY MODAL WINDOW
    # ------------------------------------------------------------------
    def open_history_window(self):
        hist_win = tk.Toplevel(self.root)
        hist_win.title("Tally Automation Bridge - Activity History")
        hist_win.geometry("620x460")
        hist_win.configure(bg="#07090e")

        top_bar = tk.Frame(hist_win, bg="#07090e", padx=14, pady=10)
        top_bar.pack(fill="x")
        tk.Label(top_bar, text="ACTIVITY & TRANSACTION HISTORY", font=("Segoe UI", 10, "bold"), fg="#f8fafc", bg="#07090e").pack(side="left")

        btn_clear = tk.Button(top_bar, text="Clear History", font=("Segoe UI", 8), bg="#1e293b", fg="#94a3b8", relief="flat", cursor="hand2", padx=8, pady=2)
        btn_clear.pack(side="right")

        text_area = scrolledtext.ScrolledText(
            hist_win, bg="#0c1322", fg="#cbd5e1", insertbackground="white",
            font=("Consolas", 9), relief="flat", highlightthickness=1, highlightbackground="#1e293b",
            padx=10, pady=10
        )
        text_area.pack(fill="both", expand=True, padx=14, pady=(0, 14))

        def _populate():
            text_area.delete("1.0", tk.END)
            with self.lock:
                for item in reversed(self.activity_history):
                    text_area.insert(tk.END, f"[{item['time']}] {item['badge']} {item['title']}\n    {item['subtitle']}\n\n")

        def _clear():
            with self.lock:
                self.activity_history.clear()
            _populate()

        btn_clear.config(command=_clear)
        _populate()

    # ------------------------------------------------------------------
    # TALLY PRIME XML GATEWAY (Port 9000)
    # ------------------------------------------------------------------
    def post_tally_xml(self, xml_content: str, timeout: float = 5.0):
        """ Thread-safe XML POST to local Tally gateway """
        with self.lock:
            tally_url = self.cfg_tally_url
        try:
            req = Request(
                tally_url,
                data=xml_content.encode("utf-8"),
                headers={"Content-Type": "text/xml;charset=utf-8"},
                method="POST"
            )
            with urlopen(req, timeout=timeout) as resp:
                return True, resp.read().decode("utf-8", errors="replace")
        except Exception as exc:
            return False, str(exc)

    def detect_tally_company(self):
        """
        Fast, robust, zero-crash detection of active company in TallyPrime.
        Works across all TallyPrime versions.
        """
        xml_list = """<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER>
  <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY>
</ENVELOPE>"""
        ok, resp = self.post_tally_xml(xml_list, timeout=4.0)

        if not ok:
            with self.lock:
                self.tally_online = False
                self.active_company = "Offline (Port 9000 Closed)"
            return False, self.active_company

        # Extract company name from Tally XML
        comp_name = None

        # Match 1: <COMPANY NAME="..."
        m = re.search(r'<COMPANY[^>]*NAME="([^"]+)"', resp, flags=re.I)
        if m and m.group(1).strip() and not m.group(1).strip().startswith("$$"):
            comp_name = m.group(1).strip()

        # Match 2: <NAME TYPE="String">...</NAME> or <NAME>...</NAME> inside <COLLECTION>
        if not comp_name:
            m = re.search(r'<COLLECTION\b[^>]*>.*?<COMPANY\b[^>]*>.*?<NAME[^>]*>([^<]+)</NAME>', resp, flags=re.I | re.DOTALL)
            if m and m.group(1).strip() and not m.group(1).strip().startswith("$$"):
                comp_name = m.group(1).strip()

        # Match 3: <COMPANYNAME>...</COMPANYNAME>
        if not comp_name:
            m = re.search(r'<COMPANYNAME[^>]*>([^<]+)</COMPANYNAME>', resp, flags=re.I)
            if m and m.group(1).strip():
                comp_name = m.group(1).strip()

        with self.lock:
            if comp_name:
                self.tally_online = True
                self.active_company = comp_name
                return True, comp_name

            # Tally is running, but no company is loaded
            if "TallyPrime" in resp or "<RESPONSE>" in resp or "<ENVELOPE>" in resp:
                self.tally_online = True
                self.active_company = "No Company Opened"
                return True, self.active_company

            self.tally_online = False
            self.active_company = "Unrecognized Tally Gateway"
            return False, self.active_company

    # ------------------------------------------------------------------
    # WEB APP CLOUD BRIDGE
    # ------------------------------------------------------------------
    def post_web(self, endpoint: str, payload: dict, timeout: float = 8.0):
        with self.lock:
            web_url = self.cfg_web_url
        full_url = f"{web_url}{endpoint}"
        try:
            data = json.dumps(payload).encode("utf-8")
            req = Request(
                full_url,
                data=data,
                headers={"Content-Type": "application/json", "Content-Length": str(len(data))},
                method="POST"
            )
            with urlopen(req, timeout=timeout) as resp:
                return True, json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            return False, {"error": str(exc)}

    def heartbeat_web(self):
        with self.lock:
            payload = {
                "username": self.cfg_username,
                "tallyOnline": self.tally_online,
                "activeCompany": self.active_company,
                "tallyUrl": self.cfg_tally_url
            }
        ok, res = self.post_web("/api/connector/heartbeat", payload, timeout=6.0)
        with self.lock:
            self.web_online = ok
        return ok

    def poll_tasks_web(self):
        with self.lock:
            user = self.cfg_username
        ok, res = self.post_web("/api/connector/poll-tasks", {"username": user}, timeout=6.0)
        if ok and res.get("tasks"):
            return res.get("tasks")
        return []

    # ------------------------------------------------------------------
    # USER ACTIONS
    # ------------------------------------------------------------------
    def action_detect_company(self):
        self._sync_cfg_from_ui()
        self.record_activity("Detecting Company...", "Probing TallyPrime gateway on port 9000", "🔍", "INFO")
        threading.Thread(target=self._run_detect, daemon=True).start()

    def _run_detect(self):
        ok, company = self.detect_tally_company()
        if ok and company not in ("No Company Opened", "Offline (Port 9000 Closed)"):
            self.record_activity(f"Company Detected: '{company}'", "TallyPrime connected and active", "✅", "SUCCESS")
            self.heartbeat_web()
        elif ok and company == "No Company Opened":
            self.record_activity("TallyPrime Ready", "Port 9000 is open. Please open a Company in TallyPrime", "ℹ️", "INFO")
            self.heartbeat_web()
        else:
            self.record_activity("Detection Failed", f"Make sure TallyPrime is open on Port 9000 ({company})", "⚠️", "WARN")
        self.update_ui_state()

    def action_sync_all(self, task_id="manual_sync"):
        if threading.current_thread() is threading.main_thread():
            self._sync_cfg_from_ui()
        self.record_activity("Synchronizing All Data...", "Extracting Masters and Day Book Vouchers from TallyPrime", "🔄", "SYNC")
        threading.Thread(target=self._run_sync_all, args=(task_id,), daemon=True).start()

    def _run_sync_all(self, task_id="manual_sync"):
        with self.lock:
            comp_name = self.active_company
            username = self.cfg_username

        comp_var = f"<SVCURRENTCOMPANY>{comp_name}</SVCURRENTCOMPANY>" if comp_name and "Offline" not in comp_name and "No Company" not in comp_name else ""

        # 1. Fetch Ledgers
        xml_l = f"""<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Ledgers</ID></HEADER>
  <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>{comp_var}</STATICVARIABLES>
  <TDL><TDLMESSAGE><COLLECTION NAME="List of Ledgers"><TYPE>Ledger</TYPE><FETCH>Name,Parent,OpeningBalance</FETCH></COLLECTION></TDLMESSAGE></TDL>
  </DESC></BODY>
</ENVELOPE>"""
        ok_l, text_l = self.post_tally_xml(xml_l, timeout=6.0)

        # 2. Fetch Groups
        xml_g = f"""<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Groups</ID></HEADER>
  <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>{comp_var}</STATICVARIABLES>
  <TDL><TDLMESSAGE><COLLECTION NAME="List of Groups"><TYPE>Group</TYPE><FETCH>Name,Parent</FETCH></COLLECTION></TDLMESSAGE></TDL>
  </DESC></BODY>
</ENVELOPE>"""
        ok_g, text_g = self.post_tally_xml(xml_g, timeout=5.0)

        # 3. Fetch Stock Items
        xml_s = f"""<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Stock Items</ID></HEADER>
  <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>{comp_var}</STATICVARIABLES>
  <TDL><TDLMESSAGE><COLLECTION NAME="List of Stock Items"><TYPE>StockItem</TYPE><FETCH>Name,Parent,BaseUnits,OpeningBalance</FETCH></COLLECTION></TDLMESSAGE></TDL>
  </DESC></BODY>
</ENVELOPE>"""
        ok_s, text_s = self.post_tally_xml(xml_s, timeout=5.0)

        # 4. Fetch Units
        xml_u = f"""<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Units</ID></HEADER>
  <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>{comp_var}</STATICVARIABLES>
  <TDL><TDLMESSAGE><COLLECTION NAME="List of Units"><TYPE>Unit</TYPE><FETCH>Name,OriginalName,DecimalPlaces</FETCH></COLLECTION></TDLMESSAGE></TDL>
  </DESC></BODY>
</ENVELOPE>"""
        ok_u, text_u = self.post_tally_xml(xml_u, timeout=5.0)

        # 5. Fetch Godowns
        xml_gd = f"""<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Godowns</ID></HEADER>
  <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>{comp_var}</STATICVARIABLES>
  <TDL><TDLMESSAGE><COLLECTION NAME="List of Godowns"><TYPE>Godown</TYPE><FETCH>Name,Parent</FETCH></COLLECTION></TDLMESSAGE></TDL>
  </DESC></BODY>
</ENVELOPE>"""
        ok_gd, text_gd = self.post_tally_xml(xml_gd, timeout=5.0)

        # 6. Fetch Voucher Types
        xml_v = f"""<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Voucher Types</ID></HEADER>
  <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>{comp_var}</STATICVARIABLES></DESC></BODY>
</ENVELOPE>"""
        ok_v, text_v = self.post_tally_xml(xml_v, timeout=5.0)

        # 7. Fetch Day Book Vouchers
        xml_vch = f"""<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>Vouchers</ID></HEADER>
  <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>{comp_var}</STATICVARIABLES>
  <TDL><TDLMESSAGE><COLLECTION NAME="Vouchers"><TYPE>Voucher</TYPE><FETCH>Date,VoucherTypeName,VoucherNumber,PartyLedgerName,LedgerName,Amount,MasterID,Narration,PersistedView</FETCH></COLLECTION></TDLMESSAGE></TDL>
  </DESC></BODY>
</ENVELOPE>"""
        ok_vch, text_vch = self.post_tally_xml(xml_vch, timeout=8.0)

        ledger_count = count_tally_ledgers(text_l) if ok_l else 0
        vch_count = count_tally_vouchers(text_vch) if ok_vch else 0

        with self.lock:
            self.ledgers_synced_count = ledger_count
            self.daybook_vouchers_count = vch_count

        if ok_l or ok_vch or ok_g or ok_s:
            self.record_activity("Uploading Data to Cloud...", f"Uploading Masters ({ledger_count} Ledgers) and {vch_count} Vouchers", "☁️", "SYNC")
            res_ok, resp = self.post_web("/api/connector/task-result", {
                "username": username,
                "taskId": task_id,
                "status": "completed",
                "data": {
                    "company": comp_name,
                    "ledgersXml": text_l if ok_l else "",
                    "groupsXml": text_g if ok_g else "",
                    "stockItemsXml": text_s if ok_s else "",
                    "unitsXml": text_u if ok_u else "",
                    "godownsXml": text_gd if ok_gd else "",
                    "voucherTypesXml": text_v if ok_v else "",
                    "vouchersXml": text_vch if ok_vch else ""
                }
            })
            if res_ok:
                counts = resp.get("counts", {}) if isinstance(resp, dict) else {}
                with self.lock:
                    if "vouchers" in counts:
                        self.daybook_vouchers_count = counts["vouchers"]
                        vch_count = counts["vouchers"]
                    if "ledgers" in counts:
                        self.ledgers_synced_count = counts["ledgers"]
                        ledger_count = counts["ledgers"]

                self.record_activity(
                    f"Sync Complete: {ledger_count} Masters & {vch_count} Vouchers",
                    f"Accounting masters and {vch_count} Day Book vouchers saved in Web Cloud",
                    "✅", "SUCCESS"
                )
            else:
                self.record_activity("Cloud Upload Failed", f"Server error: {resp.get('error', 'Unknown')}", "⚠️", "WARN")
        else:
            self.record_activity("Sync Failed", "Could not extract data from TallyPrime Port 9000", "⚠️", "ERROR")
        self.update_ui_state()

    def action_save_connect(self):
        self._sync_cfg_from_ui()
        self.record_activity("Connecting to Cloud...", f"Saving credentials for '{self.cfg_username}'", "⚙", "INFO")
        threading.Thread(target=self._run_save_connect, daemon=True).start()

    def _run_save_connect(self):
        self.detect_tally_company()
        ok = self.heartbeat_web()
        if ok:
            self.record_activity("Connected & Paired Successfully", f"Live cloud bridge active with {self.cfg_web_url}", "✅", "SUCCESS")
        else:
            self.record_activity("Connection Failed", f"Could not reach {self.cfg_web_url}", "⚠️", "WARN")
        self.update_ui_state()

    # ------------------------------------------------------------------
    # TASK EXECUTION (SEQUENTIAL ANTI-LAG THROTTLE)
    # ------------------------------------------------------------------
    def execute_task(self, task):
        t_id = task.get("id")
        action = task.get("action")
        payload = task.get("payload", {})

        if action == "SYNC_MASTERS":
            self._run_sync_all(task_id=t_id)
        elif action in ("CREATE_MASTER", "CREATE_LEDGER"):
            master_name = payload.get("name", "Ledger")
            xml_data = payload.get("xml", "")
            self.record_activity(f"Creating Master: '{master_name}'...", "Importing into TallyPrime gateway", "✨", "SYNC")

            # Ensure company matches active company in Tally
            with self.lock:
                active_comp = self.active_company

            if active_comp and "Offline" not in active_comp and "No Company" not in active_comp:
                if "<SVCURRENTCOMPANY>" in xml_data:
                    xml_data = re.sub(r'<SVCURRENTCOMPANY>.*?</SVCURRENTCOMPANY>', f'<SVCURRENTCOMPANY>{active_comp}</SVCURRENTCOMPANY>', xml_data)
                elif "<REQUESTDESC>" in xml_data:
                    xml_data = xml_data.replace("<REQUESTDESC>", f"<REQUESTDESC><STATICVARIABLES><SVCURRENTCOMPANY>{active_comp}</SVCURRENTCOMPANY></STATICVARIABLES>")

            ok, resp = self.post_tally_xml(xml_data, timeout=6.0)

            has_err = not ok or ("<LINEERROR>" in resp) or ("<ERRORS>" in resp and "<ERRORS>0</ERRORS>" not in resp)
            err_msg = ""
            if has_err:
                match = re.search(r'<LINEERROR[^>]*>(.*?)</LINEERROR>', resp, flags=re.I)
                err_msg = match.group(1).strip() if match else (resp[:200] if not ok else "Tally rejected ledger")
                self.record_activity("Ledger Creation Failed", f"{master_name}: {err_msg}", "⚠️", "WARN")
            else:
                with self.lock:
                    self.ledgers_synced_count += 1
                self.record_activity(f"Ledger Created: '{master_name}'", "Available in TallyPrime for transactions", "✅", "SUCCESS")

            self.post_web("/api/connector/task-result", {
                "username": self.cfg_username,
                "taskId": t_id,
                "status": "completed",
                "data": {
                    "name": master_name,
                    "status": "failed" if has_err else "created",
                    "message": err_msg or "Created in TallyPrime.",
                    "response": resp[:300] if resp else ""
                }
            })
            self.update_ui_state()
        elif action == "DISPATCH_VOUCHERS":
            vouchers = payload.get("vouchers", [])
            total = len(vouchers)
            self.record_activity("Dispatching Vouchers...", f"Processing batch of {total} vouchers into TallyPrime", "🚀", "SYNC")
            imported = 0
            failed = 0
            results = []

            for idx, item in enumerate(vouchers):
                v_res_ok, v_text = self.post_tally_xml(item.get("xml", ""), timeout=5.0)
                has_err = not v_res_ok or ("<LINEERROR>" in v_text) or ("<ERRORS>" in v_text and "<ERRORS>0</ERRORS>" not in v_text)

                err_msg = ""
                if has_err:
                    failed += 1
                    match = re.search(r'<LINEERROR[^>]*>(.*?)</LINEERROR>', v_text, flags=re.I)
                    err_msg = match.group(1).strip() if match else (v_text[:200] if not v_res_ok else "Tally rejected voucher")
                else:
                    imported += 1
                    with self.lock:
                        self.vouchers_dispatched_count += 1

                results.append({
                    "id": item.get("id"),
                    "status": "failed" if has_err else "imported",
                    "message": err_msg if has_err else "Imported into Tally via Connector.",
                    "response": v_text[:300] if v_text else ""
                })

                # 60ms micro-delay prevents Tally UI lag / freeze
                time.sleep(0.06)

            self.post_web("/api/connector/task-result", {
                "username": self.cfg_username,
                "taskId": t_id,
                "status": "completed",
                "data": {"imported": imported, "failed": failed, "total": total, "voucherResults": results}
            })
            self.record_activity(f"Batch Complete: {imported} Imported", f"{failed} failed out of {total} vouchers", "✅" if failed == 0 else "⚠️", "SUCCESS")
            self.update_ui_state()

    # ------------------------------------------------------------------
    # UI STATE UPDATE (THREAD-SAFE VIA AFTER)
    # ------------------------------------------------------------------
    def update_ui_state(self):
        def _apply():
            with self.lock:
                t_on = self.tally_online
                comp = self.active_company
                w_on = self.web_online
                user = self.cfg_username
                server = self.cfg_web_url
                vch_cnt = self.daybook_vouchers_count
                disp_cnt = self.vouchers_dispatched_count
                mast_cnt = self.ledgers_synced_count

            try:
                # Tally Badge & Info
                if t_on:
                    if comp == "No Company Opened":
                        self.badge_tally.config(text="● ONLINE", fg="#f59e0b", bg="#291e0a")
                        self.lbl_tally_comp.config(text="No Company Opened", fg="#f1f5f9")
                        self.lbl_tally_sub.config(text="Port 9000 Ready • Open Company in Tally", fg="#94a3b8")
                    else:
                        self.badge_tally.config(text="● ONLINE", fg="#34d399", bg="#062b1a")
                        self.lbl_tally_comp.config(text=comp, fg="#f1f5f9")
                        self.lbl_tally_sub.config(text="Port 9000 • XML Gateway Active", fg="#64748b")
                else:
                    self.badge_tally.config(text="● OFFLINE", fg="#ef4444", bg="#2a1215")
                    self.lbl_tally_comp.config(text="Offline (Port 9000 Closed)", fg="#94a3b8")
                    self.lbl_tally_sub.config(text="Start TallyPrime to connect", fg="#ef4444")

                # Web Badge & Info
                if w_on:
                    self.badge_web.config(text="● PAIRED", fg="#34d399", bg="#062b1a")
                    self.lbl_web_user.config(text=f"{user} (Connected)", fg="#f1f5f9")
                    self.lbl_web_sub.config(text=server, fg="#64748b")
                else:
                    self.badge_web.config(text="● UNPAIRED", fg="#f59e0b", bg="#291e0a")
                    self.lbl_web_user.config(text=f"{user} (Offline)", fg="#94a3b8")
                    self.lbl_web_sub.config(text=server, fg="#64748b")

                # Metrics
                self.lbl_stat_daybook.config(text=str(vch_cnt))
                self.lbl_stat_dispatched.config(text=f"Dispatched: {disp_cnt}")
                self.lbl_stat_masters.config(text=str(mast_cnt))
            except tk.TclError:
                pass

        try:
            self.root.after(0, _apply)
        except Exception:
            pass

    # ------------------------------------------------------------------
    # BACKGROUND POLLER
    # ------------------------------------------------------------------
    def start_background_worker(self):
        def _loop():
            # Initial detection & pairing
            time.sleep(0.5)
            self.detect_tally_company()
            self.heartbeat_web()
            self.update_ui_state()

            last_status = time.time()
            while self.poll_running:
                now = time.time()
                try:
                    if now - last_status > 4.5:
                        self.detect_tally_company()
                        self.heartbeat_web()
                        self.update_ui_state()
                        last_status = now

                    tasks = self.poll_tasks_web()
                    for t in tasks:
                        self.execute_task(t)
                except Exception:
                    pass
                time.sleep(2.0)

        t = threading.Thread(target=_loop, daemon=True)
        t.start()


def main():
    root = tk.Tk()
    app = TallyConnectorGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
