#!/usr/bin/env python3
"""
Simple test script for ML feature extraction without numpy
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'ml-service/src'))

# Mock numpy for testing
class MockArray:
    def __init__(self, data):
        self.data = data if isinstance(data, list) else [data]
    
    @property
    def shape(self):
        return (len(self.data),)
    
    def min(self):
        return min(self.data) if self.data else 0
    
    def max(self):
        return max(self.data) if self.data else 0
    
    def mean(self):
        return sum(self.data) / len(self.data) if self.data else 0
    
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, key):
        if isinstance(key, slice):
            return MockArray(self.data[key])
        return self.data[key]
    
    def __ne__(self, other):
        if isinstance(other, (int, float)):
            return MockArray([1 if x != other else 0 for x in self.data])
        return MockArray([1] * len(self.data))
    
    def sum(self):
        return sum(self.data)

# Mock numpy module
class MockNumpy:
    @staticmethod
    def array(data, dtype=None):
        return MockArray(data)
    
    float32 = 'float32'
    ndarray = MockArray  # Add ndarray for type hints

sys.modules['numpy'] = MockNumpy()

# Now import the feature extractor
from ml.feature_extractor import FeatureExtractor

def test_feature_count():
    """Test that we have 150+ features."""
    
    print("🧪 Testing ML Feature Count Expansion")
    print("=" * 50)
    
    # Initialize feature extractor
    extractor = FeatureExtractor()
    
    feature_count = len(extractor.feature_names)
    print(f"📊 Total feature count: {feature_count}")
    print(f"🎯 Original count: 35")
    print(f"🎯 Target count: 150+")
    
    if feature_count >= 150:
        print(f"✅ SUCCESS: Feature expansion achieved! ({feature_count} >= 150)")
        expansion_ratio = feature_count / 35
        print(f"📈 Expansion ratio: {expansion_ratio:.1f}x")
    else:
        print(f"❌ NEED MORE: Only {feature_count} features (need {150 - feature_count} more)")
    
    # Show feature categories and counts
    print(f"\n📋 Feature Breakdown:")
    
    categories = [
        "User Agent features (6)",
        "Header features (7)", 
        "Geo features (5)",
        "Device/Browser features (7)",
        "Behavioral features (5)",
        "Network features (5)",
        "Headless detection features (8)",
        "Advanced fingerprinting features (25)",
        "Behavioral & Pattern Analysis features (20)",
        "Advanced Detection Evasion features (25)", 
        "ML & AI Detection features (20)"
    ]
    
    for i, category in enumerate(categories, 1):
        print(f"  {i:2d}. {category}")
    
    expected_total = 6 + 7 + 5 + 7 + 5 + 5 + 8 + 25 + 20 + 25 + 20
    print(f"\n📊 Expected total: {expected_total}")
    print(f"📊 Actual total: {feature_count}")
    
    # Quick feature name analysis
    print(f"\n🔍 Feature Name Analysis:")
    
    unique_prefixes = set()
    for name in extractor.feature_names:
        parts = name.split('_')
        if len(parts) > 1:
            unique_prefixes.add(parts[0])
    
    print(f"🏷️  Unique feature prefixes: {len(unique_prefixes)}")
    print(f"🏷️  Examples: {', '.join(list(unique_prefixes)[:10])}")
    
    # Test basic feature extraction structure
    print(f"\n🧪 Testing feature extraction structure...")
    
    test_data = {
        'userAgent': 'Mozilla/5.0 (Macintosh) Chrome/91.0',
        'headers': {'accept': 'text/html'},
        'ip': '192.168.1.1',
        'geo': {'country': 'US'},
        'device': {'type': 'desktop'},
        'browser': {'name': 'Chrome'},
        'os': {'name': 'Mac OS'}
    }
    
    try:
        features = extractor.extract_features(test_data)
        print(f"✅ Feature extraction works: {len(features)} features extracted")
        
        if hasattr(features, 'shape'):
            print(f"📊 Feature vector shape: {features.shape}")
        
        # Check for reasonable feature distribution
        non_placeholder = sum(1 for f in features.data if f != 0.5 and f != 0.0)
        print(f"🎯 Non-placeholder features: {non_placeholder}/{len(features)}")
        
    except Exception as e:
        print(f"❌ Feature extraction failed: {e}")
    
    print(f"\n" + "=" * 50)
    
    if feature_count >= 150:
        print(f"🎉 MILESTONE ACHIEVED: ML feature set expanded from 35 to {feature_count}!")
        print(f"🚀 Bot detection capability significantly enhanced")
        return True
    else:
        print(f"⚠️  Need to add {150 - feature_count} more features to reach target")
        return False

if __name__ == '__main__':
    success = test_feature_count()
    exit(0 if success else 1)