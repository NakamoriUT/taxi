from flask import Flask
import sys
import os

# プロジェクトのルートディレクトリをPythonパスに追加
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app import app as application

# Vercel用のハンドラー
app = application