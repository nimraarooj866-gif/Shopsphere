#!/usr/bin/env python
"""
Test script to diagnose acne/eczema misclassification issue
Shows which classes are being confused
"""

import os
import sys
import numpy as np
import json
from PIL import Image
from pathlib import Path

# Suppress warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import warnings
warnings.filterwarnings('ignore')

import tensorflow as tf
tf.get_logger().setLevel('ERROR')
from tensorflow import keras

# ============= SETUP =============
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'skin_condition_model.h5')
DATA_DIR = os.path.join(os.path.dirname(__file__), '../public/Skin_Conditions')
CLASSES = ['Acne', 'Carcinoma', 'Eczema', 'Keratosis', 'Milia', 'Rosacea']
TARGET_SIZE = (224, 224)

print("=" * 60)
print("🔍 SKIN DISEASE MODEL DIAGNOSTIC TEST")
print("=" * 60)

# Load model
print("\n📥 Loading model...")
try:
    model = keras.models.load_model(MODEL_PATH)
    print(f"✓ Model loaded: {MODEL_PATH}")
except Exception as e:
    print(f"✗ Error loading model: {e}")
    sys.exit(1)

# Test on sample images
print("\n🧪 Testing on sample images...\n")

confusion_matrix = np.zeros((len(CLASSES), len(CLASSES)))
results_by_class = {cls: [] for cls in CLASSES}

for class_idx, class_name in enumerate(CLASSES):
    class_dir = os.path.join(DATA_DIR, class_name)
    if not os.path.exists(class_dir):
        print(f"✗ {class_name}: Directory not found")
        continue
    
    # Get sample images (max 10 per class for speed)
    images = [f for f in os.listdir(class_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))][:10]
    
    if not images:
        print(f"✗ {class_name}: No images found")
        continue
    
    correct = 0
    total = len(images)
    
    for img_file in images:
        try:
            img_path = os.path.join(class_dir, img_file)
            img = Image.open(img_path).convert('RGB')
            img = img.resize(TARGET_SIZE, Image.Resampling.LANCZOS)
            img_array = np.array(img, dtype=np.float32) / 255.0
            img_array = np.expand_dims(img_array, axis=0)
            
            # Predict
            predictions = model.predict(img_array, verbose=0)
            pred_class_idx = int(np.argmax(predictions[0]))
            pred_confidence = float(predictions[0][pred_class_idx])
            
            # Update confusion matrix
            confusion_matrix[class_idx][pred_class_idx] += 1
            
            # Store result
            results_by_class[class_name].append({
                'image': img_file,
                'predicted': CLASSES[pred_class_idx],
                'confidence': pred_confidence,
                'correct': pred_class_idx == class_idx
            })
            
            if pred_class_idx == class_idx:
                correct += 1
        except Exception as e:
            print(f"  Error processing {img_file}: {e}")
    
    accuracy = (correct / total) * 100 if total > 0 else 0
    status = "✓" if accuracy >= 80 else "⚠️" if accuracy >= 60 else "✗"
    print(f"{status} {class_name}: {correct}/{total} correct ({accuracy:.1f}%)")

# ============= CONFUSION MATRIX =============
print("\n" + "=" * 60)
print("📊 CONFUSION MATRIX")
print("=" * 60)
print("\nRows = True Label | Columns = Predicted Label\n")

# Header
print("        ", end="")
for cls in CLASSES:
    print(f"{cls:>10}", end="")
print()

# Rows
for i, true_class in enumerate(CLASSES):
    print(f"{true_class:>7}", end="")
    for j in range(len(CLASSES)):
        count = int(confusion_matrix[i][j])
        print(f"{count:>10}", end="")
    print()

# ============= ACNE VS ECZEMA ANALYSIS =============
print("\n" + "=" * 60)
print("🔍 ACNE vs ECZEMA ANALYSIS")
print("=" * 60)

acne_idx = CLASSES.index('Acne')
eczema_idx = CLASSES.index('Eczema')

acne_as_acne = confusion_matrix[acne_idx][acne_idx]
acne_as_eczema = confusion_matrix[acne_idx][eczema_idx]
eczema_as_eczema = confusion_matrix[eczema_idx][eczema_idx]
eczema_as_acne = confusion_matrix[eczema_idx][acne_idx]

print(f"\nAcne Images:")
print(f"  ✓ Correctly identified as Acne: {int(acne_as_acne)}")
print(f"  ✗ Incorrectly identified as Eczema: {int(acne_as_eczema)}")

print(f"\nEczema Images:")
print(f"  ✓ Correctly identified as Eczema: {int(eczema_as_eczema)}")
print(f"  ✗ Incorrectly identified as Acne: {int(eczema_as_acne)}")

if acne_as_eczema > acne_as_acne * 0.3:
    print("\n⚠️  ISSUE DETECTED: High acne→eczema misclassification!")
    print("    Recommendation: RETRAIN MODEL using train_skin_model.py")

# ============= DETAILED RESULTS =============
print("\n" + "=" * 60)
print("📋 DETAILED RESULTS BY CLASS")
print("=" * 60)

for class_name in CLASSES:
    results = results_by_class[class_name]
    if not results:
        continue
    
    print(f"\n{class_name}:")
    incorrect = [r for r in results if not r['correct']]
    
    if incorrect:
        print(f"  ❌ Incorrect predictions ({len(incorrect)}/{len(results)}):")
        for r in incorrect:
            print(f"     - {r['image']}: Predicted {r['predicted']} ({r['confidence']*100:.1f}%)")
    else:
        print(f"  ✅ All predictions correct!")

print("\n" + "=" * 60)
