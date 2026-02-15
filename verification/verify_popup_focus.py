from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a context to set viewport size similar to popup
        context = browser.new_context(viewport={'width': 400, 'height': 500})
        page = context.new_page()

        # Mock chrome API
        # We need to make sure 'chrome' is defined before the app loads
        page.add_init_script("""
        window.chrome = {
          runtime: {
            getManifest: () => ({ version: '1.0.0' }),
            lastError: null,
            id: 'mock-extension-id',
          },
          tabs: {
            query: (queryInfo, callback) => {
                if (callback) callback([{ id: 1, url: 'https://classroom.google.com/' }]);
            },
            create: () => {},
          },
          storage: {
            local: {
              get: (keys, callback) => {
                console.log('Mock storage.get called');
                // Mock default settings and stats
                if (callback) callback({
                  extensionEnabled: true,
                  local_stats: { total: 10, byType: { 'pdf': 5, 'assignment': 5 } }
                });
              },
              set: () => {},
            },
            onChanged: {
              addListener: () => {},
              removeListener: () => {},
            }
          }
        };
        console.log('Mock chrome API injected');
        """)

        page.on("console", lambda msg: print(f"Page console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page error: {err}"))

        # Navigate to the popup served locally
        try:
            page.goto('http://localhost:8080/popup.html')
        except Exception as e:
            print(f"Navigation failed: {e}")
            return

        # Wait for content to load
        try:
            # Wait for .cqd-app or specific element
            page.wait_for_selector('.cqd-app', timeout=5000)
            print("Popup loaded successfully.")
        except Exception as e:
            print(f"Timeout waiting for popup: {e}")
            # Take screenshot anyway to debug
            page.screenshot(path='verification/debug_timeout.png')
            return

        # Take a screenshot of the initial state
        page.screenshot(path='verification/popup_initial.png')
        print("Initial screenshot saved.")

        # Focus on the first toggle switch
        switch_label = page.locator('.cqd-switch').first
        if switch_label.count() > 0:
            print("Found switch label.")
            switch_label.focus()
            page.wait_for_timeout(200)
            page.screenshot(path='verification/popup_focus_switch.png')
            print("Switch focus screenshot saved.")
        else:
            print("Switch label not found.")

        # Focus on a button (e.g. version)
        version_btn = page.locator('.cqd-brand-version').first
        if version_btn.count() > 0:
            print("Found version button.")
            version_btn.focus()
            page.wait_for_timeout(200)
            page.screenshot(path='verification/popup_focus_button.png')
            print("Button focus screenshot saved.")
        else:
            print("Version button not found.")

        browser.close()

if __name__ == '__main__':
    # Ensure server is up (simple wait)
    time.sleep(2)
    run()
