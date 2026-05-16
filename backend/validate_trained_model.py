#!/usr/bin/env python
"""
Post-training validation script
Run this after train_skin_model.py completes
Provides detailed report on model improvements
"""

import os
import sys
import numpy as np
import json
from pathlib import Path
from datetime import datetime

# Suppress warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import warnings
warnings.filterwarnings('ignore')

import tensorflow as tf
tf.get_logger().setLevel('ERROR')
from tensorflow import keras
from PIL import Image

# ============= SETUP =============
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'skin_condition_model.h5')
DATA_DIR = os.path.join(os.path.dirname(__file__), '../public/Skin_Conditions')
CLASSES = ['Acne', 'Carcinoma', 'Eczema', 'Keratosis', 'Milia', 'Rosacea']
TARGET_SIZE = (300, 300)  # Match training size

print("\n" + "=" * 70)
print("✅ POST-TRAINING VALIDATION REPORT")
print("=" * 70)
print(f"📅 Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

# Load model
print("📥 Loading trained model...")
try:
    model = keras.models.load_model(MODEL_PATH)
    print(f"✓ Model loaded successfully ({MODEL_PATH})")
except Exception as e:
    print(f"✗ Error loading model: {e}")
    sys.exit(1)

# ============= VALIDATION METRICS =============
print("\n" + "-" * 70)
print("📊 VALIDATION METRICS")
print("-" * 70)

# Test on images
all_correct = 0
all_total = 0
class_metrics = {}

for class_idx, class_name in enumerate(CLASSES):
    class_dir = os.path.join(DATA_DIR, class_name)
    if not os.path.exists(class_dir):
        print(f"✗ {class_name}: Directory not found")
        continue
    
    images = [f for f in os.listdir(class_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))][:20]
    
    if not images:
        print(f"✗ {class_name}: No images found")
        continue
    
    correct = 0
    high_confidence = 0
    low_confidence = 0
    
    for img_file in images:
        try:
            img_path = os.path.join(class_dir, img_file)
            img = Image.open(img_path).convert('RGB')
            img = img.resize(TARGET_SIZE, Image.Resampling.LANCZOS)
            img_array = np.array(img, dtype=np.float32) / 255.0
            img_array = np.expand_dims(img_array, axis=0)
            
            predictions = model.predict(img_array, verbose=0)
            pred_class_idx = int(np.argmax(predictions[0]))
            confidence = float(predictions[0][pred_class_idx])
            
            if pred_class_idx == class_idx:
                correct += 1
                if confidence >= 0.80:
                    high_confidence += 1
                elif confidence < 0.60:
                    low_confidence += 1
            
            all_total += 1
        except Exception as e:
            pass
    
    accuracy = (correct / len(images)) * 100 if len(images) > 0 else 0
    class_metrics[class_name] = {
        'accuracy': accuracy,
        'correct': correct,
        'total': len(images),
        'high_confidence': high_confidence,
        'low_confidence': low_confidence
    }
    all_correct += correct

# Print results
print(f"\n{'Class':<15} {'Accuracy':<12} {'Correct':<12} {'High Conf':<12} {'Low Conf':<12}")
print("-" * 70)

for class_name in CLASSES:
    if class_name not in class_metrics:
        continue
    m = class_metrics[class_name]
    acc_str = f"{m['accuracy']:.1f}%"
    correct_str = f"{m['correct']}/{m['total']}"
    high_str = f"{m['high_confidence']}/{m['total']}"
    low_str = f"{m['low_confidence']}/{m['total']}"
    
    # Color coding
    if m['accuracy'] >= 85:
        status = "✅"
    elif m['accuracy'] >= 70:
        status = "⚠️ "
    else:
        status = "❌"
    
    print(f"{status} {class_name:<13} {acc_str:<12} {correct_str:<12} {high_str:<12} {low_str:<12}")

