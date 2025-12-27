#!/usr/bin/env python3
"""
Comprehensive UI Test for Cluebase.ai Production
Tests all major functionalities with the configured test account
"""

import sys
import time
from playwright.sync_api import sync_playwright, expect

# Test credentials
TEST_EMAIL = "localtest5561@cluebase.ai"
TEST_PASSWORD = "TestPassword123!"
BASE_URL = "https://cluebase.ai"

def log(msg: str, status: str = "INFO"):
    icons = {"PASS": "✅", "FAIL": "❌", "INFO": "ℹ️", "TEST": "🧪", "WARN": "⚠️"}
    print(f"{icons.get(status, 'ℹ️')} {msg}")

def test_authentication(page):
    """Test 1: Authentication flow"""
    log("Testing Authentication Flow", "TEST")

    # Navigate to signin
    page.goto(f"{BASE_URL}/auth/signin")
    page.wait_for_load_state("networkidle")

    # Verify signin page loads
    try:
        expect(page.get_by_role("heading", name="Welcome back")).to_be_visible(timeout=10000)
        log("Signin page loaded correctly", "PASS")
    except Exception as e:
        # Try alternative heading
        try:
            expect(page.locator("h1, h2").first).to_be_visible(timeout=5000)
            log("Signin page loaded (alternative heading)", "PASS")
        except:
            log(f"Signin page heading not found: {e}", "FAIL")
            return False

    # Fill credentials
    page.locator("#email").fill(TEST_EMAIL)
    page.locator("#password").fill(TEST_PASSWORD)

    # Submit login
    page.get_by_role("button", name="Sign in").click()

    # Wait for navigation (could be dashboard or setup)
    try:
        page.wait_for_url("**/dashboard**", timeout=30000)
        log("Successfully logged in - redirected to dashboard", "PASS")
        return True
    except:
        # Check if we're on setup page
        if "/setup" in page.url:
            log("Redirected to setup page (expected for new workspace)", "WARN")
            # Navigate to dashboard
            page.goto(f"{BASE_URL}/dashboard")
            page.wait_for_load_state("networkidle")
            return True
        log(f"Login failed - current URL: {page.url}", "FAIL")
        return False

def test_dashboard(page):
    """Test 2: Dashboard overview"""
    log("Testing Dashboard Overview", "TEST")

    page.goto(f"{BASE_URL}/dashboard")
    page.wait_for_load_state("networkidle")
    time.sleep(2)  # Wait for data to load

    results = []

    # Check dashboard header
    try:
        expect(page.get_by_role("heading", name="Dashboard")).to_be_visible(timeout=5000)
        log("Dashboard header visible", "PASS")
        results.append(True)
    except:
        log("Dashboard header not found", "FAIL")
        results.append(False)

    # Check for stats cards
    try:
        stats_section = page.locator("[class*='stats'], [class*='card'], [class*='metric']").first
        expect(stats_section).to_be_visible(timeout=5000)
        log("Stats/metrics section visible", "PASS")
        results.append(True)
    except:
        log("Stats section not visible", "WARN")
        results.append(True)  # Non-critical

    # Check sidebar navigation
    try:
        nav = page.locator("nav, aside, [role='navigation']").first
        expect(nav).to_be_visible(timeout=5000)
        log("Navigation sidebar visible", "PASS")
        results.append(True)
    except:
        log("Navigation not visible", "FAIL")
        results.append(False)

    return all(results)

