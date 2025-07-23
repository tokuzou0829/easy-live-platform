const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  path: "/chat/"
});
const cors = require("cors");
app.use(cors({
  origin: ['*'],
  credentials: true,
  optionsSuccessStatus: 200
}))
const userStore = {};

app.use(cors());
app.use(express.json());

io.on("connection", (socket) => {
  socket.on("join", async (msg) => {
    let usrobj = {};
    usrobj = {
        userId: socket.id,
        room: msg.roomId,
        name: msg.name,
        image: msg.image

    };
    userStore[socket.id] = usrobj;

    socket.join(msg.roomId);

    socket.on("disconnect", () => {
      delete userStore[socket.id];
    });
  });

  socket.on("post", (msg) => {
    const store = userStore[socket.id];
    io.to(store.room).emit("message", { "name": store.name, "text": msg.text, "image": store.image });
  });
});

app.get("/chat-auth/health", async (req, res) => {
  return res.status(200).json({health:"ok"});
});

const PORT = process.env.PORT || 3002;
http.listen(PORT, () => {
  console.log(`Chat server listening on port ${PORT}`);
});
