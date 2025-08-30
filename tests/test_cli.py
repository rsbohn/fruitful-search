from __future__ import annotations

import builtins
from pathlib import Path
from types import SimpleNamespace

import webbrowser as _webbrowser

from core import cli
from core import db as coredb


class DummyConn:
    def __init__(self, url: str):
        self._url = url

    def execute(self, _sql: str, _params: tuple):
        class _C:
            def __init__(self, url: str):
                self._url = url

            def fetchone(self):
                return (self._url,)

        return _C(self._url)

    def close(self):
        return None


def test_single_shot_query_prints_results(monkeypatch, capsys):
    # Arrange: stub search to return a single result
    res = coredb.Result(
        pid=1234,
        name="Feather Test Board",
        price=12.34,
        stock=42,
        url="https://adafruit.com/product/1234",
        date_added="2024-08-01",
        discontinue_status="",
        model="",
        mpn="",
        manufacturer="Adafruit",
    )

    def fake_search(query: str, limit: int = 20, db_path: Path = coredb.DEFAULT_DB_PATH):
        assert "feather" in query.lower()
        assert limit == 5
        return [res]

    monkeypatch.setattr(coredb, "search", fake_search)

    # Act
    rc = cli.main(["feather", "--limit", "5"])

    # Assert
    captured = capsys.readouterr().out
    assert rc == 0
    assert "PID 1234" in captured
    assert "Feather Test Board" in captured
    assert "https://adafruit.com/product/1234" in captured


def test_open_pid_opens_browser(monkeypatch, capsys):
    opened = {}

    def fake_open(url):
        opened["url"] = url
        return True

    monkeypatch.setattr(_webbrowser, "open", fake_open)
    monkeypatch.setattr(coredb, "open_db", lambda p: DummyConn("https://example.com/p/999"))

    rc = cli.main([":open", "999"])  # one-shot :open
    out = capsys.readouterr().out

    assert rc == 0
    assert opened["url"] == "https://example.com/p/999"
    assert "Opened https://example.com/p/999" in out


def test_json_output(monkeypatch, capsys):
    res = coredb.Result(
        pid=555,
        name="QT Py Test",
        price=9.99,
        stock="in stock",
        url="https://adafruit.com/product/555",
        date_added="2024-07-01",
        discontinue_status="",
        model="QT-Py",
        mpn="",
        manufacturer="Adafruit",
    )

    def fake_search(query: str, limit: int = 20, db_path: Path = coredb.DEFAULT_DB_PATH):
        return [res]

    monkeypatch.setattr(coredb, "search", fake_search)

    rc = cli.main(["--json", "qt", "py"])  # query becomes "qt py"
    out = capsys.readouterr().out

    assert rc == 0
    data = __import__("json").loads(out)
    assert isinstance(data, list) and len(data) == 1
    assert data[0]["pid"] == 555
    assert data[0]["name"] == "QT Py Test"


def test_missing_db_returns_error(tmp_path, capsys):
    missing = tmp_path / "no-index.sqlite"
    rc = cli.main(["--db", str(missing), "feather"])
    out = capsys.readouterr().out
    assert rc == 2
    assert "Error:" in out
    assert "index not found" in out.lower()


def test_open_pid_non_integer(capsys):
    rc = cli.main([":open", "abc"])
    out = capsys.readouterr().out
    assert rc == 2
    assert "PID must be an integer." in out


def test_open_pid_no_url(monkeypatch, capsys):
    class NoUrlConn:
        def execute(self, _sql, _params):
            class C:
                def fetchone(self_inner):
                    return None

            return C()

        def close(self):
            return None

    monkeypatch.setattr(coredb, "open_db", lambda p: NoUrlConn())
    rc = cli.main([":open", "42"])  # one-shot :open
    out = capsys.readouterr().out
    assert rc == 1
    assert "No URL found for PID 42." in out
