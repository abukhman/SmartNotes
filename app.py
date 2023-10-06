from flask import Flask, render_template


app = Flask(__name__)
menu = [{"name": "Home", "url": "/"},
        {"name": "History", "url": "history"},
        {"name": "Convert", "url": "convert"}]

@app.route("/")
def home():
    return render_template('home.html', menu=menu)

@app.route("/history")
def history():
    return render_template('history.html', menu=menu)

@app.route("/convert")
def generate():
    return render_template('convert.html', menu=menu)

if __name__ == "__main__":
    app.run(debug=True)
