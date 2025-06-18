from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    return '<h1>テストサーバーが動作しています！</h1><p>ポート8888で起動中</p>'

if __name__ == '__main__':
    print("シンプルなテストサーバーを起動します...")
    print("http://localhost:8888 でアクセスしてください")
    app.run(debug=False, host='127.0.0.1', port=8888)