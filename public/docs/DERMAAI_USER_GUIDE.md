# 📱 DermaAI Chatbot - User Guide

## 🎯 What is DermaAI?

**DermaAI** is an AI-powered skin analysis assistant that helps you identify and understand various skin conditions. The chatbot combines conversational AI with computer vision to provide skincare recommendations.

---

## 🏥 Detectable Skin Conditions

Our AI model can detect and analyze the following 6 skin conditions:

| Condition | Description |
|-----------|-------------|
| 🔴 **Acne** | Pimples, blackheads, whiteheads, cystic acne |
| 🟠 **Eczema** | Inflamed, itchy, dry skin patches |
| 🟡 **Rosacea** | Facial redness, visible blood vessels |
| 🟢 **Keratosis** | Rough, scaly growths (usually benign) |
| 🔵 **Milia** | Small white bumps under skin |
| ⚫ **Carcinoma** | ⚠️ Skin cancer (needs urgent attention) |

---

## 📸 How to Use the Skin Analysis Feature

### Step-by-Step Guide:

```
┌─────────────────────────────────────┐
│  DermaAI Chatbot Interface          │
│                                     │
│  [ℹ️ About]      [Chat Title]  [✕]  │  ← Header
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Chat messages appear here...  │  │
│  │                               │  │
│  │  User: [Uploaded image]       │  │
│  │  Bot:  🔍 Detected: Acne      │  │
│  │        Confidence: 92.5%      │  │
│  │        💡 Recommendations...  │  │
│  └───────────────────────────────┘  │
│                                     │
│  [+]  [Type message...]   [➤]      │  ← Input area
│   ↑                        ↑         │
│ Upload Image            Send         │
│                                     │
└─────────────────────────────────────┘
```

### Detailed Steps:

#### **Step 1: Click the + Button**
- Located at the bottom-left of the chat
- Opens file picker for image selection
- Accepts: JPG, PNG, and other image formats

#### **Step 2: Select a Skin Photo**
- Choose a clear, well-lit photo of the affected area
- The image will be uploaded to the AI model
- You'll see a preview in the chat

#### **Step 3: Wait for Analysis**
- AI processing takes 2-3 seconds
- Shows "typing" indicator while analyzing
- Don't close the page during processing

#### **Step 4: View Results**
```
🔍 Detected: Acne
Confidence: 92.5%
💡 Recommendations: Use salicylic acid cleansers, 
benzoyl peroxide, and avoid heavy makeup. 
Consult a dermatologist if severe.
```

---

## 💬 Chat Features

### General Questions
Ask the bot about:
- 🛍️ Product recommendations
- 💄 Skincare tips
- ✨ Skin type guidance
- 🧴 Skincare concerns

**Note**: The chatbot provides general responses. For detailed advice, upload an image for AI analysis.

### Suggested Prompts
Quick buttons for common questions:
- "Skincare Tips" - Get general skincare advice
- "Products" - See product recommendations
- "Sensitive Skin" - Tips for sensitive skin
- "Skin Analysis" - Information about analysis

---

## ℹ️ About Section (Click the ℹ️ Button)

The "About" modal provides:
- ✅ All detectable conditions
- 📸 How to use the analysis tool
- ⚠️ Chatbot limitations
- 🔍 Model accuracy information
- ✨ Tips for best results
- ⚡ Important medical disclaimer

---

## 🔍 Model Accuracy & Limitations

### What to Expect:
- **Accuracy**: 85%+ on trained conditions
- **Best for**: Clear, high-quality images
- **Confidence Score**: Higher = more reliable

### Important Limitations:
1. ❌ **NOT a Medical Diagnosis**
   - AI predictions are for informational purposes
   - Always consult a dermatologist

2. 📷 **Image Quality Matters**
   - Poor lighting = lower accuracy
   - Blurry photos reduce reliability
   - Multiple angles improve results

3. 🤔 **Borderline Cases**
   - Some conditions are visually similar
   - System flags uncertain predictions
   - Use dermatologist for final diagnosis

4. 🎯 **Single Image Limitation**
   - Based on one photo only
   - Multiple photos from different angles = better accuracy

5. 🚫 **Unknown Conditions**
   - May not recognize rare conditions
   - Only trained on 6 specific conditions

---

## ✨ Tips for Best Results

### Photography Tips:
1. **Lighting**: Use natural daylight (avoid harsh shadows)
2. **Focus**: Take clear, sharp photos (not blurry)
3. **Distance**: Get close-up but include context
4. **Angle**: Try multiple angles if possible
5. **Cleanliness**: Clean the area before photos
6. **Format**: Use JPG or PNG images

### Before Upload:
- ✓ Good lighting (natural sunlight recommended)
- ✓ Clear, focused image
- ✓ Close-up of affected area
- ✓ Dry skin (if possible)
- ✓ No makeup or filters

### Upload Quality:
- ✓ File size: Less than 10MB
- ✓ Resolution: Higher resolution = better
- ✓ Format: JPG/PNG
- ✓ No blurry or dark images

---

## 🎯 Use Cases

