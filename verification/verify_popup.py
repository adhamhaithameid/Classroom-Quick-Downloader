import os
import sys
from playwright.sync_api import sync_playwright


def verify_popup(url: str):
    screenshot_path = os.path.join(os.getcwd(), "verification/verification.png")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        print(f"Navigating to {url}")
        page.goto(url)
        page.wait_for_selector("text=Classroom Quick Downloader", state="visible")
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")
        browser.close()


if __name__ == "__main__":
    target_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080/popup.html"
    verify_popup(target_url)
