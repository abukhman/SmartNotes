import os
import tempfile

from flask import Flask, render_template, request

app = Flask(__name__)
app.config["SECRET_KEY"] = "very long and powerful secretkey"
app.config["UPLOAD_PATH"] = "static/uploads"
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024  # 100 МБ
app.config["CERT_PATH"] = "certs.pem"

from convertor.salute_convertor import SaluteConvertor

if not os.path.exists(app.config["UPLOAD_PATH"]):
    os.mkdir(app.config["UPLOAD_PATH"])

menu = [
    {"name": "Home", "url": "/"},
    {"name": "History", "url": "history"},
    {"name": "Convert", "url": "convert"},
]


@app.route("/")
def home():
    return render_template("home.html", menu=menu)


@app.route("/history")
def history():
    files = os.listdir(app.config["UPLOAD_PATH"])
    return render_template("history.html", menu=menu, files=files)


@app.route("/notes")
def notes():
    args = request.args
    id = args.get("id")
    return render_template("notes.html", menu=menu, id=id)


@app.route("/convert", methods=["GET", "POST"])
def convert():
    if request.method == "POST":
        kind = "sync"
        auth = request.form["auth"]
        file = request.files["file"]
        tmp = tempfile.TemporaryFile()

        file.save(tmp)
        # начинаем с начала, потому что после save указатель в конце
        tmp.seek(0)

        conv = SaluteConvertor()
        conv.get_token(auth)

        if kind == "sync":
            result = conv.sync_recognition(file.mimetype, tmp)

            text = ""
            if result != None and len(result) > 0:
                text = result[0]
                for i in range(1, len(result)):
                    text += result[i]
            return {"text": text, "redirect_url": "/notes"}
        else:
            task_id = conv.async_recognition(file.mimetype, tmp)

            return {"task_id": task_id}

    return render_template("convert.html", menu=menu)


@app.route("/check_task", methods=["GET", "POST"])
def check_task():
    if request.method == "POST":
        auth = request.form["auth"]
        task_id = request.form["task_id"]

        conv = SaluteConvertor()
        conv.login(auth)

        result = conv.check_and_download(task_id)
        if result != None and len(result) > 0:
            text = result[0]
            for i in range(1, len(result)):
                text += result[i]
            return {"text": text, "redirect_url": "/notes"}
        return {}


if __name__ == "__main__":
    app.run(debug=True)
