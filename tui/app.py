from __future__ import annotations

import webbrowser
from dataclasses import asdict
from pathlib import Path
from typing import List, Optional

from textual import events
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.reactive import reactive
from textual.widgets import Footer, Header, Input, Static, ListItem, ListView

from core import db as coredb


class ResultItem(ListItem):
    def __init__(self, text: str, payload: coredb.Result) -> None:
        super().__init__(Static(text, expand=True))
        self.payload = payload


class DetailView(Static):
    result: reactive[Optional[coredb.Result]] = reactive(None)

    def watch_result(self, result: Optional[coredb.Result]) -> None:
        if result is None:
            self.update("\nSelect a result to see details.")
            return
        r = result
        stock = r.stock
        stock_str = str(stock)
        lines = [
            f"PID: {r.pid}",
            f"Name: {r.name}",
            f"Price: ${r.price:.2f}",
            f"Stock: {stock_str}",
            f"URL: {r.url}",
            f"Model: {r.model}",
            f"MPN: {r.mpn}",
            f"Manufacturer: {r.manufacturer}",
            f"Added: {r.date_added}",
            f"Status: {r.discontinue_status}",
        ]
        self.update("\n" + "\n".join(lines))


class FruitfulApp(App):
    CSS_PATH = None
    BINDINGS = [
        Binding("/", "focus_search", "Search"),
        Binding("enter", "run_search", "Run"),
        Binding("o", "open_url", "Open"),
        Binding("q", "quit", "Quit"),
        Binding("escape", "clear_selection", "Clear"),
    ]

    query: reactive[str] = reactive("")

    def compose(self) -> ComposeResult:
        yield Header(show_clock=False)
        with Horizontal():
            with Vertical(id="left"):
                self.search = Input(
                    placeholder="Type to search… Press Enter to run", id="search"
                )
                yield self.search
                self.results = ListView(id="results")
                yield self.results
            self.details = DetailView(id="details")
            yield self.details
        yield Footer()

    def on_mount(self) -> None:
        # Initial hint and focus the search box so typing works immediately
        self.details.update(
            "\nType a query and press Enter. Use '/' to refocus the search box."
        )
        try:
            # Prefer App-managed focus for reliability across terminals
            self.set_focus(self.search)
        except Exception:
            self.search.focus()
        # In some terminals (e.g., Windows Terminal + WSL), initial focus may be ignored.
        # Schedule a follow-up focus shortly after mount.
        self.set_timer(0.05, lambda: self.set_focus(self.search))

    def on_key(self, event: events.Key) -> None:  # type: ignore[name-defined]
        # Fallback: if user starts typing and search isn't focused, capture and redirect
        if event.character and hasattr(self, "search") and self.search is not None:
            if self.focused is not self.search:
                self.set_focus(self.search)
                # Insert the first typed character so it isn't lost
                try:
                    self.search.insert_text_at_cursor(event.character)
                    event.stop()
                    return
                except Exception:
                    pass

    def on_input_submitted(self, event: Input.Submitted) -> None:  # type: ignore[name-defined]
        # Enter pressed while search input is focused
        self.action_run_search()

    def action_focus_search(self) -> None:
        self.query = ""
        self.search.focus()

    def action_run_search(self) -> None:
        q = self.search.value.strip()
        self.query = q
        self.results.clear()
        if not q:
            self.details.update("\nEnter a query to search.")
            return
        try:
            rows = coredb.search(q, limit=20)
        except FileNotFoundError as e:
            self.details.update(
                f"\nIndex not found. {e}\nRun scripts/build_index.py first."
            )
            return
        except RuntimeError as e:
            self.details.update(f"\nFTS5 not available: {e}")
            return
        if not rows:
            self.details.update("\nNo results.")
            return
        for r in rows:
            stock = str(r.stock)
            text = f"PID {r.pid}  ${r.price:.2f}  stock={stock}  {r.name}"
            self.results.append(ResultItem(text, r))
        # Focus results list for navigation
        self.results.index = 0
        self.results.focus()
        self.details.result = rows[0]

    def action_clear_selection(self) -> None:
        self.results.index = None
        self.details.result = None
        self.search.focus()

    def action_open_url(self) -> None:
        item = self._current_item()
        if not item:
            return
        url = item.payload.url
        if url:
            webbrowser.open(url)

    def _current_item(self) -> Optional[ResultItem]:
        if not hasattr(self, "results"):
            return None
        if self.results.index is None or self.results.index < 0:
            return None
        # Textual versions differ; avoid relying on a helper and read children directly
        children = [c for c in self.results.children if isinstance(c, ResultItem)]
        if 0 <= self.results.index < len(children):
            return children[self.results.index]
        return None

    def on_list_view_highlighted(self, event: ListView.Highlighted) -> None:  # type: ignore[name-defined]
        item = self._current_item()
        if item:
            self.details.result = item.payload
