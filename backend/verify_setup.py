#!/usr/bin/env python
"""
Setup verification script for Skin Disease Detection
Run this to verify all components are properly installed
"""

import sys
import subprocess
from pathlib import Path

def print_status(status, message):
    if status:
        print(f"✓ {message}")
    else:
        print(f"✗ {message}")
    return status

def check_python_version():
    """Check if Python version is 3.7+"""
    version = sys.version_info
    if version.major >= 3 and version.minor >= 7:
        return print_status(True, f"Python version: {version.major}.{version.minor}.{version.micro}")
    else:
        return print_status(False, f"Python 3.7+ required, found {version.major}.{version.minor}")

def check_package(package_name, import_name=None):
    """Check if a Python package is installed"""
    if import_name is None:
        import_name = package_name
    
    try:
        __import__(import_name)
        return print_status(True, f"Package '{package_name}' is installed")
    except ImportError:
        return print_status(False, f"Package '{package_name}' is NOT installed")

def check_model_file():
    """Check if model file exists"""
    model_path = Path(__file__).parent / "skin_condition_model.h5"
    exists = model_path.exists()
    if exists:
        size_mb = model_path.stat().st_size / (1024 * 1024)
        return print_status(True, f"Model file found ({size_mb:.1f} MB)")
    else:
        return print_status(False, "Model file NOT found at: skin_condition_model.h5")

def check_backend_files():
    """Check if required backend files exist"""
    backend_path = Path(__file__).parent
    files = {
        "index.js": backend_path / "index.js",
        "skin_predictor.py": backend_path / "skin_predictor.py",
        "package.json": backend_path / "package.json"
    }
    
    all_good = True
    for name, path in files.items():
        exists = path.exists()
        all_good = all_good and exists
        status = "✓" if exists else "✗"
        print(f"{status} {name}")
    
    return all_good

def main():
    print("\n" + "="*50)
    print("🔍 SKIN DISEASE DETECTION - SETUP VERIFICATION")
    print("="*50 + "\n")
    
    checks = []
    
    print("📌 Python Environment:")
    checks.append(check_python_version())
    print()
    
    print("📦 Required Packages:")
    checks.append(check_package("tensorflow"))
    checks.append(check_package("PIL", "PIL"))
    checks.append(check_package("numpy"))
    print()
    
    print("📁 Backend Files:")
    checks.append(check_backend_files())
    print()
    
    print("🤖 Model File:")
    checks.append(check_model_file())
    print()
    
    print("="*50)
    if all(checks):
        print("✓ All checks passed! You're ready to go! 🎉")
        print("\nNext steps:")
        print("1. cd backend && npm install")
        print("2. node index.js")
        print("3. Open chat.html and click the + button")
    else:
        print("✗ Some checks failed. Please see above for details.")
        print("\nInstall missing packages with:")
        print("pip install tensorflow pillow numpy")
    print("="*50 + "\n")

if __name__ == "__main__":
    main()
