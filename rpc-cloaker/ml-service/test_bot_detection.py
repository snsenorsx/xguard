#!/usr/bin/env python3
"""
Comprehensive Bot Detection Test Suite
Tests all variations and scenarios for the bot detection system
"""

import asyncio
import json
import time
from typing import Dict, Any, List
import requests
from datetime import datetime
import random
import string

class BotDetectionTester:
    def __init__(self, ml_service_url: str = "http://localhost:5000", api_key: str = "ml_service_secret_key"):
        self.base_url = ml_service_url
        self.api_key = api_key
        self.headers = {"X-API-Key": api_key, "Content-Type": "application/json"}
    
    def generate_fingerprint(self) -> str:
        """Generate random fingerprint hash."""
        return ''.join(random.choices(string.ascii_lowercase + string.digits, k=32))
    
    def create_test_scenarios(self) -> List[Dict[str, Any]]:
        """Create comprehensive test scenarios."""
        scenarios = []
        
        # 1. OBVIOUS BOT SCENARIOS
        scenarios.extend([
            {
                "name": "Python Bot",
                "category": "obvious_bot",
                "expected_bot": True,
                "visitor": {
                    "ip": "192.168.1.100",
                    "userAgent": "python-requests/2.28.1",
                    "headers": {
                        "accept": "*/*",
                        "user-agent": "python-requests/2.28.1"
                    },
                    "fingerprintHash": self.generate_fingerprint(),
                    "geo": {"country": "US", "city": "New York"},
                    "device": {"type": "desktop"},
                    "browser": {"name": "unknown", "version": "unknown"},
                    "os": {"name": "unknown", "version": "unknown"}
                }
            },
            {
                "name": "Curl Bot",
                "category": "obvious_bot",
                "expected_bot": True,
                "visitor": {
                    "ip": "54.239.123.45",  # AWS IP
                    "userAgent": "curl/7.68.0",
                    "headers": {
                        "accept": "*/*",
                        "user-agent": "curl/7.68.0"
                    },
                    "fingerprintHash": self.generate_fingerprint(),
                    "geo": {"country": "US", "city": "Ashburn"},
                    "device": {"type": "unknown"},
                    "browser": {"name": "unknown"},
                    "os": {"name": "linux"}
                }
            },
            {
                "name": "Headless Chrome",
                "category": "headless_bot",
                "expected_bot": True,
                "visitor": {
                    "ip": "35.232.146.78",  # GCP IP
                    "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/91.0.4472.124 Safari/537.36",
                    "headers": {
                        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "accept-language": "en-US,en;q=0.5",
                        "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/91.0.4472.124 Safari/537.36"
                    },
                    "fingerprintHash": self.generate_fingerprint(),
                    "geo": {"country": "US", "city": "Mountain View"},
                    "device": {"type": "desktop"},
                    "browser": {"name": "chrome", "version": "91.0"},
                    "os": {"name": "linux", "version": "unknown"}
                }
            },
            {
                "name": "Selenium Bot",
                "category": "automation_bot",
                "expected_bot": True,
                "visitor": {
                    "ip": "13.57.189.23",  # AWS IP
                    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 selenium",
                    "headers": {
                        "accept": "text/html,application/xhtml+xml",
                        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 selenium"
                    },
                    "fingerprintHash": self.generate_fingerprint(),
                    "geo": {"country": "US", "city": "San Francisco"},
                    "device": {"type": "desktop"},
                    "browser": {"name": "chrome", "version": "91.0"},
                    "os": {"name": "windows", "version": "10"}
                }
            }
        ])
        
        # 2. LEGITIMATE USER SCENARIOS
        scenarios.extend([
            {
                "name": "Chrome Desktop User",
                "category": "legitimate_user",
                "expected_bot": False,
                "visitor": {
                    "ip": "203.0.113.45",  # Regular ISP IP
                    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
                    "headers": {
                        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                        "accept-language": "en-US,en;q=0.9",
                        "accept-encoding": "gzip, deflate, br",
                        "referer": "https://google.com/",
                        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
                    },
                    "fingerprintHash": self.generate_fingerprint(),
                    "geo": {"country": "US", "city": "Chicago"},
                    "device": {"type": "desktop"},
                    "browser": {"name": "chrome", "version": "119.0"},
                    "os": {"name": "windows", "version": "10"}
                }
            },
            {
                "name": "iPhone Safari User",
                "category": "legitimate_mobile",
                "expected_bot": False,
                "visitor": {
                    "ip": "198.51.100.123",
                    "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
                    "headers": {
                        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "accept-language": "en-US,en;q=0.9",
                        "accept-encoding": "gzip, deflate",
                        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1"
                    },
                    "fingerprintHash": self.generate_fingerprint(),
                    "geo": {"country": "US", "city": "Los Angeles"},
                    "device": {"type": "mobile"},
                    "browser": {"name": "safari", "version": "17.1"},
                    "os": {"name": "ios", "version": "17.1"}
                }
            },
            {
                "name": "Android Chrome User",
                "category": "legitimate_mobile",
                "expected_bot": False,
                "visitor": {
                    "ip": "172.16.254.200",
                    "userAgent": "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
                    "headers": {
                        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                        "accept-language": "en-US,en;q=0.9",
                        "accept-encoding": "gzip, deflate, br",
                        "user-agent": "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36"
                    },
                    "fingerprintHash": self.generate_fingerprint(),
                    "geo": {"country": "DE", "city": "Berlin"},
                    "device": {"type": "mobile"},
                    "browser": {"name": "chrome", "version": "119.0"},
                    "os": {"name": "android", "version": "13"}
                }
            }
        ])
        
        # 3. EDGE CASES AND SUSPICIOUS SCENARIOS
        scenarios.extend([
            {
                "name": "Outdated Browser",
                "category": "suspicious",
                "expected_bot": True,
                "visitor": {
                    "ip": "192.0.2.146",
                    "userAgent": "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
                    "headers": {
                        "accept": "text/html, application/xhtml+xml, */*",
                        "accept-language": "en-US",
                        "user-agent": "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko"
                    },
                    "fingerprintHash": self.generate_fingerprint(),
                    "geo": {"country": "US", "city": "Seattle"},
                    "device": {"type": "desktop"},
                    "browser": {"name": "internet explorer", "version": "11.0"},
                    "os": {"name": "windows", "version": "10"}
                }
            },
            {
                "name": "High-Risk Country Bot",
                "category": "geo_suspicious",
                "expected_bot": True,
                "visitor": {
                    "ip": "223.5.5.5",
                    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                    "headers": {
                        "accept": "*/*",
                        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                    },
                    "fingerprintHash": self.generate_fingerprint(),
                    "geo": {"country": "CN", "city": "Beijing"},
                    "device": {"type": "desktop"},
                    "browser": {"name": "chrome", "version": "91.0"},
                    "os": {"name": "windows", "version": "10"}
                }
            },
            {
                "name": "Missing Headers Bot",
                "category": "header_anomaly",
                "expected_bot": True,
                "visitor": {
                    "ip": "198.51.100.42",
                    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "headers": {
                        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    },
                    "fingerprintHash": self.generate_fingerprint(),
                    "geo": {"country": "US", "city": "Denver"},
                    "device": {"type": "desktop"},
                    "browser": {"name": "chrome", "version": "unknown"},
                    "os": {"name": "windows", "version": "10"}
                }
            }
        ])
        
        # 4. TARGETING CONFLICT SCENARIOS
        scenarios.extend([
            {
                "name": "High-Risk Country (User Targeted)",
                "category": "targeting_conflict",
                "expected_bot": False,  # Should be less suspicious due to targeting
                "targeting": {
                    "countries": ["CN", "RU", "IN"],
                    "devices": ["desktop", "mobile"]
                },
                "visitor": {
                    "ip": "223.5.5.5",
                    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
                    "headers": {
                        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
                        "accept-encoding": "gzip, deflate, br",
                        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
                    },
                    "fingerprintHash": self.generate_fingerprint(),
                    "geo": {"country": "CN", "city": "Shanghai"},
                    "device": {"type": "desktop"},
                    "browser": {"name": "chrome", "version": "119.0"},
                    "os": {"name": "windows", "version": "10"}
                }
            },
            {
                "name": "Non-Targeted Device",
                "category": "targeting_mismatch",
                "expected_bot": True,  # Should be more suspicious
                "targeting": {
                    "countries": ["US", "UK", "DE"],
                    "devices": ["mobile"]  # Only mobile targeted
                },
                "visitor": {
                    "ip": "203.0.113.45",
                    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
                    "headers": {
                        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "accept-language": "en-US,en;q=0.9",
                        "accept-encoding": "gzip, deflate, br",
                        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
                    },
                    "fingerprintHash": self.generate_fingerprint(),
                    "geo": {"country": "US", "city": "Miami"},
                    "device": {"type": "desktop"},  # Desktop not targeted
                    "browser": {"name": "chrome", "version": "119.0"},
                    "os": {"name": "windows", "version": "10"}
                }
            }
        ])
        
        return scenarios
    
    def health_check(self) -> bool:
        """Check if ML service is healthy."""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def analyze_visitor(self, visitor_data: Dict, targeting: Dict = None) -> Dict:
        """Send visitor data for analysis."""
        payload = {
            "visitor": visitor_data,
            "detection": {
                "isBot": False,
                "score": 0.0,
                "reason": "test",
                "details": {}
            }
        }
        
        # Add targeting context if provided
        if targeting:
            payload["targeting"] = targeting
        
        try:
            response = requests.post(
                f"{self.base_url}/analyze",
                json=payload,
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "error": f"HTTP {response.status_code}",
                    "message": response.text
                }
        except Exception as e:
            return {
                "error": "Request failed",
                "message": str(e)
            }
    
    def run_test_scenario(self, scenario: Dict) -> Dict:
        """Run a single test scenario."""
        print(f"\n🔍 Testing: {scenario['name']}")
        print(f"   Category: {scenario['category']}")
        print(f"   Expected Bot: {scenario['expected_bot']}")
        
        start_time = time.time()
        
        # Get targeting if available
        targeting = scenario.get('targeting')
        
        # Run analysis
        result = self.analyze_visitor(scenario['visitor'], targeting)
        
        end_time = time.time()
        response_time = round((end_time - start_time) * 1000, 2)
        
        if 'error' in result:
            print(f"   ❌ ERROR: {result['error']} - {result['message']}")
            return {
                "scenario": scenario['name'],
                "status": "error",
                "error": result['error'],
                "response_time_ms": response_time
            }
        
        # Analyze results
        is_bot = result.get('isBot', False)
        confidence = result.get('confidence', 0.0)
        targeting_aware = result.get('targetingAware', False)
        
        correct_prediction = is_bot == scenario['expected_bot']
        
        print(f"   Result: Bot={is_bot}, Confidence={confidence:.3f}")
        print(f"   Targeting Aware: {targeting_aware}")
        print(f"   Response Time: {response_time}ms")
        print(f"   ✅ PASS" if correct_prediction else "   ❌ FAIL")
        
        # Show key features
        features = result.get('features', {})
        if features:
            print(f"   Key Features:")
            # Show most important features
            important_features = [
                'ua_bot_keyword', 'ua_suspicious_pattern', 'header_anomaly_score',
                'is_datacenter_ip', 'country_risk_score', 'device_browser_mismatch'
            ]
            for feat in important_features:
                if feat in features:
                    print(f"     {feat}: {features[feat]:.3f}")
        
        return {
            "scenario": scenario['name'],
            "category": scenario['category'],
            "expected_bot": scenario['expected_bot'],
            "actual_bot": is_bot,
            "confidence": confidence,
            "targeting_aware": targeting_aware,
            "correct": correct_prediction,
            "response_time_ms": response_time,
            "features": features
        }
    
    def run_comprehensive_test(self) -> Dict:
        """Run all test scenarios and generate report."""
        print("🤖 Bot Detection Comprehensive Test Suite")
        print("=" * 50)
        
        # Health check
        print("\n🏥 Health Check...")
        if not self.health_check():
            print("❌ ML Service is not healthy!")
            return {"error": "Service unavailable"}
        
        print("✅ ML Service is healthy")
        
        # Generate test scenarios
        scenarios = self.create_test_scenarios()
        print(f"\n📋 Running {len(scenarios)} test scenarios...")
        
        results = []
        categories = {}
        
        # Run all tests
        for scenario in scenarios:
            result = self.run_test_scenario(scenario)
            results.append(result)
            
            # Group by category
            category = result.get('category', 'unknown')
            if category not in categories:
                categories[category] = {'total': 0, 'passed': 0, 'failed': 0}
            
            categories[category]['total'] += 1
            if result.get('correct', False):
                categories[category]['passed'] += 1
            else:
                categories[category]['failed'] += 1
        
        # Generate summary
        total_tests = len(results)
        passed_tests = sum(1 for r in results if r.get('correct', False))
        failed_tests = total_tests - passed_tests
        accuracy = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        avg_response_time = sum(r.get('response_time_ms', 0) for r in results) / total_tests if total_tests > 0 else 0
        
        print(f"\n📊 Test Summary")
        print("=" * 30)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Accuracy: {accuracy:.1f}%")
        print(f"Avg Response Time: {avg_response_time:.1f}ms")
        
        print(f"\n📈 Category Breakdown")
        print("-" * 30)
        for category, stats in categories.items():
            cat_accuracy = (stats['passed'] / stats['total']) * 100 if stats['total'] > 0 else 0
            print(f"{category}: {stats['passed']}/{stats['total']} ({cat_accuracy:.1f}%)")
        
        # Show failed tests
        failed_results = [r for r in results if not r.get('correct', False)]
        if failed_results:
            print(f"\n❌ Failed Tests ({len(failed_results)}):")
            print("-" * 30)
            for result in failed_results:
                print(f"  • {result['scenario']}")
                print(f"    Expected: {result['expected_bot']}, Got: {result['actual_bot']}")
                print(f"    Confidence: {result.get('confidence', 0):.3f}")
        
        return {
            "summary": {
                "total_tests": total_tests,
                "passed": passed_tests,
                "failed": failed_tests,
                "accuracy": accuracy,
                "avg_response_time_ms": avg_response_time
            },
            "categories": categories,
            "results": results,
            "failed_tests": failed_results
        }

def main():
    """Run the comprehensive bot detection test."""
    
    print("🚀 Starting Bot Detection Test Suite")
    print("Checking ML service availability...")
    
    tester = BotDetectionTester()
    
    # Run comprehensive test
    report = tester.run_comprehensive_test()
    
    if "error" in report:
        print(f"❌ Test failed: {report['error']}")
        return 1
    
    # Save detailed report
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = f"bot_detection_test_report_{timestamp}.json"
    
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Detailed report saved to: {report_file}")
    
    # Return appropriate exit code
    accuracy = report['summary']['accuracy']
    if accuracy >= 80:
        print("🎉 Test PASSED - Good accuracy!")
        return 0
    else:
        print("⚠️ Test NEEDS IMPROVEMENT - Low accuracy")
        return 1

if __name__ == "__main__":
    exit(main())