### Example 1: Analyzing Acne
```
User: [Uploads photo of pimple-covered face]
↓
DermaAI: 🔍 Detected: Acne
         Confidence: 94.2%
         💡 Recommendations: Use salicylic acid cleansers...
```

### Example 2: Uncertain Prediction
```
User: [Uploads borderline acne/eczema image]
↓
DermaAI: 🔍 Detected: Acne
         Confidence: 68.3%
         ⚠️ Note: This prediction has lower confidence.
            Please consult a dermatologist.
```

### Example 3: Serious Condition
```
User: [Uploads suspicious skin growth]
↓
DermaAI: 🔍 Detected: Carcinoma
         Confidence: 87.5%
         ⚠️ URGENT: This may be skin cancer.
            Please consult a dermatologist immediately!
```

---

## 🚨 Important Disclaimer

### Medical Disclaimer:
> **This tool is for informational purposes ONLY.**
>
> - ❌ NOT a substitute for professional medical advice
> - ❌ NOT a diagnosis tool
> - ❌ May have errors or inaccuracies
> - ✅ Always consult a qualified dermatologist
> - ✅ For serious concerns, seek immediate medical attention

### What to Do If Results Are Concerning:
1. 🏥 **Carcinoma detected**: See dermatologist IMMEDIATELY
2. 😟 **Uncertain result**: Consult dermatologist to confirm
3. ❓ **Unsure about condition**: Get professional evaluation
4. 📋 **For treatment**: Follow dermatologist's recommendations

---

## 🆘 Troubleshooting

### Issue 1: "No image file provided"
**Solution**: Make sure you selected an image file before uploading.

### Issue 2: "Image preprocessing failed"
**Solution**: Try a different image or check file size (<10MB).

### Issue 3: "Prediction timeout"
**Solution**: 
- Check internet connection
- Try again after a few seconds
- Use a clearer image

### Issue 4: Low Confidence Score
**Solution**:
- Take a clearer, more focused photo
- Improve lighting conditions
- Try from different angle
- Consult dermatologist

### Issue 5: Wrong Prediction
**Solution**:
- Model may be uncertain
- Low confidence indicates this
- Always verify with dermatologist
- Multiple photos help

---

## 📞 Support Features

### Within the App:
- **ℹ️ About Button**: Full information and limitations
- **+ Button**: Upload images for analysis
- **💬 Chat**: Ask general questions
- **✕ Button**: Close chat and go back

### Outside the App:
- Visit dermatologist for confirmation
- Use multiple sources for diagnosis
- Consider getting professional opinion

---

## 🎓 How the AI Works

### Behind the Scenes:

```
1. You upload image
   ↓
2. Image is processed and scaled
   ↓
3. AI model analyzes features
   ↓
4. Compares with 6 known conditions
   ↓
5. Generates confidence scores
   ↓
6. Returns top prediction + all scores
   ↓
7. Displays results with confidence
```

### Confidence Score:
- **90%+** = Very confident, likely accurate
- **80-90%** = Confident, probably accurate
- **70-80%** = Moderately confident, verify
- **<70%** = Low confidence, consult dermatologist

---

## 📱 Compatible Devices

### Works On:
- ✅ Desktop/Laptop browsers
- ✅ Tablets
- ✅ Mobile phones
- ✅ All modern browsers

### Browser Support:
- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge

---

## 💡 Quick Reference

| Feature | How to Use |
|---------|-----------|
| **Analyze Skin** | Click + → Select image → View results |
| **Get Advice** | Click suggested prompts or type question |
| **Learn More** | Click ℹ️ About button |
| **Ask Question** | Type in chat and press Enter |
| **Leave Chat** | Click ✕ button (top right) |
| **Close Modal** | Click ✕ or click outside modal |

---

## 🌟 Success Checklist

Before analyzing:
- [ ] Have a clear skin photo ready
- [ ] Good lighting available
- [ ] Image is in focus
- [ ] Internet connection working
- [ ] Understand results are not medical diagnosis
- [ ] Plan to consult dermatologist if needed

---

## 🎯 Next Steps

1. **Try It Out**: Upload a skin photo and see results
2. **Learn**: Click About (ℹ️) to understand limitations
3. **Ask Questions**: Use chat for general skincare tips
4. **Verify**: Get professional opinion from dermatologist
5. **Shop**: Find products in Shopsphere to help treat condition

---

## 💬 Example Conversation

```
User: I want to analyze my skin
Bot:  That's a great question! Let me help you with that.

User: [Uploads acne photo]
Bot:  🔍 Detected: Acne
      Confidence: 91.5%
      💡 Recommendations: Use salicylic acid cleansers, 
         benzoyl peroxide, and avoid heavy makeup. 
         Consult a dermatologist if severe.

User: What products help with acne?
Bot:  I'd recommend checking our skincare collection 
      for your needs.

User: [Clicks About button]
Bot:  [Shows full information modal]
```

---

## 🔐 Privacy & Security

- Images are processed on-device when possible
- Data is encrypted in transit
- No personal data is stored
- Only used for analysis
- One-time use (not stored)

---

**Ready to analyze your skin? Click the + button to start!**

*Disclaimer: This is an informational tool only. Always consult a qualified dermatologist for medical advice.*
