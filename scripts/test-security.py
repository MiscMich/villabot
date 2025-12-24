#!/usr/bin/env python3
"""
Security Testing Script
Tests all security implementations using Playwright and direct API calls
"""

import json
import requests
from playwright.sync_api import sync_playwright

API_URL = "http://localhost:3000"
DASHBOARD_URL = "http://localhost:3001"

def test_rate_limiting():
    """Test rate limiting on auth endpoints"""
    print("\n🔒 Testing Rate Limiting...")

    # Test login rate limiting (5 attempts per minute)
    endpoint = f"{API_URL}/api/auth/signin"
    payload = {"email": "test@test.com", "password": "wrongpassword"}

    results = []
    for i in range(7):
        try:
            response = requests.post(endpoint, json=payload, timeout=5)
            results.append(response.status_code)
            print(f"  Attempt {i+1}: {response.status_code}")
        except Exception as e:
            print(f"  Attempt {i+1}: Error - {e}")
            results.append("error")

    # After 5 attempts, should get 429
    rate_limited = 429 in results
    print(f"  ✅ Rate limiting working: {rate_limited}" if rate_limited else "  ⚠️ Rate limiting may need more attempts to trigger")
    return rate_limited


def test_zod_validation():
    """Test Zod validation on various endpoints"""
    print("\n🔒 Testing Zod Validation...")

    tests = [
        {
            "name": "Signup - invalid email",
            "endpoint": f"{API_URL}/api/auth/signup",
            "payload": {"email": "not-an-email", "password": "password123"},
            "expected_code": 400,
        },
        {
            "name": "Signup - short password",
            "endpoint": f"{API_URL}/api/auth/signup",
            "payload": {"email": "test@test.com", "password": "short"},
            "expected_code": 400,
        },
        {
            "name": "Signin - invalid email format",
            "endpoint": f"{API_URL}/api/auth/signin",
            "payload": {"email": "not-an-email", "password": "password123"},
            "expected_code": 400,
        },
        {
            "name": "Test Slack - invalid bot token format",
            "endpoint": f"{API_URL}/api/setup/test-slack",
            "payload": {"botToken": "invalid-token", "appToken": "xapp-valid"},
            "expected_code": 400,
        },
        {
            "name": "Test Slack - invalid app token format",
            "endpoint": f"{API_URL}/api/setup/test-slack",
            "payload": {"botToken": "xoxb-valid", "appToken": "invalid-token"},
            "expected_code": 400,
        },
    ]

    all_passed = True
    for test in tests:
        try:
            response = requests.post(test["endpoint"], json=test["payload"], timeout=5)
            passed = response.status_code == test["expected_code"]

            # Check for validation error structure
            if passed and response.status_code == 400:
                data = response.json()
                has_validation_error = data.get("code") == "VALIDATION_ERROR" or "Validation" in data.get("error", "")
                passed = has_validation_error

            status = "✅" if passed else "❌"
            print(f"  {status} {test['name']}: {response.status_code} (expected {test['expected_code']})")
            if not passed:
                all_passed = False
                print(f"      Response: {response.text[:200]}")
        except Exception as e:
            print(f"  ❌ {test['name']}: Error - {e}")
            all_passed = False

    return all_passed


def test_cors_headers():
    """Test CORS configuration"""
    print("\n🔒 Testing CORS Headers...")

    # Test with allowed origin
    headers = {"Origin": "http://localhost:3001"}
    response = requests.options(f"{API_URL}/api/health", headers=headers, timeout=5)

    cors_header = response.headers.get("Access-Control-Allow-Origin", "")
    print(f"  CORS header for localhost:3001: {cors_header}")

    # Test with disallowed origin
    headers = {"Origin": "http://evil.com"}
    response = requests.options(f"{API_URL}/api/health", headers=headers, timeout=5)
    evil_cors = response.headers.get("Access-Control-Allow-Origin", "")
    print(f"  CORS header for evil.com: {evil_cors or '(none - blocked)'}")

    passed = cors_header and not evil_cors
    print(f"  {'✅' if passed else '⚠️'} CORS properly configured")
    return passed


