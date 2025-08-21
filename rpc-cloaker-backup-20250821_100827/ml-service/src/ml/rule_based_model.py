"""
Rule-based bot detection model for fallback when ML model is not available
"""

import numpy as np
from typing import Dict, Any, List


class RuleBasedBotDetector:
    """Rule-based bot detector using heuristics."""
    
    def __init__(self):
        self.feature_names = [
            'ua_length', 'ua_bot_keyword', 'ua_crawler_keyword',
            'ua_missing_browser', 'ua_outdated_browser', 'ua_suspicious_pattern',
            'header_count', 'has_accept_language', 'has_accept_encoding',
            'has_referer', 'has_dnt', 'has_proxy_headers', 'header_anomaly_score',
            'is_datacenter_ip', 'geo_missing', 'country_risk_score',
            'city_population_log', 'timezone_mismatch',
            'is_mobile', 'is_tablet', 'is_desktop', 'is_unknown_device',
            'browser_market_share', 'os_market_share', 'device_browser_mismatch',
            'request_hour', 'request_day_of_week', 'session_duration',
            'page_views_per_minute', 'click_pattern_score',
            'ip_reputation_score', 'asn_type_score', 'connection_type_score',
            'tls_fingerprint_common', 'tcp_fingerprint_match'
        ]
    
    def fit(self, X, y):
        """Dummy fit method for compatibility."""
        pass
    
    def predict(self, features: np.ndarray) -> np.ndarray:
        """Make binary predictions based on rules."""
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        predictions = []
        for feature_row in features:
            score = self._calculate_bot_score(feature_row)
            is_bot = score > 0.5
            predictions.append(int(is_bot))
        
        return np.array(predictions)
    
    def predict_proba(self, features: np.ndarray) -> np.ndarray:
        """Return prediction probabilities."""
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        probabilities = []
        for feature_row in features:
            bot_score = self._calculate_bot_score(feature_row)
            human_score = 1.0 - bot_score
            probabilities.append([human_score, bot_score])
        
        return np.array(probabilities)
    
    def _calculate_bot_score(self, features: np.ndarray) -> float:
        """Calculate bot probability based on rule-based scoring."""
        score = 0.0
        
        # Create feature dict for easier access
        feature_dict = dict(zip(self.feature_names, features))
        
        # Rule 1: User Agent Analysis (weight: 0.3)
        ua_score = 0.0
        if feature_dict.get('ua_bot_keyword', 0) > 0.5:
            ua_score += 0.8  # Strong bot indicator
        if feature_dict.get('ua_crawler_keyword', 0) > 0.5:
            ua_score += 0.9  # Very strong bot indicator
        if feature_dict.get('ua_suspicious_pattern', 0) > 0.5:
            ua_score += 0.7  # Strong suspicious pattern
        if feature_dict.get('ua_missing_browser', 0) > 0.5:
            ua_score += 0.5  # Missing browser info
        if feature_dict.get('ua_outdated_browser', 0) > 0.5:
            ua_score += 0.6  # Increased weight for outdated browser
        
        # User agent length analysis
        ua_length = feature_dict.get('ua_length', 100)
        if ua_length < 20:
            ua_score += 0.6  # Very short UA
        elif ua_length > 500:
            ua_score += 0.4  # Very long UA
        
        ua_score = min(ua_score, 1.0)
        score += ua_score * 0.3
        
        # Rule 2: Header Analysis (weight: 0.25)
        header_score = 0.0
        header_anomaly = feature_dict.get('header_anomaly_score', 0)
        header_score += header_anomaly * 1.2  # Increase weight for header anomalies
        
        if feature_dict.get('has_accept_language', 0) < 0.5:
            header_score += 0.4  # Increased weight for missing accept-language
        if feature_dict.get('has_accept_encoding', 0) < 0.5:
            header_score += 0.3  # Increased weight for missing accept-encoding
        if feature_dict.get('has_referer', 0) < 0.5:
            header_score += 0.2  # Increased weight for missing referer
        if feature_dict.get('has_proxy_headers', 0) > 0.5:
            header_score += 0.5  # Increased weight for proxy headers
        
        header_count = feature_dict.get('header_count', 10)
        if header_count < 5:
            header_score += 0.4  # Too few headers
        elif header_count > 25:
            header_score += 0.2  # Too many headers
        
        header_score = min(header_score, 1.0)
        score += header_score * 0.25
        
        # Rule 3: Geo/IP Analysis (weight: 0.2)
        geo_score = 0.0
        if feature_dict.get('is_datacenter_ip', 0) > 0.5:
            geo_score += 0.8  # Datacenter IP
        
        country_risk = feature_dict.get('country_risk_score', 0.2)
        geo_score += country_risk * 0.8  # Increased weight for country risk
        
        if feature_dict.get('geo_missing', 0) > 0.5:
            geo_score += 0.3  # Missing geo data
        
        geo_score = min(geo_score, 1.0)
        score += geo_score * 0.2
        
        # Rule 4: Device/Browser Analysis (weight: 0.15)
        device_score = 0.0
        if feature_dict.get('device_browser_mismatch', 0) > 0.5:
            device_score += 0.6  # Device/browser mismatch
        if feature_dict.get('is_unknown_device', 0) > 0.5:
            device_score += 0.4  # Unknown device
        
        browser_share = feature_dict.get('browser_market_share', 0.5)
        if browser_share < 0.01:
            device_score += 0.5  # Very uncommon browser
        
        device_score = min(device_score, 1.0)
        score += device_score * 0.15
        
        # Rule 5: Network Analysis (weight: 0.1)
        network_score = 0.0
        asn_score = feature_dict.get('asn_type_score', 0.2)
        network_score += asn_score * 0.5
        
        ip_reputation = feature_dict.get('ip_reputation_score', 0.5)
        if ip_reputation > 0.7:
            network_score += 0.6  # Bad IP reputation
        
        network_score = min(network_score, 1.0)
        score += network_score * 0.1
        
        # Ensure score is between 0 and 1
        final_score = max(0.0, min(1.0, score))
        
        return final_score
    
    def get_feature_importance(self) -> Dict[str, float]:
        """Return feature importance for rule-based model."""
        # Define importance based on rule weights
        importance = {}
        
        # User Agent features (30% total weight)
        ua_features = ['ua_bot_keyword', 'ua_crawler_keyword', 'ua_suspicious_pattern', 
                      'ua_missing_browser', 'ua_outdated_browser', 'ua_length']
        for feature in ua_features:
            importance[feature] = 0.05
        
        # Header features (25% total weight)
        header_features = ['header_anomaly_score', 'has_accept_language', 'has_accept_encoding',
                          'has_referer', 'has_proxy_headers', 'header_count']
        for feature in header_features:
            importance[feature] = 0.04
        
        # Geo features (20% total weight)
        geo_features = ['is_datacenter_ip', 'country_risk_score', 'geo_missing']
        for feature in geo_features:
            importance[feature] = 0.07
        
        # Device features (15% total weight)
        device_features = ['device_browser_mismatch', 'is_unknown_device', 'browser_market_share']
        for feature in device_features:
            importance[feature] = 0.05
        
        # Network features (10% total weight)
        network_features = ['asn_type_score', 'ip_reputation_score']
        for feature in network_features:
            importance[feature] = 0.05
        
        # Fill remaining features with small weights
        for feature in self.feature_names:
            if feature not in importance:
                importance[feature] = 0.01
        
        return importance