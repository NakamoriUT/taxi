#!/usr/bin/env python
"""分割配送のビジュアル確認用テストデータ生成"""

import json

def create_test_data():
    """分割配送のテストデータを生成"""
    
    # テストケース1: 単純な分割配送
    test1 = {
        "depot": {
            "address": "東京駅",
            "lat": 35.6812,
            "lon": 139.7671
        },
        "deliveries": [
            {
                "id": 1,
                "address": "新宿駅",
                "lat": 35.6896,
                "lon": 139.7006,
                "demand": 250,  # 車両容量100を超える
                "priority": 5,
                "service_time": 10
            }
        ],
        "vehicles": [
            {
                "name": "車両1",
                "capacity": 100
            }
        ]
    }
    
    # テストケース2: 複数配送先と分割
    test2 = {
        "depot": {
            "address": "東京駅",
            "lat": 35.6812,
            "lon": 139.7671
        },
        "deliveries": [
            {
                "id": 1,
                "address": "新宿駅",
                "lat": 35.6896,
                "lon": 139.7006,
                "demand": 150,  # 2回に分割
                "priority": 5,
                "service_time": 10
            },
            {
                "id": 2,
                "address": "渋谷駅",
                "lat": 35.6580,
                "lon": 139.7016,
                "demand": 80,   # 1回で配送可能
                "priority": 5,
                "service_time": 10
            },
            {
                "id": 3,
                "address": "品川駅",
                "lat": 35.6284,
                "lon": 139.7387,
                "demand": 60,   # 1回で配送可能
                "priority": 5,
                "service_time": 10
            }
        ],
        "vehicles": [
            {
                "name": "車両1",
                "capacity": 100
            }
        ]
    }
    
    print("=== テストケース1: 単純な分割配送 ===")
    print("配送先1つ、荷物量250、車両容量100")
    print("期待される結果: 3回に分けて配送（100+100+50）")
    print("\nコピーして使用:")
    print(json.dumps(test1, ensure_ascii=False, indent=2))
    
    print("\n\n=== テストケース2: 複数配送先と分割 ===")
    print("配送先3つ、荷物量150/80/60、車両容量100")
    print("期待される結果: 配送先1は2回に分割")
    print("\nコピーして使用:")
    print(json.dumps(test2, ensure_ascii=False, indent=2))
    
    print("\n\n=== 使い方 ===")
    print("1. ブラウザの開発者ツールを開く（F12）")
    print("2. コンソールタブで以下を実行:")
    print("   const testData = <上記のJSONをコピー>;")
    print("   // デポ設定")
    print("   depot = testData.depot;")
    print("   deliveries = testData.deliveries;")
    print("   updateMap();")
    print("3. 車両容量を100に設定")
    print("4. ルートを最適化")

if __name__ == "__main__":
    create_test_data()