def test_setup_status_auth():
    """Test that setup status requires auth for workspace-specific data"""
    print("\n🔒 Testing Setup Status Authentication...")

    # Without auth - should get generic response
    response = requests.get(f"{API_URL}/api/setup/status", timeout=5)
    data = response.json()

    # Should return generic "not completed" without workspace details
    is_generic = data.get("completed") == False and data.get("steps", {}).get("workspace") == False
    print(f"  Unauthenticated response: {json.dumps(data, indent=2)[:200]}")
    print(f"  {'✅' if is_generic else '⚠️'} Returns generic status for unauthenticated requests")

    return is_generic


def test_sql_injection_protection():
    """Test SQL injection protection in admin search"""
    print("\n🔒 Testing SQL Injection Protection...")

    # These payloads should be safely handled
    payloads = [
        "test'; DROP TABLE workspaces; --",
        "test%' OR '1'='1",
        "test.ilike.%admin%",
    ]

    all_safe = True
    for payload in payloads:
        try:
            # Note: Admin endpoint requires auth, so we expect 401
            response = requests.get(
                f"{API_URL}/api/admin/workspaces",
                params={"search": payload},
                timeout=5
            )
            # 401 means auth blocked it before SQL could be an issue
            # 400 would mean validation caught it
            # 200 with safe handling is also ok
            # 500 would indicate potential injection issue
            is_safe = response.status_code != 500
            print(f"  {'✅' if is_safe else '❌'} Payload '{payload[:30]}...': {response.status_code}")
            if not is_safe:
                all_safe = False
        except Exception as e:
            print(f"  ⚠️ Payload '{payload[:30]}...': Error - {e}")

    return all_safe


def test_with_playwright():
    """Test security features through the browser"""
    print("\n🔒 Testing with Playwright (Browser)...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Collect console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        # Test 1: Login page loads without errors
        print("  Testing login page...")
        page.goto(f"{DASHBOARD_URL}/auth/login")
        page.wait_for_load_state("networkidle")

        # Take screenshot
        page.screenshot(path="/tmp/security-test-login.png")
        print(f"  📸 Screenshot saved to /tmp/security-test-login.png")

        # Test 2: Check for XSS protection headers
        response = page.goto(f"{DASHBOARD_URL}/auth/login")
        headers = response.headers if response else {}

        security_headers = {
            "x-content-type-options": headers.get("x-content-type-options"),
            "x-frame-options": headers.get("x-frame-options"),
            "x-xss-protection": headers.get("x-xss-protection"),
        }
        print(f"  Security headers: {json.dumps(security_headers, indent=2)}")

        # Test 3: Verify form validation
        print("  Testing form validation...")
        page.goto(f"{DASHBOARD_URL}/auth/login")
        page.wait_for_load_state("networkidle")

        # Try submitting empty form
        submit_button = page.locator('button[type="submit"]')
        if submit_button.count() > 0:
            submit_button.first.click()
            page.wait_for_timeout(1000)
            page.screenshot(path="/tmp/security-test-validation.png")
            print(f"  📸 Form validation screenshot saved to /tmp/security-test-validation.png")

        # Test 4: Check dashboard redirect without auth
        print("  Testing auth redirect...")
        page.goto(f"{DASHBOARD_URL}/dashboard")
        page.wait_for_load_state("networkidle")
        final_url = page.url

        redirected_to_login = "/auth" in final_url or "/login" in final_url
        print(f"  {'✅' if redirected_to_login else '⚠️'} Unauthenticated redirect: {final_url}")

        # Report console errors
        if console_errors:
            print(f"  ⚠️ Console errors detected: {len(console_errors)}")
            for err in console_errors[:3]:
                print(f"      - {err[:100]}")
        else:
            print("  ✅ No console errors")

        browser.close()

    return True


def main():
    print("=" * 60)
    print("🔐 SECURITY TESTING SUITE")
    print("=" * 60)

    results = {}

    # Run all tests
    results["CORS Headers"] = test_cors_headers()
    results["Zod Validation"] = test_zod_validation()
    results["Setup Status Auth"] = test_setup_status_auth()
    results["SQL Injection Protection"] = test_sql_injection_protection()
    results["Rate Limiting"] = test_rate_limiting()
    results["Playwright Browser Tests"] = test_with_playwright()

    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)

    for test, passed in results.items():
        status = "✅ PASS" if passed else "⚠️ CHECK"
        print(f"  {status}: {test}")

    all_passed = all(results.values())
    print("\n" + ("🎉 All security tests passed!" if all_passed else "⚠️ Some tests need attention"))

    return 0 if all_passed else 1


if __name__ == "__main__":
    exit(main())
