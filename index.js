const express = require("express");
const app = express();
const admin = require("firebase-admin");
const cors = require("cors");
const { ObjectId } = require("mongodb");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

// index.js
const decoded = Buffer.from(process.env.FIREVASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);  /* here is the firebase jwt properties */

const port = 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Firebase Admin SDK ---
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// --- Token Authorization Middleware ---
const authorizariontoken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "Token not found!" });
  }

  const finaltoken = token.split(" ")[1];
  try {
    await admin.auth().verifyIdToken(finaltoken);
    next();
  } catch (error) {
    res.status(401).send("Unauthorized access!");
  }
};

// --- MongoDB Connection ---
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.exfto5h.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// --- Server Root ---
app.get("/", (req, res) => {
  res.send("AI Inventory Project Server Running ✅");
});

async function run() {
  try {
    await client.connect();

    // --- Collections ---
    const db = client.db("ai_model_inventory_manager");
    const modelscollections = db.collection("models");
    const userscollections = db.collection("users");
    const Purchasecollections = db.collection("Purchase");

    // --- Recent Models ---
    app.get("/recent-model", async (req, res) => {
      const cursor = modelscollections.find().sort({ createdAt: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    // --- Get All Models ---
    app.get("/models", async (req, res) => {
      const cursor = modelscollections.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // --- Add Model ---
    app.post("/models", async (req, res) => {
      const newmodel = req.body;
      const result = await modelscollections.insertOne(newmodel);
      res.send(result);
    });

    // --- Get Model by ID ---
    app.get("/models/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await modelscollections.findOne(query);
        if (!result) return res.status(404).send({ message: "Model not found" });
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // --- Update Model ---
    app.patch("/models/:id", async (req, res) => {
      const id = req.params.id;
      const updateproduct = req.body;
      const query = { _id: new ObjectId(id) };
      const update = { $set: updateproduct };
      const result = await modelscollections.updateOne(query, update);
      res.send(result);
    });

    // --- Delete Model ---
    app.delete("/models/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await modelscollections.deleteOne(query);
      res.send(result);
    });

    // --- My Models (by email, requires auth) ---
    app.get("/my-models", authorizariontoken, async (req, res) => {
      const email = req.query.email;
      const result = await modelscollections.find({ createdBy: email }).toArray();
      res.send(result);
    });

    // --- Purchase Routes ---
    app.post("/my-Purchase", async (req, res) => {
      const purchaseData = req.body;
      const result = await Purchasecollections.insertOne(purchaseData);
      res.send(result);
    });

    app.get("/my-Purchase", async (req, res) => {
      const email = req.query.email;
      const result = await Purchasecollections.find({ dowloded_by: email }).toArray();
      res.send(result);
    });

    app.post("/my-Purchase/:id", async (req, res) => {
      try {
        const purchaseData = req.body;
        const id = req.params.id;
        const result = await Purchasecollections.insertOne(purchaseData);

        const filter = { _id: new ObjectId(id) };
        const update = { $inc: { purchased: 1 } };
        const updatepurchased = await modelscollections.updateOne(filter, update);

        res.send({ result, updatepurchased });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // --- User Routes ---
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userscollections.insertOne(user);
      res.send(result);
    });

    // --- Search Functionality ---
    app.get("/search", async (req, res) => {
      const search_text = req.query.search;
      const result = await modelscollections
        .find({ name: { $regex: search_text, $options: "i" } })
        .toArray();
      res.send(result);
    });

    // --- Framework Filter ---
    app.get("/findmodels", async (req, res) => {
      try {
        const { framework } = req.query; // e.g. ?framework=TensorFlow,PyTorch
        let query = {};

        if (framework && framework.length > 0) {
          const frameworks = framework.split(",").map((f) => f.trim());
          // Case-insensitive match
          query.framework = { $in: frameworks.map(f => new RegExp(`^${f}$`, "i")) };
        }

        const result = await modelscollections.find(query).toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching models:", err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // --- DB Connection Test ---
    // await client.db("admin").command({ ping: 1 });
    console.log(" Connected to MongoDB successfully!");
  } finally {
    // Keeping the connection alive
  }
}

run().catch(console.dir);

// --- Start Server ---
app.listen(port, () => {
  console.log(` Server running on http://localhost:${port}`);
});