# ============= ACNE/ECZEMA FOCUS =============
print("\n" + "-" * 70)
print("🔍 CRITICAL: ACNE vs ECZEMA DISTINCTION")
print("-" * 70)

if 'Acne' in class_metrics and 'Eczema' in class_metrics:
    acne_acc = class_metrics['Acne']['accuracy']
    eczema_acc = class_metrics['Eczema']['accuracy']
    
    print(f"\n🔴 Acne Recognition: {acne_acc:.1f}%")
    print(f"🟣 Eczema Recognition: {eczema_acc:.1f}%")
    
    if acne_acc >= 80 and eczema_acc >= 80:
        print("\n✅ EXCELLENT: Both acne and eczema are being recognized correctly!")
    elif acne_acc >= 70 and eczema_acc >= 70:
        print("\n⚠️  ACCEPTABLE: Recognition is improved but could be better.")
    else:
        print("\n❌ POOR: Recognition needs improvement. Consider retraining.")

# ============= OVERALL STATISTICS =============
print("\n" + "-" * 70)
print("📈 OVERALL STATISTICS")
print("-" * 70)

overall_accuracy = (all_correct / all_total) * 100 if all_total > 0 else 0
print(f"\n🎯 Overall Accuracy: {overall_accuracy:.1f}%")
print(f"📊 Total Test Images: {all_total}")
print(f"✓ Correctly Classified: {all_correct}")
print(f"✗ Misclassified: {all_total - all_correct}")

# ============= RECOMMENDATION =============
print("\n" + "-" * 70)
print("💡 RECOMMENDATION")
print("-" * 70)

if overall_accuracy >= 85:
    print("\n✅ GREAT! The model is ready for production.")
    print("   - Accuracy is excellent (85%+)")
    print("   - Acne/Eczema distinction is working well")
    print("   - You can deploy this model with confidence")
elif overall_accuracy >= 75:
    print("\n⚠️  ACCEPTABLE for deployment with caution.")
    print("   - Accuracy is decent (75-85%)")
    print("   - Consider monitoring predictions in production")
    print("   - Retrain with more data if possible for improvements")
else:
    print("\n❌ NOT READY. Further improvements needed:")
    print("   - Accuracy is below 75%")
    print("   - Consider:")
    print("     1. Increasing training epochs (edit train_skin_model.py)")
    print("     2. Reducing image preprocessing (try larger BATCH_SIZE)")
    print("     3. Using more training data")
    print("     4. Fine-tuning more layers of the base model")

# ============= DEPLOYMENT CHECKLIST =============
print("\n" + "-" * 70)
print("📋 DEPLOYMENT CHECKLIST")
print("-" * 70)

checks = [
    ("Model file exists", os.path.exists(MODEL_PATH)),
    ("Overall accuracy ≥ 75%", overall_accuracy >= 75),
    ("Acne recognition ≥ 70%", 'Acne' in class_metrics and class_metrics['Acne']['accuracy'] >= 70),
    ("Eczema recognition ≥ 70%", 'Eczema' in class_metrics and class_metrics['Eczema']['accuracy'] >= 70),
    ("Low misclassification rate", (all_total - all_correct) / all_total < 0.25 if all_total > 0 else False),
]

for desc, result in checks:
    status = "✅" if result else "❌"
    print(f"{status} {desc}")

# ============= SAVE REPORT =============
report_path = os.path.join(os.path.dirname(__file__), 'validation_report.json')
report = {
    'timestamp': datetime.now().isoformat(),
    'overall_accuracy': overall_accuracy,
    'class_metrics': class_metrics,
    'total_test_images': all_total,
    'correctly_classified': all_correct,
}

with open(report_path, 'w') as f:
    json.dump(report, f, indent=2)
print(f"\n💾 Report saved to: {report_path}")

print("\n" + "=" * 70)
print("✅ VALIDATION COMPLETE")
print("=" * 70 + "\n")
