#!/usr/bin/env python3
"""
Simple test script for headless browser detection
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'ml-service/src'))

from ml.headless_detector import detect_headless_browser

def test_headless_detection():
    """Test headless browser detection with sample data"""
    
    # Test case 1: Normal Chrome user
    normal_visitor = {
        'userAgent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'headers': {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.5',
            'accept-encoding': 'gzip, deflate',
        },
        'ip': '192.168.1.1',
        'geo': {'country': 'US', 'city': 'New York'},
        'device': {'type': 'desktop'},
        'browser': {'name': 'Chrome', 'version': '91.0.4472.124'},
        'os': {'name': 'Mac OS', 'version': '10.15.7'}
    }
    
    # Test case 2: Headless Chrome
    headless_visitor = {
        'userAgent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/91.0.4472.124 Safari/537.36',
        'headers': {
            'accept': '*/*',
        },
        'ip': '34.102.136.180',  # Google Cloud IP
        'geo': {'country': 'US', 'city': 'Mountain View'},
        'device': {'type': 'desktop'},
        'browser': {'name': 'Chrome', 'version': '91.0.4472.124'},
        'os': {'name': 'Linux', 'version': ''},
        'advancedFingerprint': {
            'environment': {
                'plugins': [],
                'languages': ['en-US'],
                'timezone': 'UTC'
            },
            'webgl': {
                'vendor': 'Brian Paul',
                'renderer': 'Mesa OffScreen'
            }
        }
    }
    
    # Test case 3: PhantomJS
    phantomjs_visitor = {
        'userAgent': 'Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/534.34 (KHTML, like Gecko) PhantomJS/1.9.8 Safari/534.34',
        'headers': {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        'ip': '172.16.0.1',
        'geo': None,
        'device': {'type': 'desktop'},
        'browser': {'name': 'PhantomJS', 'version': '1.9.8'},
        'os': {'name': 'Linux', 'version': ''}
    }
    
    print("🧪 Testing Headless Browser Detection")
    print("=" * 50)
    
    # Test normal visitor
    print("\n1. Testing Normal Chrome User:")
    result1 = detect_headless_browser(normal_visitor)
    print(f"   Is Headless: {result1.is_headless}")
    print(f"   Confidence: {result1.confidence:.2f}")
    print(f"   Risk Score: {result1.risk_score}")
    print(f"   Framework: {result1.framework.value}")
    print(f"   Detections: {', '.join(result1.detections[:3])}")
    
    # Test headless visitor
    print("\n2. Testing Headless Chrome:")
    result2 = detect_headless_browser(headless_visitor)
    print(f"   Is Headless: {result2.is_headless}")
    print(f"   Confidence: {result2.confidence:.2f}")
    print(f"   Risk Score: {result2.risk_score}")
    print(f"   Framework: {result2.framework.value}")
    print(f"   Detections: {', '.join(result2.detections[:3])}")
    
    # Test PhantomJS visitor
    print("\n3. Testing PhantomJS:")
    result3 = detect_headless_browser(phantomjs_visitor)
    print(f"   Is Headless: {result3.is_headless}")
    print(f"   Confidence: {result3.confidence:.2f}")
    print(f"   Risk Score: {result3.risk_score}")
    print(f"   Framework: {result3.framework.value}")
    print(f"   Detections: {', '.join(result3.detections[:3])}")
    
    print("\n" + "=" * 50)
    
    # Validate results
    success = True
    
    if result1.is_headless:
        print("❌ ERROR: Normal visitor detected as headless")
        success = False
    
    if not result2.is_headless:
        print("❌ ERROR: Headless Chrome not detected")
        success = False
    
    if not result3.is_headless:
        print("❌ ERROR: PhantomJS not detected")
        success = False
    
    if result2.framework.value != 'chrome_headless':
        print(f"❌ ERROR: Wrong framework detected for headless Chrome: {result2.framework.value}")
        success = False
    
    if result3.framework.value != 'phantomjs':
        print(f"❌ ERROR: Wrong framework detected for PhantomJS: {result3.framework.value}")
        success = False
    
    if success:
        print("✅ All tests passed! Headless detection working correctly.")
        return True
    else:
        print("❌ Some tests failed. Review detection logic.")
        return False

if __name__ == '__main__':
    test_headless_detection()