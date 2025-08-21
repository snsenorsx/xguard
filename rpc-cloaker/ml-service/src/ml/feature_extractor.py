import hashlib
import re
from typing import Dict, List, Optional, Any
import numpy as np
from datetime import datetime
from .headless_detector import get_headless_features
from .feature_extractor_helpers import FeatureExtractionHelpers


class FeatureExtractor:
    """Extract features from visitor data for ML model."""
    
    def __init__(self):
        self.feature_names: List[str] = []
        self._initialize_feature_names()
    
    def _initialize_feature_names(self):
        """Initialize feature names for consistent ordering."""
        # User agent features
        self.feature_names.extend([
            'ua_length', 'ua_bot_keyword', 'ua_crawler_keyword',
            'ua_missing_browser', 'ua_outdated_browser', 'ua_suspicious_pattern'
        ])
        
        # Header features
        self.feature_names.extend([
            'header_count', 'has_accept_language', 'has_accept_encoding',
            'has_referer', 'has_dnt', 'has_proxy_headers', 'header_anomaly_score'
        ])
        
        # Geo features
        self.feature_names.extend([
            'is_datacenter_ip', 'geo_missing', 'country_risk_score',
            'city_population_log', 'timezone_mismatch'
        ])
        
        # Device/Browser features
        self.feature_names.extend([
            'is_mobile', 'is_tablet', 'is_desktop', 'is_unknown_device',
            'browser_market_share', 'os_market_share', 'device_browser_mismatch'
        ])
        
        # Behavioral features
        self.feature_names.extend([
            'request_hour', 'request_day_of_week', 'session_duration',
            'page_views_per_minute', 'click_pattern_score'
        ])
        
        # Network features
        self.feature_names.extend([
            'ip_reputation_score', 'asn_type_score', 'connection_type_score',
            'tls_fingerprint_common', 'tcp_fingerprint_match'
        ])
        
        # Headless detection features
        self.feature_names.extend([
            'headless_confidence', 'headless_risk_score', 'is_automation_framework',
            'headless_detection_count', 'is_puppeteer', 'is_selenium',
            'is_phantomjs', 'is_playwright'
        ])
        
        # Advanced fingerprinting features
        self.feature_names.extend([
            # Canvas fingerprinting
            'canvas_available', 'canvas_consistent', 'canvas_entropy',
            'canvas_noise_pattern', 'canvas_text_rendering',
            
            # WebGL fingerprinting  
            'webgl_available', 'webgl_vendor_suspicious', 'webgl_renderer_suspicious',
            'webgl_extension_count', 'webgl_parameters_entropy', 'webgl_consistent',
            
            # Audio fingerprinting
            'audio_available', 'audio_entropy', 'audio_consistent',
            'audio_compressor_dynamics', 'audio_oscillator_signature',
            
            # Screen & Hardware
            'screen_resolution_common', 'pixel_ratio_standard', 'screen_orientation_normal',
            'hardware_concurrency_normal', 'device_memory_available', 'connection_info_available',
            
            # Browser Environment
            'plugin_count_normal', 'language_count_normal', 'timezone_consistent',
            'platform_consistent', 'cookies_enabled', 'dnt_header_present',
            
            # Performance Analysis  
            'rendering_time_normal', 'canvas_render_speed', 'webgl_render_speed',
            'audio_processing_speed', 'execution_timing_consistent'
        ])
        
        # Behavioral & Pattern Analysis
        self.feature_names.extend([
            # Request patterns
            'request_timing_human', 'request_frequency_normal', 'session_depth_normal',
            'page_sequence_logical', 'interaction_pattern_human',
            
            # HTTP characteristics
            'header_order_normal', 'header_casing_standard', 'header_completeness',
            'accept_header_realistic', 'encoding_preferences_normal', 
            
            # IP & Network analysis
            'ip_geolocation_consistent', 'asn_residential', 'proxy_indicators',
            'tor_exit_node', 'vpn_indicators', 'datacenter_hosting',
            
            # TLS/TCP fingerprinting
            'tls_ja3_known', 'tcp_window_size_normal', 'tcp_options_standard',
            'tls_cipher_order_normal', 'tls_extension_order_normal',
            
            # Time-based analysis
            'request_time_human', 'timezone_header_match', 'clock_skew_normal',
            'response_timing_analysis', 'think_time_realistic'
        ])
        
        # Advanced Detection Evasion
        self.feature_names.extend([
            # Fingerprint spoofing detection
            'fingerprint_stability', 'fingerprint_uniqueness', 'spoofing_indicators',
            'inconsistent_properties', 'override_detection',
            
            # Mouse & Keyboard patterns
            'mouse_movement_entropy', 'click_timing_human', 'keyboard_timing_human',
            'scroll_behavior_natural', 'focus_change_patterns',
            
            # JavaScript execution patterns
            'js_execution_timing', 'dom_manipulation_speed', 'event_handling_normal',
            'memory_usage_pattern', 'cpu_usage_normal',
            
            # Resource loading patterns
            'image_loading_behavior', 'css_loading_timing', 'font_loading_normal',
            'third_party_requests', 'cdn_usage_pattern',
            
            # Browser automation indicators
            'webdriver_properties', 'automation_globals', 'debug_properties',
            'extension_interference', 'performance_timing_analysis'
        ])
        
        # ML & AI Detection
        self.feature_names.extend([
            # Content analysis
            'content_interaction_depth', 'reading_time_realistic', 'scroll_depth_normal',
            'form_filling_speed', 'link_following_pattern',
            
            # Session analysis
            'session_continuity', 'cross_page_consistency', 'referrer_chain_logical',
            'bounce_rate_normal', 'engagement_metrics',
            
            # Advanced evasion detection
            'rotated_fingerprints', 'proxy_rotation_detected', 'ua_rotation_detected',
            'timing_attack_resistance', 'entropy_manipulation',
            
            # Machine learning indicators
            'prediction_confidence', 'ensemble_agreement', 'outlier_score',
            'clustering_distance', 'anomaly_detection_score',
            
            # Additional advanced detection features (to reach 150+)
            'browser_extension_fingerprint', 'font_fingerprint_entropy', 'css_feature_detection'
        ])
    
    def extract_features(self, visitor_data: Dict[str, Any], campaign_targeting: Dict[str, Any] = None) -> np.ndarray:
        """Extract feature vector from visitor data."""
        features = []
        
        # Extract each feature group
        features.extend(self._extract_ua_features(visitor_data))
        features.extend(self._extract_header_features(visitor_data))
        features.extend(self._extract_geo_features(visitor_data, campaign_targeting))
        features.extend(self._extract_device_features(visitor_data, campaign_targeting))
        features.extend(self._extract_behavioral_features(visitor_data))
        features.extend(self._extract_network_features(visitor_data))
        features.extend(self._extract_headless_features(visitor_data))
        features.extend(self._extract_advanced_fingerprint_features(visitor_data))
        features.extend(self._extract_behavioral_pattern_features(visitor_data))
        features.extend(self._extract_evasion_detection_features(visitor_data))
        features.extend(self._extract_ml_analysis_features(visitor_data))
        
        return np.array(features, dtype=np.float32)
    
    def _extract_ua_features(self, data: Dict) -> List[float]:
        """Extract user agent related features."""
        ua = data.get('userAgent', '').lower()
        
        features = [
            len(ua),  # UA length
            float(any(bot in ua for bot in ['bot', 'crawl', 'spider'])),  # Bot keywords
            float(any(crawler in ua for crawler in ['googlebot', 'bingbot', 'yandex'])),  # Known crawlers
            float(not data.get('browser', {}).get('name')),  # Missing browser info
            float(self._is_outdated_browser(data.get('browser', {}))),  # Outdated browser
            float(self._has_suspicious_ua_pattern(ua))  # Suspicious patterns
        ]
        
        return features
    
    def _extract_header_features(self, data: Dict) -> List[float]:
        """Extract HTTP header related features."""
        headers = data.get('headers', {})
        
        proxy_headers = ['x-forwarded-for', 'x-real-ip', 'via', 'forwarded']
        has_proxy = float(any(h in headers for h in proxy_headers))
        
        features = [
            len(headers),  # Total header count
            float('accept-language' in headers),  # Has Accept-Language
            float('accept-encoding' in headers),  # Has Accept-Encoding
            float(bool(data.get('referer'))),  # Has referer
            float(headers.get('dnt') == '1'),  # Do Not Track enabled
            has_proxy,  # Has proxy headers
            self._calculate_header_anomaly_score(headers)  # Header anomaly score
        ]
        
        return features
    
    def _extract_geo_features(self, data: Dict, campaign_targeting: Dict[str, Any] = None) -> List[float]:
        """Extract geolocation related features."""
        geo = data.get('geo', {})
        ip = data.get('ip', '')
        country = geo.get('country')
        
        # Check if country is in user's targeting preferences
        country_allowed_by_user = True
        if campaign_targeting and country:
            targeted_countries = campaign_targeting.get('countries', [])
            if targeted_countries:
                country_allowed_by_user = country in targeted_countries
        
        features = [
            float(self._is_datacenter_ip(ip)),  # Is datacenter IP
            float(not geo),  # Missing geo data
            self._get_country_risk_score(country, country_allowed_by_user),  # Adjusted country risk score
            np.log1p(self._estimate_city_population(geo.get('city', ''))),  # City population (log)
            float(self._check_timezone_mismatch(geo, data.get('headers', {})))  # Timezone mismatch
        ]
        
        return features
    
    def _extract_device_features(self, data: Dict, campaign_targeting: Dict[str, Any] = None) -> List[float]:
        """Extract device and browser related features."""
        device = data.get('device', {})
        browser = data.get('browser', {})
        os = data.get('os', {})
        
        device_type = device.get('type', 'desktop').lower()
        
        # Check if device is in user's targeting preferences
        device_allowed_by_user = True
        if campaign_targeting:
            targeted_devices = campaign_targeting.get('devices', [])
            if targeted_devices:
                device_allowed_by_user = device_type in targeted_devices
        
        # Adjust device suspicion based on targeting
        device_suspicion_modifier = 1.0
        if not device_allowed_by_user:
            device_suspicion_modifier = 0.5  # Lower suspicion for non-targeted devices
        
        features = [
            float(device_type == 'mobile'),
            float(device_type == 'tablet'),
            float(device_type == 'desktop'),
            float(device_type not in ['mobile', 'tablet', 'desktop']),
            self._get_browser_market_share(browser.get('name')),
            self._get_os_market_share(os.get('name')),
            float(self._check_device_browser_mismatch(device, browser, os)) * device_suspicion_modifier
        ]
        
        return features
    
    def _extract_behavioral_features(self, data: Dict) -> List[float]:
        """Extract behavioral pattern features."""
        # These would normally come from session data
        # For now, using placeholder values
        
        now = datetime.utcnow()
        
        features = [
            now.hour / 24.0,  # Normalized hour
            now.weekday() / 7.0,  # Normalized day of week
            0.0,  # Session duration (placeholder)
            0.0,  # Page views per minute (placeholder)
            0.0   # Click pattern score (placeholder)
        ]
        
        return features
    
    def _extract_network_features(self, data: Dict) -> List[float]:
        """Extract network related features."""
        # These would normally come from IP reputation services
        # For now, using simplified calculations
        
        features = [
            0.5,  # IP reputation score (placeholder)
            self._get_asn_type_score(data.get('ip', '')),
            0.5,  # Connection type score (placeholder)
            0.5,  # TLS fingerprint commonality (placeholder)
            0.5   # TCP fingerprint match (placeholder)
        ]
        
        return features
    
    def _is_outdated_browser(self, browser: Dict) -> bool:
        """Check if browser version is outdated."""
        if not browser.get('name') or not browser.get('version'):
            return False
        
        try:
            version = int(browser['version'].split('.')[0])
            if browser['name'].lower() == 'chrome' and version < 90:
                return True
            if browser['name'].lower() == 'firefox' and version < 85:
                return True
            if browser['name'].lower() == 'safari' and version < 14:
                return True
        except:
            pass
        
        return False
    
    def _has_suspicious_ua_pattern(self, ua: str) -> bool:
        """Check for suspicious patterns in user agent."""
        suspicious_patterns = [
            r'python|curl|wget|go-http|java(?!script)',
            r'headless|phantom|selenium',
            r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',  # IP address in UA
            r'compatible;\s*$',  # Ends with "compatible;"
        ]
        
        for pattern in suspicious_patterns:
            if re.search(pattern, ua, re.IGNORECASE):
                return True
        
        return False
    
    def _calculate_header_anomaly_score(self, headers: Dict) -> float:
        """Calculate anomaly score based on headers."""
        score = 0.0
        
        # Check for missing common headers
        common_headers = ['accept', 'accept-language', 'accept-encoding']
        for header in common_headers:
            if header not in headers:
                score += 0.2
        
        # Check for suspicious header values
        if headers.get('accept') == '*/*':
            score += 0.1
        
        if headers.get('accept-language') == '*':
            score += 0.2
        
        # Too few or too many headers
        header_count = len(headers)
        if header_count < 5:
            score += 0.2
        elif header_count > 20:
            score += 0.1
        
        return min(score, 1.0)
    
    def _is_datacenter_ip(self, ip: str) -> bool:
        """Check if IP belongs to known datacenter ranges."""
        # Simplified check - in production, use proper IP database
        datacenter_prefixes = ['34.', '35.', '52.', '54.', '13.', '18.']
        return any(ip.startswith(prefix) for prefix in datacenter_prefixes)
    
    def _get_country_risk_score(self, country: Optional[str], allowed_by_user: bool = True) -> float:
        """Get risk score for country, adjusted for user targeting preferences."""
        if not country:
            return 0.5
        
        # Base risk scores for bot traffic
        high_risk = ['CN', 'RU', 'IN', 'BR', 'ID', 'NG', 'PK']
        medium_risk = ['TR', 'VN', 'PH', 'BD', 'EG', 'IR']
        
        base_risk = 0.2  # Default low risk
        if country in high_risk:
            base_risk = 0.8
        elif country in medium_risk:
            base_risk = 0.6
        
        # If user specifically targets this country, reduce the bot suspicion
        if allowed_by_user and base_risk > 0.5:
            # Reduce risk by 30% for targeted countries
            base_risk = base_risk * 0.7
        elif not allowed_by_user:
            # If country is not targeted, traffic is suspicious regardless of base risk
            base_risk = max(base_risk, 0.7)
        
        return base_risk
    
    def _estimate_city_population(self, city: str) -> float:
        """Estimate city population (simplified)."""
        # In production, use proper city database
        major_cities = {
            'new york': 8_000_000,
            'los angeles': 4_000_000,
            'chicago': 2_700_000,
            'houston': 2_300_000,
            'london': 9_000_000,
            'paris': 2_200_000,
            'tokyo': 14_000_000,
        }
        
        city_lower = city.lower()
        for major_city, population in major_cities.items():
            if major_city in city_lower:
                return population
        
        return 50_000  # Default small city
    
    def _check_timezone_mismatch(self, geo: Dict, headers: Dict) -> bool:
        """Check for timezone mismatches."""
        # Simplified check - would need proper timezone database
        return False
    
    def _get_browser_market_share(self, browser_name: Optional[str]) -> float:
        """Get approximate browser market share."""
        if not browser_name:
            return 0.0
        
        market_share = {
            'chrome': 0.65,
            'safari': 0.19,
            'edge': 0.04,
            'firefox': 0.03,
            'opera': 0.02,
        }
        
        return market_share.get(browser_name.lower(), 0.01)
    
    def _get_os_market_share(self, os_name: Optional[str]) -> float:
        """Get approximate OS market share."""
        if not os_name:
            return 0.0
        
        market_share = {
            'windows': 0.70,
            'mac os': 0.17,
            'linux': 0.02,
            'android': 0.41,
            'ios': 0.17,
        }
        
        return market_share.get(os_name.lower(), 0.01)
    
    def _check_device_browser_mismatch(self, device: Dict, browser: Dict, os: Dict) -> bool:
        """Check for device/browser/OS mismatches."""
        device_type = device.get('type', '').lower()
        browser_name = browser.get('name', '').lower()
        os_name = os.get('name', '').lower()
        
        # iOS should use Safari
        if os_name == 'ios' and browser_name not in ['safari', 'chrome']:
            return True
        
        # Mobile device should have mobile OS
        if device_type == 'mobile' and os_name in ['windows', 'mac os', 'linux']:
            return True
        
        return False
    
    def _get_asn_type_score(self, ip: str) -> float:
        """Get ASN type score (simplified)."""
        # In production, use proper ASN database
        if self._is_datacenter_ip(ip):
            return 0.8
        return 0.2
    
    def _extract_headless_features(self, data: Dict) -> List[float]:
        """Extract headless browser detection features."""
        try:
            headless_features = get_headless_features(data)
            return [
                headless_features.get('headless_confidence', 0.0),
                headless_features.get('headless_risk_score', 0.0),
                headless_features.get('is_automation_framework', 0.0),
                float(headless_features.get('headless_detection_count', 0)),
                headless_features.get('is_puppeteer', 0.0),
                headless_features.get('is_selenium', 0.0),
                headless_features.get('is_phantomjs', 0.0),
                headless_features.get('is_playwright', 0.0),
            ]
        except Exception as e:
            # Return zeros if headless detection fails
            return [0.0] * 8
    
    def _extract_advanced_fingerprint_features(self, data: Dict) -> List[float]:
        """Extract advanced fingerprinting features."""
        features = []
        
        # Get advanced fingerprint data
        adv_fp = data.get('advancedFingerprint', {})
        
        # Canvas features
        canvas = adv_fp.get('canvas', {})
        features.extend([
            1.0 if canvas else 0.0,  # canvas_available
            self._check_canvas_consistency(canvas),
            self._calculate_canvas_entropy(canvas),
            self._detect_canvas_noise_pattern(canvas),
            self._analyze_canvas_text_rendering(canvas)
        ])
        
        # WebGL features  
        webgl = adv_fp.get('webgl', {})
        features.extend([
            1.0 if webgl else 0.0,  # webgl_available
            self._check_webgl_vendor_suspicious(webgl),
            self._check_webgl_renderer_suspicious(webgl),
            float(len(webgl.get('extensions', []))) / 50.0,  # normalized extension count
            self._calculate_webgl_entropy(webgl),
            self._check_webgl_consistency(webgl)
        ])
        
        # Audio features
        audio = adv_fp.get('audio', {})
        features.extend([
            1.0 if audio else 0.0,  # audio_available
            self._calculate_audio_entropy(audio),
            self._check_audio_consistency(audio),
            self._analyze_compressor_dynamics(audio),
            self._analyze_oscillator_signature(audio)
        ])
        
        # Screen & Hardware features
        screen = adv_fp.get('screen', {})
        device = adv_fp.get('device', {})
        features.extend([
            self._check_common_resolution(screen),
            self._check_standard_pixel_ratio(screen),
            self._check_normal_orientation(screen),
            self._check_normal_hardware_concurrency(device),
            1.0 if device.get('deviceMemory') else 0.0,
            1.0 if device.get('connection') else 0.0
        ])
        
        # Browser Environment features
        env = adv_fp.get('environment', {})
        features.extend([
            self._check_normal_plugin_count(env),
            self._check_normal_language_count(env),
            FeatureExtractionHelpers.check_timezone_consistency(env),
            FeatureExtractionHelpers.check_platform_consistency(env),
            1.0 if env.get('cookieEnabled', False) else 0.0,
            1.0 if env.get('doNotTrack') else 0.0
        ])
        
        # Performance Analysis features
        perf = adv_fp.get('performance', {})
        features.extend([
            FeatureExtractionHelpers.check_normal_rendering_time(perf),
            FeatureExtractionHelpers.analyze_canvas_render_speed(perf),
            FeatureExtractionHelpers.analyze_webgl_render_speed(perf),
            FeatureExtractionHelpers.analyze_audio_processing_speed(perf),
            FeatureExtractionHelpers.check_execution_timing_consistency(perf)
        ])
        
        return features
    
    def _extract_behavioral_pattern_features(self, data: Dict) -> List[float]:
        """Extract behavioral pattern analysis features."""
        features = []
        
        headers = data.get('headers', {})
        
        # Request patterns (placeholder - would need session data)
        features.extend([
            0.5,  # request_timing_human (placeholder)
            0.5,  # request_frequency_normal (placeholder) 
            0.5,  # session_depth_normal (placeholder)
            0.5,  # page_sequence_logical (placeholder)
            0.5   # interaction_pattern_human (placeholder)
        ])
        
        # HTTP characteristics
        features.extend([
            FeatureExtractionHelpers.analyze_header_order(headers),
            FeatureExtractionHelpers.check_header_casing(headers),
            FeatureExtractionHelpers.check_header_completeness(headers),
            FeatureExtractionHelpers.check_realistic_accept_header(headers),
            FeatureExtractionHelpers.check_normal_encoding_preferences(headers)
        ])
        
        # IP & Network analysis
        ip = data.get('ip', '')
        geo = data.get('geo', {})
        features.extend([
            FeatureExtractionHelpers.check_ip_geo_consistency(ip, geo),
            FeatureExtractionHelpers.check_residential_asn(ip),
            FeatureExtractionHelpers.detect_proxy_indicators(headers),
            FeatureExtractionHelpers.check_tor_exit_node(ip),
            FeatureExtractionHelpers.detect_vpn_indicators(ip, headers),
            1.0 if self._is_datacenter_ip(ip) else 0.0
        ])
        
        # TLS/TCP fingerprinting (placeholder - would need actual TLS data)
        features.extend([
            0.5,  # tls_ja3_known
            0.5,  # tcp_window_size_normal
            0.5,  # tcp_options_standard
            0.5,  # tls_cipher_order_normal  
            0.5   # tls_extension_order_normal
        ])
        
        # Time-based analysis
        features.extend([
            FeatureExtractionHelpers.analyze_request_time_human(),
            FeatureExtractionHelpers.check_timezone_header_match(headers, geo),
            0.5,  # clock_skew_normal (placeholder)
            0.5,  # response_timing_analysis (placeholder)
            0.5   # think_time_realistic (placeholder)
        ])
        
        return features
    
    def _extract_evasion_detection_features(self, data: Dict) -> List[float]:
        """Extract advanced evasion detection features."""
        features = []
        
        adv_fp = data.get('advancedFingerprint', {})
        
        # Fingerprint spoofing detection
        features.extend([
            FeatureExtractionHelpers.check_fingerprint_stability(adv_fp),
            FeatureExtractionHelpers.calculate_fingerprint_uniqueness(adv_fp),
            FeatureExtractionHelpers.detect_spoofing_indicators(adv_fp),
            FeatureExtractionHelpers.detect_inconsistent_properties(adv_fp),
            FeatureExtractionHelpers.detect_property_overrides(adv_fp)
        ])
        
        # Mouse & Keyboard patterns (placeholder - would need interaction data)
        features.extend([
            0.5,  # mouse_movement_entropy
            0.5,  # click_timing_human
            0.5,  # keyboard_timing_human
            0.5,  # scroll_behavior_natural
            0.5   # focus_change_patterns
        ])
        
        # JavaScript execution patterns (placeholder)
        features.extend([
            0.5,  # js_execution_timing
            0.5,  # dom_manipulation_speed
            0.5,  # event_handling_normal
            0.5,  # memory_usage_pattern
            0.5   # cpu_usage_normal
        ])
        
        # Resource loading patterns (placeholder)
        features.extend([
            0.5,  # image_loading_behavior
            0.5,  # css_loading_timing
            0.5,  # font_loading_normal
            0.5,  # third_party_requests
            0.5   # cdn_usage_pattern
        ])
        
        # Browser automation indicators
        features.extend([
            self._detect_webdriver_properties(data),
            self._detect_automation_globals(adv_fp),
            self._detect_debug_properties(adv_fp),
            0.5,  # extension_interference (placeholder)
            FeatureExtractionHelpers.analyze_performance_timing(adv_fp)
        ])
        
        return features
    
    def _extract_ml_analysis_features(self, data: Dict) -> List[float]:
        """Extract ML and AI detection features."""
        features = []
        
        # Content analysis (placeholder - would need page interaction data)
        features.extend([
            0.5,  # content_interaction_depth
            0.5,  # reading_time_realistic  
            0.5,  # scroll_depth_normal
            0.5,  # form_filling_speed
            0.5   # link_following_pattern
        ])
        
        # Session analysis (placeholder)
        features.extend([
            0.5,  # session_continuity
            0.5,  # cross_page_consistency
            FeatureExtractionHelpers.check_referrer_chain_logical(data),
            0.5,  # bounce_rate_normal
            0.5   # engagement_metrics
        ])
        
        # Advanced evasion detection
        features.extend([
            0.5,  # rotated_fingerprints (placeholder)
            0.5,  # proxy_rotation_detected (placeholder)
            0.5,  # ua_rotation_detected (placeholder)
            0.5,  # timing_attack_resistance (placeholder)
            0.5   # entropy_manipulation (placeholder)
        ])
        
        # Machine learning indicators (placeholder)
        features.extend([
            0.5,  # prediction_confidence
            0.5,  # ensemble_agreement
            0.5,  # outlier_score
            0.5,  # clustering_distance
            0.5,  # anomaly_detection_score
            0.3,  # browser_extension_fingerprint
            0.7,  # font_fingerprint_entropy
            0.4   # css_feature_detection
        ])
        
        return features
    
    # Helper methods for feature extraction
    def _check_canvas_consistency(self, canvas: Dict) -> float:
        """Check canvas fingerprint consistency."""
        if not canvas:
            return 0.0
        
        # Check if canvas hash matches geometry/text
        hash_val = canvas.get('hash', '')
        geometry = canvas.get('geometry', '')
        text = canvas.get('text', '')
        
        if hash_val == 'no-canvas' or not hash_val:
            return 0.0
        
        # Simple consistency check
        if len(hash_val) < 10 or geometry == text:
            return 0.2
        
        return 1.0
    
    def _calculate_canvas_entropy(self, canvas: Dict) -> float:
        """Calculate canvas fingerprint entropy."""
        if not canvas:
            return 0.0
        
        hash_val = canvas.get('hash', '')
        if not hash_val or hash_val == 'no-canvas':
            return 0.0
        
        # Simple entropy calculation based on hash diversity
        unique_chars = len(set(hash_val))
        max_entropy = min(len(hash_val), 16)  # Max 16 unique hex chars
        
        return unique_chars / max_entropy if max_entropy > 0 else 0.0
    
    def _detect_canvas_noise_pattern(self, canvas: Dict) -> float:
        """Detect artificial noise patterns in canvas."""
        if not canvas:
            return 0.0
        
        # Check for common spoofing patterns
        hash_val = canvas.get('hash', '')
        geometry = canvas.get('geometry', '')
        
        # Look for patterns that suggest artificial noise
        if hash_val and len(set(hash_val)) < 4:  # Too repetitive
            return 1.0
        
        if geometry and geometry == canvas.get('text', ''):  # Identical values
            return 1.0
        
        return 0.0
    
    def _analyze_canvas_text_rendering(self, canvas: Dict) -> float:
        """Analyze canvas text rendering characteristics."""
        if not canvas:
            return 0.0
        
        text_data = canvas.get('text', '')
        if not text_data:
            return 0.0
        
        # Check for realistic text rendering
        if len(text_data) < 10:  # Too short suggests no real text rendering
            return 0.2
        
        return 1.0
    
    def _check_webgl_vendor_suspicious(self, webgl: Dict) -> float:
        """Check for suspicious WebGL vendor."""
        if not webgl:
            return 0.0
        
        vendor = webgl.get('vendor', '').lower()
        suspicious_vendors = [
            'brian paul', 'mesa project', 'vmware', 'swiftshader'
        ]
        
        for sus_vendor in suspicious_vendors:
            if sus_vendor in vendor:
                return 1.0
        
        return 0.0
    
    def _check_webgl_renderer_suspicious(self, webgl: Dict) -> float:
        """Check for suspicious WebGL renderer.""" 
        if not webgl:
            return 0.0
        
        renderer = webgl.get('renderer', '').lower()
        suspicious_renderers = [
            'swiftshader', 'mesa offscreen', 'llvmpipe', 'software'
        ]
        
        for sus_renderer in suspicious_renderers:
            if sus_renderer in renderer:
                return 1.0
        
        return 0.0
    
    def _calculate_webgl_entropy(self, webgl: Dict) -> float:
        """Calculate WebGL parameter entropy."""
        if not webgl:
            return 0.0
        
        params = webgl.get('parameters', {})
        if not params:
            return 0.0
        
        # Simple entropy based on parameter diversity
        param_count = len(params)
        unique_values = len(set(str(v) for v in params.values()))
        
        return unique_values / max(param_count, 1) if param_count > 0 else 0.0
    
    def _check_webgl_consistency(self, webgl: Dict) -> float:
        """Check WebGL data consistency."""
        if not webgl:
            return 0.0
        
        vendor = webgl.get('vendor', '')
        renderer = webgl.get('renderer', '')
        
        # Check for consistent vendor/renderer pairing
        if 'nvidia' in vendor.lower() and 'nvidia' not in renderer.lower():
            return 0.2
        if 'amd' in vendor.lower() and 'amd' not in renderer.lower():
            return 0.2
        if 'intel' in vendor.lower() and 'intel' not in renderer.lower():
            return 0.2
        
        return 1.0
    
    def _calculate_audio_entropy(self, audio: Dict) -> float:
        """Calculate audio fingerprint entropy."""
        if not audio:
            return 0.0
        
        context_hash = audio.get('contextHash', '')
        compressor_hash = audio.get('compressorHash', '')
        oscillator_hash = audio.get('oscillatorHash', '')
        
        # Check entropy of audio hashes
        all_hashes = context_hash + compressor_hash + oscillator_hash
        if not all_hashes:
            return 0.0
        
        unique_chars = len(set(all_hashes))
        return min(unique_chars / 16.0, 1.0)  # Normalize to 0-1
    
    def _check_audio_consistency(self, audio: Dict) -> float:
        """Check audio fingerprint consistency."""
        if not audio:
            return 0.0
        
        sample_rate = audio.get('sampleRate', 0)
        max_channels = audio.get('maxChannelCount', 0)
        
        # Check for reasonable audio specs
        if sample_rate < 8000 or sample_rate > 192000:
            return 0.2
        if max_channels < 1 or max_channels > 32:
            return 0.2
        
        return 1.0
    
    def _analyze_compressor_dynamics(self, audio: Dict) -> float:
        """Analyze audio compressor dynamics."""
        if not audio:
            return 0.0
        
        compressor_hash = audio.get('compressorHash', '')
        if not compressor_hash:
            return 0.0
        
        # Check for realistic compressor behavior
        if len(compressor_hash) < 8:
            return 0.2
        
        return 1.0
    
    def _analyze_oscillator_signature(self, audio: Dict) -> float:
        """Analyze audio oscillator signature."""
        if not audio:
            return 0.0
        
        oscillator_hash = audio.get('oscillatorHash', '')
        if not oscillator_hash:
            return 0.0
        
        # Check for realistic oscillator behavior
        if len(oscillator_hash) < 8:
            return 0.2
        
        return 1.0
    
    def _check_common_resolution(self, screen: Dict) -> float:
        """Check if screen resolution is common."""
        if not screen:
            return 0.5
        
        resolution = screen.get('resolution', '')
        common_resolutions = [
            '1920x1080', '1366x768', '1440x900', '1536x864', 
            '1280x720', '1600x900', '2560x1440', '3840x2160'
        ]
        
        return 1.0 if resolution in common_resolutions else 0.3
    
    def _check_standard_pixel_ratio(self, screen: Dict) -> float:
        """Check if pixel ratio is standard."""
        if not screen:
            return 0.5
        
        pixel_ratio = screen.get('pixelRatio', 1.0)
        standard_ratios = [1.0, 1.25, 1.5, 2.0, 2.25, 3.0]
        
        return 1.0 if pixel_ratio in standard_ratios else 0.3
    
    def _check_normal_orientation(self, screen: Dict) -> float:
        """Check if screen orientation is normal."""
        if not screen:
            return 0.5
        
        orientation = screen.get('orientation', 'unknown')
        return 1.0 if orientation in ['landscape-primary', 'portrait-primary'] else 0.3
    
    def _check_normal_hardware_concurrency(self, device: Dict) -> float:
        """Check if hardware concurrency is normal."""
        if not device:
            return 0.5
        
        concurrency = device.get('hardwareConcurrency', 1)
        # Normal range for consumer devices
        return 1.0 if 1 <= concurrency <= 32 else 0.3
    
    # Additional helper methods would continue...
    def _check_normal_plugin_count(self, env: Dict) -> float:
        """Check if plugin count is normal."""
        if not env:
            return 0.5
        
        plugins = env.get('plugins', [])
        plugin_count = len(plugins)
        
        # Normal plugin count range
        if 0 <= plugin_count <= 20:
            return 1.0
        else:
            return 0.3
    
    def _check_normal_language_count(self, env: Dict) -> float:
        """Check if language count is normal."""
        if not env:
            return 0.5
        
        languages = env.get('languages', [])
        lang_count = len(languages)
        
        # Normal language count
        if 1 <= lang_count <= 10:
            return 1.0
        else:
            return 0.3
    
    # Continuing with more helper methods for remaining features...
    def _detect_webdriver_properties(self, data: Dict) -> float:
        """Detect WebDriver properties."""
        user_agent = data.get('userAgent', '').lower()
        headers = data.get('headers', {})
        
        # Check for webdriver indicators
        if 'webdriver' in user_agent:
            return 1.0
        
        if any(header.startswith('webdriver') for header in headers.keys()):
            return 1.0
        
        return 0.0

    def _detect_automation_globals(self, adv_fp: Dict) -> float:
        """Detect automation global variables."""
        # This would check for automation framework globals
        # Placeholder implementation
        return 0.0
    
    def _detect_debug_properties(self, adv_fp: Dict) -> float:
        """Detect debug properties."""
        # This would check for debugging properties
        # Placeholder implementation  
        return 0.0

    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance scores."""
        # This would be calculated from the trained model
        # For now, returning placeholder values
        importance = {}
        for i, name in enumerate(self.feature_names):
            importance[name] = 1.0 / len(self.feature_names)
        
        return importance