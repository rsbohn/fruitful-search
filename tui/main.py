from __future__ import annotations

import webbrowser
from dataclasses import asdict
from typing import Optional

from textual import events
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.reactive import reactive
from textual.widgets import Footer, Header, Input, Static, ListItem, ListView, Label

from core import db as coredb


class ResultItem(ListItem):
    def __init__(self, summary: str, payload: coredb.Result, why: str = "") -> None:
        super().__init__(Static(summary, expand=True))
        self.payload = payload
        self.why = why


class DetailView(Static):
    result: reactive[Optional[coredb.Result]] = reactive(None)
    why: reactive[str] = reactive("")

    def watch_result(self, result: Optional[coredb.Result]) -> None:
        if result is None:
            self.update("\nSelect a result to see details.")
            return
        r = result
        stock_str = str(r.stock)
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
        if self.why:
            lines.append("")
            lines.append(f"Why it matched: {self.why}")
        self.update("\n" + "\n".join(lines))


class FruitfulApp(App):
    BINDINGS = [
        Binding("enter", "run_search", "Run"),
        Binding("i", "toggle_in_stock", "In-Stock"),
        Binding("f", "open_filters", "Filters"),
        Binding("g", "inspire", "Inspire"),
        Binding("o", "open_url", "Open"),
        Binding("?", "help", "Help"),
        Binding("q", "quit", "Quit"),
        Binding("escape", "clear_selection", "Clear"),
    ]

    query: reactive[str] = reactive("")
    in_stock_only: reactive[bool] = reactive(True)

    def compose(self) -> ComposeResult:
        yield Header(show_clock=False)
        with Horizontal():
            with Vertical(id="left"):
                self.stock_badge = Label(self._stock_label(), id="stock-badge")
                yield self.stock_badge
                self.results = ListView(id="results")
                yield self.results
            self.details = DetailView(id="details")
            yield self.details
        # Bottom search input just above footer
        self.search = Input(
            placeholder="Type to search… Enter to run", id="search"
        )
        yield self.search
        yield Footer()

    def on_mount(self) -> None:
        self.details.update(
            "\nType a query and press Enter. '/' focuses search (without inserting) unless input is already focused. 'i' toggles In-Stock."
        )
        self.set_focus(self.search)
        self.set_timer(0.05, lambda: self.set_focus(self.search))

    def _stock_label(self) -> str:
        return f"In-Stock: {'ON' if self.in_stock_only else 'OFF'} (press 'i' to toggle)"

    def _why_for(self, q: str, r: coredb.Result) -> str:
        tokens = [t.lower() for t in q.split() if t]
        name_l = (r.name or "").lower()
        matched = [t for t in tokens if t in name_l]
        return ", ".join(matched) if matched else "BM25 lexical match"

    def on_key(self, event: events.Key) -> None:  # type: ignore[name-defined]
        if event.character and self.focused is not self.search:
            ch = event.character
            self.set_focus(self.search)
            # If slash is pressed while not focused, focus but discard '/'
            if ch == "/":
                event.stop()
                return
            try:
                self.search.insert_text_at_cursor(ch)
                event.stop()
                return
            except Exception:
                pass

    def on_input_submitted(self, event: Input.Submitted) -> None:  # type: ignore[name-defined]
        self.action_run_search()

    def action_focus_search(self) -> None:
        self.set_focus(self.search)

    def action_toggle_in_stock(self) -> None:
        self.in_stock_only = not self.in_stock_only
        self.stock_badge.update(self._stock_label())
        if self.query:
            self.action_run_search()

    def action_open_filters(self) -> None:
        self.details.update(
            "\nFilters panel is not yet implemented in this rebuild."
        )

    def action_inspire(self) -> None:
        self.search.value = ""
        self.results.clear()
        self.details.update(
            "\nInspire mode stub — try searching for a sensor, display, or microcontroller."
        )

    def action_help(self) -> None:
        self.details.update(
            "\nShortcuts: '/' focus search, Enter run, 'i' in-stock, 'o' open, 'q' quit, '?' help."
        )

    def action_run_search(self) -> None:
        q = self.search.value.strip()
        self.query = q
        self.results.clear()
        if not q:
            self.details.update("\nEnter a query to search.")
            return
        try:
            rows = coredb.search(q, limit=50)
        except FileNotFoundError as e:
            self.details.update(
                f"\nIndex not found. {e}\nRun scripts/build_index.py first."
            )
            return
        except RuntimeError as e:
            self.details.update(f"\nFTS5 not available: {e}")
            return

        def in_stock(r: coredb.Result) -> bool:
            try:
                return int(r.stock) > 0
            except Exception:
                return str(r.stock).strip().lower() not in {"oos", "out", "0", "no"}

        if self.in_stock_only:
            rows = [r for r in rows if in_stock(r)]

        if not rows:
            self.details.update("\nNo results.")
            return

        for r in rows:
            stock = str(r.stock)
            summary = f"PID {r.pid}  ${r.price:.2f}  stock={stock}  {r.name}"
            why = self._why_for(q, r)
            self.results.append(ResultItem(summary, r, why))

        self.results.index = 0
        self.results.focus()
        first_item = self._current_item()
        if first_item:
            self.details.why = first_item.why
            self.details.result = first_item.payload

    def action_clear_selection(self) -> None:
        self.results.index = None
        self.details.result = None
        self.details.why = ""
        self.set_focus(self.search)

    def action_open_url(self) -> None:
        item = self._current_item()
        if not item:
            return
        if item.payload.url:
            webbrowser.open(item.payload.url)

    def _current_item(self) -> Optional[ResultItem]:
        if self.results.index is None or self.results.index < 0:
            return None
        children = [c for c in self.results.children if isinstance(c, ResultItem)]
        if 0 <= self.results.index < len(children):
            return children[self.results.index]
        return None

    def on_list_view_highlighted(self, event: ListView.Highlighted) -> None:  # type: ignore[name-defined]
        item = self._current_item()
        if item:
            self.details.why = item.why
            self.details.result = item.payload


def main() -> None:
    FruitfulApp().run()


if __name__ == "__main__":
    main()
