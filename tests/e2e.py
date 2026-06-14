"""End-to-end smoke + functional test for Jump Count Timer.

Server is provided externally by with_server.py on port 5180.
"""
from __future__ import annotations
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, expect

BASE = "http://127.0.0.1:5180/"
SHOTS = Path(__file__).resolve().parent.parent / "screenshots"
SHOTS.mkdir(exist_ok=True)


def snap(page: Page, name: str) -> None:
    path = SHOTS / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    print(f"  [shot] {path.name}")


def assert_console_clean(messages: list[dict], allow_substrings: list[str] | None = None) -> list[dict]:
    allow_substrings = allow_substrings or []
    bad = []
    for m in messages:
        if m["type"] not in ("error", "warning"):
            continue
        if any(sub in m["text"] for sub in allow_substrings):
            continue
        bad.append(m)
    return bad


def run() -> int:
    failures: list[str] = []
    console_msgs: list[dict] = []
    page_errors: list[str] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on("console", lambda msg: console_msgs.append({"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))

        # 0. Clear storage and load
        print("[step 0] load page + clear storage")
        page.goto(BASE, wait_until="domcontentloaded")
        page.evaluate("() => { try { localStorage.clear(); } catch(e){} }")
        page.reload(wait_until="networkidle")
        snap(page, "01-initial-empty")

        # 1. Title and main screen visible
        print("[step 1] verify main screen")
        expect(page).to_have_title("점프 카운트 타이머 · Day 33")
        expect(page.locator("#screen-main")).to_be_visible()
        expect(page.locator("#btn-start")).to_be_disabled()

        # 2. Add a student
        print("[step 2] add student 김민지")
        page.fill("#input-new-student", "김민지")
        page.click("#form-add-student button[type=submit]")
        expect(page.locator(".student-item.active")).to_contain_text("김민지")

        # 3. Add a second student
        print("[step 3] add student 이서준")
        page.fill("#input-new-student", "이서준")
        page.click("#form-add-student button[type=submit]")
        items = page.locator(".student-item")
        if items.count() != 2:
            failures.append(f"expected 2 students, got {items.count()}")
        # The new addition should auto-select
        expect(page.locator(".student-item.active")).to_contain_text("이서준")
        # Re-select 김민지
        page.locator(".student-item .pick").first.click()
        expect(page.locator(".student-item.active")).to_contain_text("김민지")

        # 4. Start should now be enabled (default 30s preset)
        print("[step 4] start enabled")
        expect(page.locator("#btn-start")).to_be_enabled()

        # 5. Select 15s preset to make the test fast, then start
        print("[step 5] pick 15s + start, prepare countdown")
        page.locator("#preset-row .chip[data-seconds='15']").click()
        expect(page.locator("#preset-row .chip[data-seconds='15']")).to_have_attribute("aria-checked", "true")
        page.click("#btn-start")
        expect(page.locator("#screen-run")).to_be_visible()
        expect(page.locator("#screen-main")).to_be_hidden()
        # The prepare panel shows 3
        expect(page.locator("#prepare-num")).to_have_text("3")
        snap(page, "02-prepare-3")

        # 6. Wait for active phase (~3.3s) then start tapping
        print("[step 6] wait for active phase")
        page.wait_for_selector("#run-active:not([hidden])", timeout=8000)
        expect(page.locator("#count-display")).to_have_text("0")
        snap(page, "03-active-start")

        # Spam space bar a bunch
        print("[step 7] simulate jumps via Space")
        for i in range(25):
            page.keyboard.press("Space")
            page.wait_for_timeout(60)  # ~60ms between taps = realistic fast jumper
        count_text = page.locator("#count-display").inner_text().strip()
        try:
            cnt = int(count_text)
        except ValueError:
            cnt = -1
        print(f"  count after 25 space presses: {cnt}")
        if cnt < 20:
            failures.append(f"space tap count too low: got {cnt}, expected >=20")

        # 8. Try clicking the tap zone too
        print("[step 8] tap clicks on stage")
        for _ in range(5):
            page.locator("#tap-zone").click()
            page.wait_for_timeout(60)
        cnt2 = int(page.locator("#count-display").inner_text().strip())
        if cnt2 <= cnt:
            failures.append(f"click taps not registering: {cnt} -> {cnt2}")
        snap(page, "04-active-mid")

        # 9. Wait for the run to finish
        print("[step 9] wait for result screen")
        page.wait_for_selector("#screen-result:not(.hidden)", timeout=20000)
        result_meta = page.locator("#result-meta").inner_text().strip()
        result_count_text = page.locator("#result-count").inner_text().strip()
        result_pr = page.locator("#result-pr").inner_text().strip()
        print(f"  result: meta='{result_meta}' count='{result_count_text}' pr='{result_pr}'")
        if "김민지" not in result_meta or "15초" not in result_meta:
            failures.append(f"result meta wrong: {result_meta}")
        if "회" not in result_count_text:
            failures.append(f"result count missing 회: {result_count_text}")
        if "신기록" not in result_pr:
            failures.append(f"expected first-PR badge, got: {result_pr}")
        snap(page, "05-result-first")

        # 10. Confirm ranking updated
        print("[step 10] return to main and verify ranking")
        page.click("#btn-next")
        expect(page.locator("#screen-main")).to_be_visible()
        # The rank tab default = 30s but our record is 15s, switch tab
        page.locator("#rank-tabs .tab[data-seconds='15']").click()
        rank_list = page.locator("#rank-list li")
        if rank_list.count() < 1:
            failures.append("ranking empty after first run")
        else:
            row_text = rank_list.first.inner_text()
            if "김민지" not in row_text:
                failures.append(f"ranking row missing student name: {row_text}")
        snap(page, "06-ranking-after-first")

        # 11. Second student gets a turn with fewer jumps, verify PR ordering
        print("[step 11] second student measurement")
        page.locator(".student-item .pick").nth(1).click()  # 이서준
        expect(page.locator(".student-item.active")).to_contain_text("이서준")
        page.locator("#preset-row .chip[data-seconds='15']").click()
        page.click("#btn-start")
        page.wait_for_selector("#run-active:not([hidden])", timeout=8000)
        for _ in range(10):
            page.keyboard.press("Space")
            page.wait_for_timeout(60)
        page.wait_for_selector("#screen-result:not(.hidden)", timeout=20000)
        snap(page, "07-result-second")
        page.click("#btn-next")
        page.locator("#rank-tabs .tab[data-seconds='15']").click()
        rows = page.locator("#rank-list li")
        if rows.count() < 2:
            failures.append(f"expected at least 2 ranking entries, got {rows.count()}")
        else:
            first = rows.nth(0).inner_text()
            second = rows.nth(1).inner_text()
            # 김민지 has higher count, must be first
            if "김민지" not in first:
                failures.append(f"first rank should be 김민지, got: {first!r}")
            if "이서준" not in second:
                failures.append(f"second rank should be 이서준, got: {second!r}")
        snap(page, "08-ranking-after-second")

        # 12. Cancel mid-run via Esc
        print("[step 12] cancel run via Escape")
        page.locator(".student-item .pick").first.click()  # 김민지
        page.click("#btn-start")
        page.wait_for_selector("#prepare:not([hidden])", timeout=4000)
        page.keyboard.press("Escape")
        expect(page.locator("#screen-main")).to_be_visible()

        # 13. Custom seconds input
        print("[step 13] custom seconds validation")
        page.fill("#input-custom", "3")
        page.click("#btn-custom")
        toast = page.locator("#toast")
        expect(toast).to_be_visible()
        page.wait_for_timeout(300)
        page.fill("#input-custom", "5")
        page.click("#btn-custom")
        page.wait_for_timeout(300)
        # All preset chips should be unchecked
        for sec in (15, 30, 60, 180):
            checked = page.locator(f"#preset-row .chip[data-seconds='{sec}']").get_attribute("aria-checked")
            if checked == "true":
                failures.append(f"custom selection didn't clear preset chip {sec}")

        # 14. Export -> JSON file
        print("[step 14] export JSON")
        with page.expect_download() as dl_info:
            page.click("#btn-export")
        download = dl_info.value
        out_path = Path(__file__).resolve().parent / "exported.json"
        download.save_as(str(out_path))
        with out_path.open() as fh:
            data = json.load(fh)
        if data.get("schema") != "jct.v1":
            failures.append(f"export schema bad: {data.get('schema')}")
        if "김민지" not in data.get("students", []):
            failures.append("export missing 김민지")
        if "15" not in str(list(data.get("records", {}).get("김민지", {}).keys())) and 15 not in data.get("records", {}).get("김민지", {}):
            # JSON keys are strings
            keys = list(data.get("records", {}).get("김민지", {}).keys())
            if "15" not in keys:
                failures.append(f"export missing 15s record for 김민지, keys={keys}")
        print(f"  exported: students={data['students']}, records-keys per student computed.")

        # 15. Mute toggle
        print("[step 15] mute toggle")
        page.click("#btn-mute")
        expect(page.locator("#btn-mute")).to_have_attribute("aria-pressed", "true")
        page.click("#btn-mute")
        expect(page.locator("#btn-mute")).to_have_attribute("aria-pressed", "false")

        # 16. Reduced motion + keyboard shortcut hint check
        print("[step 16] verify keyboard hints + a11y attrs")
        # tap-zone must be focusable
        expect(page.locator("#tap-zone")).to_have_attribute("role", "button")
        # rank list aria-live
        expect(page.locator("#rank-list")).to_have_attribute("aria-live", "polite")

        # 17. Mobile viewport check
        print("[step 17] mobile viewport snapshot")
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(BASE, wait_until="networkidle")
        snap(page, "09-mobile-main")
        # No horizontal scroll
        body_w = page.evaluate("() => document.documentElement.scrollWidth")
        if body_w > 410:
            failures.append(f"mobile horizontal overflow: scrollWidth={body_w}")

        # 18. TV viewport check
        print("[step 18] TV viewport snapshot")
        page.set_viewport_size({"width": 1920, "height": 1080})
        page.goto(BASE, wait_until="networkidle")
        snap(page, "10-tv-main")

        browser.close()

    # Report console / page errors
    bad_console = assert_console_clean(console_msgs, allow_substrings=[
        "cdn.tailwindcss.com",
        "favicon",
        "Download the React DevTools",
    ])
    if bad_console:
        for m in bad_console:
            failures.append(f"console {m['type']}: {m['text']}")
    for e in page_errors:
        failures.append(f"pageerror: {e}")

    print("\n=== Test Summary ===")
    if failures:
        print(f"FAIL ({len(failures)} issues):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("PASS — all checks green.")
    return 0


if __name__ == "__main__":
    sys.exit(run())
