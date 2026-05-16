#!/usr/bin/env python
"""
Improved Skin Disease Detection Model Training
Fixes misclassification issues with better preprocessing and training techniques
"""

import os
import sys
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, models
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import EfficientNetB3
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from sklearn.utils import class_weight
import warnings

warnings.filterwarnings('ignore')

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
tf.get_logger().setLevel('ERROR')

# ============= CONFIGURATION =============
IMAGE_SIZE = (300, 300)  # Larger size for better feature extraction
BATCH_SIZE = 32
EPOCHS = 50
CLASSES = ['Acne', 'Carcinoma', 'Eczema', 'Keratosis', 'Milia', 'Rosacea']
DATA_DIR = os.path.join(os.path.dirname(__file__), '../public/Skin_Conditions')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'skin_condition_model.h5')

print("=" * 60)
print("🔄 SKIN DISEASE DETECTION - MODEL RETRAINING")
print("=" * 60)
print(f"\n📁 Training data directory: {DATA_DIR}")
print(f"🖼️  Image size: {IMAGE_SIZE}")
print(f"📦 Batch size: {BATCH_SIZE}")
print(f"🔁 Epochs: {EPOCHS}")
print(f"🏷️  Classes: {', '.join(CLASSES)}\n")

# ============= DATA VALIDATION =============
print("📊 Checking training data...")
class_counts = {}
for class_name in CLASSES:
    class_dir = os.path.join(DATA_DIR, class_name)
    if os.path.exists(class_dir):
        count = len([f for f in os.listdir(class_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
        class_counts[class_name] = count
        print(f"  ✓ {class_name}: {count} images")
    else:
        print(f"  ✗ {class_name}: Directory not found!")
        sys.exit(1)

print(f"\nTotal images: {sum(class_counts.values())}")

# ============= DATA AUGMENTATION =============
print("\n📈 Setting up data augmentation...")

# More aggressive augmentation for better generalization
train_datagen = ImageDataGenerator(
    rescale=1./255,
    rotation_range=25,
    width_shift_range=0.2,
    height_shift_range=0.2,
    shear_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True,
    vertical_flip=False,
    brightness_range=[0.8, 1.2],
    fill_mode='nearest',
    validation_split=0.2  # 80% train, 20% validation
)

# Validation data only rescaling (no augmentation)
val_datagen = ImageDataGenerator(rescale=1./255)

# ============= LOAD DATA =============
print("\n📥 Loading training data...")
train_generator = train_datagen.flow_from_directory(
    DATA_DIR,
    target_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    classes=CLASSES,
    subset='training',
    shuffle=True,
    seed=42
)

print("📥 Loading validation data...")
val_generator = train_datagen.flow_from_directory(
    DATA_DIR,
    target_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    classes=CLASSES,
    subset='validation',
    shuffle=False,
    seed=42
)

# ============= CLASS WEIGHTS =============
print("\n⚖️  Computing class weights for balanced training...")
class_weights_dict = class_weight.compute_class_weight(
    'balanced',
    classes=np.unique(train_generator.classes),
    y=train_generator.classes
)
class_weights = dict(enumerate(class_weights_dict))
print(f"  Class weights: {class_weights}")

# ============= BUILD MODEL =============
print("\n🏗️  Building model architecture...")
print("  Using EfficientNetB3 as backbone (better than standard CNN)")

# Use pre-trained EfficientNetB3 for transfer learning
base_model = EfficientNetB3(
    weights='imagenet',
    include_top=False,
    input_shape=(*IMAGE_SIZE, 3)
)

# Freeze base model initially
base_model.trainable = False

# Build custom model
model = models.Sequential([
    base_model,
    layers.GlobalAveragePooling2D(),
    
    # Additional dense layers for better feature extraction
    layers.Dense(512, activation='relu', kernel_regularizer=keras.regularizers.l2(0.0001)),
    layers.BatchNormalization(),
    layers.Dropout(0.4),
    
    layers.Dense(256, activation='relu', kernel_regularizer=keras.regularizers.l2(0.0001)),
    layers.BatchNormalization(),
    layers.Dropout(0.3),
    
    layers.Dense(128, activation='relu', kernel_regularizer=keras.regularizers.l2(0.0001)),
    layers.BatchNormalization(),
    layers.Dropout(0.2),
    
    layers.Dense(len(CLASSES), activation='softmax')
])

# ============= COMPILE =============
print("\n⚙️  Compiling model...")
model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=0.001),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

print("\nModel Summary:")
print(f"  Total parameters: {model.count_params():,}")

# ============= CALLBACKS =============
print("\n📌 Setting up training callbacks...")
callbacks = [
    EarlyStopping(
        monitor='val_loss',
        patience=10,
        restore_best_weights=True,
        verbose=1
    ),
    ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=5,
        min_lr=1e-7,
        verbose=1
    ),
    ModelCheckpoint(
        MODEL_PATH,
        monitor='val_accuracy',
        save_best_only=True,
        verbose=1
    )
]

# ============= TRAINING PHASE 1: Frozen Base =============
print("\n" + "=" * 60)
print("🎓 TRAINING PHASE 1: Feature Extraction (Frozen Base)")
print("=" * 60)

history1 = model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=15,
    class_weight=class_weights,
    callbacks=callbacks,
    verbose=1
)

# ============= FINE-TUNING PHASE 2: Unfreeze Base =============
print("\n" + "=" * 60)
print("🔧 TRAINING PHASE 2: Fine-tuning (Unfrozen Base)")
print("=" * 60)

# Unfreeze the last 20 layers of base model
base_model.trainable = True
for layer in base_model.layers[:-20]:
    layer.trainable = False

# Recompile with lower learning rate for fine-tuning
model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=0.0001),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

history2 = model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=35,
    class_weight=class_weights,
    callbacks=callbacks,
    verbose=1
)

# ============= EVALUATION =============
print("\n" + "=" * 60)
print("📊 FINAL EVALUATION")
print("=" * 60)

val_loss, val_accuracy = model.evaluate(val_generator, verbose=0)
print(f"\n✓ Validation Accuracy: {val_accuracy*100:.2f}%")
print(f"✓ Validation Loss: {val_loss:.4f}")

# ============= TEST PREDICTIONS =============
print("\n🧪 Testing predictions on first batch...")
X_test, y_test = next(val_generator)
predictions = model.predict(X_test[:5], verbose=0)

for i in range(min(5, len(X_test))):
    pred_class = np.argmax(predictions[i])
    pred_confidence = predictions[i][pred_class]
    true_class = np.argmax(y_test[i])
    print(f"  Sample {i+1}: Predicted {CLASSES[pred_class]} ({pred_confidence*100:.1f}%) | True: {CLASSES[true_class]}")

print("\n" + "=" * 60)
print("✅ MODEL TRAINING COMPLETE!")
print(f"📁 Model saved to: {MODEL_PATH}")
print("=" * 60)
