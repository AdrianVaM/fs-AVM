from flask import Flask, request, render_template, url_for

app = Flask(__name__)

@app.route('/')
def hello_world():
    return render_template("index.html")

@app.route("/a", methods=["GET","POST"])
def form():
    if request.method == "POST":
        name = request.form.get("name")
        password = request.form.get("password")
        return render_template("form.html", name=name, password=password)
    else:
        return render_template("form.html")

if __name__ == '__main__':
    app.run("0.0.0.0",debug=True)