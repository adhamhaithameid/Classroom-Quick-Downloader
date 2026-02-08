import os
from playwright.sync_api import sync_playwright

def verify_popup():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the popup
        page.goto("http://localhost:8000/popup.html")

        # Wait for content to load
        page.wait_for_selector(".cqd-app")

        # Take screenshot
        os.makedirs("/home/jules/verification", exist_ok=True)
        page.screenshot(path="/home/jules/verification/popup.png")

        browser.close()

if __name__ == "__main__":
    verify_popup()
