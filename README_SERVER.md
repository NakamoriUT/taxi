# サーバー起動手順

## 1. 新しいターミナルウィンドウを開く

## 2. ディレクトリに移動
```bash
cd /Users/nakamoritomomasa/Documents/配送ルート/delivery-route-optimizer
```

## 3. サーバーを起動
```bash
python app.py
```

または、作成したスクリプトを使用：
```bash
./start_server.sh
```

## 4. ブラウザでアクセス
以下のURLのいずれかにアクセス：
- http://localhost:5000
- http://127.0.0.1:5000

## トラブルシューティング

### ポートが使用中の場合
別のポートで起動：
```bash
FLASK_RUN_PORT=8000 python app.py
```
この場合は http://localhost:8000 にアクセス

### 依存関係の確認
```bash
pip install flask requests ortools
```

### サーバーが起動しているか確認
```bash
curl http://localhost:5000
```

## サーバーの停止
ターミナルで `Ctrl+C` を押す