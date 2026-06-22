#!/usr/bin/env python3
"""
Pre-deploy check for index.html.

Run this BEFORE every git push. It extracts the inline JS from index.html and
runs `node --check` on it, which catches the single most common cause of the
"tabs broke / Monthly close frozen on Loading" failures: an unescaped quote
inside a JS string (usually an onclick="..." with bare 'single' quotes inside
an h+='...' concatenation).

If this script prints FAIL, do NOT push — fix the reported line first.

Usage:
    python3 predeploy_check.py
"""
import re
import subprocess
import sys
import tempfile
import os

INDEX = os.path.join(os.path.dirname(__file__), "index.html")


def extract_main_js(html: str) -> str:
    """Return the body of the largest <script> block (the app code)."""
    opens = [m.end() for m in re.finditer(r"<script>", html)]
    closes = [m.start() for m in re.finditer(r"</script>", html)]
    if not opens or not closes:
        return ""
    # largest block by body size
    best_start = max(opens, key=lambda st: next((c for c in closes if c > st), 0))
    best_end = next(c for c in closes if c > best_start)
    return html[best_start:best_end]


def main() -> int:
    html = open(INDEX, encoding="utf-8").read()

    problems = []

    # 1. Hard syntax check via node --check
    js = extract_main_js(html)
    if not js:
        problems.append("Could not locate the main <script> block.")
    else:
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
            f.write(js)
            tmp = f.name
        res = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
        os.unlink(tmp)
        if res.returncode != 0:
            problems.append("JS SYNTAX ERROR (node --check):\n" + res.stderr.strip())

    # 2. Heuristic: bare unescaped single-quoted args inside onclick="..." that
    #    sits inside an h+='...' concatenation. These are the recurring killer.
    #    Pattern: onclick="...('something')..." where the surrounding JS string
    #    uses single quotes. We flag onclick="...'...'..." that is NOT escaped.
    for m in re.finditer(r"h\s*\+=\s*'[^\n]*onclick=\"[^\"]*?'[^\"]*?'[^\"]*?\"", html):
        snippet = m.group(0)
        # If it contains \' it's escaped; a bare ' inside is the danger.
        # Crude but effective: warn if there's a (' or ') without a preceding backslash
        if re.search(r"[^\\]'(?:[a-zA-Z]|\))", snippet):
            problems.append(
                "Possible unescaped single quote inside onclick within an h+='...' "
                "string:\n    " + snippet[:160]
            )

    # 3. Check critical variable declaration order in renderMRR
    import re as _re
    rf_m = _re.search(r'function renderMRR\(.*?\n\}', js, _re.DOTALL)
    if rf_m:
        rf = rf_m.group()
        order_checks = [
            ('custMoM', 'currCount'),
            ('momAmt',  'currMRR'),
            ('momAmt',  'prevMRR'),
            ('kpiMoM',  'currMRR'),
        ]
        for later, earlier in order_checks:
            m1 = _re.search(r'(const|let|var)\s+' + earlier + r'\b', rf)
            m2 = _re.search(r'(const|let|var)\s+' + later  + r'\b', rf)
            if m1 and m2 and m2.start() < m1.start():
                problems.append(
                    f"Variable order: '{later}' declared before '{earlier}' in renderMRR "
                    f"(will ReferenceError at runtime)."
                )

    # 5. Required CSS classes (catches silent injection failures)
    required_css = ['.bkpi-headline', '.hcard', '.cohort-grid', '.cgrow', '.cgcell', '.dchip', '.sect-head']
    for cls in required_css:
        if cls not in html:
            problems.append(f"CSS class '{cls}' missing from stylesheet — injection likely failed.")

    # 7. Sanity: tab router and the five page switchers must be present.
    if "function switchPage" not in html:
        problems.append("switchPage function missing.")
    for page in ["'closing'", "'mrr'", "'fin'", "'meta'", "'export'"]:
        if f"switchPage({page}" not in html:
            problems.append(f"switchPage call for {page} missing.")

    # 4. File-size floor — catches truncation from a bad JSON rewrite.
    if len(html) < 800_000:
        problems.append(f"index.html is suspiciously small ({len(html):,} bytes) — possible truncation.")

    if problems:
        print("FAIL — do NOT push:\n")
        for p in problems:
            print("  • " + p + "\n")
        return 1

    print(f"PASS — index.html looks safe to deploy ({len(html):,} bytes).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
