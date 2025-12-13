const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const admin = require("firebase-admin");

const serviceAccount = require("./serviceKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middlewares
app.use(express.json());
app.use(cors());

const verifyAdmin = async (req, res, next) => {
  const user = await usersCollection.findOne({ email: req.user.email });
  if (user?.role !== "admin") {
    return res.status(403).send({ message: "Admin only" });
  }
  next();
};

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) return res.status(401).send({ message: "unauthorized access" });

  const token = authorization.split(" ")[1];
  if (!token) return res.status(401).send({ message: "Token missing" });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.email) throw new Error("Invalid token");
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    console.log("Token verification failed:", err.message);
    return res.status(401).send({ message: "Invalid token", error: err.message });
  }
};

const uri = `mongodb+srv://contest-hub:${process.env.DB_PASSWORD}@algo-nova.ntsxvj0.mongodb.net/?appName=Algo-Nova`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

async function run() {
  try {
    await client.connect();
    const db = client.db("contest-hub");
    const contestCollection = db.collection("contests");
    const allRolesCollection = db.collection("roles");

    // contest related apis

    app.post("/contests", async (req, res) => {
      const contest = req.body;
      contest.createdAt = new Date();
      contest.status = "pending";
      const query = {
        creatorEmail: contest.creatorEmail,
        name: contest.name,
      };

      let contestExist = await contestCollection.findOne(query);

      if (contestExist) {
        return res.send({ message: "contest already exist" });
      }

      const result = await contestCollection.insertOne(contest);
      res.send(result);
    });

    app.get("/contests", async (req, res) => {
      const query = {};
      if (req.query.status) {
        query.status = req.query.status;
      }
      const result = await contestCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/contests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestCollection.findOne(query);
      res.send(result);
    });

    // roles related apis

    app.post("/roles", async (req, res) => {
      const data = req.body;
      data.createdAt = new Date();
      data.role = "user";
      const query = {
        email: data.email,
      };
      const dataExists = await allRolesCollection.findOne(query);
      if (dataExists) {
        return res.send({ message: "user already exist" });
      }

      const result = await allRolesCollection.insertOne(data);
      res.send(result);
    });

    app.get("/roles", async (req, res) => {
      const result = await allRolesCollection.find().toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
