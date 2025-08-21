"""
Helper methods for ML feature extraction
Additional methods to keep main file manageable
"""

from typing import Dict, List, Optional, Any
import re
from datetime import datetime

class FeatureExtractionHelpers:
    """Helper class with additional feature extraction methods."""
    
    @staticmethod
    def check_timezone_consistency(env: Dict) -> float:
        """Check timezone consistency."""
        if not env:
            return 0.5
        
        timezone = env.get('timezone', 'UTC')
        timezone_offset = env.get('timezoneOffset', 0)
        
        # Check for realistic timezone/offset combinations
        if timezone == 'UTC' and timezone_offset != 0:
            return 0.2
        
        return 1.0
    
    @staticmethod
    def check_platform_consistency(env: Dict) -> float:
        """Check platform consistency."""
        if not env:
            return 0.5
        
        platform = env.get('platform', '').lower()
        languages = env.get('languages', [])
        
        # Check platform/language consistency
        if 'win' in platform and any('zh' in lang for lang in languages):
            return 1.0  # Common combination
        if 'mac' in platform and any('en' in lang for lang in languages):
            return 1.0  # Common combination
        
        return 0.8  # Default reasonable score
    
    @staticmethod
    def check_normal_rendering_time(perf: Dict) -> float:
        """Check if rendering time is normal."""
        if not perf:
            return 0.5
        
        rendering_time = perf.get('renderingTime', 0)
        
        # Normal rendering time range (milliseconds)
        if 10 <= rendering_time <= 500:
            return 1.0
        elif rendering_time < 1:  # Too fast, suspicious
            return 0.1
        else:
            return 0.5
    
    @staticmethod
    def analyze_canvas_render_speed(perf: Dict) -> float:
        """Analyze canvas rendering speed."""
        if not perf:
            return 0.5
        
        canvas_time = perf.get('canvasRenderTime', 0)
        
        # Normal canvas rendering time
        if 5 <= canvas_time <= 200:
            return 1.0
        elif canvas_time < 1:  # Too fast
            return 0.2
        else:
            return 0.6
    
    @staticmethod
    def analyze_webgl_render_speed(perf: Dict) -> float:
        """Analyze WebGL rendering speed."""
        if not perf:
            return 0.5
        
        webgl_time = perf.get('webglRenderTime', 0)
        
        # Normal WebGL rendering time
        if 2 <= webgl_time <= 100:
            return 1.0
        elif webgl_time < 1:  # Too fast
            return 0.2
        else:
            return 0.6
    
    @staticmethod
    def analyze_audio_processing_speed(perf: Dict) -> float:
        """Analyze audio processing speed."""
        if not perf:
            return 0.5
        
        audio_time = perf.get('audioProcessingTime', 0)
        
        # Normal audio processing time
        if 1 <= audio_time <= 50:
            return 1.0
        elif audio_time < 0.5:  # Too fast
            return 0.2
        else:
            return 0.6
    
    @staticmethod
    def check_execution_timing_consistency(perf: Dict) -> float:
        """Check execution timing consistency."""
        if not perf:
            return 0.5
        
        canvas_time = perf.get('canvasRenderTime', 0)
        webgl_time = perf.get('webglRenderTime', 0)
        audio_time = perf.get('audioProcessingTime', 0)
        
        # Check if timings are realistic relative to each other
        if canvas_time > 0 and webgl_time > 0:
            ratio = canvas_time / webgl_time
            if 0.1 <= ratio <= 10:  # Reasonable ratio
                return 1.0
            else:
                return 0.3
        
        return 0.7  # Default if can't compare
    
    @staticmethod
    def analyze_header_order(headers: Dict) -> float:
        """Analyze HTTP header order."""
        if not headers:
            return 0.5
        
        header_keys = list(headers.keys())
        
        # Check for common browser header order patterns
        expected_early_headers = ['host', 'user-agent', 'accept']
        
        found_early = 0
        for i, header in enumerate(header_keys[:3]):
            if header.lower() in expected_early_headers:
                found_early += 1
        
        return found_early / 3.0 if len(header_keys) >= 3 else 0.5
    
    @staticmethod
    def check_header_casing(headers: Dict) -> float:
        """Check HTTP header casing."""
        if not headers:
            return 0.5
        
        # Check for proper header casing
        proper_casing_count = 0
        total_headers = len(headers)
        
        for header in headers.keys():
            if header.islower():  # Most common casing
                proper_casing_count += 1
            elif '-'.join(word.capitalize() for word in header.split('-')) == header:
                proper_casing_count += 1
        
        return proper_casing_count / total_headers if total_headers > 0 else 0.5
    
    @staticmethod
    def check_header_completeness(headers: Dict) -> float:
        """Check HTTP header completeness."""
        if not headers:
            return 0.0
        
        required_headers = ['user-agent', 'accept', 'host']
        common_headers = ['accept-language', 'accept-encoding', 'connection']
        
        required_score = sum(1 for h in required_headers if h in headers) / len(required_headers)
        common_score = sum(1 for h in common_headers if h in headers) / len(common_headers)
        
        return (required_score * 0.7) + (common_score * 0.3)
    
    @staticmethod
    def check_realistic_accept_header(headers: Dict) -> float:
        """Check if Accept header is realistic."""
        if not headers:
            return 0.5
        
        accept = headers.get('accept', '')
        if not accept:
            return 0.0
        
        # Check for realistic Accept header patterns
        if accept == '*/*':
            return 0.2  # Too generic, suspicious
        
        if 'text/html' in accept and 'application/xhtml+xml' in accept:
            return 1.0  # Typical browser pattern
        
        if len(accept) < 10:
            return 0.3  # Too short
        
        return 0.7  # Default reasonable score
    
    @staticmethod
    def check_normal_encoding_preferences(headers: Dict) -> float:
        """Check normal encoding preferences."""
        if not headers:
            return 0.5
        
        accept_encoding = headers.get('accept-encoding', '')
        if not accept_encoding:
            return 0.3
        
        # Check for common encoding patterns
        common_encodings = ['gzip', 'deflate', 'br']
        found_encodings = sum(1 for enc in common_encodings if enc in accept_encoding)
        
        return found_encodings / len(common_encodings)
    
    @staticmethod
    def check_ip_geo_consistency(ip: str, geo: Dict) -> float:
        """Check IP geolocation consistency."""
        if not ip or not geo:
            return 0.5
        
        # Placeholder - would need actual IP geolocation verification
        # Check if IP and reported geo match
        return 0.8  # Assume mostly consistent
    
    @staticmethod
    def check_residential_asn(ip: str) -> float:
        """Check if IP belongs to residential ASN."""
        if not ip:
            return 0.5
        
        # Placeholder - would need actual ASN database
        # Check common residential ISP patterns
        return 0.7  # Default assumption
    
    @staticmethod
    def detect_proxy_indicators(headers: Dict) -> float:
        """Detect proxy indicators in headers."""
        if not headers:
            return 0.0
        
        proxy_headers = [
            'x-forwarded-for', 'x-real-ip', 'x-proxy-connection',
            'via', 'forwarded', 'x-forwarded-host'
        ]
        
        proxy_count = sum(1 for header in proxy_headers if header in headers)
        return min(proxy_count / 2.0, 1.0)  # Normalize
    
    @staticmethod
    def check_tor_exit_node(ip: str) -> float:
        """Check if IP is Tor exit node."""
        if not ip:
            return 0.0
        
        # Placeholder - would need actual Tor exit node list
        return 0.0  # Assume not Tor by default
    
    @staticmethod
    def detect_vpn_indicators(ip: str, headers: Dict) -> float:
        """Detect VPN indicators."""
        if not ip:
            return 0.0
        
        # Placeholder - would need VPN detection service
        return 0.1  # Low default assumption
    
    @staticmethod
    def analyze_request_time_human() -> float:
        """Analyze if request time patterns are human."""
        # Placeholder - would need actual request timing data
        current_hour = datetime.now().hour
        
        # Check if request is during normal human hours
        if 6 <= current_hour <= 23:
            return 1.0
        else:
            return 0.3  # Suspicious late night activity
    
    @staticmethod
    def check_timezone_header_match(headers: Dict, geo: Dict) -> float:
        """Check if timezone in headers matches geo location."""
        if not headers or not geo:
            return 0.5
        
        # Placeholder - would need timezone/geo correlation
        return 0.8  # Assume mostly consistent
    
    @staticmethod
    def check_fingerprint_stability(adv_fp: Dict) -> float:
        """Check fingerprint stability over time."""
        if not adv_fp:
            return 0.5
        
        # Placeholder - would need historical fingerprint data
        return 0.8  # Assume stable by default
    
    @staticmethod
    def calculate_fingerprint_uniqueness(adv_fp: Dict) -> float:
        """Calculate fingerprint uniqueness."""
        if not adv_fp:
            return 0.0
        
        # Simple uniqueness based on available fingerprint components
        components = 0
        if adv_fp.get('canvas'):
            components += 1
        if adv_fp.get('webgl'):
            components += 1
        if adv_fp.get('audio'):
            components += 1
        if adv_fp.get('screen'):
            components += 1
        if adv_fp.get('device'):
            components += 1
        if adv_fp.get('environment'):
            components += 1
        
        return min(components / 6.0, 1.0)
    
    @staticmethod
    def detect_spoofing_indicators(adv_fp: Dict) -> float:
        """Detect fingerprint spoofing indicators."""
        if not adv_fp:
            return 0.0
        
        spoofing_score = 0.0
        
        # Check canvas spoofing
        canvas = adv_fp.get('canvas', {})
        if canvas.get('hash') == canvas.get('geometry'):
            spoofing_score += 0.3
        
        # Check WebGL spoofing
        webgl = adv_fp.get('webgl', {})
        if webgl.get('vendor') == 'Google Inc.' and 'SwiftShader' in webgl.get('renderer', ''):
            spoofing_score += 0.3
        
        # Check environment spoofing
        env = adv_fp.get('environment', {})
        if len(env.get('plugins', [])) == 0 and env.get('cookieEnabled', True):
            spoofing_score += 0.2  # Inconsistent
        
        return min(spoofing_score, 1.0)
    
    @staticmethod
    def detect_inconsistent_properties(adv_fp: Dict) -> float:
        """Detect inconsistent properties."""
        if not adv_fp:
            return 0.0
        
        inconsistency_score = 0.0
        
        screen = adv_fp.get('screen', {})
        device = adv_fp.get('device', {})
        env = adv_fp.get('environment', {})
        
        # Check screen/device consistency
        if screen.get('resolution') == '1920x1080' and device.get('maxTouchPoints', 0) > 0:
            inconsistency_score += 0.2  # Desktop resolution but touch device
        
        # Check platform/language consistency
        platform = env.get('platform', '').lower()
        languages = env.get('languages', [])
        
        if 'win' in platform and not any('en' in lang for lang in languages):
            inconsistency_score += 0.1
        
        return min(inconsistency_score, 1.0)
    
    @staticmethod
    def detect_property_overrides(adv_fp: Dict) -> float:
        """Detect property overrides."""
        if not adv_fp:
            return 0.0
        
        # Placeholder - would need to detect if properties have been overridden
        return 0.1  # Low default assumption
    
    @staticmethod
    def analyze_performance_timing(adv_fp: Dict) -> float:
        """Analyze performance timing patterns."""
        if not adv_fp:
            return 0.5
        
        perf = adv_fp.get('performance', {})
        if not perf:
            return 0.5
        
        rendering_time = perf.get('renderingTime', 0)
        
        # Check for suspiciously fast or consistent timing
        if rendering_time < 1:
            return 1.0  # Too fast, likely automated
        elif 10 <= rendering_time <= 100:
            return 0.0  # Normal range
        else:
            return 0.5  # Slightly suspicious
    
    @staticmethod
    def check_referrer_chain_logical(data: Dict) -> float:
        """Check if referrer chain is logical."""
        referer = data.get('referer', '')
        
        if not referer:
            return 0.5  # No referrer, neutral
        
        # Basic referrer validation
        if referer.startswith('http'):
            return 1.0  # Valid HTTP referrer
        else:
            return 0.3  # Invalid referrer format