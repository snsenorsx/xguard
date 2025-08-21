"""
Advanced Headless Browser Detection for ML Service
Server-side analysis of headless browser indicators
"""

import re
import json
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class HeadlessFramework(Enum):
    PUPPETEER = "puppeteer"
    SELENIUM = "selenium"
    PLAYWRIGHT = "playwright"
    PHANTOMJS = "phantomjs"
    CHROME_HEADLESS = "chrome_headless"
    UNKNOWN = "unknown"

@dataclass
class HeadlessDetectionResult:
    is_headless: bool
    confidence: float
    framework: HeadlessFramework
    detections: List[str]
    risk_score: int
    features: Dict[str, Any]

class HeadlessBrowserDetector:
    """
    Advanced headless browser detection using multiple indicators
    """
    
    def __init__(self):
        self.headless_patterns = self._load_headless_patterns()
        self.suspicious_headers = self._load_suspicious_headers()
        self.automation_indicators = self._load_automation_indicators()
    
    def detect(self, visitor_info: Dict[str, Any]) -> HeadlessDetectionResult:
        """
        Comprehensive headless browser detection
        """
        detections = []
        features = {}
        risk_score = 0
        framework = HeadlessFramework.UNKNOWN
        
        # 1. User Agent Analysis
        ua_result = self._analyze_user_agent(visitor_info.get('userAgent', ''))
        if ua_result['is_suspicious']:
            detections.extend(ua_result['detections'])
            risk_score += ua_result['score']
            features.update(ua_result['features'])
            if ua_result['framework'] != HeadlessFramework.UNKNOWN:
                framework = ua_result['framework']
        
        # 2. Headers Analysis
        headers_result = self._analyze_headers(visitor_info.get('headers', {}))
        if headers_result['is_suspicious']:
            detections.extend(headers_result['detections'])
            risk_score += headers_result['score']
            features.update(headers_result['features'])
        
        # 3. Advanced Fingerprint Analysis
        if 'advancedFingerprint' in visitor_info:
            fp_result = self._analyze_advanced_fingerprint(visitor_info['advancedFingerprint'])
            if fp_result['is_suspicious']:
                detections.extend(fp_result['detections'])
                risk_score += fp_result['score']
                features.update(fp_result['features'])
        
        # 4. Browser Environment Analysis
        env_result = self._analyze_browser_environment(visitor_info)
        if env_result['is_suspicious']:
            detections.extend(env_result['detections'])
            risk_score += env_result['score']
            features.update(env_result['features'])
        
        # 5. Behavioral Analysis
        behavior_result = self._analyze_behavioral_patterns(visitor_info)
        if behavior_result['is_suspicious']:
            detections.extend(behavior_result['detections'])
            risk_score += behavior_result['score']
            features.update(behavior_result['features'])
        
        # Calculate final confidence
        confidence = min(risk_score / 100.0, 1.0)
        is_headless = risk_score >= 60  # Threshold for headless detection
        
        return HeadlessDetectionResult(
            is_headless=is_headless,
            confidence=confidence,
            framework=framework,
            detections=detections,
            risk_score=risk_score,
            features=features
        )
    
    def _analyze_user_agent(self, user_agent: str) -> Dict[str, Any]:
        """
        Analyze user agent for headless indicators
        """
        result = {
            'is_suspicious': False,
            'detections': [],
            'score': 0,
            'features': {},
            'framework': HeadlessFramework.UNKNOWN
        }
        
        if not user_agent:
            result['is_suspicious'] = True
            result['detections'].append('Empty user agent')
            result['score'] += 20
            return result
        
        # Direct headless indicators
        headless_keywords = [
            'HeadlessChrome', 'PhantomJS', 'SlimerJS', 'HtmlUnit',
            'Headless', 'headless', 'automation', 'webdriver'
        ]
        
        for keyword in headless_keywords:
            if keyword in user_agent:
                result['is_suspicious'] = True
                result['detections'].append(f'Headless keyword detected: {keyword}')
                result['score'] += 30
                
                # Identify framework (set only if not already set)
                if result['framework'] == HeadlessFramework.UNKNOWN:
                    if 'HeadlessChrome' in user_agent or 'Headless' in user_agent:
                        result['framework'] = HeadlessFramework.CHROME_HEADLESS
                    elif 'PhantomJS' in user_agent:
                        result['framework'] = HeadlessFramework.PHANTOMJS
        
        # Chrome-specific patterns for Puppeteer/Selenium
        if 'Chrome' in user_agent and result['framework'] == HeadlessFramework.UNKNOWN:
            # Suspicious Chrome versions
            chrome_version_match = re.search(r'Chrome/(\d+)\.(\d+)\.(\d+)\.(\d+)', user_agent)
            if chrome_version_match:
                version_parts = chrome_version_match.groups()
                
                # Check for automation-specific Chrome versions
                automation_versions = ['88.0.4324.150', '91.0.4472.124', '92.0.4515.107']
                full_version = f"{version_parts[0]}.{version_parts[1]}.{version_parts[2]}.{version_parts[3]}"
                
                if full_version in automation_versions:
                    result['is_suspicious'] = True
                    result['detections'].append(f'Automation Chrome version: {full_version}')
                    result['score'] += 25
                    result['framework'] = HeadlessFramework.PUPPETEER
        
        # Missing platform information
        if not any(platform in user_agent for platform in ['Windows', 'Macintosh', 'Linux', 'X11']):
            result['is_suspicious'] = True
            result['detections'].append('Missing platform information in user agent')
            result['score'] += 15
        
        # Unusual user agent structure
        if user_agent.count('(') != user_agent.count(')'):
            result['is_suspicious'] = True
            result['detections'].append('Malformed user agent structure')
            result['score'] += 10
        
        # Too simple or too complex
        if len(user_agent) < 50:
            result['is_suspicious'] = True
            result['detections'].append('Unusually short user agent')
            result['score'] += 10
        elif len(user_agent) > 500:
            result['is_suspicious'] = True
            result['detections'].append('Unusually long user agent')
            result['score'] += 5
        
        result['features']['user_agent_length'] = len(user_agent)
        return result
    
    def _analyze_headers(self, headers: Dict[str, str]) -> Dict[str, Any]:
        """
        Analyze HTTP headers for automation indicators
        """
        result = {
            'is_suspicious': False,
            'detections': [],
            'score': 0,
            'features': {}
        }
        
        # Convert to lowercase for case-insensitive comparison
        headers_lower = {k.lower(): v for k, v in headers.items()}
        
        # Missing common headers
        expected_headers = ['accept', 'accept-language', 'accept-encoding']
        missing_headers = []
        
        for header in expected_headers:
            if header not in headers_lower:
                missing_headers.append(header)
        
        if missing_headers:
            result['is_suspicious'] = True
            result['detections'].append(f'Missing headers: {", ".join(missing_headers)}')
            result['score'] += len(missing_headers) * 10
        
        # Suspicious header values
        if 'accept-language' in headers_lower:
            accept_lang = headers_lower['accept-language']
            if accept_lang == 'en-US' or accept_lang == '*':
                result['is_suspicious'] = True
                result['detections'].append('Suspicious accept-language header')
                result['score'] += 10
        
        # Automation-specific headers
        automation_headers = [
            'x-chrome-connected', 'x-devtools-emulate-network-conditions-client-id',
            'sec-ch-ua-mobile', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site'
        ]
        
        automation_count = 0
        for header in automation_headers:
            if header in headers_lower:
                automation_count += 1
        
        # Too many or too few modern headers
        if automation_count > 8:
            result['is_suspicious'] = True
            result['detections'].append('Too many automation-related headers')
            result['score'] += 15
        elif automation_count == 0 and 'chrome' in headers_lower.get('user-agent', '').lower():
            result['is_suspicious'] = True
            result['detections'].append('Missing modern Chrome headers')
            result['score'] += 10
        
        # Connection header anomalies
        if 'connection' in headers_lower:
            connection = headers_lower['connection'].lower()
            if connection != 'keep-alive' and connection != 'close':
                result['is_suspicious'] = True
                result['detections'].append(f'Unusual connection header: {connection}')
                result['score'] += 5
        
        result['features']['headers_count'] = len(headers)
        result['features']['automation_headers_count'] = automation_count
        return result
    
    def _analyze_advanced_fingerprint(self, fingerprint: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze advanced fingerprint for headless indicators
        """
        result = {
            'is_suspicious': False,
            'detections': [],
            'score': 0,
            'features': {}
        }
        
        # Canvas fingerprint analysis
        if 'canvas' in fingerprint:
            canvas = fingerprint['canvas']
            
            # Check for common headless canvas signatures
            if 'hash' in canvas:
                # Known headless canvas hashes
                headless_canvas_hashes = [
                    'da39a3ee5e6b4b0d3255bfef95601890afd80709',  # Empty canvas
                    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4',   # Common headless
                ]
                
                if canvas['hash'] in headless_canvas_hashes:
                    result['is_suspicious'] = True
                    result['detections'].append('Known headless canvas signature')
                    result['score'] += 25
            
            # Canvas text rendering issues
            if 'text' in canvas and canvas['text'] == canvas.get('geometry', ''):
                result['is_suspicious'] = True
                result['detections'].append('Canvas text rendering anomaly')
                result['score'] += 15
        
        # WebGL analysis
        if 'webgl' in fingerprint:
            webgl = fingerprint['webgl']
            
            # Suspicious vendors/renderers
            suspicious_vendors = [
                'Brian Paul', 'Mesa Project', 'VMware, Inc.', 'SwiftShader'
            ]
            
            if 'vendor' in webgl:
                for vendor in suspicious_vendors:
                    if vendor in webgl['vendor']:
                        result['is_suspicious'] = True
                        result['detections'].append(f'Suspicious WebGL vendor: {vendor}')
                        result['score'] += 20
            
            if 'renderer' in webgl:
                if 'SwiftShader' in webgl['renderer'] or 'Mesa OffScreen' in webgl['renderer']:
                    result['is_suspicious'] = True
                    result['detections'].append('Software-rendered WebGL detected')
                    result['score'] += 20
        
        # Screen analysis
        if 'screen' in fingerprint:
            screen = fingerprint['screen']
            
            # Common headless screen resolutions
            headless_resolutions = [
                '1920x1080', '1366x768', '800x600', '1024x768'
            ]
            
            if 'resolution' in screen and screen['resolution'] in headless_resolutions:
                result['features']['common_resolution'] = True
            
            # Suspicious pixel ratios
            if 'pixelRatio' in screen:
                if screen['pixelRatio'] == 1.0:
                    result['is_suspicious'] = True
                    result['detections'].append('Default pixel ratio detected')
                    result['score'] += 5
        
        # Device analysis
        if 'device' in fingerprint:
            device = fingerprint['device']
            
            # Hardware concurrency anomalies
            if 'hardwareConcurrency' in device:
                concurrency = device['hardwareConcurrency']
                # Too many or too few cores for typical browsers
                if concurrency > 16 or concurrency == 1:
                    result['is_suspicious'] = True
                    result['detections'].append(f'Unusual hardware concurrency: {concurrency}')
                    result['score'] += 10
            
            # Missing device memory (common in headless)
            if 'deviceMemory' not in device:
                result['is_suspicious'] = True
                result['detections'].append('Device memory API not available')
                result['score'] += 5
        
        # Environment analysis
        if 'environment' in fingerprint:
            env = fingerprint['environment']
            
            # Plugin analysis
            if 'plugins' in env:
                plugin_count = len(env['plugins'])
                if plugin_count == 0:
                    result['is_suspicious'] = True
                    result['detections'].append('No browser plugins detected')
                    result['score'] += 15
                elif plugin_count < 3:
                    result['is_suspicious'] = True
                    result['detections'].append('Unusually few plugins')
                    result['score'] += 10
            
            # Language analysis
            if 'languages' in env:
                languages = env['languages']
                if len(languages) == 1 and languages[0] == 'en-US':
                    result['is_suspicious'] = True
                    result['detections'].append('Only default language detected')
                    result['score'] += 10
            
            # Timezone analysis
            if 'timezone' in env and env['timezone'] == 'UTC':
                result['is_suspicious'] = True
                result['detections'].append('UTC timezone detected')
                result['score'] += 10
        
        return result
    
    def _analyze_browser_environment(self, visitor_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze browser environment for automation indicators
        """
        result = {
            'is_suspicious': False,
            'detections': [],
            'score': 0,
            'features': {}
        }
        
        # Browser/OS combination analysis
        browser = visitor_info.get('browser', {})
        os = visitor_info.get('os', {})
        
        if browser and os:
            browser_name = browser.get('name', '').lower()
            os_name = os.get('name', '').lower()
            
            # Unusual browser/OS combinations
            if browser_name == 'chrome' and os_name == 'linux':
                # This could indicate server-based automation
                result['features']['linux_chrome'] = True
            
            # Version analysis
            if 'version' in browser:
                version = browser['version']
                # Look for automation-specific versions
                if re.match(r'^\d+\.0\.0\.0$', version):
                    result['is_suspicious'] = True
                    result['detections'].append('Suspicious browser version pattern')
                    result['score'] += 15
        
        return result
    
    def _analyze_behavioral_patterns(self, visitor_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze behavioral patterns that indicate automation
        """
        result = {
            'is_suspicious': False,
            'detections': [],
            'score': 0,
            'features': {}
        }
        
        # This would be enhanced with actual behavioral data
        # For now, we check for missing behavioral indicators
        
        # Check if referer is missing (common in automation)
        if not visitor_info.get('referer'):
            result['features']['missing_referer'] = True
        
        # IP analysis for hosting providers (common for headless browsers)
        ip = visitor_info.get('ip', '')
        if self._is_hosting_ip(ip):
            result['is_suspicious'] = True
            result['detections'].append('Request from hosting provider IP')
            result['score'] += 20
        
        return result
    
    def _is_hosting_ip(self, ip: str) -> bool:
        """
        Check if IP belongs to hosting providers (basic implementation)
        """
        # This would be enhanced with actual hosting provider IP ranges
        hosting_patterns = [
            r'^172\.16\.',  # Private range often used by cloud providers
            r'^10\.',       # Private range
            r'^192\.168\.', # Private range
        ]
        
        for pattern in hosting_patterns:
            if re.match(pattern, ip):
                return True
        
        return False
    
    def _load_headless_patterns(self) -> List[str]:
        """
        Load known headless browser patterns
        """
        return [
            r'HeadlessChrome',
            r'PhantomJS',
            r'SlimerJS',
            r'HtmlUnit',
            r'webdriver',
            r'automation',
            r'headless',
        ]
    
    def _load_suspicious_headers(self) -> List[str]:
        """
        Load suspicious header patterns
        """
        return [
            'x-chrome-connected',
            'x-devtools-emulate-network-conditions-client-id',
            'webdriver-active',
            'selenium-ide',
        ]
    
    def _load_automation_indicators(self) -> List[str]:
        """
        Load automation framework indicators
        """
        return [
            'webdriver',
            'selenium',
            'puppeteer',
            'playwright',
            'phantomjs',
            'chromedriver',
            'geckodriver',
        ]

# Factory function for easy integration
def create_headless_detector() -> HeadlessBrowserDetector:
    """
    Create a new headless browser detector instance
    """
    return HeadlessBrowserDetector()

# Quick detection function
def detect_headless_browser(visitor_info: Dict[str, Any]) -> HeadlessDetectionResult:
    """
    Quick headless browser detection
    """
    detector = create_headless_detector()
    return detector.detect(visitor_info)

# Integration with existing bot detection
def get_headless_features(visitor_info: Dict[str, Any]) -> Dict[str, float]:
    """
    Extract headless detection features for ML model
    """
    detector = create_headless_detector()
    result = detector.detect(visitor_info)
    
    return {
        'headless_confidence': result.confidence,
        'headless_risk_score': result.risk_score / 100.0,
        'is_automation_framework': 1.0 if result.framework != HeadlessFramework.UNKNOWN else 0.0,
        'headless_detection_count': len(result.detections),
        'is_puppeteer': 1.0 if result.framework == HeadlessFramework.PUPPETEER else 0.0,
        'is_selenium': 1.0 if result.framework == HeadlessFramework.SELENIUM else 0.0,
        'is_phantomjs': 1.0 if result.framework == HeadlessFramework.PHANTOMJS else 0.0,
        'is_playwright': 1.0 if result.framework == HeadlessFramework.PLAYWRIGHT else 0.0,
    }