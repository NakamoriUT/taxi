#!/usr/bin/env python
"""サーバー接続テストスクリプト"""

import requests
import time

def test_server():
    ports = [5000, 8000, 3000]
    
    for port in ports:
        url = f"http://localhost:{port}"
        print(f"\nTesting {url}...")
        
        try:
            response = requests.get(url, timeout=2)
            if response.status_code == 200:
                print(f"✓ Server is running on port {port}")
                print(f"  Access the application at: {url}")
                return True
            else:
                print(f"✗ Server responded with status code {response.status_code}")
        except requests.exceptions.ConnectionError:
            print(f"✗ No server running on port {port}")
        except requests.exceptions.Timeout:
            print(f"✗ Server timeout on port {port}")
        except Exception as e:
            print(f"✗ Error: {e}")
    
    print("\n" + "="*50)
    print("サーバーが見つかりませんでした。")
    print("\n以下のコマンドでサーバーを起動してください：")
    print("\n1. 新しいターミナルを開く")
    print("2. 以下を実行：")
    print("   cd /Users/nakamoritomomasa/Documents/配送ルート/delivery-route-optimizer")
    print("   python app.py")
    print("\n3. このスクリプトを再度実行")
    print("="*50)
    return False

if __name__ == "__main__":
    test_server()