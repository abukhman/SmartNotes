import os
import tempfile

from flask import Flask, render_template, request, redirect, url_for, send_from_directory
from werkzeug.utils import secure_filename

from converter.salute_converter import SaluteConverter


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
        auth = request.form['auth_data']
        file = request.files['file']
        tmp = tempfile.TemporaryFile()

        # tmp_path = os.path.join(tempfile.gettempdir(), tmp.name)
        # print(tmp_path)

        file.save(tmp)
        # начинаем с начала, потому что после save указатель в конце
        tmp.seek(0)

        conv = SaluteConverter()
        conv.login(auth)
        result = conv.sync_recognition(file.mimetype, tmp)
        if result != None and len(result) > 0:
            text = result[0]
            for i in range(1, len(result)):
                text += result[i]
            return render_template('convert.html', menu=menu, filename="tts.ogg", text=text)

        return render_template('convert.html', menu=menu, filename="tts.ogg", text="")
    return render_template('convert.html', menu=menu)

if __name__ == "__main__":
    app.run(debug=True)
