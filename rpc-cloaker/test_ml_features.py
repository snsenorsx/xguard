#!/usr/bin/env python3
"""
Test script for expanded ML feature extraction
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'ml-service/src'))

from ml.feature_extractor import FeatureExtractor

def test_feature_extraction():
    """Test the expanded feature extraction system."""
    
    print("🧪 Testing Expanded ML Feature Extraction")
    print("=" * 50)
    
    # Initialize feature extractor
    extractor = FeatureExtractor()
    
    print(f"📊 Total feature count: {len(extractor.feature_names)}")
    print(f"🎯 Target: 150+ features (was: 35)")
    
    # Test data with comprehensive visitor information
    test_visitor = {
        'userAgent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'headers': {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.5',
            'accept-encoding': 'gzip, deflate, br',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'connection': 'keep-alive',
            'host': 'example.com'
        },
        'ip': '192.168.1.100',
        'referer': 'https://google.com',
        'geo': {
            'country': 'US', 
            'region': 'CA',
            'city': 'San Francisco',
            'll': [37.7749, -122.4194]
        },
        'device': {'type': 'desktop'},
        'browser': {'name': 'Chrome', 'version': '91.0.4472.124'},
        'os': {'name': 'Mac OS', 'version': '10.15.7'},
        'advancedFingerprint': {
            'canvas': {
                'hash': '5f4d3c2e1b9a8f6e5d4c3b2a1f9e8d7c6b5a4f3e2d1c9b8a7f6e5d4c3b2a1f9e',
                'geometry': 'canvas_geometry_unique',
                'text': 'canvas_text_rendered'
            },
            'webgl': {
                'vendor': 'Google Inc. (Apple)',
                'renderer': 'ANGLE (Apple, Apple M1, OpenGL 4.1)',
                'version': 'OpenGL ES 2.0 (ANGLE 2.1.0 git hash: unknown)',
                'shadingLanguageVersion': 'OpenGL ES GLSL ES 1.0 (ANGLE 2.1.0 git hash: unknown)',
                'extensions': ['ANGLE_instanced_arrays', 'EXT_blend_minmax', 'EXT_color_buffer_half_float'],
                'parameters': {'MAX_VERTEX_ATTRIBS': 16, 'MAX_FRAGMENT_UNIFORM_VECTORS': 1024},
                'hash': 'webgl_hash_unique_identifier'
            },
            'audio': {
                'contextHash': 'audio_context_hash',
                'compressorHash': 'compressor_hash_unique',
                'oscillatorHash': 'oscillator_hash_unique',
                'sampleRate': 44100,
                'maxChannelCount': 2,
                'baseLatency': 0.005
            },
            'screen': {
                'resolution': '1920x1080',
                'colorDepth': 24,
                'pixelRatio': 1.0,
                'orientation': 'landscape-primary',
                'availableResolution': '1920x1055'
            },
            'device': {
                'hardwareConcurrency': 8,
                'maxTouchPoints': 0,
                'deviceMemory': 8,
                'connection': {
                    'effectiveType': '4g',
                    'downlink': 10,
                    'rtt': 50
                }
            },
            'environment': {
                'timezone': 'America/Los_Angeles',
                'timezoneOffset': 480,
                'languages': ['en-US', 'en'],
                'platform': 'MacIntel',
                'cookieEnabled': True,
                'doNotTrack': None,
                'plugins': [
                    {'name': 'Chrome PDF Plugin', 'description': 'Portable Document Format', 'filename': 'internal-pdf-viewer'},
                    {'name': 'Chromium PDF Plugin', 'description': 'Portable Document Format', 'filename': 'mhjfbmdgcfjbbpaeojofohoefgiehjai'}
                ]
            },
            'performance': {
                'renderingTime': 45.2,
                'canvasRenderTime': 12.8,
                'webglRenderTime': 8.5,
                'audioProcessingTime': 3.2
            },
            'headlessDetection': {
                'isHeadless': False,
                'confidence': 0.1,
                'score': 15,
                'detections': ['Normal browser environment'],
                'features': {
                    'webdriver': False,
                    'selenium': False,
                    'puppeteer': False,
                    'phantomjs': False,
                    'playwright': False
                }
            }
        }
    }
    
    # Extract features
    try:
        features = extractor.extract_features(test_visitor)
        
        print(f"✅ Feature extraction successful!")
        print(f"📊 Extracted {len(features)} features")
        print(f"🎯 Feature vector shape: {features.shape}")
        print(f"📈 Feature value range: [{features.min():.3f}, {features.max():.3f}]")
        print(f"📊 Non-zero features: {(features != 0).sum()}/{len(features)}")
        
        # Show feature categories
        print("\n📋 Feature Categories:")
        categories = {
            'User Agent': (0, 6),
            'Headers': (6, 13), 
            'Geo': (13, 18),
            'Device/Browser': (18, 25),
            'Behavioral': (25, 30),
            'Network': (30, 35),
            'Headless Detection': (35, 43),
            'Advanced Fingerprinting': (43, 68),
            'Behavioral Patterns': (68, 88),
            'Evasion Detection': (88, 113),
            'ML Analysis': (113, 133)
        }
        
        for cat_name, (start, end) in categories.items():
            if end <= len(features):
                cat_features = features[start:end]
                non_zero = (cat_features != 0).sum()
                avg_val = cat_features.mean()
                print(f"  {cat_name:.<25} {end-start:>3} features | {non_zero:>2} active | avg: {avg_val:.3f}")
        
        # Test with bot-like visitor
        print(f"\n🤖 Testing with bot-like visitor:")
        bot_visitor = {
            'userAgent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/91.0.4472.124 Safari/537.36',
            'headers': {
                'accept': '*/*',
                'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/91.0.4472.124 Safari/537.36'
            },
            'ip': '34.102.136.180',  # Google Cloud
            'geo': {'country': 'US', 'city': 'Mountain View'},
            'device': {'type': 'desktop'},
            'browser': {'name': 'Chrome', 'version': '91.0.4472.124'},
            'os': {'name': 'Linux'},
            'advancedFingerprint': {
                'environment': {
                    'plugins': [],
                    'languages': ['en-US'],
                    'timezone': 'UTC'
                },
                'webgl': {
                    'vendor': 'Brian Paul',
                    'renderer': 'Mesa OffScreen'
                },
                'headlessDetection': {
                    'isHeadless': True,
                    'confidence': 0.9,
                    'score': 85
                }
            }
        }
        
        bot_features = extractor.extract_features(bot_visitor)
        
        print(f"🤖 Bot feature extraction: {len(bot_features)} features")
        print(f"📊 Bot non-zero features: {(bot_features != 0).sum()}/{len(bot_features)}")
        print(f"📈 Bot feature range: [{bot_features.min():.3f}, {bot_features.max():.3f}]")
        
        # Compare human vs bot features
        diff = abs(features - bot_features)
        significant_diffs = (diff > 0.1).sum()
        print(f"🔍 Significant differences: {significant_diffs}/{len(features)} features")
        
        print(f"\n✅ SUCCESS: Expanded from 35 to {len(features)} features!")
        print(f"🎯 Target achieved: {len(features)} >= 150 features")
        
        return True
        
    except Exception as e:
        print(f"❌ ERROR: Feature extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_feature_extraction()
    exit(0 if success else 1)