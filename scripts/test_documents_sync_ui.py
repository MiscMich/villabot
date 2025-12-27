#!/usr/bin/env python3
"""
Test Documents Page Sync UI
Verifies that the sync status cards and document counts display correctly
"""

from playwright.sync_api import sync_playwright
import time

def test_documents_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1440, 'height': 900}
        )
        page = context.new_page()

        # Enable console logging
        page.on("console", lambda msg: print(f"[Console] {msg.type}: {msg.text}") if msg.type in ["error", "warning"] else None)

        print("=" * 60)
        print("Testing Documents Page Sync UI")
        print("=" * 60)

        # Navigate to documents page
        print("\n1. Navigating to documents page...")
        page.goto("http://localhost:3001/documents", wait_until="networkidle", timeout=30000)

        # Wait for content to load
        page.wait_for_timeout(2000)

        # Take screenshot of initial state
        page.screenshot(path="/tmp/documents_page_initial.png", full_page=True)
        print("   Screenshot saved: /tmp/documents_page_initial.png")

        # Check if redirected to auth
        if "/auth" in page.url:
            print("   Redirected to auth page - need to login first")
            print(f"   Current URL: {page.url}")
            browser.close()
            return

        # Check for page header
        print("\n2. Checking page elements...")
        header = page.locator("h1:has-text('Documents')")
        if header.count() > 0:
            print("   ✓ Documents header found")
        else:
            print("   ✗ Documents header NOT found")

        # Check for Google Drive sync card
        print("\n3. Checking Google Drive sync card...")
        drive_card = page.locator("text=Google Drive").first
        if drive_card.is_visible():
            print("   ✓ Google Drive card visible")
            # Look for sync status
            drive_section = page.locator(".premium-card:has-text('Google Drive')").first
            drive_text = drive_section.inner_text() if drive_section.count() > 0 else ""
            if "Last synced" in drive_text:
                print("   ✓ Last synced timestamp found")
            elif "Never" in drive_text:
                print("   ⚠ Shows 'Never synced'")
            elif "Not connected" in drive_text:
                print("   ⚠ Google Drive not connected")
        else:
            print("   ✗ Google Drive card NOT visible")

        # Check for Website Scraping card
        print("\n4. Checking Website Scraping card...")
        website_card = page.locator("text=Website Scraping").first
        if website_card.is_visible():
            print("   ✓ Website Scraping card visible")
            website_section = page.locator(".premium-card:has-text('Website Scraping')").first
            website_text = website_section.inner_text() if website_section.count() > 0 else ""
            if "Configured" in website_text:
                print("   ✓ Website is configured")
            elif "Not Set" in website_text:
                print("   ⚠ Website URL not configured")
        else:
            print("   ✗ Website Scraping card NOT visible")

        # Check for source filter tabs
        print("\n5. Checking source filter tabs...")
        all_tab = page.locator("button:has-text('All')").first
        drive_tab = page.locator("button:has-text('Drive')").first
        website_tab = page.locator("button:has-text('Website')").first

        if all_tab.is_visible():
            print("   ✓ 'All' filter tab visible")
        if drive_tab.is_visible():
            # Get count from badge
            drive_count = page.locator("button:has-text('Drive') >> span").last
            count_text = drive_count.inner_text() if drive_count.count() > 0 else "?"
            print(f"   ✓ 'Drive' filter tab visible (count: {count_text})")
        if website_tab.is_visible():
            website_count = page.locator("button:has-text('Website') >> span").last
            count_text = website_count.inner_text() if website_count.count() > 0 else "?"
            print(f"   ✓ 'Website' filter tab visible (count: {count_text})")

        # Check document count
        print("\n6. Checking document count display...")
        total_badge = page.locator("text=/\\d+ total/")
        if total_badge.count() > 0:
            print(f"   ✓ Total documents badge: {total_badge.first.inner_text()}")

        # Check for Sync Now button
        print("\n7. Checking Sync Now button...")
        sync_btn = page.locator("button:has-text('Sync Now')")
        if sync_btn.count() > 0:
            btn_disabled = sync_btn.first.is_disabled()
            print(f"   ✓ Sync Now button found (disabled: {btn_disabled})")
        else:
            print("   ✗ Sync Now button NOT found")

        # Check for Scrape Now button
        print("\n8. Checking Scrape Now button...")
        scrape_btn = page.locator("button:has-text('Scrape Now')")
        if scrape_btn.count() > 0:
            print("   ✓ Scrape Now button found")
        else:
            print("   ⚠ Scrape Now button not visible (website may not be configured)")

        # Take final screenshot
        page.screenshot(path="/tmp/documents_page_final.png", full_page=True)
        print("\n   Final screenshot saved: /tmp/documents_page_final.png")

        print("\n" + "=" * 60)
        print("Test Complete")
        print("=" * 60)

        browser.close()

if __name__ == "__main__":
    test_documents_page()
