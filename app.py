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
    return render_template("history.html", menu=menu)


@app.route("/notes")
def notes():
    args = request.args
    id = args.get("id")
    return render_template("notes.html", menu=menu, id=id)


@app.route("/convert", methods=["GET", "POST"])
def convert():
    if request.method == "POST":
        auth = request.form["auth"]
        kind = request.form["kind"]
        file = request.files["file"]

        tmp = tempfile.TemporaryFile()
        file.save(tmp)

        # начинаем с начала, потому что после save указатель в конце
        tmp.seek(0)

        convertor = SaluteConvertor()
        convertor.get_auth_token(auth)

        if kind == "sync":
            result = convertor.sync_recognize(file.mimetype, tmp)

            text = ""
            if result != None and len(result) > 0:
                text = result[0]
                for i in range(1, len(result)):
                    text += result[i]
            return {"text": text, "redirect_url": "/notes"}

        elif kind == "async":
            file_id = convertor.upload_file(file.mimetype, tmp)
            task_id = convertor.create_task(file_id, file.mimetype)

            return {"file_id": file_id, "task_id": task_id}

    return render_template("convert.html", menu=menu)


@app.route("/check", methods=["GET", "POST"])
def check():
    if request.method == "POST":
        auth = request.form["auth"]
        task_id = request.form["task_id"]

        convertor = SaluteConvertor()
        convertor.get_auth_token(auth)

        task = convertor.check_task(task_id)

        return {"status": task.get("status", "")}


@app.route("/download", methods=["GET", "POST"])
def download():
    if request.method == "POST":
        auth = request.form["auth"]
        task_id = request.form["task_id"]

        convertor = SaluteConvertor()
        convertor.get_auth_token(auth)

        task = convertor.check_task(task_id)
        if task.get("status", "") != "DONE":
            return

        text, words = convertor.download_result(task.get("response_file_id", ""))

        return {"text": text, "words": words, "redirect_url": "/notes"}


if __name__ == "__main__":
    app.run(debug=True)