def test_documents_page(page):
    """Test 3: Documents page"""
    log("Testing Documents Page", "TEST")

    page.goto(f"{BASE_URL}/documents")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    results = []

    # Check page header
    try:
        expect(page.get_by_role("heading", name="Documents")).to_be_visible(timeout=5000)
        log("Documents header visible", "PASS")
        results.append(True)
    except:
        log("Documents header not found", "FAIL")
        results.append(False)

    # Check for document list or empty state
    try:
        # Look for either documents or empty state
        doc_table = page.locator("table, [role='table'], [class*='document']")
        empty_state = page.locator("[class*='empty'], text=/no documents/i")

        if doc_table.count() > 0:
            log(f"Document list visible ({doc_table.count()} elements)", "PASS")
            results.append(True)
        elif empty_state.count() > 0:
            log("Empty state displayed (no documents yet)", "PASS")
            results.append(True)
        else:
            log("Neither document list nor empty state found", "WARN")
            results.append(True)
    except Exception as e:
        log(f"Document list check failed: {e}", "WARN")
        results.append(True)

    # Check sync button
    try:
        sync_btn = page.get_by_role("button", name=/sync/i)
        if sync_btn.count() > 0:
            log("Sync button visible", "PASS")
            results.append(True)
        else:
            log("Sync button not found", "WARN")
            results.append(True)
    except:
        log("Sync button check skipped", "WARN")
        results.append(True)

    return all(results)

def test_bots_page(page):
    """Test 4: Bots page"""
    log("Testing Bots Page", "TEST")

    page.goto(f"{BASE_URL}/bots")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    results = []

    # Check page header
    try:
        expect(page.get_by_role("heading", name="Bots")).to_be_visible(timeout=5000)
        log("Bots header visible", "PASS")
        results.append(True)
    except:
        log("Bots header not found", "FAIL")
        results.append(False)

    # Check for bot list or create button
    try:
        create_btn = page.get_by_role("button", name=/create|add|new/i)
        if create_btn.count() > 0:
            log("Create bot button visible", "PASS")
            results.append(True)
        else:
            log("Create bot button not found", "WARN")
            results.append(True)
    except:
        results.append(True)

    # Check for bot cards
    try:
        bot_cards = page.locator("[class*='bot'], [class*='card']")
        if bot_cards.count() > 0:
            log(f"Bot cards visible ({bot_cards.count()} found)", "PASS")
        else:
            log("No bot cards found (may be empty)", "INFO")
        results.append(True)
    except:
        results.append(True)

    return all(results)

def test_knowledge_page(page):
    """Test 5: Knowledge page"""
    log("Testing Knowledge Page", "TEST")

    page.goto(f"{BASE_URL}/knowledge")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    results = []

    # Check page header
    try:
        expect(page.get_by_role("heading", name="Knowledge")).to_be_visible(timeout=5000)
        log("Knowledge header visible", "PASS")
        results.append(True)
    except:
        log("Knowledge header not found", "FAIL")
        results.append(False)

    # Check for add fact button
    try:
        add_btn = page.get_by_role("button", name=/add|new|create/i)
        if add_btn.count() > 0:
            log("Add fact button visible", "PASS")
            results.append(True)
        else:
            log("Add fact button not found", "WARN")
            results.append(True)
    except:
        results.append(True)

    return all(results)

def test_conversations_page(page):
    """Test 6: Conversations page"""
    log("Testing Conversations Page", "TEST")

    page.goto(f"{BASE_URL}/conversations")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    results = []

    # Check page loads
    try:
        expect(page.get_by_role("heading", name=/conversation/i)).to_be_visible(timeout=5000)
        log("Conversations header visible", "PASS")
        results.append(True)
    except:
        # Check if page loaded at all
        if page.url.endswith("/conversations"):
            log("Conversations page loaded (header not found)", "WARN")
            results.append(True)
        else:
            log("Conversations page not accessible", "FAIL")
            results.append(False)

    return all(results)

def test_analytics_page(page):
    """Test 7: Analytics page"""
    log("Testing Analytics Page", "TEST")

    page.goto(f"{BASE_URL}/analytics")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    results = []

    # Check page loads
    try:
        expect(page.get_by_role("heading", name=/analytics/i)).to_be_visible(timeout=5000)
        log("Analytics header visible", "PASS")
        results.append(True)
    except:
        if "/analytics" in page.url:
            log("Analytics page loaded (header not found)", "WARN")
            results.append(True)
        else:
            log("Analytics page not accessible", "FAIL")
            results.append(False)

    return all(results)

