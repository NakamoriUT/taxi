#!/usr/bin/env python
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app

if __name__ == '__main__':
    print("サーバーを起動しています...")
    print("http://127.0.0.1:8001 でアクセスしてください")
    try:
        app.run(host='127.0.0.1', port=8001, debug=False)
    except Exception as e:
        print(f"エラーが発生しました: {e}")