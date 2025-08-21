import hashlib
import re
from typing import Dict, List, Optional, Any
import numpy as np
from datetime import datetime


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
    
    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance scores."""
        # This would be calculated from the trained model
        # For now, returning placeholder values
        importance = {}
        for i, name in enumerate(self.feature_names):
            importance[name] = 1.0 / len(self.feature_names)
        
        return importance