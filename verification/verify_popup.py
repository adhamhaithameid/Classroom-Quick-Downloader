import os
import sys
from urllib.parse import urlparse


def is_local_verification_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost"}


def verify_popup(url: str):
    try:
        from playwright.sync_api import sync_playwright
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Missing Playwright Python package. Install with "
            "`pip install playwright` and then "
            "`python3 -m playwright install chromium`."
        ) from exc

    screenshot_path = os.path.join(os.getcwd(), "verification/verification.png")
    error_screenshot_path = os.path.join(os.getcwd(), "verification/error.png")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print(f"Navigating to {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_selector(
                "text=Classroom Quick Downloader",
                state="visible",
                timeout=15000,
            )
            page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            try:
                page.screenshot(path=error_screenshot_path)
                print(f"Error screenshot saved to {error_screenshot_path}")
            except Exception as screenshot_error:
                print(f"Could not capture error screenshot: {screenshot_error}", file=sys.stderr)
            raise
        finally:
            browser.close()


if __name__ == "__main__":
    target_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080/popup.html"
    if not is_local_verification_url(target_url):
        print("Verification URL must be localhost/127.0.0.1 over http.", file=sys.stderr)
        sys.exit(2)
    try:
        verify_popup(target_url)
    except Exception as exc:
        print(f"Verification failed: {exc}", file=sys.stderr)
        sys.exit(1)
