const express = require("express")
const path = require("path");
const app = express();
app.use(express.urlencoded({ extended: false }));
const server = require("http").Server(app);
const { v4: uuidv4 } = require("uuid");

const { ExpressPeerServer } = require("peer");
const opinions = {
    debug: true,
}
const sqlite3 = require("sqlite3").verbose()
const db_name = path.join(__dirname, "data", "crud.db")
const appdb = new sqlite3.Database(db_name, err => {
    if (err) {
        return console.error(err.message)
    }
    console.log("Connected to database successfully")
})

app.set("view engine", "ejs");
const io = require("socket.io")(server, {
    cors: {
        origin: '*'
    }
});
app.set("views", path.join(__dirname, "/views"));


app.use("/peerjs", ExpressPeerServer(server, opinions));
app.use(express.static('public'));

app.get("/", (req, res) => {
    res.render("home");
})
app.get("/register", (req, res) => {
    res.render("register");
})
app.get("/room/:room", (req, res) => {
    res.render("room", { roomId: req.params.room });
})
app.get("/logout", (req, res) => {
    res.redirect("/")
})


app.post("/register", (req, res) => {
    const sql = "INSERT INTO user (name, email, password) VALUES (?, ?, ?)";
    const id = [req.body.Username, req.body.Email, req.body.Password];
    appdb.run(sql, id, (err) => {
        // if (err) ...
        res.redirect("/");
    });
});

app.post("/", (req, res) => {
    const { Email, Password } = req.body;

    appdb.get("SELECT * FROM user WHERE email = ?", [Email], (err, user) => {
        if (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
            return;
        }

        if (!user || user.password !== Password) {
            res.status(401).send("Invalid email or password");
            return;
        }
        res.render("room", { roomId: req.params.room });
    });
});

app.get("/show", (req, res) => {
    const sql = "SELECT * FROM user ";
    appdb.all(sql, [], (err, rows) => {
        if (err) {
            return console.error(err.message);
        }
        res.render("showdata", { model: rows });
    });
});

app.get("/editdata/:id", (req, res) => {
    const id = req.params.id;
    const sql = "SELECT * FROM user WHERE ID = ?";
    appdb.get(sql, id, (err, row) => {
        // if (err) ...
        console.log(row)
        res.render("editdata", { model: row });
    });
});
// POST/edit/5
app.post("/editdata/:id", (req, res) => {
    const id = req.params.id;
    const book = [req.body.Username, req.body.Email, req.body.Password, id];
    const sql =
        "UPDATE user SET name = ?, email = ?, password = ? WHERE (ID = ?)";
    appdb.run(sql, book, (err) => {
        if (err) {
            return console.error(err.message);
        }
        res.redirect("showdata");
    });
});

app.post("/delete/:id", (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM user WHERE ID = ?";
    appdb.run(sql, id, function(err) {
        if (err) {
            console.log(err);
            return res.status(500).send("An error occurred while deleting the user.");
        }
        res.redirect("showdata")
    });
});



io.on("connection", (socket) => {
    socket.on("join-room", (roomId, userId, userName) => {
        socket.join(roomId);
        setTimeout(() => {
            socket.to(roomId).broadcast.emit("user-connected", userId);
        }, 1000)
        socket.on("message", (message) => {
            io.to(roomId).emit("createMessage", message, userName);
        });
    });
});
server.listen(process.env.PORT || 3030);
