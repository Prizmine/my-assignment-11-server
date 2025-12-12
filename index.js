const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

// middlewares
app.use(express.json());
app.use(cors());

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
// fwY1ifykJFELyVpU

async function run() {
  try {
    await client.connect();
    const db = client.db("contest-hub");
    const contestCollection = db.collection("contests");

    app.post("/contests", async (req, res) => {
      const contest = req.body;
      contest.createdAt = new Date();
      const id = contest._id;

      const contestExist = contestCollection.findOne({ _id: new ObjectId(id) });

      if (contestExist) {
        return res.send({ message: "contest already exist" });
      }

      const result = await contestCollection.insertOne(contest);
      res.send(result);
    });

    app.get("/contests", async (req, res) => {
      const result = contestCollection.find().toArray();
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
