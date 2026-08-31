import datetime, time, sys
print(f"{datetime.datetime.now().isoformat()}  camoufox launcher starting", flush=True)
try:
    from camoufox.sync_api import Camoufox
    with Camoufox(headless=True) as browser:
        page = browser.new_page()
        print(f"{datetime.datetime.now().isoformat()}  browser up, beginning loop", flush=True)
        n = 0
        while True:
            n += 1
            page.goto("https://example.com", timeout=30000)
            print(f"{datetime.datetime.now().isoformat()}  fetch #{n} example.com -> {page.title()!r}", flush=True)
            time.sleep(6)
except Exception as e:
    print(f"{datetime.datetime.now().isoformat()}  ERROR {type(e).__name__}: {e}", flush=True)
    sys.exit(1)
