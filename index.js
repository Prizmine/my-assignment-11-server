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

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const token = authorization.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    console.log(decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send(err);
  }
  // console.log(token);
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

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const user = await allRolesCollection.findOne({ email });

      if (user?.role !== "admin") {
        return res.status(403).send({ message: "Admin only" });
      }
      next();
    };


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

    app.get("/approved-contests", async (req, res) => {
      const query = {};
      if (req.query.status) {
        query.status = req.query.status;
      }
      const result = await contestCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/contests", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const size = parseInt(req.query.size) || 10;
      const query = {};

      if (req.query.status) {
        query.status = req.query.status;
      }

      if (req.query.email) {
        query.creatorEmail = req.query.email;
      }
      const skip = (page - 1) * size;

      try {
        const contests = await contestCollection
          .find(query)
          .skip(skip)
          .limit(size)
          .toArray();
        const totalContestsCount = await contestCollection.countDocuments(
          query
        );

        res.send({
          contests: contests,
          count: totalContestsCount,
          itemsPerPage: size,
          currentPage: page,
        });
      } catch (error) {
        console.error("Error fetching contests with pagination:", error);
        res
          .status(500)
          .send({ message: "Server error, failed to fetch data." });
      }
    });

    app.delete("/contests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/edit-contests/:id", async (req, res) => {
      const id = req.params.id;

      const filter = {
        _id: new ObjectId(id),
        creatorEmail: req.body.creatorEmail,
      };

      const updatedData = {
        $set: {
          name: req.body.name,
          image: req.body.image,
          description: req.body.description,
          price: req.body.price,
          prize: req.body.prize,
          taskInstruction: req.body.taskInstruction,
          type: req.body.type,
          deadline: req.body.deadline,
        },
      };

      try {
        const result = await contestCollection.updateOne(filter, updatedData);

        if (result.matchedCount === 0) {
          return res.status(404).send({
            message: "Contest not found or you are not authorized to edit.",
          });
        }

        res.send({ modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error("Error updating contest:", error);
        res
          .status(500)
          .send({ message: "Internal server error during update." });
      }
    });

    app.get("/contests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestCollection.findOne(query);
      res.send(result);
    });

    app.patch("/contests/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status,
        },
      };
      const result = await contestCollection.updateOne(query, updatedDoc);
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
      const query = {};
      if (req.query.email) {
        query.email = req.query.email;
      }

      const result = await allRolesCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/roles/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const role = req.body.role;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: role,
        },
      };
      const result = await allRolesCollection.updateOne(query, updatedDoc);
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
