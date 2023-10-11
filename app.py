import os

from flask import Flask, render_template, request, redirect, url_for, send_from_directory
from werkzeug.utils import secure_filename


app = Flask(__name__)
app.config['SECRET_KEY'] = "very long and powerful secretkey"
app.config['UPLOAD_PATH'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  #100 МБ

if not os.path.exists(app.config['UPLOAD_PATH']):
    os.mkdir(app.config['UPLOAD_PATH'])

menu = [{"name": "Home", "url": "/"},
        {"name": "History", "url": "history"},
        {"name": "Convert", "url": "convert"}]


@app.route('/uploads/<filename>')
def upload(filename):
    return send_from_directory(app.config['UPLOAD_PATH'], filename)

@app.route("/")
def home():
    return render_template('home.html', menu=menu)

@app.route("/history")
def history():
    files = os.listdir(app.config['UPLOAD_PATH'])
    return render_template('history.html', menu=menu, files=files)

@app.route("/convert", methods=['GET', 'POST'])
def convert():
    if request.method == 'POST':
        file = request.files['file']
        filename = secure_filename(file.filename)
        if filename != '':
            file.save(os.path.join(app.config['UPLOAD_PATH'], filename))
            return render_template('convert.html', menu=menu, filename=filename)
    return render_template('convert.html', menu=menu)

if __name__ == "__main__":
    app.run(debug=True)
