import os
import sys
import json
import numpy as np
from PIL import Image
import time

# Suppress all warnings including TensorFlow and absl
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import warnings
warnings.filterwarnings('ignore')

# Suppress absl logging
import logging
logging.getLogger('absl').setLevel(logging.ERROR)
logging.getLogger('tensorflow').setLevel(logging.ERROR)

import tensorflow as tf
tf.get_logger().setLevel('ERROR')

from tensorflow import keras

# ------------------- Model Setup -------------------
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'skin_condition_model.h5')
model = None

def load_model_once():
    """Load model once on first call"""
    global model
    if model is None:
        try:
            model = keras.models.load_model(MODEL_PATH)
        except Exception as e:
            return None
    return model

# Attempt to load model at startup
model = load_model_once()

CLASS_LABELS = {
    0: 'Acne',
    1: 'Carcinoma',
    2: 'Eczema',
    3: 'Keratosis',
    4: 'Milia',
    5: 'Rosacea'
}

RECOMMENDATIONS = {
    'Acne': 'Use salicylic acid cleansers, benzoyl peroxide, and avoid heavy makeup. Consult a dermatologist if severe.',
    'Carcinoma': '⚠️ URGENT: This may be skin cancer. Please consult a dermatologist immediately for professional examination.',
    'Eczema': 'Use fragrance-free moisturizers, avoid harsh soaps, and keep skin hydrated. Consult a dermatologist for treatment.',
    'Keratosis': 'Use sunscreen regularly and avoid sun exposure. Consult a dermatologist for professional removal if desired.',
    'Milia': 'Avoid heavy creams. Use exfoliating products gently. Consult a dermatologist for extraction if needed.',
    'Rosacea': 'Avoid triggers (spicy food, alcohol, extreme temperatures). Use gentle skincare and SPF 30+. Consult a dermatologist.'
}

def preprocess_image(image_path, target_size=(224, 224)):
    """Preprocess image for model prediction with optimizations"""
    try:
        img = Image.open(image_path).convert('RGB')
        img = img.resize(target_size, Image.Resampling.LANCZOS)
        img_array = np.array(img, dtype=np.float32) / 255.0
        img_array = np.expand_dims(img_array, axis=0)
        return img_array
    except Exception as e:
        raise Exception(f"Image preprocessing failed: {str(e)}")

def predict_skin_disease(image_path):
    """Run prediction on the uploaded image with improved confidence handling"""
    global model
    
    if model is None:
        model = load_model_once()
    
    if model is None:
        return {"success": False, "error": "Model not available."}
    
    try:
        img_array = preprocess_image(image_path)
        # Disable verbose output for speed
        predictions = model.predict(img_array, verbose=0, batch_size=1)
        
        # Get top predictions
        top_indices = np.argsort(predictions[0])[::-1][:3]  # Top 3 predictions
        predicted_class = int(top_indices[0])
        confidence = float(predictions[0][predicted_class])
        second_confidence = float(predictions[0][top_indices[1]]) if len(top_indices) > 1 else 0
        
        # Check for uncertain predictions (low confidence or close second prediction)
        confidence_gap = confidence - second_confidence
        is_uncertain = confidence < 0.70 or confidence_gap < 0.15
        
        disease_name = CLASS_LABELS.get(predicted_class, 'Unknown')
        recommendation = RECOMMENDATIONS.get(disease_name, 'Consult a dermatologist.')
        
        # Add warning if prediction is uncertain
        if is_uncertain:
            recommendation += "\n⚠️ Note: This prediction has lower confidence. Please consult a dermatologist for professional diagnosis."
        
        return {
            'success': True,
            'disease': disease_name,
            'confidence': confidence,
            'is_uncertain': is_uncertain,
            'confidence_gap': confidence_gap,
            'recommendations': recommendation,
            'all_predictions': {
                CLASS_LABELS.get(i, f'Class {i}'): float(predictions[0][i])
                for i in range(len(predictions[0]))
            }
        }
    except Exception as e:
        return {"success": False, "error": f"Prediction error: {str(e)}"}

# ------------------- Main CLI Entry -------------------
if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Image path not provided"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({"success": False, "error": "Image file not found"}))
        sys.exit(1)
    
    result = predict_skin_disease(image_path)
    print(json.dumps(result))