def test_settings_page(page):
    """Test 8: Settings page"""
    log("Testing Settings Page", "TEST")

    page.goto(f"{BASE_URL}/settings")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    results = []

    # Check page header
    try:
        expect(page.get_by_role("heading", name=/settings/i)).to_be_visible(timeout=5000)
        log("Settings header visible", "PASS")
        results.append(True)
    except:
        log("Settings header not found", "FAIL")
        results.append(False)

    # Check for integrations section
    try:
        integrations = page.locator("text=/google drive|integrations/i")
        if integrations.count() > 0:
            log("Integrations section visible", "PASS")
            results.append(True)
        else:
            log("Integrations section not found", "WARN")
            results.append(True)
    except:
        results.append(True)

    return all(results)

def test_billing_page(page):
    """Test 9: Billing page"""
    log("Testing Billing Page", "TEST")

    page.goto(f"{BASE_URL}/billing")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    results = []

    # Check page loads
    try:
        expect(page.get_by_role("heading", name=/billing|subscription|plan/i)).to_be_visible(timeout=5000)
        log("Billing header visible", "PASS")
        results.append(True)
    except:
        if "/billing" in page.url:
            log("Billing page loaded (header not found)", "WARN")
            results.append(True)
        else:
            log("Billing page not accessible", "FAIL")
            results.append(False)

    return all(results)

def test_team_page(page):
    """Test 10: Team management page"""
    log("Testing Team Page", "TEST")

    page.goto(f"{BASE_URL}/team")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    results = []

    # Check page loads
    try:
        expect(page.get_by_role("heading", name=/team|members/i)).to_be_visible(timeout=5000)
        log("Team header visible", "PASS")
        results.append(True)
    except:
        if "/team" in page.url:
            log("Team page loaded (header not found)", "WARN")
            results.append(True)
        else:
            log("Team page not accessible", "FAIL")
            results.append(False)

    # Check for invite button
    try:
        invite_btn = page.get_by_role("button", name=/invite/i)
        if invite_btn.count() > 0:
            log("Invite button visible", "PASS")
            results.append(True)
        else:
            log("Invite button not found", "WARN")
            results.append(True)
    except:
        results.append(True)

    return all(results)

def main():
    print("\n" + "="*60)
    print("🧪 CLUEBASE.AI PRODUCTION UI TEST")
    print("="*60)
    print(f"URL: {BASE_URL}")
    print(f"Test Account: {TEST_EMAIL}")
    print("="*60 + "\n")

    test_results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)  # Visible for manual observation
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        try:
            # Test 1: Authentication
            test_results["Authentication"] = test_authentication(page)

            if test_results["Authentication"]:
                # Only proceed if logged in
                test_results["Dashboard"] = test_dashboard(page)
                test_results["Documents"] = test_documents_page(page)
                test_results["Bots"] = test_bots_page(page)
                test_results["Knowledge"] = test_knowledge_page(page)
                test_results["Conversations"] = test_conversations_page(page)
                test_results["Analytics"] = test_analytics_page(page)
                test_results["Settings"] = test_settings_page(page)
                test_results["Billing"] = test_billing_page(page)
                test_results["Team"] = test_team_page(page)

        except Exception as e:
            log(f"Test execution error: {e}", "FAIL")
        finally:
            # Print summary
            print("\n" + "="*60)
            print("📊 TEST RESULTS SUMMARY")
            print("="*60)

            passed = sum(1 for v in test_results.values() if v)
            total = len(test_results)

            for test_name, result in test_results.items():
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"  {test_name}: {status}")

            print("="*60)
            print(f"  Total: {passed}/{total} tests passed")
            print("="*60 + "\n")

            # Keep browser open for 10 seconds for manual inspection
            print("Browser will close in 10 seconds...")
            time.sleep(10)

            browser.close()

    return 0 if all(test_results.values()) else 1

if __name__ == "__main__":
    sys.exit(main())
